import json
import logging
from datetime import datetime, timezone
from typing import List
from app.agents.core.base import BaseAgent
from app.models.analysis import ExtractedData, FraudFinding, FraudType, Severity
from app.models.document import DocumentStatus
from app.core.config import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

FRAUD_SYSTEM_PROMPT = """You are an AI assistant that helps users spot CONCRETE risk indicators in Indian land documents. You return ONLY document-specific concerns — never generic background information.

CORE RULES — read carefully:
1. DO NOT invent risk indicators to fill a quota. If the document looks clean, return a short list (or even an empty list). Quality over quantity.
2. A "risk indicator" means a SPECIFIC observation in THIS document — a name that doesn't match, a chain gap, a value that contradicts the area, a stamp that looks off. Generic statements like "Roshni Act exists in J&K" or "land scams happen in this district" are NOT risk indicators and must be omitted.
3. Do NOT flag missing extraction fields (null values) as fraud — that's an OCR/parsing limitation, not suspicion. Examples of what NOT to flag: `area is null`, `unit is null`, `stamp_duty_amount is null`, `registration_number is null`, `book_number is null`, `page_numbers is null`. These are extraction gaps, not red flags. Do NOT produce findings whose title or evidence is essentially "X is null" or "X is missing".
4. Default severity is `low`. Reserve `medium` for items worth clarifying, `high` for clear red flags (mismatched names, broken chain, value far off market), `critical` for items that strongly suggest fraud (forged signatures, fabricated documents). Do not over-grade trivial cosmetic differences (e.g. "Shri" vs "Col." title prefix on a name) — those are at most `low`.
5. Frame findings as "worth verifying" not accusations. The user's document may be perfectly valid.
6. DATES: The user prompt will give you TODAY'S DATE. Use it as the reference for "past" vs "future". A date is "future-dated" ONLY if it is strictly AFTER today's date. Dates from earlier this year, last year, or any prior year are PAST — never flag them as future. Do NOT rely on your training data to decide what "today" is.
7. CONSOLIDATE related observations into ONE finding. If multiple things you'd flag belong to the same concern (e.g. several mismatched fields on the same person, several gaps in the same chain of title), combine them into a single finding whose `evidence` array lists the specific items. Do NOT emit a separate card per sub-field. Aim for at most ONE finding per distinct concern per document.

CONCRETE THINGS TO CHECK (only flag if you see real evidence in the data):
- NAME_MISMATCH — the same person appears with materially different names in different fields (not just a salutation/title difference)
- OWNERSHIP_CHAIN_BREAK — a visible gap or contradiction in the title history captured by the document
- UNDERVALUATION — the stated consideration is far below what's plausible for the stated area and location
- FORGED_SIGNATURE — explicit indications of missing or contradictory signatures
- FAKE_DOCUMENTS — internal inconsistencies that suggest fabrication (e.g. registration number that doesn't match the date)
- UNKNOWN — any other concrete inconsistency

OUTPUT — JSON array (may be empty):
[
    {
        "fraud_type": "name_mismatch|ownership_chain_break|forged_signature|undervaluation|fake_documents|unknown",
        "description": "Short, document-specific title",
        "is_suspicious": true,
        "severity": "low|medium|high|critical",
        "evidence": ["the specific thing observed", "why it's worth checking"],
        "recommendation": "Concrete action the user can take to verify."
    }
]

If nothing concrete is suspicious, return []. Do not fabricate findings. Return ONLY the JSON array."""


class FraudDetectionAgent(BaseAgent[ExtractedData, List[FraudFinding]]):
    def __init__(self):
        super().__init__("FraudDetectionAgent")
        self.client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_LOCATION,
        )

    async def run(self, extracted_data: ExtractedData, document_id: str) -> List[FraudFinding]:
        await self._update_progress(document_id, "Reviewing the document for risk indicators...", 55, "fraud_detection_started")

        try:
            # Build context about the location for grounded search
            district = ""
            state = ""
            if extracted_data.property_details:
                district = extracted_data.property_details.district or ""
                state = extracted_data.property_details.state or ""

            prompt_text = (
                f"TODAY'S DATE (for reference): {datetime.now(timezone.utc).strftime('%Y-%m-%d')}. "
                f"Treat any date on or before today as a PAST date. Do NOT flag dates from this year or earlier as 'future-dated' "
                f"unless they are strictly AFTER today.\n\n"
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

            from app.core.retry import retry_async

            async def _call_gemini():
                return await self.client.aio.models.generate_content(
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
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                    ),
                )

            response = await retry_async(_call_gemini, attempts=3, label="fraud.gemini")

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

        await self._update_progress(document_id, "Risk review complete.", 75, "fraud_detection_completed", data=[f.dict() for f in findings])
        return findings
