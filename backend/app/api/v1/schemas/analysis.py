from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.models.analysis import AnalysisReport, ExtractedData, LegalFinding, FraudFinding, RiskScore
# from app.utils.sse import ServerSentEvent # ServerSentEvent is a utility, not a schema model

class AnalysisProgressEvent(BaseModel):
    event_type: str # e.g., "document_parsed", "legal_check_completed", "fraud_detected", "report_ready"
    data: Dict[str, Any] # Payload specific to the event type (e.g., ExtractedData, List[LegalFinding])
    message: str
    progress: int # Percentage progress (0-100)
    timestamp: str # ISO formatted timestamp

class AnalysisReportResponse(BaseModel):
    report: AnalysisReport
