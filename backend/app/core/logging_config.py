"""Structured JSON logging for Cloud Run / Cloud Logging.

Emits one JSON object per log record on stdout. Cloud Logging picks up the
fields automatically (severity, message, request_id, etc.) when the log line
is valid JSON.

Also provides a contextvar-based request_id so any log line during a request
gets correlated to the incoming request.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

_request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# Map Python log levels to Cloud Logging severities.
_SEVERITY = {
    "DEBUG": "DEBUG",
    "INFO": "INFO",
    "WARNING": "WARNING",
    "ERROR": "ERROR",
    "CRITICAL": "CRITICAL",
}


def set_request_id(rid: str) -> None:
    _request_id_var.set(rid)


def get_request_id() -> str:
    return _request_id_var.get()


def new_request_id() -> str:
    return uuid.uuid4().hex[:16]


class JsonFormatter(logging.Formatter):
    """Render LogRecord as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        payload: dict[str, Any] = {
            "severity": _SEVERITY.get(record.levelname, record.levelname),
            "message": record.getMessage(),
            "logger": record.name,
            "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
            "request_id": _request_id_var.get(),
        }
        if record.exc_info:
            payload["stack_trace"] = self.formatException(record.exc_info)
        # Allow extra={...} fields on the logger call to flow through.
        for k, v in record.__dict__.items():
            if k in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
            ):
                continue
            try:
                json.dumps(v)
                payload[k] = v
            except (TypeError, ValueError):
                payload[k] = str(v)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    """Replace the root logger with a single JSON-stdout handler.

    Falls back to a plain text formatter when ``LOG_FORMAT=text`` (handy
    locally). Idempotent — safe to call more than once.
    """
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    if os.getenv("LOG_FORMAT", "json").lower() == "text":
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s - %(message)s")
        )
    else:
        handler.setFormatter(JsonFormatter())

    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    root.addHandler(handler)

    # Quiet third-party noise.
    for noisy in ("uvicorn.access", "google.auth.transport.requests"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
