from typing import List
from app.agents.core.base import BaseAgent
from app.models.analysis import ExtractedData, LegalFinding, FraudFinding, RiskScore, VerificationChecklistItem, AnalysisReport, Severity
from app.models.document import DocumentStatus
from datetime import datetime
from pydantic import BaseModel
import json
import re

_SEVERITY_RANK = {Severity.LOW: 1, Severity.MEDIUM: 2, Severity.HIGH: 3, Severity.CRITICAL: 4}


def _norm_text(s: str | None) -> str:
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    # Use first ~80 chars as the semantic fingerprint — agents often vary the tail
    return s[:80]


def _dedup_legal_findings(findings: List[LegalFinding]) -> List[LegalFinding]:
    """Collapse legal findings sharing the same (rule_id, fingerprint); keep most severe."""
    best: dict[tuple, LegalFinding] = {}
    for f in findings:
        key = (f.rule_id or "", _norm_text(f.description))
        existing = best.get(key)
        if existing is None or _SEVERITY_RANK.get(f.severity, 0) > _SEVERITY_RANK.get(existing.severity, 0):
            best[key] = f
    return list(best.values())


def _dedup_fraud_findings(findings: List[FraudFinding]) -> List[FraudFinding]:
    """Collapse fraud findings sharing the same (fraud_type, fingerprint); keep most severe."""
    best: dict[tuple, FraudFinding] = {}
    for f in findings:
        ftype = f.fraud_type.value if hasattr(f.fraud_type, "value") else str(f.fraud_type)
        key = (ftype, _norm_text(f.description))
        existing = best.get(key)
        if existing is None or _SEVERITY_RANK.get(f.severity, 0) > _SEVERITY_RANK.get(existing.severity, 0):
            best[key] = f
    return list(best.values())


class ReportInput(BaseModel):
    document_id: str
    extracted_data: ExtractedData
    legal_findings: List[LegalFinding]
    fraud_findings: List[FraudFinding]
    missing_documents: List[str] = []

