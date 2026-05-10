from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
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
    state: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    land_type: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads a land document. Does NOT auto-trigger analysis.
    User must explicitly trigger analysis via /analysis/analyze endpoint.
    """
    allowed_content_types = ["application/pdf", "image/jpeg", "image/png", "image/tiff"]
    if not file.content_type or file.content_type not in allowed_content_types:
        raise InvalidFileFormatException(allowed_formats=[ct.split('/')[-1] for ct in allowed_content_types])

    # File size limit: 20MB
    MAX_FILE_SIZE = 20 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds the maximum limit of 20MB."
        )

    document_id = str(uuid.uuid4())
    user_id = current_user.uid
    # Sanitize filename: keep only alphanumeric, dots, hyphens, underscores
    import re
    safe_filename = re.sub(r'[^\w.\-]', '_', file.filename or 'document')
    file_extension = safe_filename.rsplit('.', 1)[-1] if '.' in safe_filename else 'bin'
    gcs_file_path = f"users/{user_id}/documents/{document_id}.{file_extension}"

    try:
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
        status=DocumentStatus.PENDING,
        state=state or "",
        district=district or "",
        land_type=land_type or "",
    )
    try:
        await firestore.create_document_entry(document.id, document.dict())
    except Exception as e:
        logger.error(f"Error saving document entry to Firestore for document {document_id}: {e}")
        await gcs.delete_file(gcs_file_path) # Rollback GCS upload if Firestore fails
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to save document entry: {e}")

    logger.info(f"Document {document_id} uploaded successfully. Awaiting analysis trigger.")

    return DocumentUploadResponse(document_id=document_id, message="Document uploaded successfully. Analysis started.")

@router.get("", response_model=DocumentListResponse)
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


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Deletes a document and its associated data."""
    document_data = await firestore.get_document_entry(document_id)

    if not document_data:
        raise DocumentNotFoundException(document_id)

    if document_data.get("user_id") != current_user.uid:
        raise UnauthorizedDocumentAccess(document_id)

    # Delete from GCS
    gcs_path = document_data.get("gcs_path", "")
    if gcs_path:
        await gcs.delete_file(gcs_path)

    # Delete from Firestore
    await firestore.delete_document_entry(document_id)
    return None
