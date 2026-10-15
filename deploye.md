# SIGNVISION — EC2 + DOCKER COMPOSE + REDIS + GITHUB ACTIONS OVER SSH
## MASTER IMPLEMENTATION PROMPT — MODIFY THE EXISTING WORK, DO NOT START OVER

You are the DevOps engineer responsible for safely finishing the deployment of my existing SignVision application. Implement and verify it; do not merely provide instructions.

## 1. THE ONLY DEPLOYMENT APPROACH I WANT

Use:
- My **existing EC2 instance**.
- Docker Engine and Docker Compose.
- Separate containers for the existing core backend and local-ML video service.
- Redis in a private container for translation caching.
- GitHub Actions to test code and deploy it over **SSH**.
- Docker images built **directly on the existing EC2** from the exact source commit uploaded by GitHub Actions.

**Do not use or create Amazon ECR, AWS OIDC, AWS Systems Manager/SSM, Parameter Store, new AWS IAM deployment roles, a new S3 artifact bucket, a load balancer, a NAT Gateway, a new EC2 instance, or any other unnecessary AWS infrastructure.** Do not add these as future requirements or leave ECR as a deployment dependency. Caddy may be used as a containerized reverse proxy if needed for HTTPS/routing; it does not justify provisioning any new AWS infrastructure.

## 2. EXISTING TARGETS — VERIFY, DO NOT RECREATE

GitHub repository: `Pruthviraj141/Signvision`

Remote: `https://github.com/Pruthviraj141/Signvision`

Production branch: `main`

Existing EC2 details from the last verified audit:
- Instance ID: `i-0d53d656ca85c6851`
- Public IP reported: `35.154.167.249` (verify it is still correct)
- AWS account: `777724728464`
- AWS CLI profile: `newaccount`
- Region: `ap-south-1`
- OS: Ubuntu 24.04 LTS x86_64
- Instance type: `c7i-flex.large`, approximately 4 GiB RAM
- Disk: 30 GiB gp3
- Security group: `sg-0f01856ef711df384`
- SSH user: `ubuntu`
- Existing SSH key was previously used as `key.pem`, if it remains available

Never create, replace, resize, or terminate this instance. If you inspect AWS state, explicitly use `AWS_PROFILE=newaccount` and verify account `777724728464`. If that profile resolves to a different account or is unavailable, stop AWS mutations; do not fall back to the default profile.

## 3. IMPORTANT: A DEPLOYMENT ATTEMPT ALREADY STARTED

I interrupted the previous Antigravity execution and cancelled these GitHub Actions runs:
- `38789491219`
- `38788822853`

The terminal already showed these files being created:
- `compose.yaml`
- `.github/workflows/deploy-ec2.yml`
- `.github/workflows/ci.yml`

Another terminal command attempted an ECR login and tried to pull `777724728464.dkr.ecr.ap-south-1.amazonaws.com/signvision-backend:latest`.

**Do not start from scratch and do not create duplicate workflow files.** First inspect the current repository, these exact files, every file under `.github/workflows/`, the cancelled workflow runs, and the current EC2 state. Confirm the old runs are no longer active. Review what was actually created and whether any ECR-specific code or configuration remains.

Modify the existing `compose.yaml`, `ci.yml`, and `deploy-ec2.yml` in place where appropriate. Reuse correct work that already exists. Remove ECR login, ECR image names, image-push steps, OIDC/SSM steps, and registry assumptions from the deployment path. Do not add a second workflow that will deploy the same push twice.

There may already be ECR repositories, IAM roles, policies, or other resources from the previous attempt. **Do not use them for this deployment, and do not delete them blindly.** Audit and report any resources clearly related to the interrupted attempt; leave them untouched unless I explicitly approve deletion. Do not create any more AWS infrastructure for this deployment.

## 4. START WITH A SAFE AUDIT

Expected local repository root: `/mnt/projects/SignVision/Signvision`. Locate the actual root if it has moved.

