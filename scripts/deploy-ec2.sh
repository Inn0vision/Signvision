#!/usr/bin/env bash
# ==============================================================================
# SignVision — EC2 Remote Deployment Script
# Safely deploys backend, video-service, Redis, and Caddy via Docker Compose.
# Supports independent service builds to avoid restarting unrelated services.
# ==============================================================================
set -euo pipefail

TARGET="${1:-all}"
COMMIT_SHA="${2:-HEAD}"
DEPLOY_DIR="${EC2_DEPLOY_PATH:-/opt/signvision}"

echo "===================================================================="
echo "SignVision Deployment Initiated: Target=[$TARGET], Commit=[$COMMIT_SHA]"
echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "===================================================================="

cd "$DEPLOY_DIR"

# 1. Environment and Disk Space Verification
echo "[1/6] Verifying host environment & disk headroom..."
if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker engine is not installed on this host." >&2
    exit 1
fi

AVAIL_DISK_MB=$(df -m "$DEPLOY_DIR" | awk 'NR==2 {print $4}')
if [ "$AVAIL_DISK_MB" -lt 2048 ]; then
    echo "ERROR: Low disk space! Only ${AVAIL_DISK_MB}MB available in $DEPLOY_DIR (minimum 2048MB required)." >&2
    df -h "$DEPLOY_DIR"
    exit 1
fi
echo "Available disk: ${AVAIL_DISK_MB}MB (OK)"

# 2. Model Bundle Invariant Verification
echo "[2/6] Verifying ISL model bundle integrity..."
BUNDLE_DIR="$DEPLOY_DIR/signvision_isl_inference_bundle"
REQUIRED_MODELS=(
    "$BUNDLE_DIR/models/sign_classifier.joblib"
    "$BUNDLE_DIR/models/model_metadata.json"
    "$BUNDLE_DIR/models/hand_landmarker.task"
)
for model in "${REQUIRED_MODELS[@]}"; do
    if [ ! -f "$model" ]; then
        echo "ERROR: Required model file is missing: $model" >&2
        exit 1
    fi
done
echo "All required ISL model files verified."

# 3. Validate Docker Compose Syntax
echo "[3/6] Validating Docker Compose configuration..."
docker compose config --quiet
echo "Compose configuration syntax is valid."

# 4. Service-Specific Sequential Build & Deployment
echo "[4/6] Executing deployment for target: $TARGET..."

case "$TARGET" in
    video-service)
        echo "--> Building ONLY video-service..."
        docker compose build video-service
        echo "--> Recreating video-service without impacting backend or redis..."
        docker compose up -d --no-deps video-service
        ;;
    backend)
        echo "--> Building ONLY backend..."
        docker compose build backend
        echo "--> Recreating backend without impacting video-service or redis..."
        docker compose up -d --no-deps backend
        ;;
    all|*)
        echo "--> Sequential build of all services to prevent memory exhaustion..."
        echo "  [1/2] Building backend..."
        docker compose build backend
        echo "  [2/2] Building video-service..."
        docker compose build video-service
        echo "--> Launching entire SignVision stack (Redis, Backend, Video-Service, Caddy)..."
        docker compose up -d --remove-orphans
        ;;
esac

# 5. Live Healthcheck Verification Loop
echo "[5/6] Verifying service health..."
MAX_ATTEMPTS=25
SLEEP_SECS=3

check_backend() {
    curl -s -f http://127.0.0.1/core/health >/dev/null 2>&1
}

check_video() {
    curl -s -f http://127.0.0.1/video/health >/dev/null 2>&1
}

check_gateway() {
    curl -s -f http://127.0.0.1/ >/dev/null 2>&1
}

VERIFIED=false
for i in $(seq 1 $MAX_ATTEMPTS); do
    BACKEND_OK=true
    VIDEO_OK=true
    GATEWAY_OK=true

    if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
        check_backend || BACKEND_OK=false
    fi
    if [ "$TARGET" = "video-service" ] || [ "$TARGET" = "all" ]; then
        check_video || VIDEO_OK=false
    fi
    if [ "$TARGET" = "all" ]; then
        check_gateway || GATEWAY_OK=false
    fi

    if [ "$BACKEND_OK" = true ] && [ "$VIDEO_OK" = true ] && [ "$GATEWAY_OK" = true ]; then
        VERIFIED=true
        echo "All target services verified healthy on attempt $i/$MAX_ATTEMPTS."
        break
    fi

    echo "Waiting for services to become healthy ($i/$MAX_ATTEMPTS)..."
    sleep $SLEEP_SECS
done

if [ "$VERIFIED" = false ]; then
    echo "ERROR: Health checks timed out after $((MAX_ATTEMPTS * SLEEP_SECS)) seconds!" >&2
    echo "=== Service Status ==="
    docker compose ps
    echo "=== Recent Backend Logs ==="
    docker compose logs --tail=30 backend || true
    echo "=== Recent Video-Service Logs ==="
    docker compose logs --tail=30 video-service || true
    exit 1
fi

# 6. Verification Summary
echo "[6/6] Finalizing deployment status..."
docker compose ps

echo "===================================================================="
echo "SignVision Deployment SUCCESSFUL: Target=[$TARGET], Commit=[$COMMIT_SHA]"
echo "===================================================================="
