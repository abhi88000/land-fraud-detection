from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.endpoints import documents, analysis
import logging
import os
from datetime import datetime, timezone

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    version="1.0.0",
    description="AI-powered land document verification platform for detecting fraud in Indian land transactions.",
    redirect_slashes=False
)

# Middleware to set X-Forwarded-Proto for proper HTTPS redirect handling
@app.middleware("http")
async def force_https_scheme(request: Request, call_next):
    if request.headers.get("x-forwarded-proto") == "https":
        request.scope["scheme"] = "https"
    return await call_next(request)

# CORS - allow configured origins, Cloud Run URLs, and dev origins
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
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/documents", tags=["documents"])
app.include_router(analysis.router, prefix=f"{settings.API_V1_STR}/analysis", tags=["analysis"])

@app.get("/")
async def root():
    return {"message": "Welcome to LandGuard API. Visit /docs for API documentation."}

@app.get(f"{settings.API_V1_STR}/health")
async def health_check():
    from app.services.monitoring import get_metrics_summary
    from app.services.cache import get_redis_client

    redis_status = "disabled"
    if settings.REDIS_ENABLED:
        client = get_redis_client()
        redis_status = "connected" if client else "unavailable"

    return {
        "status": "healthy",
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
