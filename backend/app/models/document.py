from datetime import datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, Field

class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class Document(BaseModel):
    id: str = Field(..., description="Unique identifier for the document")
    user_id: str = Field(..., description="ID of the user who uploaded the document")
    file_name: str = Field(..., description="Original name of the uploaded file")
    gcs_path: str = Field(..., description="Google Cloud Storage path to the document")
    content_type: str = Field(..., description="MIME type of the document")
    status: DocumentStatus = Field(DocumentStatus.UPLOADED, description="Current status of the document analysis")
    state: str = Field("", description="Indian state where the property is located")
    district: str = Field("", description="District where the property is located")
    land_type: str = Field("", description="Type of land: Residential, Agricultural, Commercial, Industrial, Plantation")
    bundle_id: str = Field("", description="ID of the bundle this document belongs to")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of document upload")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of last update")

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() + "Z"
        }
        schema_extra = {
            "example": {
                "id": "doc_12345",
                "user_id": "user_abc",
                "file_name": "land_deed_1.pdf",
                "gcs_path": "gs://landguard-docs/user_abc/doc_12345.pdf",
                "content_type": "application/pdf",
                "status": "uploaded",
                "created_at": "2023-10-27T10:00:00Z",
                "updated_at": "2023-10-27T10:00:00Z",
            }
        }
