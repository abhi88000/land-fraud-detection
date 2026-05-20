from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse
from typing import List, Optional
from app.core.security import get_current_user
from app.core.models import User
from app.models.bundle import Bundle, BundleStatus
from app.models.document import Document, DocumentStatus
from app.api.v1.schemas.bundles import BundleCreateResponse, BundleListResponse, BundleDetailResponse, BundleReportResponse
from app.api.v1.schemas.analysis import AnalysisProgressEvent
from app.services import gcs, firestore
from app.services.cache import check_rate_limit
from app.agents.orchestrator import OrchestratorAgent
from app.models.analysis import AnalysisReport
from app.utils.sse import generate_sse_event
from app.core.errors import DocumentNotFoundException
import asyncio
import uuid
import re
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/create", response_model=BundleCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_bundle(
    state: str = Form(...),
    district: str = Form(...),
    land_type: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """Create a document bundle with multiple files sharing the same location and land type."""
    if not await check_rate_limit(current_user.uid, action="bundle_create", max_requests=30, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Bundle creation rate limit exceeded. Try again later.",
        )
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per bundle.")

    allowed_content_types = ["application/pdf", "image/jpeg", "image/png", "image/tiff"]
    MAX_FILE_SIZE = 20 * 1024 * 1024

    bundle_id = str(uuid.uuid4())
    user_id = current_user.uid
    document_ids = []

    # Upload each file
    for file in files:
        if not file.content_type or file.content_type not in allowed_content_types:
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.filename}. Allowed: PDF, JPEG, PNG, TIFF.")

        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File {file.filename} exceeds 20MB limit.")

        document_id = str(uuid.uuid4())
        safe_filename = re.sub(r'[^\w.\-]', '_', file.filename or 'document')
        file_extension = safe_filename.rsplit('.', 1)[-1] if '.' in safe_filename else 'bin'
        gcs_file_path = f"users/{user_id}/documents/{document_id}.{file_extension}"

        try:
            gcs_uri = await gcs.upload_file(gcs_file_path, file_content, file.content_type)
        except Exception as e:
            logger.error(f"Error uploading file {file.filename} to GCS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload {file.filename}")

        document = Document(
            id=document_id,
            user_id=user_id,
            file_name=file.filename,
            gcs_path=gcs_uri,
            content_type=file.content_type,
            status=DocumentStatus.PENDING,
            state=state,
            district=district,
            land_type=land_type,
            bundle_id=bundle_id,
        )
        await firestore.create_document_entry(document_id, document.dict())
        document_ids.append(document_id)

    # Create the bundle
    bundle = Bundle(
        id=bundle_id,
        user_id=user_id,
        name=f"{land_type} land in {district}, {state}",
        state=state,
        district=district,
        land_type=land_type,
        status=BundleStatus.CREATED,
        document_ids=document_ids,
    )
    await firestore.create_bundle_entry(bundle_id, bundle.dict())

    logger.info(f"Bundle {bundle_id} created with {len(document_ids)} documents.")
    return BundleCreateResponse(bundle_id=bundle_id, message=f"Bundle created with {len(document_ids)} documents.")


@router.get("", response_model=BundleListResponse)
async def list_bundles(current_user: User = Depends(get_current_user)):
    """List all bundles for the current user."""
    bundles_data = await firestore.list_bundles_for_user(current_user.uid)
    bundles = [Bundle(**b) for b in bundles_data]
    return BundleListResponse(bundles=bundles)


@router.get("/{bundle_id}", response_model=BundleDetailResponse)
async def get_bundle(bundle_id: str, current_user: User = Depends(get_current_user)):
    """Get bundle details including its documents."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")
    bundle = Bundle(**bundle_data)
    docs = await firestore.list_documents_for_bundle(bundle_id)
    return BundleDetailResponse(bundle=bundle, documents=docs)


@router.post("/{bundle_id}/analyze")
async def analyze_bundle(bundle_id: str, current_user: User = Depends(get_current_user)):
    """Trigger analysis for all documents in the bundle."""
    if not await check_rate_limit(current_user.uid, action="bundle_analyze", max_requests=30, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Analysis rate limit exceeded. Try again later.",
        )
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    bundle = Bundle(**bundle_data)
    if bundle.status == BundleStatus.ANALYZING:
        raise HTTPException(status_code=409, detail="Analysis already in progress.")

    # Reset status for retry
    await firestore.update_bundle_entry(bundle_id, {"status": BundleStatus.CREATED.value})

    orchestrator = OrchestratorAgent()
    asyncio.create_task(orchestrator.analyze_bundle(bundle_id))
    logger.info(f"Bundle analysis triggered for {bundle_id}")

    return {"message": "Analysis started.", "bundle_id": bundle_id}


@router.put("/{bundle_id}")
async def update_bundle(
    bundle_id: str,
    state: str = Form(None),
    district: str = Form(None),
    land_type: str = Form(None),
    current_user: User = Depends(get_current_user),
):
    """Update bundle metadata (state, district, land_type)."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    updates = {}
    if state is not None:
        updates["state"] = state
    if district is not None:
        updates["district"] = district
    if land_type is not None:
        updates["land_type"] = land_type

    if updates:
        # Also update the bundle name
        new_state = updates.get("state", bundle_data.get("state", ""))
        new_district = updates.get("district", bundle_data.get("district", ""))
        new_land_type = updates.get("land_type", bundle_data.get("land_type", ""))
        updates["name"] = f"{new_land_type} land in {new_district}, {new_state}"
        await firestore.update_bundle_entry(bundle_id, updates)

    updated = await firestore.get_bundle_entry(bundle_id)
    return {"bundle": updated}


