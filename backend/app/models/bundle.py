from datetime import datetime
from typing import List, Optional
from enum import Enum

from pydantic import BaseModel, Field


class BundleStatus(str, Enum):
    CREATED = "created"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class Bundle(BaseModel):
    id: str = Field(..., description="Unique identifier for the bundle")
    user_id: str = Field(..., description="ID of the user who created the bundle")
    name: str = Field("", description="Display name for the bundle")
    state: str = Field("", description="Indian state where the property is located")
    district: str = Field("", description="District where the property is located")
    land_type: str = Field("", description="Type of land: Residential, Agricultural, Commercial, Industrial, Plantation")
    status: BundleStatus = Field(BundleStatus.CREATED, description="Current status of the bundle")
    document_ids: List[str] = Field(default_factory=list, description="List of document IDs in this bundle")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() + "Z"
        }
