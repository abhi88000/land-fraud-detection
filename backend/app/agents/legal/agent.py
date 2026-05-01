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

LEGAL_SYSTEM_PROMPT = """You are an expert Indian land law attorney. Analyze the extracted document data and check compliance with Indian land laws.

Check against:
1. Transfer of Property Act, 1882 - Is the transfer valid?
2. Registration Act, 1908 - Is the document properly registered?
3. Indian Stamp Act - Is stamp duty adequate?
4. State-specific land laws - Are there restrictions on this type of land transfer?
5. RERA compliance (if applicable)
6. Agricultural land transfer restrictions
7. Government/panchayat/tribal/ceiling land restrictions

For each check, return a JSON array:
[
    {
        "rule_id": "L-001",
        "description": "Brief rule description",
        "is_compliant": true/false,
        "severity": "low/medium/high/critical",
        "explanation": "Detailed explanation of finding",
        "remediation_suggestion": "What to do if non-compliant, or null if compliant"
    }
]

Be thorough. Check at least 5-8 rules. Return ONLY the JSON array."""


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
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_text(
                                f"Analyze this extracted land document data for legal compliance:\n\n{json.dumps(extracted_data.dict(), indent=2, default=str)}"
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

            findings = []
            for f in parsed_findings:
                findings.append(LegalFinding(
                    rule_id=f.get("rule_id", "L-000"),
                    description=f.get("description", ""),
                    is_compliant=f.get("is_compliant", True),
                    severity=Severity(f.get("severity", "low")),
                    explanation=f.get("explanation", ""),
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