@router.get("/{bundle_id}/stream", response_class=EventSourceResponse)
async def stream_bundle_progress(bundle_id: str, current_user: User = Depends(get_current_user)):
    """Stream real-time analysis progress for a bundle."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    bundle = Bundle(**bundle_data)

    # If already done, return immediately
    if bundle.status in [BundleStatus.COMPLETED, BundleStatus.FAILED]:
        final_msg = "Analysis completed." if bundle.status == BundleStatus.COMPLETED else "Analysis failed."
        final_data = {}
        if bundle.status == BundleStatus.COMPLETED:
            report_data = await firestore.get_bundle_report(bundle_id)
            if report_data:
                final_data = report_data

        async def immediate():
            payload = AnalysisProgressEvent(
                event_type="analysis_completed" if bundle.status == BundleStatus.COMPLETED else "analysis_failed",
                data={"report": final_data},
                message=final_msg,
                progress=100,
                timestamp=datetime.now(timezone.utc).isoformat() + "Z",
            ).model_dump()
            yield generate_sse_event(payload["event_type"], payload["data"], payload["message"], payload["progress"])

        return EventSourceResponse(immediate())

    async def event_generator():
        last_ts = None
        yield generate_sse_event("connected", {"bundle_id": bundle_id}, "Connected to bundle stream.", 0)

        STREAM_TIMEOUT_S = 280   # must stay under Cloud Run --timeout (300s)
        HEARTBEAT_EVERY_S = 25
        start = datetime.now(timezone.utc)
        last_heartbeat = start

        while True:
            now = datetime.now(timezone.utc)
            if (now - start).total_seconds() > STREAM_TIMEOUT_S:
                yield generate_sse_event("stream_timeout", {"bundle_id": bundle_id}, "Stream timed out. Please refresh.", 100)
                break

            events = await firestore.get_bundle_events_since(bundle_id, last_ts)
            for ev in events:
                payload = AnalysisProgressEvent(
                    event_type=ev.get("event_type", "progress_update"),
                    data=ev.get("data", {}),
                    message=ev.get("message", "Processing..."),
                    progress=ev.get("progress", 0),
                    timestamp=ev.get("timestamp", datetime.now(timezone.utc).isoformat() + "Z"),
                ).model_dump()
                yield generate_sse_event(payload["event_type"], payload["data"], payload["message"], payload["progress"])
                last_ts = ev.get("timestamp")

            updated = await firestore.get_bundle_entry(bundle_id)
            if updated:
                st = updated.get("status")
                if st in [BundleStatus.COMPLETED.value, BundleStatus.FAILED.value]:
                    if st == BundleStatus.COMPLETED.value:
                        report_data = await firestore.get_bundle_report(bundle_id)
                        payload = AnalysisProgressEvent(
                            event_type="analysis_completed",
                            data={"report": report_data or {}},
                            message="Analysis completed successfully.",
                            progress=100,
                            timestamp=datetime.now(timezone.utc).isoformat() + "Z",
                        ).model_dump()
                    else:
                        payload = AnalysisProgressEvent(
                            event_type="analysis_failed",
                            data={},
                            message="Analysis failed.",
                            progress=100,
                            timestamp=datetime.now(timezone.utc).isoformat() + "Z",
                        ).model_dump()
                    yield generate_sse_event(payload["event_type"], payload["data"], payload["message"], payload["progress"])
                    break

            if (now - last_heartbeat).total_seconds() >= HEARTBEAT_EVERY_S:
                yield ": ping\n\n"
                last_heartbeat = now

            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@router.get("/{bundle_id}/report", response_model=BundleReportResponse)
async def get_bundle_report(bundle_id: str, current_user: User = Depends(get_current_user)):
    """Get the analysis report for a bundle."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    report_data = await firestore.get_bundle_report(bundle_id)
    if not report_data:
        raise HTTPException(status_code=404, detail="Report not yet available.")

    report = AnalysisReport(**report_data)
    return BundleReportResponse(report=report)


