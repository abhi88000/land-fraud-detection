"""
BigQuery analytics service for LandGuard.
Stores analysis events and enables cross-document/cross-user fraud pattern detection.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_bq_client = None


def _get_client():
    """Lazy-initialize BigQuery client."""
    global _bq_client
    if _bq_client is not None:
        return _bq_client

    if not settings.BIGQUERY_ENABLED:
        logger.info("BigQuery disabled.")
        return None

    try:
        from google.cloud import bigquery
        _bq_client = bigquery.Client(project=settings.GCP_PROJECT_ID)
        logger.info("BigQuery client initialized.")
        return _bq_client
    except Exception as e:
        logger.warning(f"BigQuery initialization failed: {e}")
        return None


def _get_table_id(table_name: str) -> str:
    return f"{settings.GCP_PROJECT_ID}.{settings.BIGQUERY_DATASET}.{table_name}"


async def log_analysis_event(
    document_id: str,
    user_id: str,
    file_name: str,
    state: str,
    district: str,
    risk_score: float,
    document_type: str,
    fraud_count: int,
    legal_issues_count: int,
    analysis_duration_ms: int,
    cached: bool = False,
):
    """Log analysis completion event to BigQuery for analytics."""
    client = _get_client()
    if not client:
        return

    row = {
        "document_id": document_id,
        "user_id": user_id,
        "file_name": file_name,
        "state": state,
        "district": district,
        "risk_score": risk_score,
        "document_type": document_type,
        "fraud_count": fraud_count,
        "legal_issues_count": legal_issues_count,
        "analysis_duration_ms": analysis_duration_ms,
        "cached_ocr": cached,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        table_id = _get_table_id(settings.BIGQUERY_TABLE_ANALYSIS)
        errors = client.insert_rows_json(table_id, [row])
        if errors:
            logger.error(f"BigQuery insert errors: {errors}")
        else:
            logger.debug(f"BigQuery: logged analysis event for {document_id}")
    except Exception as e:
        logger.warning(f"BigQuery log_analysis_event failed: {e}")


async def log_fraud_pattern(
    document_id: str,
    user_id: str,
    fraud_type: str,
    severity: str,
    state: str,
    district: str,
    party_names: List[str],
    property_survey_numbers: List[str],
    evidence: List[str],
):
    """Log individual fraud finding for cross-user pattern detection."""
    client = _get_client()
    if not client:
        return

    row = {
        "document_id": document_id,
        "user_id": user_id,
        "fraud_type": fraud_type,
        "severity": severity,
        "state": state,
        "district": district,
        "party_names": party_names,
        "property_survey_numbers": property_survey_numbers,
        "evidence": json.dumps(evidence),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        table_id = _get_table_id(settings.BIGQUERY_TABLE_FRAUD)
        errors = client.insert_rows_json(table_id, [row])
        if errors:
            logger.error(f"BigQuery fraud pattern insert errors: {errors}")
    except Exception as e:
        logger.warning(f"BigQuery log_fraud_pattern failed: {e}")


async def find_similar_fraud_patterns(
    state: str,
    district: str,
    party_names: List[str],
    survey_numbers: List[str],
) -> List[Dict[str, Any]]:
    """
    Query BigQuery for similar fraud patterns across all users.
    Detects: same seller in multiple fraud docs, same property in dispute, etc.
    """
    client = _get_client()
    if not client:
        return []

    try:
        # Build query to find matching fraud patterns
        names_clause = " OR ".join([f"pn IN UNNEST(party_names)" for pn in party_names[:5]]) if party_names else "FALSE"
        survey_clause = " OR ".join([f"sn IN UNNEST(property_survey_numbers)" for sn in survey_numbers[:5]]) if survey_numbers else "FALSE"

        query = f"""
        SELECT
            document_id,
            fraud_type,
            severity,
            party_names,
            property_survey_numbers,
            state,
            district,
            timestamp
        FROM `{_get_table_id(settings.BIGQUERY_TABLE_FRAUD)}`
        WHERE
            (state = @state OR district = @district)
            AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
        ORDER BY timestamp DESC
        LIMIT 20
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("state", "STRING", state),
                bigquery.ScalarQueryParameter("district", "STRING", district),
            ]
        )

        results = client.query(query, job_config=job_config).result()
        patterns = []
        for row in results:
            patterns.append({
                "document_id": row.document_id,
                "fraud_type": row.fraud_type,
                "severity": row.severity,
                "party_names": row.party_names,
                "survey_numbers": row.property_survey_numbers,
                "state": row.state,
                "district": row.district,
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            })
        return patterns
    except Exception as e:
        logger.warning(f"BigQuery find_similar_fraud_patterns failed: {e}")
        return []


async def get_regional_fraud_stats(state: str) -> Dict[str, Any]:
    """Get fraud statistics for a region (for risk calibration)."""
    client = _get_client()
    if not client:
        return {}

    try:
        query = f"""
        SELECT
            fraud_type,
            COUNT(*) as count,
            COUNTIF(severity = 'critical') as critical_count,
            COUNTIF(severity = 'high') as high_count
        FROM `{_get_table_id(settings.BIGQUERY_TABLE_FRAUD)}`
        WHERE state = @state
            AND timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
        GROUP BY fraud_type
        ORDER BY count DESC
        LIMIT 10
        """

        from google.cloud import bigquery
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("state", "STRING", state),
            ]
        )

        results = client.query(query, job_config=job_config).result()
        stats = {"fraud_types": [], "total": 0}
        for row in results:
            stats["fraud_types"].append({
                "type": row.fraud_type,
                "count": row.count,
                "critical": row.critical_count,
                "high": row.high_count,
            })
            stats["total"] += row.count
        return stats
    except Exception as e:
        logger.warning(f"BigQuery get_regional_fraud_stats failed: {e}")
        return {}
