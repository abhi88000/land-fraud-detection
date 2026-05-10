from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime

from pydantic import BaseModel, Field

class Party(BaseModel):
    name: str
    role: str # e.g., "Buyer", "Seller", "Witness"

class PropertyDetails(BaseModel):
    survey_numbers: List[str] = Field(default_factory=list)
    plot_numbers: List[str] = Field(default_factory=list)
    area: Optional[str] = None
    unit: Optional[str] = None # e.g., "sq ft", "acres"
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    land_type: Optional[str] = None # Residential, Agricultural, Commercial, Industrial, Plantation
    country: str = "India"

class RegistrationInfo(BaseModel):
    registration_number: Optional[str] = None
    registration_date: Optional[str] = None # Using string for flexibility with various date formats
    sub_registrar_office: Optional[str] = None
    book_number: Optional[str] = None
    volume_number: Optional[str] = None
    page_numbers: Optional[str] = None # Can be a range "1-10" or single "5"

class ExtractedData(BaseModel):
    document_type: Optional[str] = None # e.g., "Sale Deed", "Gift Deed"
    party_names: List[Party] = Field(default_factory=list)
    property_details: Optional[PropertyDetails] = None
    dates: Dict[str, Any] = Field(default_factory=dict) # e.g., {"execution_date": "2023-01-15", "registration_date": "2023-01-20"}
    registration_info: Optional[RegistrationInfo] = None
    stamp_duty_amount: Optional[str] = None
    signatures_present: Optional[bool] = None
    document_language: Optional[str] = None # e.g., "Hindi", "English"

    class Config:
        schema_extra = {
            "example": {
                "document_type": "Sale Deed",
                "party_names": [
                    {"name": "John Doe", "role": "Seller"},
                    {"name": "Jane Smith", "role": "Buyer"}
                ],
                "property_details": {
                    "survey_numbers": ["123/A", "124/B"],
                    "plot_numbers": ["P1", "P2"],
                    "area": "1500",
                    "unit": "sq ft",
                    "address": "123 Main St",
                    "city": "Mumbai",
                    "district": "Mumbai Suburban",
                    "state": "Maharashtra",
                    "country": "India"
                },
                "dates": {
                    "execution_date": "2023-01-15",
                    "registration_date": "2023-01-20"
                },
                "registration_info": {
                    "registration_number": "REG-MUM-12345-2023",
                    "registration_date": "2023-01-20",
                    "sub_registrar_office": "Bandra",
                    "book_number": "1",
                    "volume_number": "10",
                    "page_numbers": "1-5"
                },
                "stamp_duty_amount": "50000 INR",
                "signatures_present": True,
                "document_language": "English"
            }
        }

class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class LegalFinding(BaseModel):
    rule_id: str = Field(default="unknown", description="Identifier for the legal rule checked")
    description: str = Field(default="", description="Description of the legal rule")
    is_compliant: bool = Field(default=False, description="Whether the document complies with the rule")
    severity: Severity = Field(default=Severity.LOW, description="Severity of non-compliance")
    explanation: str = Field(default="", description="Detailed explanation of the finding and its implications")
    remediation_suggestion: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "rule_id": "TPA-Sec54",
                "description": "Transfer of Property Act, Section 54: Sale how made",
                "is_compliant": True,
                "severity": "low",
                "explanation": "Document appears to follow standard sale procedures.",
                "remediation_suggestion": None
            }
        }

class FraudType(str, Enum):
    NAME_MISMATCH = "name_mismatch"
    OWNERSHIP_CHAIN_BREAK = "ownership_chain_break"
    FORGED_SIGNATURE = "forged_signature"
    UNDERVALUATION = "undervaluation"
    FAKE_DOCUMENTS = "fake_documents"
    UNKNOWN = "unknown"

class FraudFinding(BaseModel):
    fraud_type: FraudType = Field(default=FraudType.UNKNOWN, description="Category of potential fraud")
    description: str = Field(default="", description="Brief description of the fraud finding")
    is_suspicious: bool = Field(default=False, description="Whether a suspicious activity was detected")
    severity: Severity = Field(default=Severity.LOW, description="Severity of the suspicious activity")
    evidence: List[str] = Field(default_factory=list, description="List of evidence points or discrepancies")
    recommendation: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "fraud_type": "name_mismatch",
                "description": "Seller name in current deed does not match previous ownership records.",
                "is_suspicious": True,
                "severity": "high",
                "evidence": ["Current Seller: John Doe", "Previous Owner: Jonathan Doe"],
                "recommendation": "Cross-verify seller's identity with official records."
            }
        }

class RiskScore(BaseModel):
    overall_score: int = Field(default=50, ge=0, le=100, description="Overall risk score (0-100, lower is better)")
    category_scores: Dict[str, int] = Field(default_factory=dict, description="Risk scores broken down by category (e.g., 'legal', 'fraud')")

    class Config:
        schema_extra = {
            "example": {
                "overall_score": 35,
                "category_scores": {
                    "legal_compliance": 20,
                    "fraud_detection": 50,
                    "data_completeness": 10
                }
            }
        }

class VerificationChecklistItem(BaseModel):
    item: str
    is_checked: bool
    details: Optional[str] = None

class DocumentSummary(BaseModel):
    """Summary of a single document within a bundle."""
    document_id: str = ""
    file_name: str = ""
    document_type: Optional[str] = None
    extracted_data: Optional[ExtractedData] = None


class AnalysisReport(BaseModel):
    document_id: str = Field(..., description="ID of the analyzed document or bundle")
    summary: str = Field(default="", description="Overall summary of the analysis")
    risk_score: Optional[RiskScore] = None
    extracted_data: Optional[ExtractedData] = None
    legal_findings: List[LegalFinding] = Field(default_factory=list)
    fraud_findings: List[FraudFinding] = Field(default_factory=list)
    verification_checklist: List[VerificationChecklistItem] = Field(default_factory=list)
    # Bundle-specific fields
    documents_analyzed: Optional[List[DocumentSummary]] = None
    missing_documents: Optional[List[str]] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of report generation")

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat() + "Z"
        }
        schema_extra = {
            "example": {
                "document_id": "doc_12345",
                "summary": "The document is a Sale Deed for property at 123 Main St, Mumbai. Minor discrepancies found in fraud detection.",
                "risk_score": {
                    "overall_score": 35,
                    "category_scores": {
                        "legal_compliance": 20,
                        "fraud_detection": 50,
                        "data_completeness": 10
                    }
                },
                "extracted_data": ExtractedData.Config.schema_extra["example"],
                "legal_findings": [LegalFinding.Config.schema_extra["example"]],
                "fraud_findings": [FraudFinding.Config.schema_extra["example"]],
                "verification_checklist": [
                    {"item": "All parties identified", "is_checked": True},
                    {"item": "Stamp duty paid", "is_checked": True, "details": "Verified via registration info"},
                    {"item": "Ownership chain verified", "is_checked": False, "details": "Requires external lookup"}
                ],
                "generated_at": "2023-10-27T11:30:00Z"
            }
        }