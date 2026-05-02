"""
Vertex AI embedding service for document similarity and fraud pattern matching.
Uses text-embedding-005 model to generate embeddings for document content.
Enables: finding similar fraudulent documents, clustering fraud patterns.
"""
import json
import logging
from typing import List, Optional, Dict, Any
from app.core.config import settings
from app.services import cache

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    """Lazy-initialize Vertex AI embedding model."""
    global _model
    if _model is not None:
        return _model

    try:
        from google.cloud import aiplatform
        from vertexai.language_models import TextEmbeddingModel

        aiplatform.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)
        _model = TextEmbeddingModel.from_pretrained(settings.VERTEX_EMBEDDING_MODEL)
        logger.info(f"Vertex AI embedding model loaded: {settings.VERTEX_EMBEDDING_MODEL}")
        return _model
    except Exception as e:
        logger.warning(f"Vertex AI embedding model initialization failed: {e}")
        return None


def _document_to_text(extracted_data: dict) -> str:
    """Convert extracted document data to a text representation for embedding."""
    parts = []

    if extracted_data.get("document_type"):
        parts.append(f"Document Type: {extracted_data['document_type']}")

    if extracted_data.get("party_names"):
        names = [f"{p.get('name', '')} ({p.get('role', '')})" for p in extracted_data["party_names"]]
        parts.append(f"Parties: {', '.join(names)}")

    prop = extracted_data.get("property_details")
    if prop:
        if prop.get("address"):
            parts.append(f"Address: {prop['address']}")
        if prop.get("survey_numbers"):
            parts.append(f"Survey Numbers: {', '.join(prop['survey_numbers'])}")
        if prop.get("state"):
            parts.append(f"State: {prop['state']}")
        if prop.get("district"):
            parts.append(f"District: {prop['district']}")
        if prop.get("area"):
            parts.append(f"Area: {prop['area']} {prop.get('unit', '')}")

    if extracted_data.get("stamp_duty_amount"):
        parts.append(f"Stamp Duty: {extracted_data['stamp_duty_amount']}")

    dates = extracted_data.get("dates", {})
    for key, val in dates.items():
        if val:
            parts.append(f"{key}: {val}")

    return " | ".join(parts)


async def generate_embedding(document_id: str, extracted_data: dict) -> Optional[List[float]]:
    """
    Generate embedding vector for a document.
    Uses Redis cache to avoid re-computation.
    """
    # Check cache first
    cached = await cache.get_cached_embedding(document_id)
    if cached:
        return cached

    model = _get_model()
    if not model:
        return None

    try:
        text = _document_to_text(extracted_data)
        if not text or len(text) < 10:
            return None

        embeddings = model.get_embeddings([text])
        if embeddings and embeddings[0].values:
            vector = embeddings[0].values
            # Cache for 30 days
            await cache.set_cached_embedding(document_id, vector)
            logger.info(f"Generated embedding for document {document_id} (dim={len(vector)})")
            return vector
        return None
    except Exception as e:
        logger.warning(f"Embedding generation failed for {document_id}: {e}")
        return None


async def find_similar_documents(
    document_id: str,
    extracted_data: dict,
    all_document_ids: List[str],
    threshold: float = 0.8,
) -> List[Dict[str, Any]]:
    """
    Find documents similar to the given one using cosine similarity.
    Useful for detecting duplicate/forged documents or same-property scams.
    """
    query_embedding = await generate_embedding(document_id, extracted_data)
    if not query_embedding:
        return []

    similar = []
    for other_id in all_document_ids:
        if other_id == document_id:
            continue

        other_embedding = await cache.get_cached_embedding(other_id)
        if not other_embedding:
            continue

        # Cosine similarity
        similarity = _cosine_similarity(query_embedding, other_embedding)
        if similarity >= threshold:
            similar.append({
                "document_id": other_id,
                "similarity": round(similarity, 4),
            })

    # Sort by similarity descending
    similar.sort(key=lambda x: x["similarity"], reverse=True)
    return similar[:10]


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)
