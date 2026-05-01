from pydantic import BaseModel
from typing import List, Optional
from app.models.document import Document, DocumentStatus

class DocumentUploadResponse(BaseModel):
    document_id: str
    message: str

class DocumentListResponse(BaseModel):
    documents: List[Document]
    total: int
    page: int
    page_size: int

class DocumentDetailResponse(BaseModel):
    document: Document