Before editing:
1. Read `AGENTS.md` and follow its project invariants.
2. Read the README and current deployment documentation, if present.
3. Inspect `git status --short`, branch, remotes, staged changes and full relevant diffs.
4. Inspect `compose.yaml`, `compose.prod.yaml` if present, `ci.yml`, `deploy-ec2.yml`, every other workflow, Dockerfiles, `.gitignore`, `.dockerignore`, scripts, and environment examples.
5. Inspect the frontend's real API URL construction in `Application/src/services/apiService.ts`.
6. Inspect current backend/video code and actual model-loading paths.
7. Check which model files are tracked, ignored, present locally, or already present on EC2.
8. Check GitHub CLI authentication and repository write permissions. Inspect run status without printing secrets.
9. Verify SSH to the existing EC2 works, then check Docker, Compose, memory and free disk space.
10. Record current uncommitted and untracked files so they are preserved.

Do not use `git reset --hard`, `git clean -fdx`, destructive checkout operations, blind `git add -A`, force-push, or history rewriting. Never overwrite unrelated user work.

## 5. PRESERVE THE EXISTING APPLICATION

### Core backend

Inspect the active source and tests, including relevant files under `backend/app/`, `backend/requirements.txt`, and `backend/tests/`. Preserve the existing English/Hindi/Marathi processing, Groq-based semantic extraction if currently used, deterministic ISL gloss/grammar generation, dictionary/word lookup, fingerspelling fallback, transcription, API response formats, error handling and Redis translation cache.

Verify actual available routes such as `/health`, `/process`, `/process_text`, `/lookup`, `/search` and `/transcribe`; do not assume an endpoint exists just because it is listed here.

Use only the dependencies the current backend actually needs. Include FFmpeg only if transcription requires it. Avoid adding heavy unrelated NLP packages.

### Video service

Inspect `video-service/`, its tests and `signvision_isl_inference_bundle/`. Preserve the current local inference implementation and its real API contract (including `/api/translate-video` if still present) and `/health`. Do not revert to the old Gemini-based implementation or require `GEMINI_API_KEY` unless the current source actually needs it.

Keep the video-service image independent from the backend image. A code-only video-service change must not rebuild or restart backend or Redis.

### Frontend and dictionary

Preserve the existing Expo frontend, native speech recognition, camera screens, sign dictionary, S3 assets, avatar/WebView/CWASA playback and current UI. Do not redesign or rewrite the frontend as part of deployment.

Follow `AGENTS.md` for all copies of `sign_language_data.json` and run the actual synchronization check.

### Model bundle

Inspect the actual model loader and confirm the exact required files exist. Never publish private or unapproved model weights into a public repository simply to satisfy CI.

If the complete bundle is already intentionally tracked, include it in the exact source archive and video image. If required weights are ignored/untracked, preserve or securely copy them to a persistent directory on this existing EC2 (for example `/opt/signvision/shared/signvision_isl_inference_bundle`) and mount them read-only if compatible with the loader. Do not create an S3 bucket. Document how to manually synchronize future model bundle changes over SSH. A build must fail clearly if a required model file is missing; never silently produce a non-working video container.

## 6. TEST THE REAL CURRENT PROJECT

Run the available checks before and after changes. Previous test counts are historical only; do not assume they still pass. Run the applicable:
- Backend unit tests.
- Video-service tests and import/syntax checks.
- Model bundle smoke test where files are available.
- `cd Application && npx tsc --noEmit`.
- Expo web export only if the current project supports it.
- Dictionary synchronization.
- `git diff --check`.
- Docker Compose config validation and image builds.

Use mocks for Groq and other paid/external providers during CI. Do not make paid API calls just to pass tests. Record pre-existing failures separately from regressions.

## 7. DOCKER FILES AND COMPOSE

Create only missing essentials; prefer modifying existing files over adding duplicates. Keep the implementation easy to understand and maintain.

