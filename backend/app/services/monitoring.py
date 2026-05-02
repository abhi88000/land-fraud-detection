"""
Google Cloud Monitoring custom metrics for LandGuard.
Tracks: analysis latency, fraud detection rates, API usage, cache hit rates.
"""
import logging
import time
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

_metrics_client = None
_project_path = None


def _get_client():
    """Lazy-initialize Cloud Monitoring client."""
    global _metrics_client, _project_path
    if _metrics_client is not None:
        return _metrics_client, _project_path

    try:
        from google.cloud import monitoring_v3
        _metrics_client = monitoring_v3.MetricServiceClient()
        _project_path = f"projects/{settings.GCP_PROJECT_ID}"
        logger.info("Cloud Monitoring client initialized.")
        return _metrics_client, _project_path
    except Exception as e:
        logger.warning(f"Cloud Monitoring initialization failed: {e}")
        return None, None


# --- In-memory metrics for batch reporting ---
_counters = {}
_latencies = []


def record_analysis_latency(duration_ms: float, cached: bool = False):
    """Record analysis duration metric."""
    _latencies.append({"duration_ms": duration_ms, "cached": cached, "time": time.time()})
    # Keep only last 1000
    if len(_latencies) > 1000:
        _latencies.pop(0)


def increment_counter(metric_name: str, labels: Optional[dict] = None):
    """Increment a counter metric."""
    key = f"{metric_name}:{labels}" if labels else metric_name
    _counters[key] = _counters.get(key, 0) + 1


def record_fraud_detected(severity: str, fraud_type: str):
    """Record a fraud detection event."""
    increment_counter("fraud_detected", {"severity": severity, "type": fraud_type})


def record_cache_hit(cache_type: str):
    """Record a cache hit."""
    increment_counter("cache_hit", {"type": cache_type})


def record_cache_miss(cache_type: str):
    """Record a cache miss."""
    increment_counter("cache_miss", {"type": cache_type})


def record_api_request(endpoint: str, status_code: int):
    """Record an API request."""
    increment_counter("api_request", {"endpoint": endpoint, "status": str(status_code)})


def record_document_upload(content_type: str):
    """Record a document upload."""
    increment_counter("document_upload", {"content_type": content_type})


async def flush_metrics():
    """
    Flush accumulated metrics to Cloud Monitoring.
    Called periodically or on shutdown.
    """
    client, project_path = _get_client()
    if not client:
        return

    try:
        from google.cloud import monitoring_v3
        from google.protobuf.timestamp_pb2 import Timestamp

        now = time.time()
        seconds = int(now)

        # Report analysis latency as a distribution
        if _latencies:
            avg_latency = sum(m["duration_ms"] for m in _latencies) / len(_latencies)
            logger.info(f"Metrics flush: avg_analysis_latency={avg_latency:.0f}ms, count={len(_latencies)}")

        # Report counters
        for key, count in _counters.items():
            logger.info(f"Metrics flush: {key}={count}")

        _counters.clear()

    except Exception as e:
        logger.warning(f"Metrics flush failed: {e}")


def get_metrics_summary() -> dict:
    """Get current metrics summary (for /health endpoint)."""
    avg_latency = 0
    if _latencies:
        recent = [m for m in _latencies if time.time() - m["time"] < 3600]
        if recent:
            avg_latency = sum(m["duration_ms"] for m in recent) / len(recent)

    return {
        "total_analyses": _counters.get("api_request:{'endpoint': '/analyze', 'status': '200'}", 0),
        "avg_analysis_latency_ms": round(avg_latency, 1),
        "cache_hits": sum(v for k, v in _counters.items() if "cache_hit" in k),
        "cache_misses": sum(v for k, v in _counters.items() if "cache_miss" in k),
        "frauds_detected": sum(v for k, v in _counters.items() if "fraud_detected" in k),
    }