@router.delete("/{bundle_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bundle(bundle_id: str, current_user: User = Depends(get_current_user)):
    """Delete a bundle and all its documents."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    # Delete all documents in bundle
    docs = await firestore.list_documents_for_bundle(bundle_id)
    for doc in docs:
        gcs_path = doc.get("gcs_path", "")
        if gcs_path:
            try:
                await gcs.delete_file(gcs_path)
            except Exception:
                pass
        await firestore.delete_document_entry(doc.get("id", ""))

    await firestore.delete_bundle_entry(bundle_id)
    return None


@router.post("/{bundle_id}/documents", status_code=status.HTTP_201_CREATED)
async def add_documents_to_bundle(
    bundle_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """Add one or more files to an existing bundle."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required.")

    existing_ids = list(bundle_data.get("document_ids", []) or [])
    if len(existing_ids) + len(files) > 10:
        raise HTTPException(status_code=400, detail="Bundle can hold a maximum of 10 documents.")

    allowed_content_types = ["application/pdf", "image/jpeg", "image/png", "image/tiff"]
    MAX_FILE_SIZE = 20 * 1024 * 1024

    state = bundle_data.get("state", "")
    district = bundle_data.get("district", "")
    land_type = bundle_data.get("land_type", "")
    user_id = current_user.uid

    new_ids: List[str] = []
    for file in files:
        if not file.content_type or file.content_type not in allowed_content_types:
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.filename}. Allowed: PDF, JPEG, PNG, TIFF.")

        file_content = await file.read()
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File {file.filename} exceeds 20MB limit.")

        document_id = str(uuid.uuid4())
        safe_filename = re.sub(r'[^\w.\-]', '_', file.filename or 'document')
        file_extension = safe_filename.rsplit('.', 1)[-1] if '.' in safe_filename else 'bin'
        gcs_file_path = f"users/{user_id}/documents/{document_id}.{file_extension}"

        try:
            gcs_uri = await gcs.upload_file(gcs_file_path, file_content, file.content_type)
        except Exception as e:
            logger.error(f"Error uploading file {file.filename} to GCS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to upload {file.filename}")

        document = Document(
            id=document_id,
            user_id=user_id,
            file_name=file.filename,
            gcs_path=gcs_uri,
            content_type=file.content_type,
            status=DocumentStatus.PENDING,
            state=state,
            district=district,
            land_type=land_type,
            bundle_id=bundle_id,
        )
        await firestore.create_document_entry(document_id, document.dict())
        new_ids.append(document_id)

    updated_ids = existing_ids + new_ids
    # Adding new files means the bundle needs re-analysis
    await firestore.update_bundle_entry(bundle_id, {
        "document_ids": updated_ids,
        "status": BundleStatus.CREATED.value,
    })
    logger.info(f"Added {len(new_ids)} documents to bundle {bundle_id}.")
    return {"added": new_ids, "document_ids": updated_ids}


@router.delete("/{bundle_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document_from_bundle(
    bundle_id: str,
    document_id: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a single document from a bundle (and delete it)."""
    bundle_data = await firestore.get_bundle_entry(bundle_id)
    if not bundle_data:
        raise HTTPException(status_code=404, detail="Bundle not found.")
    if bundle_data.get("user_id") != current_user.uid:
        raise HTTPException(status_code=403, detail="Not authorized.")

    existing_ids = list(bundle_data.get("document_ids", []) or [])
    if document_id not in existing_ids:
        raise HTTPException(status_code=404, detail="Document not in this bundle.")

    if len(existing_ids) <= 1:
        raise HTTPException(status_code=400, detail="A bundle must contain at least one document. Delete the bundle instead.")

    # Delete from GCS + Firestore
    doc_data = await firestore.get_document_entry(document_id)
    if doc_data:
        gcs_path = doc_data.get("gcs_path", "")
        if gcs_path:
            try:
                await gcs.delete_file(gcs_path)
            except Exception:
                pass
    await firestore.delete_document_entry(document_id)

    updated_ids = [d for d in existing_ids if d != document_id]
    await firestore.update_bundle_entry(bundle_id, {
        "document_ids": updated_ids,
        "status": BundleStatus.CREATED.value,
    })
    return None
