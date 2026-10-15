# Production Dockerfile for SignVision Video Microservice (Local ISL ML)
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8001 \
    PYTHONPATH=/app/signvision_isl_inference_bundle:/app/video-service

# Install system dependencies (curl for healthcheck, libglib for OpenCV dependencies if needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libglib2.0-0 \
    libegl1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged application user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser

WORKDIR /app

# Copy and install video service dependencies
COPY video-service/requirements.txt ./video-service/requirements.txt
RUN pip install --no-cache-dir -r ./video-service/requirements.txt

# Copy model inference bundle and video service code
COPY signvision_isl_inference_bundle/ /app/signvision_isl_inference_bundle/
COPY video-service/ /app/video-service/

# Create temporary upload storage directory with permissions
RUN mkdir -p /tmp/signvision_uploads && chown -R appuser:appuser /app /tmp/signvision_uploads

WORKDIR /app/video-service

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
