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

LEGAL_SYSTEM_PROMPT = """You are an AI assistant that helps users understand how Indian land laws apply to their document. You return ONLY actionable, document-specific findings — never generic statutory information.

CORE RULES — read carefully:
1. DO NOT invent findings to fill a quota. If the document looks clean, return a short list (or even an empty list). Quality over quantity.
2. A "finding" means something CONCRETE in THIS document that the user should act on. Generic statements like "Transfer of Property Act, 1882 applies" or "RERA may be applicable" are NOT findings — they are textbook information and must be omitted.
3. Only return an item with `is_compliant: false` when there is ACTUAL evidence in the document that something is missing, malformed, or contradicts a law. Missing extraction fields (null values) are an OCR/parsing limitation, NOT a legal non-compliance — do not flag them as legal issues.
4. State-specific context: only flag a state law if the document is actually subject to it. Do NOT add "informational" entries about every state law that might exist in that region.
5. Default severity is `low`. Reserve `medium` for items the user should clarify with their lawyer, `high` for clear gaps that block the transaction, `critical` for situations that could void title or invite prosecution. Do not over-grade.
6. Frame findings as advisory, never accusatory. The user's document may be perfectly valid.

WHAT TO CHECK (only flag if you can point to a concrete issue in the document):
- Registration & stamp duty actually recorded in the document (missing/inadequate vs. what's typical for the value)
- Transfer chain breaks visible in the data (missing prior owner, gap in mutation)
- State-specific restrictions that DIRECTLY APPLY (e.g. J&K residency rules if the buyer is clearly non-domicile; tribal land restriction if buyer is non-tribal in a Schedule V/VI area)
- Agricultural-land buyer restrictions (only if state requires agriculturist certification and the buyer field shows otherwise)
- RERA registration (only flag if the property type clearly falls under RERA and no project registration is referenced)

OUTPUT — JSON array of findings (may be empty):
[
    {
        "rule_id": "L-001",
        "description": "Short, document-specific title",
        "is_compliant": false,
        "severity": "low|medium|high|critical",
        "explanation": "Concrete observation from the document and why the user should verify it.",
        "remediation_suggestion": "Specific action the user can take."
    }
]

If the document looks legally clean for what's visible, return []. Do not fabricate findings. Return ONLY the JSON array."""


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
            land_type = ""
            district = ""
            state = ""
            if extracted_data.property_details:
                land_type = extracted_data.property_details.land_type or ""
                district = extracted_data.property_details.district or ""
                state = extracted_data.property_details.state or ""

            prompt_text = (
                f"Analyze this extracted land document data for legal compliance:\n\n"
                f"{json.dumps(extracted_data.dict(), indent=2, default=str)}\n\n"
                f"Location: {district}, {state}, India. Land Type: {land_type or 'Not specified'}.\n"
                f"If Agricultural land, check state-specific agriculturist buyer requirements. "
                f"If Residential/Commercial, check RERA applicability. "
                f"If in tribal/scheduled area, check specific land transfer restrictions. "
                f"Suggest specific documents the user needs to obtain for {state}."
            )

            response = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_text(text=prompt_text),
                        ],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=LEGAL_SYSTEM_PROMPT,
                    temperature=0.2,
                    response_mime_type="application/json",
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
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
