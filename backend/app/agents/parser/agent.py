import json
import logging
from typing import List, Dict, Any
from app.agents.core.base import BaseAgent
from app.models.analysis import ExtractedData, Party, PropertyDetails, RegistrationInfo
from app.services import gcs
from app.models.document import DocumentStatus
from app.core.config import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

PARSER_SYSTEM_PROMPT = """You are an expert Indian land document analyst. You can read and understand land documents in English, Hindi, Tamil, Kannada, Telugu, Marathi, and other Indian languages.

Your task is to extract structured information from the uploaded land document image/PDF.

CRITICAL: "state" and "district" are MANDATORY fields. If they are not explicitly mentioned in the document, infer them from any available clues — sub-registrar office name, address, language of the document, stamp paper details, or any other context. If you absolutely cannot determine them, set them to "Unknown" but NEVER leave them as null.

Valid Indian states and UTs: Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh, Goa, Gujarat, Haryana, Himachal Pradesh, Jharkhand, Karnataka, Kerala, Madhya Pradesh, Maharashtra, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil Nadu, Telangana, Tripura, Uttar Pradesh, Uttarakhand, West Bengal, Andaman and Nicobar Islands, Chandigarh, Dadra and Nagar Haveli and Daman and Diu, Delhi, Jammu and Kashmir, Ladakh, Lakshadweep, Puducherry.

Extract the following information and return it as valid JSON:
{
    "document_type": "Sale Deed / Gift Deed / Lease Deed / Exchange Deed / Agreement to Sell / Simple Mortgage Deed / Power of Attorney / Will / Encumbrance Certificate / Property Extract / Mutation Record / etc.",
    "party_names": [{"name": "Full Name", "role": "Buyer/Seller/Witness/Donor/Donee/Lessor/Lessee/Mortgagor/Mortgagee/Testator/Beneficiary/Exchanging Party"}],
    "property_details": {
        "survey_numbers": ["list of survey numbers"],
        "plot_numbers": ["list of plot numbers"],
        "area": "area value as string",
        "unit": "sq ft / sq m / acres / hectares / guntha / bigha etc.",
        "address": "full address",
        "city": "city/town/village",
        "district": "district name (REQUIRED - infer if not explicit)",
        "state": "state or UT name (REQUIRED - infer if not explicit)",
        "country": "India"
    },
    "dates": {"execution_date": "YYYY-MM-DD", "registration_date": "YYYY-MM-DD"},
    "registration_info": {
        "registration_number": "registration number if present",
        "registration_date": "YYYY-MM-DD",
        "sub_registrar_office": "office name",
        "book_number": "book number if present",
        "volume_number": "volume number if present",
        "page_numbers": "page numbers if present"
    },
    "stamp_duty_amount": "amount with currency e.g. 50000 INR",
    "signatures_present": true/false,
    "document_language": "Hindi/English/Tamil/Kannada/Telugu/Marathi/etc."
}

If any field cannot be determined from the document, set it to null — EXCEPT state and district which must always have a value.
Return ONLY the JSON object, no other text."""


class DocumentParserAgent(BaseAgent[str, ExtractedData]):
    def __init__(self):
        super().__init__("DocumentParserAgent")
        self.client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_LOCATION,
        )

    async def run(self, gcs_path: str, document_id: str) -> ExtractedData:
        await self._update_progress(document_id, "Parsing document content with Gemini Vision...", 10, "parsing_started")

        try:
            # Download document from GCS
            file_bytes = await gcs.download_file_bytes(gcs_path)

            # Determine MIME type from path
            mime_type = "application/pdf"
            if gcs_path.lower().endswith((".jpg", ".jpeg")):
                mime_type = "image/jpeg"
            elif gcs_path.lower().endswith(".png"):
                mime_type = "image/png"
            elif gcs_path.lower().endswith(".tiff"):
                mime_type = "image/tiff"

            # Call Gemini for multimodal document analysis (async, with retry on transient errors)
            from app.core.retry import retry_async

            async def _call_gemini():
                return await self.client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[
                        types.Content(
                            role="user",
                            parts=[
                                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                                types.Part.from_text(text="Extract all information from this Indian land document as structured JSON."),
                            ],
                        )
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=PARSER_SYSTEM_PROMPT,
                        temperature=0.1,
                        response_mime_type="application/json",
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )

            response = await retry_async(_call_gemini, attempts=3, label="parser.gemini")

            # Parse response
            response_text = response.text.strip()
            parsed_json = json.loads(response_text)

            # Map to Pydantic models
            party_names = [Party(name=p.get("name", "Unknown"), role=p.get("role", "Unknown")) for p in parsed_json.get("party_names", [])]

            prop = parsed_json.get("property_details")
            property_details = None
            if prop:
                property_details = PropertyDetails(
                    survey_numbers=prop.get("survey_numbers") or [],
                    plot_numbers=prop.get("plot_numbers") or [],
                    area=prop.get("area"),
                    unit=prop.get("unit"),
                    address=prop.get("address"),
                    city=prop.get("city"),
                    district=prop.get("district"),
                    state=prop.get("state"),
                    country=prop.get("country") or "India",
                )

            reg = parsed_json.get("registration_info")
            registration_info = None
            if reg:
                registration_info = RegistrationInfo(
                    registration_number=reg.get("registration_number"),
                    registration_date=reg.get("registration_date"),
                    sub_registrar_office=reg.get("sub_registrar_office"),
                    book_number=reg.get("book_number"),
                    volume_number=reg.get("volume_number"),
                    page_numbers=reg.get("page_numbers"),
                )

            extracted_data = ExtractedData(
                document_type=parsed_json.get("document_type"),
                party_names=party_names,
                property_details=property_details,
                dates=parsed_json.get("dates") or {},
                registration_info=registration_info,
                stamp_duty_amount=parsed_json.get("stamp_duty_amount"),
                signatures_present=parsed_json.get("signatures_present"),
                document_language=parsed_json.get("document_language"),
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON for document {document_id}: {e}")
            await self._update_progress(document_id, f"Document parsing failed: Could not parse AI response", 100, "parsing_failed")
            # Return empty extracted data instead of crashing
            extracted_data = ExtractedData()
        except Exception as e:
            logger.error(f"Document parsing failed for {document_id}: {e}")
            await self._update_progress(document_id, f"Document parsing failed: {e}", 100, "parsing_failed")
            # Return empty extracted data instead of crashing
            extracted_data = ExtractedData()

        await self._update_progress(document_id, "Document parsing complete.", 25, "document_parsed", data=extracted_data.dict())
        return extracted_data
