# Stage 1: Build
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

RUN groupadd -r landguard && useradd -r -g landguard -m landguard

COPY --from=builder /root/.local /home/landguard/.local
COPY . .

ENV PATH=/home/landguard/.local/bin:$PATH
# Cloud Run injects PORT at runtime; default to 8000 for local docker runs
ENV PORT=8000

RUN chown -R landguard:landguard /app
USER landguard

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD python -c "import urllib.request,os; urllib.request.urlopen(f\"http://localhost:{os.environ.get('PORT','8000')}/api/v1/health\")" || exit 1

# Start with Gunicorn using Uvicorn workers; honour Cloud Run's $PORT
CMD ["sh", "-c", "exec gunicorn -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} app.main:app --workers ${WEB_CONCURRENCY:-2} --timeout 300 --graceful-timeout 30"]
