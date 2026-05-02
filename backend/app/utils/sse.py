import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _default_serializer(obj):
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat() + "Z" if not obj.tzinfo else obj.isoformat()
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'value'):  # Handle enums
        return obj.value
    return str(obj)

async def send_sse_message(document_id: str, event_type: str, message: str, progress: int, data: Optional[Dict[str, Any]] = None):
    """
    Sends a Server-Sent Event message. In a real application, this would
    publish to a message queue (e.g., Redis Pub/Sub, Google Pub/Sub)
    that the SSE endpoint subscribes to. For now, it's a placeholder.
    """
    # Placeholder: In a real system, this would publish to a channel
    # specific to the document_id.
    
    # For local testing or simple setups, you might store this in a temporary
    # in-memory store that the EventSourceResponse can read from.
    # However, for scalability, a dedicated message broker is required.
    
    # The actual FastAPI SSE endpoint will format and send the data.
    # This function primarily prepares the payload.
    
    payload = {
        "event_type": event_type,
        "message": message,
        "progress": progress,
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "data": data if data is not None else {}
    }
    
    # print(f"SSE Message for document {document_id}: {json.dumps(payload)}") # For debugging

def generate_sse_event(event: str, data: Dict[str, Any], message: str, progress: int) -> str:
    """
    Generates a Server-Sent Event formatted string.
    """
    payload = {
        "event_type": event,
        "message": message,
        "progress": progress,
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "data": data
    }
    return f"event: {event}\ndata: {json.dumps(payload, default=_default_serializer)}\n\n"
