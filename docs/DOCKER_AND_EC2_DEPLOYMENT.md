# SignVision — Docker & EC2 Deployment Guide

This document describes the direct Docker Compose and SSH-based deployment architecture for SignVision on AWS EC2.

---

## 1. Architecture Overview

SignVision runs directly on an AWS EC2 instance (`c7i-flex.large`, Ubuntu 24.04 LTS, `ap-south-1`) via **Docker Compose**.

- **signvision-gateway (Caddy 2.8)**: Containerized reverse proxy on port 80 (and 443). Routes `/core/*` to the Core NLP backend and `/video/*` to the Video Inference service. Internal ports (8000, 8001, 6379) are kept private within the Docker bridge network.
- **signvision-backend (Python 3.11)**: Core NLP, Groq LLM slot extraction, deterministic ISL grammar, dictionary lookup, and Redis translation caching. Runs CPU-optimized PyTorch to minimize disk footprint.
- **signvision-video-service (Python 3.11)**: Local ISL ML inference using scikit-learn, MediaPipe, and OpenCV. Standalone container with zero external LLM dependencies.
- **signvision-redis (Redis 7.2-alpine)**: In-memory cache for translation results (capped at 128 MB with `allkeys-lru` eviction policy). Fail-open design ensures backend stays active if Redis is offline.

---

## 2. Infrastructure & Host Specifications

- **AWS Region**: `ap-south-1` (Mumbai)
- **Instance ID**: `i-0d53d656ca85c6851`
- **Public IP**: `35.154.167.249`
- **Instance User**: `ubuntu`
- **Deployment Root**: `/opt/signvision`
- **Secrets Directory**: `/etc/signvision` (permissions `0600`)

---

## 3. GitHub Actions SSH Secrets & Variables

CI/CD builds and deploys directly to EC2 over SSH without any intermediate container registry (no ECR, no OIDC, no SSM).

### Repository Secrets (Settings -> Secrets and variables -> Actions -> Secrets)
- `EC2_SSH_PRIVATE_KEY`: Private SSH key for user `ubuntu` on the EC2 instance.
- `EC2_KNOWN_HOSTS`: Pinned host key entries for `35.154.167.249`.
- `GROQ_API_KEY`: API key for backend CI unit tests and slot extraction.
- `GROQ_API_KEY_FALLBACK_1`, `_2`, `_3`: Fallback keys for resilience testing.

### Repository Variables (Settings -> Secrets and variables -> Actions -> Variables)
- `EC2_HOST`: `35.154.167.249`
- `EC2_USER`: `ubuntu`
- `EC2_DEPLOY_PATH`: `/opt/signvision`
- `EXPO_PUBLIC_CORE_API_URL`: `http://35.154.167.249/core`
- `EXPO_PUBLIC_VIDEO_API_URL`: `http://35.154.167.249/video`

---

## 4. Production Secrets Management

Production secrets live exclusively on the EC2 host in `/etc/signvision/` and are never committed to git or exposed in workflow logs.

```bash
# On EC2:
sudo mkdir -p /etc/signvision
sudo chmod 700 /etc/signvision

# Backend environment:
sudo tee /etc/signvision/backend.env > /dev/null << 'EOF'
PORT=8000
GROQ_API_KEY=your_production_key_here
GROQ_API_KEYS=key1,key2,key3
GROQ_MODEL=openai/gpt-oss-20b
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_ENABLED=true
REDIS_CACHE_TTL=604800
TRANSLATION_CACHE_VERSION=v1
EOF

sudo chmod 600 /etc/signvision/backend.env /etc/signvision/video.env
```

---

## 5. Independent Service Deployment & Changed-Component Detection

The deployment script (`scripts/deploy-ec2.sh`) and GitHub Actions workflow (`.github/workflows/deploy-ec2.yml`) support targeted service updates:

1. **Video Service Only (`video-service/**`, `signvision_isl_inference_bundle/**`)**:
   ```bash
   docker compose build video-service
   docker compose up -d --no-deps video-service
   ```
   *Backend and Redis containers remain uninterrupted.*

2. **Backend Only (`backend/**`)**:
   ```bash
   docker compose build backend
   docker compose up -d --no-deps backend
   ```
   *Video service and Redis containers remain uninterrupted.*

3. **Full Stack / Config Changes (`compose.yaml`, `Caddyfile`, `scripts/**`)**:
   ```bash
   # Sequential build to protect 4GB RAM instance against OOM:
   docker compose build backend
   docker compose build video-service
   docker compose up -d --remove-orphans
   ```

---

## 6. Manual Deployment & Local Execution

### Local Testing with Docker Compose
```bash
# Validate compose syntax
docker compose config

# Run locally
docker compose up -d

# Verify services
curl http://localhost/core/health
curl http://localhost/video/health
```

### Manual Trigger via GitHub Actions
Trigger a manual deployment for any service target from the GitHub Web UI:
1. Navigate to **Actions** -> **SignVision Deploy to EC2**.
2. Click **Run workflow**.
3. Choose branch `main` and target: `all`, `backend`, or `video-service`.

---

## 7. Model Bundle Synchronization

The required ISL ML model files reside in `signvision_isl_inference_bundle/models/`:
- `sign_classifier.joblib`
- `model_metadata.json`
- `hand_landmarker.task`

If updating model files outside git, copy them directly to EC2:
```bash
scp -i key.pem signvision_isl_inference_bundle/models/* ubuntu@35.154.167.249:/opt/signvision/signvision_isl_inference_bundle/models/
ssh -i key.pem ubuntu@35.154.167.249 "cd /opt/signvision && docker compose build video-service && docker compose up -d --no-deps video-service"
```

---

## 8. Rollback Procedure

To roll back to a previous commit:
```bash
ssh -i key.pem ubuntu@35.154.167.249
cd /opt/signvision
git checkout <PREVIOUS_COMMIT_SHA>
./scripts/deploy-ec2.sh all <PREVIOUS_COMMIT_SHA>
```

---

## 9. Observability & Health Verification

```bash
# Check container status
docker compose -f /opt/signvision/compose.yaml ps

# Stream logs
docker compose -f /opt/signvision/compose.yaml logs -f backend
docker compose -f /opt/signvision/compose.yaml logs -f video-service

# Verify Redis cache status
docker exec -it signvision-redis redis-cli ping
docker exec -it signvision-redis redis-cli info memory
```

---

## 10. HTTPS & Mobile Web Limitations

The SignVision API gateway is currently exposed on HTTP port 80 at `http://35.154.167.249`.

> **Note on Browser Camera Security Contexts**:
> Modern mobile and desktop browsers (Chrome, Safari) restrict `navigator.mediaDevices.getUserMedia` (camera access) to secure contexts (`https://` or `localhost`).
> When running the React Native mobile app on physical Android/iOS devices, native camera APIs operate without this browser constraint. For mobile web browsers, configure a custom domain with automated Let's Encrypt TLS in `Caddyfile` once the domain is pointed to `35.154.167.249`.
