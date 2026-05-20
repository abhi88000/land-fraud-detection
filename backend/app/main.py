import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.endpoints import analysis, bundles, documents
from app.core.config import settings
from app.core.logging_config import configure_logging, new_request_id, set_request_id

configure_logging()
logger = logging.getLogger("landshield.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup + graceful shutdown."""
    logger.info("Landshield API starting", extra={"project": settings.GCP_PROJECT_ID})
    try:
        yield
    finally:
        # Give in-flight asyncio tasks a brief window to finish.
        pending = [t for t in asyncio.all_tasks() if not t.done() and t is not asyncio.current_task()]
        if pending:
            logger.info("Draining in-flight tasks", extra={"pending": len(pending)})
            try:
                await asyncio.wait(pending, timeout=10)
            except Exception:  # noqa: BLE001
                logger.exception("Error during task drain")
        logger.info("Landshield API stopped")


# Disable OpenAPI in production unless explicitly enabled.
_enable_docs = os.getenv("ENABLE_DOCS", "true").lower() == "true"

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=(f"{settings.API_V1_STR}/openapi.json" if _enable_docs else None),
    docs_url=("/docs" if _enable_docs else None),
    redoc_url=("/redoc" if _enable_docs else None),
    version="1.0.0",
    description="AI-powered land document verification platform for detecting fraud in Indian land transactions.",
    redirect_slashes=False,
    lifespan=lifespan,
)


# --- Middleware: request ID + access log --------------------------------------
@app.middleware("http")
async def request_context(request: Request, call_next):
    # Honour incoming X-Request-Id; otherwise mint a new one.
    rid = request.headers.get("x-request-id") or new_request_id()
    set_request_id(rid)
    start = datetime.now(timezone.utc)
    try:
        response = await call_next(request)
    except Exception:  # noqa: BLE001 - handled by global exception handler too
        logger.exception(
            "Unhandled exception in request",
            extra={"method": request.method, "path": request.url.path},
        )
        raise
    duration_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
    response.headers["X-Request-Id"] = rid
    # Skip noisy health-check logs.
    if not request.url.path.endswith("/health"):
        logger.info(
            "request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
    return response


# Force HTTPS scheme when behind Cloud Run / load balancer.
@app.middleware("http")
async def force_https_scheme(request: Request, call_next):
    if request.headers.get("x-forwarded-proto") == "https":
        request.scope["scheme"] = "https"
    return await call_next(request)


# --- CORS ---------------------------------------------------------------------
default_origins = (
    "http://localhost:3000,http://localhost:8080,"
    "https://land-guard-web-593405835352.us-central1.run.app,"
    "https://land-guard-web-uvgzgnof7a-uc.a.run.app"
)
cors_origins = os.getenv("CORS_ORIGINS", default_origins).split(",")
cors_origins = [o.strip() for o in cors_origins if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
    expose_headers=["X-Request-Id"],
)


# --- Exception handlers -------------------------------------------------------
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Keep client-visible 4xx messages; suppress detail for 5xx.
    detail = exc.detail if exc.status_code < 500 else "Internal server error"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": detail, "request_id": request.headers.get("x-request-id", "-")},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "Invalid request",
            "details": exc.errors(),
            "request_id": request.headers.get("x-request-id", "-"),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception", extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "request_id": request.headers.get("x-request-id", "-"),
        },
    )


# --- Routers ------------------------------------------------------------------
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/documents", tags=["documents"])
app.include_router(analysis.router, prefix=f"{settings.API_V1_STR}/analysis", tags=["analysis"])
app.include_router(bundles.router, prefix=f"{settings.API_V1_STR}/bundles", tags=["bundles"])


@app.get("/")
async def root():
    return {"message": "Welcome to Landshield API. Visit /docs for API documentation."}


@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    """Liveness probe — always cheap, never touches downstream services."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
    }


@app.get(f"{settings.API_V1_STR}/readyz")
async def readiness_check():
    """Readiness probe — reports downstream availability for Cloud Run diagnostics."""
    from app.services.cache import get_redis_client
    from app.services.monitoring import get_metrics_summary

    redis_status = "disabled"
    if settings.REDIS_ENABLED:
        client = get_redis_client()
        redis_status = "connected" if client else "unavailable"

    return {
        "status": "ready",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "project": settings.GCP_PROJECT_ID,
        "services": {
            "redis": redis_status,
            "pubsub": "enabled" if settings.PUBSUB_ENABLED else "disabled",
            "bigquery": "enabled" if settings.BIGQUERY_ENABLED else "disabled",
        },
        "metrics": get_metrics_summary(),
    }