Required end result:
- `backend/Dockerfile`
- `video-service/Dockerfile`
- Existing root `compose.yaml` for local development.
- `compose.prod.yaml` for EC2 if separate production settings are required.
- An appropriate root `.dockerignore`.
- A tested deployment script, such as `scripts/deploy-ec2.sh`.
- Update the existing `.github/workflows/ci.yml` and `.github/workflows/deploy-ec2.yml`.
- `docs/DOCKER_AND_EC2_DEPLOYMENT.md`.

Do not create a registry-based workflow or multiple competing deployment workflows.

### Backend container

Use a compatible maintained slim Python image; install active requirements and actual OS dependencies. Copy only required source and runtime data. Exclude real `.env` files, SSH keys, `.git`, virtual environments, caches, `node_modules` and unrelated artifacts. Run as non-root, log to stdout/stderr, bind to `0.0.0.0:8000`, and start with one Uvicorn worker initially.

### Video container

Keep `video-service/requirements.txt` independent. Install only the compatible packages actually required by the code, use the verified model paths, run as non-root, bind to `0.0.0.0:8001`, start with one worker, provide writable temporary storage, and safely clean temporary uploads. Ensure the image contains or can read every required model artifact. Verify that the model loads inside the container.

### Redis

Use a maintained official Redis image on the private Compose network. The backend container must use `REDIS_URL=redis://redis:6379/0`, not localhost. Redis is a disposable cache; use approximately 128–256 MiB memory and `allkeys-lru` if compatible with the current cache implementation. Do not publish port 6379. Preserve fail-open behavior so loss of Redis does not take down the backend.

### Networking and Compose

Use the fixed Compose project name `signvision` for all releases. In local development, publishing backend/video ports to localhost is acceptable. In production, do not publish 8000, 8001 or 6379 publicly. If public routing is required, use Caddy as a containerized reverse proxy with public ports 80/443; it must route to backend/video containers internally. Include a static frontend container only if the existing Expo web export actually works; otherwise keep Android/iOS as a separately built native app.

Add working health checks, restart policies, bounded logs, sensible resource settings, and persistent Caddy data if Caddy is used. Do not make backend startup depend on Redis being healthy. Do not add a database or unrelated service.

## 8. GITHUB ACTIONS OVER SSH — NO ECR

Build Docker images directly on the existing EC2. GitHub Actions must not log into a registry, push images, or pull images from a registry.

The workflow must deploy the **exact commit that triggered it**, not a later commit fetched from `main`.

### GitHub workflow

Update the existing `.github/workflows/ci.yml` to run applicable code checks. Update the existing `.github/workflows/deploy-ec2.yml` to deploy after those checks pass and on `workflow_dispatch` for the first/full deployment. Inspect triggers carefully so one push does not trigger duplicate deployments.

For deployment:
1. Check out the exact triggering SHA.
2. Create a source archive from that checkout.
3. Exclude secrets, real `.env` files, `*.pem`, `.git`, virtual environments, caches, Python bytecode and `node_modules`.
4. Preserve Dockerfiles, Compose configuration, deployment scripts, lockfiles, required dictionaries and intended tracked model assets.
5. Transfer the archive to the existing EC2 using `scp` over SSH with host-key verification enabled.
6. Run the tested remote deployment script over SSH and wait for it to finish.
7. Verify real container health and return a failed workflow status if deployment or health checks fail.
8. Record the commit SHA and result.

Do not install GitHub credentials or personal access tokens on EC2 just to fetch source. Do not disable SSH host-key checking with `StrictHostKeyChecking=no`.

### GitHub Actions SSH variables and secrets

Use the fewest settings required.

**Repository secrets:**
- `EC2_SSH_PRIVATE_KEY`: SSH private key accepted by the existing EC2 host.
- `EC2_KNOWN_HOSTS`: verified host-key entries for the EC2 address, pinned and checked against the real server key.

