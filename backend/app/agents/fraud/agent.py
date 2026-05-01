import json
import logging
from typing import List
from app.agents.core.base import BaseAgent
from app.models.analysis import ExtractedData, FraudFinding, FraudType, Severity
from app.models.document import DocumentStatus
from app.core.config import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

FRAUD_SYSTEM_PROMPT = """You are an expert Indian land fraud investigator. Analyze the extracted document data for potential fraud indicators.

Check for these fraud patterns:
1. NAME_MISMATCH - Names inconsistent across document pages or with known records
2. OWNERSHIP_CHAIN_BREAK - Gaps or inconsistencies in property ownership history
3. FORGED_SIGNATURE - Signs of forged or missing signatures
4. UNDERVALUATION - Property value suspiciously low (possible stamp duty evasion)
5. FAKE_DOCUMENTS - Signs of document tampering or fabrication
6. UNKNOWN - Any other suspicious patterns

Also use your knowledge of real land fraud cases in India, especially in the district/state mentioned.

Return a JSON array:
[
    {
        "fraud_type": "name_mismatch/ownership_chain_break/forged_signature/undervaluation/fake_documents/unknown",
        "description": "Brief description of the finding",
        "is_suspicious": true/false,
        "severity": "low/medium/high/critical",
        "evidence": ["evidence point 1", "evidence point 2"],
        "recommendation": "What the buyer should do, or null if not suspicious"
    }
]

Be thorough but fair. Flag genuine risks, don't create false alarms. Check at least 4-6 fraud patterns.
Return ONLY the JSON array."""


class FraudDetectionAgent(BaseAgent[ExtractedData, List[FraudFinding]]):
    def __init__(self):
        super().__init__("FraudDetectionAgent")
        self.client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_LOCATION,
        )

    async def run(self, extracted_data: ExtractedData, document_id: str) -> List[FraudFinding]:
        await self._update_progress(document_id, "Detecting potential fraud indicators...", 55, "fraud_detection_started")

        try:
            # Build context about the location for grounded search
            district = ""
            state = ""
            if extracted_data.property_details:
                district = extracted_data.property_details.district or ""
                state = extracted_data.property_details.state or ""

            prompt_text = (
                f"Analyze this extracted land document data for potential fraud:\n\n"
                f"{json.dumps(extracted_data.dict(), indent=2, default=str)}\n\n"
                f"Also search for recent land fraud cases reported in {district}, {state}, India "
                f"and check if this document shows similar patterns."
            )

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(prompt_text)],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=FRAUD_SYSTEM_PROMPT,
                    temperature=0.2,
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    response_mime_type="application/json",
                ),
            )

            response_text = response.text.strip()
            parsed_findings = json.loads(response_text)

            findings = []
            for f in parsed_findings:
                fraud_type_str = f.get("fraud_type", "unknown")
                try:
                    fraud_type = FraudType(fraud_type_str)
                except ValueError:
                    fraud_type = FraudType.UNKNOWN

                findings.append(FraudFinding(
                    fraud_type=fraud_type,
                    description=f.get("description", ""),
                    is_suspicious=f.get("is_suspicious", False),
                    severity=Severity(f.get("severity", "low")),
                    evidence=f.get("evidence", []),
                    recommendation=f.get("recommendation"),
                ))

        except Exception as e:
            logger.error(f"Fraud detection failed for document {document_id}: {e}")
            findings = [FraudFinding(
                fraud_type=FraudType.UNKNOWN,
                description="Fraud detection analysis could not be completed",
                is_suspicious=False,
                severity=Severity.MEDIUM,
                evidence=[f"Error during analysis: {str(e)}"],
                recommendation="Please retry the analysis or consult a legal professional.",
            )]

        await self._update_progress(document_id, "Fraud detection complete.", 75, "fraud_detection_completed", data=[f.dict() for f in findings])
        return findings
