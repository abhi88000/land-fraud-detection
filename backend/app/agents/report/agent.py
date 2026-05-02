from typing import List
from app.agents.core.base import BaseAgent
from app.models.analysis import ExtractedData, LegalFinding, FraudFinding, RiskScore, VerificationChecklistItem, AnalysisReport, Severity
from app.models.document import DocumentStatus
from datetime import datetime
from pydantic import BaseModel

class ReportInput(BaseModel):
    document_id: str
    extracted_data: ExtractedData
    legal_findings: List[LegalFinding]
    fraud_findings: List[FraudFinding]

class ReportGeneratorAgent(BaseAgent[ReportInput, AnalysisReport]):
    def __init__(self):
        super().__init__("ReportGeneratorAgent")

    async def run(self, input_data: ReportInput, document_id: str) -> AnalysisReport:
        await self._update_progress(document_id, "Generating final analysis report...", 80, "report_generation_started")

        extracted_data = input_data.extracted_data
        legal_findings = input_data.legal_findings
        fraud_findings = input_data.fraud_findings

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

        risk_score = RiskScore(
            overall_score=overall_score,
            category_scores={
                "legal_compliance": max(0, min(100, 100 - legal_score)),
                "fraud_detection": max(0, min(100, 100 - fraud_score)),
                "data_completeness": max(0, min(100, 100 - completeness_score))
            }
        )

        # 2. Generate Summary
        summary_parts = [f"Analysis of '{input_data.extracted_data.document_type or 'document'}' (ID: {document_id})."]
        if risk_score.overall_score >= 70:
            summary_parts.append("The document appears to have a low risk of issues.")
        elif risk_score.overall_score >= 40:
            summary_parts.append("The document has some potential issues identified, warranting further review.")
        else:
            summary_parts.append("Significant risks and discrepancies were identified. Proceed with extreme caution.")
        summary_parts.append(f"Overall Risk Score: {risk_score.overall_score}/100.")
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

        await self._update_progress(document_id, "Analysis report generated.", 95, "report_generated", data=report.dict())
        return report