**Repository variables:**
- `EC2_HOST`: verified current public address.
- `EC2_USER`: `ubuntu`.
- `EC2_DEPLOY_PATH`: `/opt/signvision`.

Prefer using the current `key.pem` only if it is accessible and suitable. Otherwise, create a dedicated SSH deploy key, add only its public key to the existing EC2 user's `authorized_keys`, and store its private key as the GitHub secret. Never put a private key in Git or workflow logs. Ensure key files are ignored by Git.

If `gh` is authenticated and authorized, configure secrets/variables directly without printing secret values. If it is not possible to do so safely, report the exact setting the user must add and continue all independent work.

Do not create or configure AWS deployment roles, OIDC, SSM, Parameter Store, or ECR.

## 9. RUNTIME SECRETS

Keep production secrets only on EC2 under `/etc/signvision/`, for example `/etc/signvision/backend.env` and `/etc/signvision/video.env` if the video service needs one. Use restrictive permissions, such as `chmod 600`, and do not put them under the source checkout.

Inspect the existing local `.env` without printing secret values. Transfer only variables the current application actually needs, using a secure SSH transfer. Preserve an existing production value if it differs from the local value unless it is safe and explicitly intended to be updated. Never invent a credential.

Do not put secret values in Dockerfiles, Compose files, source archives, GitHub variables, frontend `EXPO_PUBLIC_*` variables, or Git commits. GitHub should need the SSH deployment key but should not need the Groq API key for source deployment.

Update `.env.example` files with placeholder values only. Ensure actual `.env` and key files are ignored and excluded from archives/build contexts.

## 10. SAFE DEPLOYMENT AND SERVICE-SPECIFIC UPDATES

Use a stable deployment location such as `/opt/signvision`, with versioned release folders or another rollback-safe approach. Keep production env files under `/etc/signvision` and required non-tracked model files in a persistent location outside the release source.

The remote script must validate arguments and required files, check disk space and Docker availability, extract the exact uploaded commit, run Compose config validation, build only the selected service, and wait for actual health checks. Keep the active source and last-known-good release/image versions for rollback.

On a video-only code change, build and recreate only `video-service` (using the stable Compose project and `--no-deps` where appropriate). Do not restart `backend` or `redis`.

On a backend-only code change, build and recreate only `backend`. Do not restart `video-service` or `redis`.

On a frontend-only code change, run frontend checks and rebuild the web container only if a working web export exists. Do not rebuild Python images.

For the first deployment, start all required services. Changes to shared Compose/proxy/deploy configuration should update only the services that configuration actually affects.

Deploy images sequentially because this EC2 has approximately 4 GiB RAM and limited disk. Check memory and free disk space before the first build. Never routinely run `docker system prune -a`, remove volumes, delete model files, or remove the rollback image. If health checks fail, show safe diagnostic logs, mark deployment failed, and roll back only if the previous version can be restored safely and verify that rollback.

## 11. PUBLIC ROUTING AND URLS

Read the actual `Application/src/services/apiService.ts` before setting URLs or routing prefixes. Do not guess whether endpoints already include `/api` or another prefix.

Update local `Application/.env` in place, preserving unrelated variables. Use the verified current public host. The intended format, only if confirmed compatible with current path construction and working HTTPS, is:

`EXPO_PUBLIC_CORE_API_URL=https://<verified-host>/core`

`EXPO_PUBLIC_VIDEO_API_URL=https://<verified-host>/video`

Use Caddy only if needed to route to the private service ports. Do not invent a domain or create a paid load balancer or other AWS infrastructure. Test whether the currently supported Caddy/certificate setup can provide a publicly trusted HTTPS certificate for the available host. If that cannot be verified, report the limitation honestly; web browser camera features generally require a secure context, so do not claim those work on plain HTTP. If the application has no supported web export, preserve native mobile support and explain that native builds may need to be rebuilt to consume changed Expo public URL variables.

