import json
import logging
from typing import List
from app.agents.core.base import BaseAgent
from app.models.analysis import ExtractedData, LegalFinding, Severity
from app.models.document import DocumentStatus
from app.core.config import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

LEGAL_SYSTEM_PROMPT = """You are an AI assistant that helps users understand how Indian land laws may apply to their document. Your role is to HIGHLIGHT areas worth verifying — NOT to give legal opinions or declare compliance/non-compliance definitively.

IMPORTANT: You are NOT a lawyer or a source of legal truth. The user may already have valid documents. Frame your findings as "things to verify" or "areas to discuss with a lawyer."

Check these areas and flag anything the user should verify:
1. Transfer of Property Act, 1882 - Does the transfer appear to follow standard requirements?
2. Registration Act, 1908 - Is there evidence of proper registration?
3. Indian Stamp Act - Does the stamp duty appear adequate based on available information?
4. State-specific land laws - Are there any restrictions the user should be aware of?
5. RERA compliance (if applicable for the property type)
6. Agricultural land transfer restrictions
7. Government/panchayat/tribal/ceiling land restrictions

CRITICAL — State and District specific checks:
- If the property is in a Scheduled Tribe area, flag specific tribal land protection acts for that state (e.g., AP Scheduled Areas Land Transfer Regulation 1959, Chotanagpur Tenancy Act for Jharkhand/Bihar).
- If in J&K or Ladakh — flag special provisions on non-resident land ownership post Article 370.
- If in Northeast states — flag customary law, Inner Line Permit areas, Sixth Schedule protections.
- If agricultural land — flag whether state requires agricultural income certificate or permission for non-agriculturist buyers.
- If near a tribunal/court jurisdiction — flag any known land tribunals operating in that district.

ALSO — What additional documents should the user obtain:
- Based on the document type and state, suggest which supporting documents are needed for complete verification
- Example: "In Maharashtra, you should also obtain the 7/12 extract and mutation entry to confirm current ownership"
- Example: "For tribal area transactions, an NOC from the District Collector or Tribal Welfare Officer is typically required"
- Be specific to the state/district — don't give generic advice

For each check, return a JSON array:
[
    {
        "rule_id": "L-001",
        "description": "Brief description of what was checked",
        "is_compliant": true/false,
        "severity": "low/medium/high/critical",
        "explanation": "What we found and why the user should verify this — framed as advisory, not judgment",
        "remediation_suggestion": "Specific step the user can take: e.g. 'Verify with the sub-registrar office' or 'Consult a property lawyer about this clause'"
    }
]

Be thorough but never alarmist. The user's documents may be perfectly valid. Check at least 5-8 areas. Return ONLY the JSON array."""


class LegalRulesAgent(BaseAgent[ExtractedData, List[LegalFinding]]):
    def __init__(self):
        super().__init__("LegalRulesAgent")
        self.client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_LOCATION,
        )

    async def run(self, extracted_data: ExtractedData, document_id: str) -> List[LegalFinding]:
        await self._update_progress(document_id, "Applying Indian land law compliance checks...", 30, "legal_checks_started")

        try:
            response = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_text(
                                text=f"Analyze this extracted land document data for legal compliance:\n\n{json.dumps(extracted_data.dict(), indent=2, default=str)}"
                            ),
                        ],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=LEGAL_SYSTEM_PROMPT,
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )

            response_text = response.text.strip()
            parsed_findings = json.loads(response_text)
            if isinstance(parsed_findings, dict):
                parsed_findings = parsed_findings.get("findings", [parsed_findings])

            findings = []
            for f in parsed_findings:
                try:
                    sev = Severity((f.get("severity") or "low").lower())
                except ValueError:
                    sev = Severity.LOW
                findings.append(LegalFinding(
                    rule_id=f.get("rule_id") or "L-000",
                    description=f.get("description") or "",
                    is_compliant=bool(f.get("is_compliant")),
                    severity=sev,
                    explanation=f.get("explanation") or "",
                    remediation_suggestion=f.get("remediation_suggestion"),
                ))

        except Exception as e:
            logger.error(f"Legal check failed for document {document_id}: {e}")
            findings = [LegalFinding(
                rule_id="L-ERR",
                description="Legal analysis could not be completed",
                is_compliant=False,
                severity=Severity.HIGH,
                explanation=f"AI legal analysis encountered an error: {str(e)}",
                remediation_suggestion="Please retry the analysis or consult a legal professional.",
            )]

        await self._update_progress(document_id, "Legal compliance checks complete.", 50, "legal_checks_completed", data=[f.dict() for f in findings])
        return findings
