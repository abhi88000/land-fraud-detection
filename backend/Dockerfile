# Stage 1: Build
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

RUN groupadd -r landguard && useradd -r -g landguard -m landguard

COPY --from=builder /root/.local /home/landguard/.local
COPY . .

ENV PATH=/home/landguard/.local/bin:$PATH
ENV PORT=8000

RUN chown -R landguard:landguard /app
USER landguard

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

# Start with Gunicorn using Uvicorn workers
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "app.main:app", "--workers", "2", "--timeout", "300", "--graceful-timeout", "300"]
