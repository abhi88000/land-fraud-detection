import json
import logging
import re
from datetime import datetime, timezone
from typing import List

from app.agents.core.base import BaseAgent
from app.core.config import settings
from app.models.analysis import ExtractedData, NewsItem
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


NEWS_SYSTEM_PROMPT = """You are a research assistant that surfaces RECENT, REAL news about land disputes, title disputes, illegal encroachment, registration scams, benami transactions, RERA actions, and high-court land judgments — scoped to a specific district or state in India.

CORE RULES:
1. Use Google Search. Only return items you can find a real source for. NEVER invent a story or URL.
2. Prefer items from the last 24 months. If you cannot find anything specific to the district, broaden to the state — but say so in `relevance`.
3. For each item, capture: title, a 1-2 sentence neutral summary, source publication name, a working URL, and the publication date in ISO format (YYYY-MM-DD) if you can determine it. If the date is approximate, prefix with "~".
4. `relevance` must be a single short sentence explaining WHY this matters for someone evaluating a land document in this region (e.g. "Same district — pattern of forged 7/12 extracts", or "State-wide — recent SC ruling affects sale-deed validity").
5. Skip items that are unrelated to land/property/title/registration.
6. Return AT MOST 6 items, sorted newest-first.
7. If nothing relevant is found, return an empty array. Do NOT fill with generic news.

OUTPUT — JSON array (may be empty), nothing else:
[
  {
    "title": "...",
    "summary": "...",
    "source": "Times of India",
    "url": "https://...",
    "published_at": "2025-03-14",
    "relevance": "..."
  }
]
Return ONLY the JSON array. No prose, no markdown fences."""


def _parse_json_array(text: str) -> list:
    text = text.strip()
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()
    # In case the model returns prose wrapping a JSON array
    m = re.search(r"\[\s*(?:\{.*?\}\s*,?\s*)*\]", text, flags=re.DOTALL)
    if m:
        text = m.group(0)
    try:
        return json.loads(text)
    except Exception:
        return []


class RegionalNewsAgent(BaseAgent[ExtractedData, List[NewsItem]]):
    """Surface recent land/title-related news for the parcel's region using grounded search."""

    def __init__(self):
        super().__init__("RegionalNewsAgent")
        self.client = genai.Client(
            vertexai=True,
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_LOCATION,
        )

    async def run(self, extracted_data: ExtractedData, document_id: str) -> List[NewsItem]:
        await self._update_progress(
            document_id,
            "Looking up recent land-related news in this region...",
            60,
            "regional_news_started",
        )

        district = ""
        state = ""
        if extracted_data.property_details:
            district = extracted_data.property_details.district or ""
            state = extracted_data.property_details.state or ""

        if not district and not state:
            await self._update_progress(
                document_id,
                "No region available — skipping news lookup.",
                70,
                "regional_news_skipped",
            )
            return []

        prompt_text = (
            f"TODAY'S DATE: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}.\n"
            f"REGION: district='{district or 'unknown'}', state='{state or 'unknown'}', country='India'.\n\n"
            f"Find recent, real news articles about land disputes, title disputes, encroachment, "
            f"registration fraud, RERA actions, benami transactions, or high-court land judgments "
            f"in this district or state. Prefer the last 24 months. "
            f"Return ONLY the JSON array described in the system instructions."
        )

        try:
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
                        system_instruction=NEWS_SYSTEM_PROMPT,
                        temperature=0.3,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                        tools=[types.Tool(google_search=types.GoogleSearch())],
                    ),
                )

            response = await retry_async(_call_gemini, attempts=2, label="news.gemini")
            raw = _parse_json_array(response.text or "")
        except Exception as e:
            logger.warning(f"Regional news lookup failed for {document_id}: {e}")
            raw = []

        items: List[NewsItem] = []
        for r in raw[:6]:
            if not isinstance(r, dict):
                continue
            url = (r.get("url") or "").strip()
            title = (r.get("title") or "").strip()
            if not title:
                continue
            items.append(
                NewsItem(
                    title=title,
                    summary=(r.get("summary") or "").strip(),
                    source=(r.get("source") or "").strip() or None,
                    url=url or None,
                    published_at=(r.get("published_at") or "").strip() or None,
                    relevance=(r.get("relevance") or "").strip() or None,
                )
            )

        await self._update_progress(
            document_id,
            f"Regional news lookup complete — {len(items)} item{'s' if len(items) != 1 else ''}.",
            74,
            "regional_news_completed",
            data=[i.dict() for i in items],
        )
        return items