Verify the core API URL and video upload URL end up at the correct actual backend routes with no duplicated or missing prefixes. Never expose provider secrets through public frontend variables.

## 12. INITIAL DEPLOYMENT AND VALIDATION

First confirm the cancelled old workflow runs are no longer active and no competing legacy ECR workflow remains enabled. If ECR-specific workflows still exist, edit them in place to remove registry setup and deployment behavior. Do not create duplicate workflows.

Run all available tests and checks before pushing. Review the complete diff and confirm no secrets or private model artifacts are staged. Use `git diff --check`. Stage only reviewed intended files; do not use `git add -A` blindly.

Commit and push only the deployment files and necessary, reviewed, tested application changes to `main`. Never force-push or overwrite unrelated work. Trigger and monitor the real GitHub Actions deployment. Diagnose failed steps and fix safe, clear issues rather than rerunning unchanged failures.

After deployment, verify:
- Docker and Compose work on the existing EC2.
- Backend `/health` succeeds.
- Video-service `/health` succeeds and the actual model initializes.
- Redis responds to `PING` internally.
- Backend can connect to Redis but continues functioning if Redis is unavailable.
- An identical translation request produces the expected real cache miss then cache hit if the current implementation exposes this behavior.
- Required dictionary data loads.
- Model assets are available at paths expected by the current loader.
- A sample inference passes if a valid sample clip exists; otherwise mark live inference unverified.
- Frontend URLs reach the right routes.
- Redis, 8000 and 8001 are not publicly exposed.
- Running services correspond to the intended commit.
- No services are repeatedly restarting or being killed due to memory pressure.
- HTTPS certificate trust is verified if HTTPS is configured.

Do not use paid external API calls unless strictly necessary for a controlled live check. Do not invent results.

## 13. DOCUMENTATION

Create or update `docs/DOCKER_AND_EC2_DEPLOYMENT.md`. Keep it focused on this simple approach:
- Local Compose use.
- Existing EC2 host, deployment directory and SSH setup.
- The GitHub Actions SSH secrets/variables (names only, never values).
- Required production environment file locations and safe secret handling.
- First/manual full deployment.
- Automatic push-to-main deployments.
- How changed-service detection works.
- How video-only changes avoid restarting backend/Redis.
- How to view health, logs and cache behavior.
- How to sync model files safely if they are not tracked in Git.
- How to roll back.
- Actual HTTPS/browser camera limitations, if any.

Do not document ECR, OIDC, SSM or Parameter Store as required deployment components.

## 14. FINAL REPORT

Report only what was actually confirmed, with each item marked **Implemented**, **Tested**, **Deployed**, **Unverified** or **Blocked**. Include:
1. The commit SHA and actual GitHub Actions run result.
2. The verified existing EC2 host and region.
3. Backend, video-service, Redis, proxy and optional web-container health.
4. Confirmation that the deployed pipeline uses EC2 + Docker Compose + Redis + GitHub Actions over SSH only, with no ECR/OIDC/SSM dependency.
5. Real API URLs and whether HTTPS trust was verified.
6. Tests that actually ran and their outcomes.
7. Redis cache verification.
8. Confirmation that video-only deployment does not restart backend/Redis, based on evidence.
9. Any pre-existing ECR/IAM resources noticed from the aborted attempt; list them without deleting them or relying on them.
10. Exact remaining blockers, if any.

## FINAL OBJECTIVE

Finish the existing work—not a fresh rewrite—and deploy SignVision to the **already-created EC2** using only **EC2 + Docker Compose + Redis + GitHub Actions over SSH**. Modify the existing `compose.yaml`, `.github/workflows/ci.yml`, and `.github/workflows/deploy-ec2.yml` instead of creating duplicate files. Build images on EC2. Preserve current application functionality, model assets, user changes and secrets. Deploy only changed services. Verify actual health before claiming success. Do not use ECR, OIDC, SSM, Parameter Store, or unnecessary AWS infrastructure.