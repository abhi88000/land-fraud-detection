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

FRAUD_SYSTEM_PROMPT = """You are an AI assistant that helps users review Indian land documents. Your role is to HIGHLIGHT areas that may need the user's attention or further verification — NOT to declare anything as fraud or make definitive judgments.

IMPORTANT: You are NOT a source of truth. The user may already have legitimate documents. Your job is to point out things worth double-checking with a lawyer, sub-registrar, or revenue office.

Highlight these patterns IF you spot them — but frame them as "worth verifying" not "this is fraud":
1. NAME_MISMATCH - Names that appear inconsistent — suggest the user verify spelling/transliteration
2. OWNERSHIP_CHAIN_BREAK - Gaps in ownership history — suggest verifying with revenue records
3. FORGED_SIGNATURE - Missing or unclear signatures — suggest confirming with the registrar
4. UNDERVALUATION - Value that may differ from circle/guideline rates — suggest checking current rates
5. FAKE_DOCUMENTS - Formatting that looks unusual — suggest verifying with the issuing authority
6. UNKNOWN - Any other patterns worth the user's attention

CRITICAL — Area-specific checks based on STATE and DISTRICT:
- If the land is in a Scheduled Area (Schedule V/VI of the Constitution), flag that transfers to non-tribals may be restricted. Mention the specific state law (e.g. Chotanagpur Tenancy Act for Jharkhand, PESA for Scheduled Areas).
- If the property is in a UT like Ladakh, Andaman, Lakshadweep, J&K — flag any special land ownership restrictions for non-residents.
- If in tribal belts (Assam, Meghalaya, Mizoram, Nagaland, Manipur, Tripura, Arunachal Pradesh) — flag customary land law considerations.
- If the land is near forest/reserved forest — flag Forest Conservation Act requirements.
- If the land is agricultural — flag whether the state requires permission for non-agriculturist purchase.
- If the land is in a Roshni Act area (J&K) — flag that these titles may be under review.
- Use Google Search to find recent land fraud news, government notifications, or court orders specific to the DISTRICT and STATE mentioned.

ALSO — Suggest additional documents the user should obtain for complete verification:
- Encumbrance Certificate (EC) — to check for existing mortgages/liens
- Revenue records (7/12 extract, Khata, Patta, RTC) — to verify ownership
- Mutation records — to verify title transfer chain
- Non-encumbrance certificate from sub-registrar
- NOC from competent authority (if tribal/agricultural/ceiling land)
- Approved layout plan (if plotted development)
- Any other documents specific to this state/district that would help verify the transaction

Return a JSON array:
[
    {
        "fraud_type": "name_mismatch/ownership_chain_break/forged_signature/undervaluation/fake_documents/unknown",
        "description": "Brief description — framed as 'worth checking' not 'this is fraud'",
        "is_suspicious": true/false,
        "severity": "low/medium/high/critical",
        "evidence": ["what we noticed", "why it's worth checking"],
        "recommendation": "Specific action the user can take to verify this (e.g. visit sub-registrar, check encumbrance certificate, consult lawyer)"
    }
]

Be helpful and thorough, but never alarmist. Frame findings as things to verify, not accusations. The user's document may be perfectly valid. Check at least 4-6 areas.
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
                f"Review this extracted land document data and highlight areas the user should verify:\n\n"
                f"{json.dumps(extracted_data.dict(), indent=2, default=str)}\n\n"
                f"Location: {district}, {state}, India.\n"
                f"Land Type: {extracted_data.property_details.land_type or 'Not specified'}\n\n"
                f"Search for relevant land regulations, transfer restrictions, "
                f"and any known issues in {district}, {state}, India. "
                f"If land type is Agricultural, check non-agriculturist purchase rules for {state}. "
                f"If Residential/Commercial, check RERA and zoning. "
                f"If Plantation, check plantation-specific transfer rules. "
                f"Help the user understand what to verify with local authorities.\n\n"
                f"IMPORTANT: Frame all findings as advisory, not accusations. Return ONLY the JSON array as specified in system instructions."
            )

            response = await self.client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=prompt_text)],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=FRAUD_SYSTEM_PROMPT,
                    temperature=0.2,
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )

            response_text = response.text.strip()
            # Extract JSON from response (may be wrapped in ```json ... ```)
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            parsed_findings = json.loads(response_text)
            if isinstance(parsed_findings, dict):
                parsed_findings = parsed_findings.get("findings", [parsed_findings])

            findings = []
            for f in parsed_findings:
                fraud_type_str = f.get("fraud_type", "unknown").lower()
                try:
                    fraud_type = FraudType(fraud_type_str)
                except ValueError:
                    fraud_type = FraudType.UNKNOWN

                try:
                    sev = Severity((f.get("severity") or "low").lower())
                except ValueError:
                    sev = Severity.LOW

                findings.append(FraudFinding(
                    fraud_type=fraud_type,
                    description=f.get("description") or "",
                    is_suspicious=bool(f.get("is_suspicious")),
                    severity=sev,
                    evidence=f.get("evidence") or [],
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
