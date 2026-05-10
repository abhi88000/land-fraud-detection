from pydantic import BaseModel
from typing import List, Optional
from app.models.bundle import Bundle
from app.models.analysis import AnalysisReport


class BundleCreateResponse(BaseModel):
    bundle_id: str
    message: str


class BundleListResponse(BaseModel):
    bundles: List[Bundle]


class BundleDetailResponse(BaseModel):
    bundle: Bundle
    documents: List[dict] = []


class BundleReportResponse(BaseModel):
    report: AnalysisReport
