"""
Google Cloud Pub/Sub integration for async analysis job processing.
Enables scalable, decoupled document analysis pipeline.
"""
import json
import logging
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_publisher = None
_topic_path = None


def _get_publisher():
    """Lazy-initialize Pub/Sub publisher."""
    global _publisher, _topic_path
    if _publisher is not None:
        return _publisher, _topic_path

    if not settings.PUBSUB_ENABLED:
        logger.info("Pub/Sub disabled. Using direct async processing.")
        return None, None

    try:
        from google.cloud import pubsub_v1
        _publisher = pubsub_v1.PublisherClient()
        _topic_path = _publisher.topic_path(settings.GCP_PROJECT_ID, settings.PUBSUB_TOPIC_ANALYSIS)
        logger.info(f"Pub/Sub publisher initialized: {_topic_path}")
        return _publisher, _topic_path
    except Exception as e:
        logger.warning(f"Pub/Sub initialization failed (will use direct async): {e}")
        return None, None


async def publish_analysis_job(
    document_ids: List[str],
    user_id: str,
    state: str = "",
    district: str = "",
    priority: str = "normal",
) -> Optional[str]:
    """
    Publish an analysis job to Pub/Sub.
    Returns message_id if successful, None if Pub/Sub unavailable.
    """
    publisher, topic_path = _get_publisher()
    if not publisher:
        return None

    message = {
        "job_type": "document_analysis",
        "document_ids": document_ids,
        "user_id": user_id,
        "state": state,
        "district": district,
        "priority": priority,
    }

    try:
        future = publisher.publish(
            topic_path,
            data=json.dumps(message).encode("utf-8"),
            job_type="document_analysis",
            priority=priority,
            user_id=user_id,
        )
        message_id = future.result(timeout=5)
        logger.info(f"Published analysis job to Pub/Sub: message_id={message_id}, docs={document_ids}")
        return message_id
    except Exception as e:
        logger.error(f"Failed to publish to Pub/Sub: {e}")
        return None


async def publish_fraud_alert(
    document_id: str,
    user_id: str,
    risk_score: float,
    fraud_findings: List[Dict[str, Any]],
) -> Optional[str]:
    """
    Publish a fraud alert event for cross-user pattern detection.
    Consumed by BigQuery streaming pipeline.
    """
    publisher, topic_path = _get_publisher()
    if not publisher:
        return None

    message = {
        "job_type": "fraud_alert",
        "document_id": document_id,
        "user_id": user_id,
        "risk_score": risk_score,
        "fraud_types": [f["fraud_type"] for f in fraud_findings if f.get("is_suspicious")],
        "severity_max": max((f.get("severity", "low") for f in fraud_findings), default="low"),
    }

    try:
        future = publisher.publish(
            topic_path,
            data=json.dumps(message).encode("utf-8"),
            job_type="fraud_alert",
        )
        message_id = future.result(timeout=5)
        logger.info(f"Published fraud alert: doc={document_id}, score={risk_score}")
        return message_id
    except Exception as e:
        logger.error(f"Failed to publish fraud alert: {e}")
        return None


async def publish_embedding_job(document_id: str, extracted_text: str) -> Optional[str]:
    """Publish a job to generate and store document embeddings."""
    publisher, topic_path = _get_publisher()
    if not publisher:
        return None

    message = {
        "job_type": "generate_embedding",
        "document_id": document_id,
        "text": extracted_text[:10000],  # Truncate for Pub/Sub message size limits
    }

    try:
        future = publisher.publish(
            topic_path,
            data=json.dumps(message).encode("utf-8"),
            job_type="generate_embedding",
        )
        return future.result(timeout=5)
    except Exception as e:
        logger.error(f"Failed to publish embedding job: {e}")
        return None
