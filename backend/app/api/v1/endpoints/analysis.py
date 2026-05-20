from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
from datetime import datetime, timezone
from typing import List
from app.core.security import get_current_user
from app.core.models import User
from app.models.document import DocumentStatus, Document
from app.models.analysis import AnalysisReport
from app.services import firestore
from app.services.cache import check_rate_limit
from app.utils.sse import generate_sse_event
from app.api.v1.schemas.analysis import AnalysisReportResponse, AnalysisProgressEvent
from app.agents.orchestrator import OrchestratorAgent
from app.core.errors import DocumentNotFoundException, UnauthorizedDocumentAccess, AnalysisInProgressException
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyzeRequest(BaseModel):
    document_ids: List[str]


@router.post("/analyze")
async def start_analysis(
    request: AnalyzeRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Triggers analysis on one or more documents.
    All documents are analyzed together as a bundle (same property context).
    """
    # Per-user analyze throttle (Redis-backed; no-op when Redis is disabled).
    if not await check_rate_limit(current_user.uid, action="analyze", max_requests=30, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Analysis rate limit exceeded. Try again later.",
        )

    if not request.document_ids:
        raise HTTPException(status_code=400, detail="No document IDs provided.")
    if len(request.document_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 documents at once.")

    # Verify all documents belong to user and exist
    documents = []
    for doc_id in request.document_ids:
        doc_data = await firestore.get_document_entry(doc_id)
        if not doc_data:
            raise DocumentNotFoundException(doc_id)
        if doc_data.get("user_id") != current_user.uid:
            raise UnauthorizedDocumentAccess(doc_id)
        documents.append(Document(**doc_data))

    # Use the first document's state/district as context for all
    state = ""
    district = ""
    for doc in documents:
        if doc.state:
            state = doc.state
        if doc.district:
            district = doc.district
        if state and district:
            break

    # Start analysis for each document
    orchestrator = OrchestratorAgent()
    for doc in documents:
        asyncio.create_task(orchestrator.start_analysis(
            document_id=doc.id,
            state_override=state,
            district_override=district,
        ))
        logger.info(f"Analysis triggered for document {doc.id} (state={state}, district={district}).")

    return {"message": f"Analysis started for {len(documents)} document(s).", "document_ids": request.document_ids}

@router.get("/stream/{document_id}", response_class=EventSourceResponse)
async def stream_analysis_progress(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Streams real-time analysis progress for a given document using Server-Sent Events (SSE).
    Clients can subscribe to this endpoint to receive updates as agents complete their tasks.
    """
    document_data = await firestore.get_document_entry(document_id)
    if not document_data:
        raise DocumentNotFoundException(document_id)
    
    if document_data.get("user_id") != current_user.uid:
        raise UnauthorizedDocumentAccess(document_id)

    document = Document(**document_data)

    if document.status in [DocumentStatus.COMPLETED, DocumentStatus.FAILED]:
        final_message = "Analysis completed." if document.status == DocumentStatus.COMPLETED else "Analysis failed."
        final_data = {}
        if document.status == DocumentStatus.COMPLETED:
            report_data = await firestore.get_analysis_report(document_id)
            if report_data:
                final_data = AnalysisReport(**report_data).dict()
        
        async def immediate_event_generator():
            event_payload = AnalysisProgressEvent(
                event_type="analysis_status",
                data={"status": document.status.value, "report": final_data},
                message=final_message,
                progress=100,
                timestamp=document.updated_at.isoformat() + "Z" if hasattr(document.updated_at, 'isoformat') else str(document.updated_at)
            ).model_dump()
            yield generate_sse_event(event_payload["event_type"], event_payload["data"], event_payload["message"], event_payload["progress"])
        return EventSourceResponse(immediate_event_generator())

    async def event_generator():
        last_event_timestamp = None
        # Send initial connected message
        yield generate_sse_event("connected", {"document_id": document_id}, "Connected to analysis stream.", 0)

        # Hard cap on stream lifetime; must stay under Cloud Run --timeout (currently 300s).
        STREAM_TIMEOUT_S = 280
        HEARTBEAT_EVERY_S = 25   # keep proxies / client connections warm
        start = datetime.now(timezone.utc)
        last_heartbeat = start

        while True:
            now = datetime.now(timezone.utc)
            if (now - start).total_seconds() > STREAM_TIMEOUT_S:
                yield generate_sse_event(
                    "stream_timeout",
                    {"document_id": document_id},
                    "Stream timed out. Please refresh.",
                    100,
                )
                break

            # Fetch events from Firestore subcollection
            events = await firestore.get_document_events_since(document_id, last_event_timestamp)
            
            for event_data in events:
                event_payload = AnalysisProgressEvent(
                    event_type=event_data.get("event_type", "progress_update"),
                    data=event_data.get("data", {}),
                    message=event_data.get("message", "Processing..."),
                    progress=event_data.get("progress", 0),
                    timestamp=event_data.get("timestamp", datetime.now(timezone.utc).isoformat() + "Z")
                ).model_dump()
                yield generate_sse_event(event_payload["event_type"], event_payload["data"], event_payload["message"], event_payload["progress"])
                last_event_timestamp = event_data["timestamp"] # Update last timestamp

            # Check for overall document status update
            updated_doc_data = await firestore.get_document_entry(document_id)
            if updated_doc_data:
                updated_document = Document(**updated_doc_data)
                if updated_document.status in [DocumentStatus.COMPLETED, DocumentStatus.FAILED]:
                    if updated_document.status == DocumentStatus.COMPLETED:
                        report_data = await firestore.get_analysis_report(document_id)
                        final_data = AnalysisReport(**report_data).model_dump() if report_data else {}
                        event_payload = AnalysisProgressEvent(
                            event_type="analysis_completed",
                            data={"report": final_data},
                            message="Analysis completed successfully.",
                            progress=100,
                            timestamp=updated_document.updated_at.isoformat() + "Z" if hasattr(updated_document.updated_at, 'isoformat') else str(updated_document.updated_at)
                        ).model_dump()
                        yield generate_sse_event(event_payload["event_type"], event_payload["data"], event_payload["message"], event_payload["progress"])
                    else: # FAILED
                        # Get the most recent event data to find the failure reason, if available
                        latest_events = await firestore.get_document_events_since(document_id, since_timestamp=None)
                        failure_reason = "An error occurred during analysis."
                        for ev in reversed(latest_events): # Check latest events for a failure message
                            if ev.get("event_type") == "analysis_failed":
                                failure_reason = ev.get("message", failure_reason)
                                break

                        event_payload = AnalysisProgressEvent(
                            event_type="analysis_failed",
                            data={"reason": failure_reason},
                            message="Analysis failed.",
                            progress=100,
                            timestamp=updated_document.updated_at.isoformat() + "Z" if hasattr(updated_document.updated_at, 'isoformat') else str(updated_document.updated_at)
                        ).model_dump()
                        yield generate_sse_event(event_payload["event_type"], event_payload["data"], event_payload["message"], event_payload["progress"])
                    break # Exit loop as analysis is complete/failed

            # Heartbeat to keep the connection alive if no events arrived.
            if (now - last_heartbeat).total_seconds() >= HEARTBEAT_EVERY_S:
                yield ": ping\n\n"   # SSE comment line; ignored by clients but keeps socket open
                last_heartbeat = now

            await asyncio.sleep(1) # Poll every 1 second for new events

    return EventSourceResponse(event_generator())

@router.get("/report/{document_id}", response_model=AnalysisReportResponse)
async def get_analysis_report(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the final analysis report for a document once its processing is complete.
    Ensures the document belongs to the authenticated user.
    """
    document_data = await firestore.get_document_entry(document_id)
    if not document_data:
        raise DocumentNotFoundException(document_id)
    
    if document_data.get("user_id") != current_user.uid:
        raise UnauthorizedDocumentAccess(document_id)

    document = Document(**document_data)
    if document.status != DocumentStatus.COMPLETED:
        raise AnalysisInProgressException(document_id)

    report_data = await firestore.get_analysis_report(document_id)
    if not report_data:
        # This case should ideally not happen if status is COMPLETED and report is saved.
        # Could indicate an issue with report saving.
        logger.error(f"Analysis report not found for document {document_id} despite status being COMPLETED.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis report not found.")

    report = AnalysisReport(**report_data)
    return AnalysisReportResponse(report=report)