class ReportGeneratorAgent(BaseAgent[ReportInput, AnalysisReport]):
    def __init__(self):
        super().__init__("ReportGeneratorAgent")

    async def run(self, input_data: ReportInput, document_id: str) -> AnalysisReport:
        await self._update_progress(document_id, "Generating final analysis report...", 80, "report_generation_started")

        extracted_data = input_data.extracted_data
        # Collapse near-duplicates emitted by parallel agents before scoring/rendering.
        legal_findings = _dedup_legal_findings(input_data.legal_findings)
        fraud_findings = _dedup_fraud_findings(input_data.fraud_findings)

        # 1. Calculate Risk Score
        overall_score = 0
        legal_score = 0
        fraud_score = 0
        completeness_score = 0

        # Simple scoring logic: assign points based on severity of findings
        # Higher points = higher risk
        severity_points = {Severity.LOW: 5, Severity.MEDIUM: 20, Severity.HIGH: 50, Severity.CRITICAL: 100}

        for finding in legal_findings:
            if not finding.is_compliant:
                legal_score += severity_points.get(finding.severity, 0)
        
        for finding in fraud_findings:
            if finding.is_suspicious:
                fraud_score += severity_points.get(finding.severity, 0)

        # Basic completeness check based on key fields in ExtractedData
        if not extracted_data.document_type: completeness_score += 10
        if not extracted_data.party_names: completeness_score += 15
        if not extracted_data.property_details: completeness_score += 20
        if not (extracted_data.registration_info and extracted_data.registration_info.registration_number): completeness_score += 15

        # Each recommended-but-missing supporting document hurts completeness.
        # We can't verify what we can't see, so the bundle should not score well
        # just because the one document provided happened to be clean.
        missing_docs = list(input_data.missing_documents or [])
        completeness_score += 25 * len(missing_docs)

        # Max scores for categories (adjust as needed for weighting)
        max_legal_score = len(legal_findings) * severity_points[Severity.HIGH] if legal_findings else 1
        max_fraud_score = len(fraud_findings) * severity_points[Severity.HIGH] if fraud_findings else 1
        max_completeness_score = 60 # Sum of example completeness points

        # Normalize to 0-100 range and invert (lower score = better)
        legal_score = min(100, int((legal_score / max_legal_score) * 100))
        fraud_score = min(100, int((fraud_score / max_fraud_score) * 100))
        completeness_score = min(100, int((completeness_score / max_completeness_score) * 100))

        # Overall score is an average (can be weighted)
        overall_score = int((legal_score + fraud_score + completeness_score) / 3)
        # Invert the score for user readability (lower score = better)
        overall_score = max(0, min(100, 100 - overall_score))

        # Hard cap: a bundle with critical supporting documents missing cannot
        # be presented as "high trust", regardless of how clean the one
        # document we did see looks. This keeps the score honest.
        if len(missing_docs) >= 3:
            overall_score = min(overall_score, 40)
        elif len(missing_docs) >= 1:
            overall_score = min(overall_score, 60)

        risk_score = RiskScore(
            overall_score=overall_score,
            category_scores={
                "legal_compliance": max(0, min(100, 100 - legal_score)),
                "fraud_detection": max(0, min(100, 100 - fraud_score)),
                "data_completeness": max(0, min(100, 100 - completeness_score))
            }
        )

        # 2. Generate Summary — purely advisory, no score mention
        location_info = ""
        if extracted_data.property_details:
            parts = []
            if extracted_data.property_details.district:
                parts.append(extracted_data.property_details.district)
            if extracted_data.property_details.state:
                parts.append(extracted_data.property_details.state)
            if parts:
                location_info = f" in {', '.join(parts)}"

        summary_parts = [f"AI review of '{input_data.extracted_data.document_type or 'document'}'{location_info}."]

        # Count actionable findings
        issues_count = sum(1 for f in legal_findings if not f.is_compliant) + sum(1 for f in fraud_findings if f.is_suspicious)
        
        if issues_count == 0:
            summary_parts.append("We did not find any major areas of concern. Your document appears to be in order based on the information provided.")
        elif issues_count <= 3:
            summary_parts.append(f"We found {issues_count} area{'s' if issues_count > 1 else ''} worth verifying. Please review the details below and consider checking with your local sub-registrar or a property lawyer.")
        else:
            summary_parts.append(f"We flagged {issues_count} areas for your attention. We recommend consulting a property lawyer or visiting your sub-registrar office to verify these items.")
        
        summary_parts.append("Note: This is an AI-assisted review meant to highlight areas for verification — not a legal opinion.")
        summary = " ".join(summary_parts)

        # 3. Create Verification Checklist
        checklist: List[VerificationChecklistItem] = []
        checklist.append(VerificationChecklistItem(item="Document type identified", is_checked=bool(extracted_data.document_type)))
        
        # Check if has_buyer and has_seller are available in scope or passed through
        has_buyer = any(p.role.lower() == "buyer" for p in extracted_data.party_names)
        has_seller = any(p.role.lower() == "seller" for p in extracted_data.party_names)

        checklist.append(VerificationChecklistItem(item="Primary parties (Buyer/Seller) identified", is_checked=has_buyer and has_seller))
        checklist.append(VerificationChecklistItem(item="Registration number present (if applicable)", is_checked=bool(extracted_data.registration_info and extracted_data.registration_info.registration_number is not None)))
        
        # Add items based on findings
        for finding in legal_findings:
            if not finding.is_compliant:
                checklist.append(VerificationChecklistItem(item=f"Address legal non-compliance: {finding.rule_id}", is_checked=False, details=finding.explanation))
        for finding in fraud_findings:
            if finding.is_suspicious:
                checklist.append(VerificationChecklistItem(item=f"Investigate fraud indicator: {finding.fraud_type.value}", is_checked=False, details=f"{finding.description}. Recommendation: {finding.recommendation}"))
        
        checklist.append(VerificationChecklistItem(item="Property details (area, survey numbers) complete", is_checked=bool(extracted_data.property_details and extracted_data.property_details.area and (extracted_data.property_details.survey_numbers or extracted_data.property_details.plot_numbers))))
        checklist.append(VerificationChecklistItem(item="Historical ownership chain verification (external)", is_checked=False, details="Requires external data source.")) # Example of external step


        report = AnalysisReport(
            document_id=document_id,
            summary=summary,
            risk_score=risk_score,
            extracted_data=extracted_data,
            legal_findings=legal_findings,
            fraud_findings=fraud_findings,
            verification_checklist=checklist,
            generated_at=datetime.utcnow()
        )

        await self._update_progress(document_id, "Analysis report generated.", 95, "report_generated", data=json.loads(report.model_dump_json()))
        return report
