from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from typing import List, Optional
from app.core.security import get_current_user
from app.core.models import User
from app.models.document import Document, DocumentStatus
from app.api.v1.schemas.documents import DocumentUploadResponse, DocumentListResponse, DocumentDetailResponse
from app.services import gcs, firestore
from app.agents.orchestrator import OrchestratorAgent
from app.core.errors import InvalidFileFormatException, DocumentNotFoundException, UnauthorizedDocumentAccess
import asyncio
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(..., description="PDF or image land document to be analyzed"),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a land document for analysis.
    The document is stored in GCS, an entry is created in Firestore, and analysis is triggered.
    """
    allowed_content_types = ["application/pdf", "image/jpeg", "image/png", "image/tiff"]
    if not file.content_type or file.content_type not in allowed_content_types:
        raise InvalidFileFormatException(allowed_formats=[ct.split('/')[-1] for ct in allowed_content_types])

    document_id = str(uuid.uuid4())
    user_id = current_user.uid
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    gcs_file_path = f"users/{user_id}/documents/{document_id}.{file_extension}"

    try:
        file_content = await file.read()
        gcs_uri = await gcs.upload_file(gcs_file_path, file_content, file.content_type)
    except Exception as e:
        logger.error(f"Error uploading file to GCS for document {document_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to upload document: {e}")

    document = Document(
        id=document_id,
        user_id=user_id,
        file_name=file.filename,
        gcs_path=gcs_uri,
        content_type=file.content_type,
        status=DocumentStatus.PENDING
    )
    try:
        await firestore.create_document_entry(document.id, document.dict())
    except Exception as e:
        logger.error(f"Error saving document entry to Firestore for document {document_id}: {e}")
        await gcs.delete_file(gcs_file_path) # Rollback GCS upload if Firestore fails
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save document entry: {e}")

    # Trigger the analysis process asynchronously (e.g., using a background task queue)
    # For now, a direct call to the orchestrator agent, which would ideally be non-blocking.
    orchestrator = OrchestratorAgent()
    # In a production setup, this would enqueue a task (e.g., to Cloud Tasks/PubSub)
    # The orchestrator would then be triggered by that task.
    asyncio.create_task(orchestrator.start_analysis(document_id=document_id))
    logger.info(f"Analysis triggered for document {document_id}.")

    return DocumentUploadResponse(document_id=document_id, message="Document uploaded successfully. Analysis started.")

@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    page: int = 1,
    page_size: int = 10,
    status_filter: Optional[DocumentStatus] = None # Renamed to avoid conflict with `status`
):
    """
    Retrieves a paginated list of uploaded documents for the current user.
    Optional filtering by document status.
    """
    documents_data, total = await firestore.list_documents_for_user(current_user.uid, page, page_size, status_filter)
    documents = [Document(**data) for data in documents_data]

    return DocumentListResponse(documents=documents, total=total, page=page, page_size=page_size)

@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document_details(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves detailed information about a specific document.
    Ensures the document belongs to the authenticated user.
    """
    document_data = await firestore.get_document_entry(document_id)

    if not document_data:
        raise DocumentNotFoundException(document_id)
    
    if document_data.get("user_id") != current_user.uid:
        raise UnauthorizedDocumentAccess(document_id)

    document = Document(**document_data)
    return DocumentDetailResponse(document=document)
