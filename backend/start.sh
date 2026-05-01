#!/bin/bash
# Start the FastAPI application using Uvicorn.
# The PORT environment variable is automatically set by Cloud Run.
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}