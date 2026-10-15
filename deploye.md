# SIGNVISION — END-TO-END DOCKER, REDIS, EXISTING EC2 DEPLOYMENT & GITHUB CI/CD MASTER PROMPT

## 1. Mission

Act as the principal DevOps engineer responsible for implementing and operating the deployment of my existing SignVision application.

I want the existing application deployed to my already-created AWS EC2 instance, using Docker, Docker Compose, Redis, Amazon ECR, GitHub Actions, AWS OIDC, and AWS Systems Manager.

This is not a request to create another EC2 instance or merely generate deployment instructions.

Inspect the real repository and current AWS resources, create the necessary deployment files, prepare runtime configuration, build and publish images, configure secure CI/CD, deploy the application, update API URLs, and verify the actual running application.

Continue diagnosing and correcting implementation problems until the deployment succeeds or an explicit external blocker prevents completion.

**Do not rebuild the application from scratch. Do not create another EC2 instance. Do not overwrite working code. Do not claim success without evidence.**

## 2. Verified deployment targets — use these exact details

### GitHub

- Repository: `Pruthviraj141/Signvision`
- Remote: `https://github.com/Pruthviraj141/Signvision`
- Production branch: `main`
- GitHub CLI authentication was previously verified as `Pruthviraj141`.
- GitHub Actions repository variables and secrets were previously empty; inspect again before configuring them.

Verify the current repository, branch, authentication and permissions before making changes.

### Existing EC2 instance

This instance has already been manually created and SSH connectivity was verified.

- Instance ID: `i-0d53d656ca85c6851`
- Current public IPv4: `35.154.167.249`
- AWS account ID: `777724728464`
- AWS CLI profile: `newaccount`
- AWS IAM user reported by the previous audit: `anti`
- Region: `ap-south-1`
- Availability Zone: `ap-south-1a`
- Instance type: `c7i-flex.large`
- Operating system: Ubuntu Server 24.04 LTS, x86_64
- Root storage: 30 GiB gp3
- Existing security group: `launch-wizard-1`
- Existing security group ID: `sg-0f01856ef711df384`
- Reported inbound ports: 22, 80 and 443
- Verified initial access method: SSH with the existing `key.pem` file
- Reported administrative access: passwordless `sudo` for the Ubuntu user

Use these details as the starting point and verify them against AWS before deploying.

### CRITICAL AWS ACCOUNT PROTECTION

Earlier audits used another AWS account, `741452524968`, through the default profile.

**For every AWS operation in this task, explicitly use `AWS_PROFILE=newaccount` and verify that the resolved account is `777724728464`.**

For example:

```bash
AWS_PROFILE=newaccount aws sts get-caller-identity
AWS_PROFILE=newaccount aws configure get region
```

Set the correct profile and region for the duration of each deployment script or workflow preparation.

If the `newaccount` profile cannot be accessed, or if the resolved AWS identity does not match account `777724728464`, stop all AWS mutations. Do not fall back to `default`, do not create resources in the other account, and report the exact blocker.

The instance is already running. Do not create, replace, resize, or terminate it.

Do not automatically allocate an Elastic IP, create another EC2 instance, provision a NAT Gateway, create a load balancer, or add unrelated infrastructure.

Verify current pricing and ongoing charges for any new resources you genuinely need. Keep the infrastructure lean.

## 3. Begin with a safe repository and cloud audit

Locate the actual repository root, expected to be:

`/mnt/projects/SignVision/Signvision`

Before changing files:

1. Read `AGENTS.md` and follow the project's Golden Invariants.
2. Read `README.md`, `deploye.md` if present, and relevant deployment documentation.
3. Inspect `git status --short`, the current branch, remotes and relevant diffs.
4. Check the current deployment and Docker files.
5. Verify the existing frontend and backend API contracts.
6. Inspect the actual AWS profile and existing instance configuration.
7. Verify GitHub authentication and repository permissions.
8. Check the local environment-file variable names without printing their values.
9. Identify tracked and untracked model artifacts.
10. Back up the existing tracked working-tree diff and record untracked files before making changes.

Preserve all intentional local changes. Do not run destructive reset, clean, or checkout commands.

Review and validate the actual current source instead of repeating historical assumptions.

If an existing resource already serves the required purpose, reuse it when safe. Avoid duplicate resources.

### Scope of allowed implementation

I authorize you to prepare and deploy this application using the existing EC2 instance and create the necessary ECR repositories, narrowly scoped IAM roles, instance profile, GitHub OIDC integration, production parameters, Docker files, Compose configuration, GitHub workflows, and supporting deployment files.

Do not create another EC2 instance or add expensive optional services such as NAT Gateway, Application Load Balancer, or managed Redis.

If a materially chargeable additional resource becomes necessary, explain its actual purpose and expected cost before creating it.

## 4. Understand the actual SignVision architecture

The currently intended application includes:

### Core backend

- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/nlp_engine.py`
- `backend/app/services/multilingual_service.py`, if present
- `backend/app/services/word_lookup.py`
- `backend/app/services/semantic_search.py`
- `backend/app/services/translation_cache.py`
- `backend/requirements.txt`
- `backend/tests/`

Verify the current implementation of:

- English, Hindi and Marathi-related translation workflows.
- Text processing and structured Groq extraction.
- Deterministic ISL grammar and gloss generation.
- Translation cache lookup and invalidation.
- Redis fail-open behavior.
- Dictionary lookup, aliases, semantic fallback and fingerspelling.
- `/process`, `/process_text` if implemented, `/lookup`, `/search`, `/transcribe`, and `/health` endpoints.

Preserve working speech recognition, translation, Redis caching, API response schemas, and error handling.

### Video inference service

- `video-service/main.py`
- `video-service/requirements.txt`
- Any model-loading utilities and tests.
- Root-level `signvision_isl_inference_bundle/` and its actual required files.

The current video implementation uses a local ML inference pipeline according to the latest project audit. It includes MediaPipe/OpenCV processing and a scikit-learn classifier reported to recognize 23 classes.

Verify the actual code and bundle. Preserve the currently working local inference pipeline.

Do not revert it to the older Gemini-based video architecture. Do not require `GEMINI_API_KEY` unless the current code actually requires it.

Keep the video service independent from the core backend so future changes to model loading, feature extraction, classification, and video processing do not require unnecessary core backend rebuilds.

### Frontend

- `Application/src/services/apiService.ts`
- `Application/src/services/s3Service.ts`
- `Application/src/screens/HomeScreen.tsx`
- `Application/src/screens/CameraTranslateScreen.tsx`
- `Application/src/components/SearchBar.tsx`
- `Application/src/components/AvatarWebView.tsx`
- `Application/src/types/index.ts`
- Existing Expo configuration, theme, components, assets and package manifest.

Preserve the existing UI/UX, native speech recognition, camera workflow, sign dictionary, S3 assets, avatar model selection, CWASA/WebView integration and animation playback behavior.

Do not redesign or recreate the frontend.

### Model bundle protection

Ensure the video image contains the complete required model bundle, including any actual equivalents of:

- `sign_classifier.joblib`
- `hand_landmarker.task`
- `model_metadata.json`
- Class-label mappings.
- Required inference configuration.
- Any additional model files found in the current loader.

Inspect the actual `git ls-files`, Git LFS configuration, file sizes and repository visibility.

Do not silently produce a video image without its model assets.

If the bundle is already correctly tracked in the repository, preserve its current arrangement.

If required model files are untracked or ignored and the GitHub repository is public, do not publish private or unapproved model weights just to make CI work. Use a private, access-controlled artifact bucket only if required, enable appropriate encryption and block public access, and give the build workflow narrowly scoped read access. Document how future model updates will be synchronized.

Do not introduce a second ML implementation.

## 5. Establish test baselines

The previous verification reported:

- 98 backend tests passing.
- 13 video-service tests passing.
- Six model-bundle smoke tests passing.
- Frontend TypeScript compilation with zero errors.
- Dictionary symmetry verified.

Run the current available tests and record their actual results.

Determine the current real test counts, model asset state and dependency requirements. Do not assume historical counts or results remain valid.

Test using mocks wherever possible. CI must not require paid Groq or Google API calls to pass.

Preserve all required copies of `sign_language_data.json` and validate the synchronization rules in `AGENTS.md`.

If tests already fail before the deployment changes, record the baseline and distinguish pre-existing failures from newly introduced problems.

## 6. Create the core backend Docker image

Create `backend/Dockerfile` and any necessary ignore configuration.

Requirements:

- Use a maintained, compatible slim Python base image.
- Prefer Python 3.11 or 3.12 after verifying package compatibility.
- Install the actual dependencies from `backend/requirements.txt`.
- Install FFmpeg if required for the `/transcribe` workflow.
- Include necessary CA certificates and any runtime utilities.
- Copy only the required backend source, dictionaries and runtime data.
- Exclude virtual environments, secrets, Git history, caches and unrelated services.
- Run as an unprivileged user.
- Send application logs to stdout/stderr.
- Bind the API to `0.0.0.0:8000`.
- Use one Uvicorn worker initially to limit memory use.

Verify the actual import path and start command rather than blindly assuming them.

Preserve all current endpoints and their existing request and response contracts.

Do not add heavyweight spaCy, ChromaDB or SentenceTransformers dependencies unless the active code genuinely requires them.

## 7. Create an independent video-service Docker image

Create `video-service/Dockerfile` and maintain `video-service/requirements.txt` independently.

Use the appropriate build context so the root-level model bundle is included when required.

A separate image should:

- Install only the packages actually required by the video inference service.
- Include compatible MediaPipe, OpenCV/headless OpenCV, scikit-learn, joblib, FastAPI, Uvicorn and multipart dependencies as verified by the code.
- Exclude the core backend's unnecessary dependencies.
- Run as a non-root user.
- Load the correct model files from valid container paths.
- Use a single Uvicorn worker initially.
- Preserve upload limits and the current `/api/translate-video` contract.
- Keep `/health` functional.
- Provide writable temporary storage.
- Clean up temporary videos and associated resources safely.
- Emit useful logs without exposing uploaded content or secrets.

Verify model initialization inside the image and execute the model-bundle smoke test in CI where practical.

Do not change the ML architecture unnecessarily during containerization.

### Independent deployment requirement

If a commit changes only the video service or its required model artifacts, the workflow must normally rebuild and deploy the video image only.

It must not unnecessarily rebuild or restart the core NLP backend or Redis.

## 8. Create local Docker Compose

Create a root-level `compose.yaml` for local development.

Services should include:

- `backend`
- `video-service`
- `redis`
- Optional static web frontend if the current Expo project exports successfully for web.

The native Android/iOS application must remain outside the production API container stack.

### Core backend

- Publish the core API on host port 8000 for local development.
- Pass the existing required environment variables.
- Connect to Redis using `REDIS_URL=redis://redis:6379/0`.
- Preserve the current cache enablement, TTL and cache-version behavior.
- Retain fail-open behavior when Redis is unavailable.

Do not use `127.0.0.1:6379` inside the backend container.

### Video service

- Publish the video API on host port 8001 for local development.
- Include the full required local model bundle.
- Preserve its current supported inference workflow.

### Redis

- Use a maintained compatible official Redis image.
- Configure a sensible memory limit of approximately 128–256 MiB initially.
- Use an appropriate eviction policy such as `allkeys-lru`.
- Keep Redis disposable as a translation cache.
- Do not publish port 6379 to the internet.
- Retain application fail-open behavior during Redis outages.

Use health checks, sensible restart policies and bounded logs.

Do not add unrelated databases or infrastructure.

## 9. Create production Compose configuration

Create `compose.prod.yaml` using prebuilt Amazon ECR images.

The production stack should include:

- `backend`
- `video-service`
- `redis`
- `caddy`
- An optional static web frontend only if the existing Expo web export works.

Use independent, immutable image tags based on the Git commit SHA.

Do not build large images on EC2.

Keep application containers on a private Compose network where possible.

Only Caddy should publish ports 80 and 443 to the host. Do not publish application ports 8000 or 8001 publicly.

Redis must not have a public port mapping.

Use:

- Restart policies.
- Correct health checks.
- Bounded Docker logs.
- Non-root backend and video containers.
- Writable temporary storage where required.
- Persistent storage for Caddy certificate/configuration data.
- A sensible cache-memory limit.
- One Uvicorn worker for each API initially.

Do not make backend availability depend on Redis health, because the backend should still function without cached acceleration.

## 10. Configure Caddy, HTTPS and routing

Use Caddy as the public reverse proxy. Do not create an ALB just to route traffic.

Inspect the actual frontend URL construction before writing the routes.

The intended routing pattern, if compatible with `apiService.ts`, is:

- `/core/*` → `backend:8000`, stripping the `/core` prefix.
- `/video/*` → `video-service:8001`, stripping the `/video` prefix.
- `/` → the static web frontend, if a working Expo web build exists.

This preserves the backend's existing endpoint paths.

### Use the existing public IP

Verify that the current EC2 public IP is still:

`35.154.167.249`

If it differs, use the verified live address and update the application environment consistently.

### HTTPS requirement

There is currently no confirmed domain name in the deployment information.

Inspect the current Caddy release and official certificate-authority support. Determine whether Caddy can obtain and automatically renew a publicly trusted Let's Encrypt IP-address certificate for the existing public IP.

If supported, configure the appropriate short-lived certificate profile, persistent certificate storage and automated renewal, then verify that the certificate is publicly trusted from outside the EC2 instance.

Do not assume that a Caddy internal/self-signed certificate is trusted by mobile devices or public browsers.

If a public IP certificate cannot be issued and validated, keep the deployment functional where possible using a clearly documented temporary HTTP configuration, but report that HTTPS-dependent browser camera functionality remains unverified. Do not falsely declare secure web camera operation complete.

Do not invent a domain or add recurring infrastructure merely to avoid reporting a blocker.

The EC2 security group should retain the required public ingress on ports 80 and 443. Keep Redis, 8000 and 8001 private. Inspect the SSH rule and avoid locking yourself out while migrating to SSM.

## 11. Update the environment files directly

This is a mandatory part of the implementation.

### Local root `.env`

Inspect the existing root `.env` and current `.env.example`.

Preserve every existing valid value. Add or update only the settings needed for Docker Compose.

Use actual required variables such as:

- `GROQ_API_KEY`, if required by the current backend.
- `GROQ_API_KEYS`, only if the active configuration uses it.
- `GROQ_MODEL`, if configured.
- `REDIS_URL`.
- `REDIS_CACHE_ENABLED`.
- `REDIS_CACHE_TTL`.
- `TRANSLATION_CACHE_VERSION`.
- Actual video-service configuration variables.
- Required frontend build settings where relevant.

For the Docker backend, use `REDIS_URL=redis://redis:6379/0`. Preserve the current working cache behavior and configure caching as enabled in production after verifying that the implementation supports it.

Do not blindly copy every variable from an older configuration. The current video service may no longer require a Gemini key; only configure secrets genuinely required by the active code.

Never display secret values.

### Production credentials

Do not copy API keys into Dockerfiles, image layers, Compose files, GitHub repository variables or Git.

Use AWS Systems Manager Parameter Store SecureString for required production credentials under a clear prefix such as:

`/signvision/production/`

Inspect existing parameter names first.

If a required secret parameter is missing and a valid corresponding value exists in the current local `.env`, transfer it securely using the configured AWS profile without printing its value.

Preserve existing production parameters when their values differ from the local source unless a safe, explicit reconciliation is possible. Do not silently overwrite working production credentials.

Create separate protected runtime environment files for the services under `/etc/signvision/` as needed. Restrict their permissions and ensure they are never inside the source checkout.

Give the backend only the secrets it needs. Give the video service only its own required configuration. Do not pass Groq secrets to the video service unless the current code requires them.

If a required key is missing, report only its variable name.

### `.env.example`

Update the example files with placeholders, safe defaults and the correct current URL format.

Do not place real secrets in any example file.

Ensure all actual `.env` files are ignored by Git and excluded from Docker build contexts.

## 12. Update the frontend URLs correctly

The frontend currently uses:

- `EXPO_PUBLIC_CORE_API_URL`
- `EXPO_PUBLIC_VIDEO_API_URL`

Inspect `Application/src/services/apiService.ts` and preserve how paths are constructed.

For the single-origin reverse proxy, use the verified HTTPS URLs if TLS validation succeeds. The intended values are:

```env
EXPO_PUBLIC_CORE_API_URL=https://35.154.167.249/core
EXPO_PUBLIC_VIDEO_API_URL=https://35.154.167.249/video
```

If a different live public IP is verified, use that instead.

Check that the core URL plus each existing endpoint path reaches the correct FastAPI route, and that the video URL plus `/api/translate-video` reaches the video service without unintended prefix duplication or removal.

Update the real `Application/.env` locally, preserving existing values unrelated to API URLs. Update its `.env.example` using safe placeholders.

If the Expo web build is supported, pass the correct URLs at build time and rebuild the web image whenever the relevant URLs or frontend source change.

Remember that Expo public environment variables can be embedded at build time. Rebuilding or reinstalling a previously distributed native application may be necessary for it to consume new URLs.

Do not commit actual `.env` files.

## 13. Create an optional static frontend image

Determine whether the current application successfully builds for web.

If web export works without breaking the existing mobile application:

- Create `Application/Dockerfile.web` or an equivalent build file.
- Use the correct Node version and existing lockfile.
- Pass the verified `EXPO_PUBLIC_CORE_API_URL` and `EXPO_PUBLIC_VIDEO_API_URL` during export/build.
- Export the existing web app.
- Serve the built static files from an appropriate lightweight runtime image.
- Integrate it through Caddy.
- Preserve all current UI/UX and frontend contracts.

If web export is unsupported or fails because of existing application constraints, do not rewrite the frontend. Deploy the APIs normally, preserve the native app, and clearly report that the native frontend continues to be built and distributed separately.

Do not put Metro or the native Android/iOS application inside the production API Compose stack.

## 14. Set up Amazon ECR

Using `AWS_PROFILE=newaccount`, create or reuse these private repositories in `ap-south-1`:

- `signvision-backend`
- `signvision-video-service`
- `signvision-frontend-web`, only if a static web frontend image is created.

Verify the exact account and repository ownership before each mutation.

Use immutable Git commit SHA image tags and preserve enough previous image versions for rollback.

Configure a sensible ECR lifecycle policy only after verifying that it preserves current and rollback releases.

Do not make ECR repositories public.

Do not build large ML images on EC2 if GitHub-hosted runners can build them.

## 15. Configure the existing EC2 instance for deployment

Do not launch a new instance.

Use the existing target:

`i-0d53d656ca85c6851`

First check whether an IAM instance profile is already attached.

If the instance is not managed by SSM, create or reuse a dedicated EC2 role and instance profile with the minimum required permissions, including:

- `AmazonSSMManagedInstanceCore`, where appropriate.
- Scoped ECR pull permissions.
- Read access to only the required production SSM parameters.

Attach the profile to the existing instance without recreating it.

Verify that the SSM agent is installed, running and able to register with Systems Manager.

Use SSM Run Command for ongoing deployments.

The existing `key.pem` may be used for initial bootstrap only if SSM is not yet available and the key is actually accessible to the local deployment environment. Never print its contents, copy it into the repository, upload it to ECR, or store it in GitHub Actions Secrets.

If SSM is not yet available, complete the safe bootstrap using the existing verified SSH access where possible. Do not open SSH broadly to the public internet solely for CI/CD. If an external access blocker prevents bootstrap, report it exactly.

Install and verify Docker Engine and the Docker Compose plugin on the existing Ubuntu instance.

Use a deployment directory such as:

`/opt/signvision`

Keep runtime secrets outside this checkout, under `/etc/signvision/`.

Do not store permanent production changes in manually edited, untracked Compose files that CI/CD cannot update.

## 16. Set up GitHub Actions OIDC

The previous audit verified GitHub authentication and write readiness. Verify them again.

Configure the AWS GitHub OIDC identity provider if it does not exist:

`https://token.actions.githubusercontent.com`

Use the audience `sts.amazonaws.com` and follow the current official GitHub/AWS OIDC documentation.

Create or reuse a dedicated deployment role such as:

`SignVisionGitHubDeployRole`

Restrict its trust policy to the exact repository and production branch. Verify the repository's current OIDC subject-claim format and account for immutable repository identity claims if applicable.

Do not trust all GitHub repositories or all branches.

Do not store long-lived AWS access keys in GitHub Secrets.

The GitHub Actions role needs only the scoped permissions necessary to:

- Authenticate to the required private ECR repositories.
- Push the corresponding images.
- Invoke SSM Run Command against the specific existing EC2 instance.
- Read the deployment-command status.
- Access the private model artifact if the verified model-bundle arrangement requires it.

Do not grant administrator privileges to the GitHub deployment role.

The EC2 instance role and GitHub deployment role must be separate.

## 17. Create the CI workflow

Create `.github/workflows/ci.yml`.

Run the relevant checks on pull requests and pushes to the verified branches.

Include:

- Core backend tests.
- NLP and Redis cache tests.
- Speech-transcription tests using mocks.
- Video-service tests and syntax/import checks.
- Model-bundle existence and path checks.
- Model smoke testing where feasible.
- Frontend TypeScript compilation.
- Expo web export testing if applicable.
- Dockerfile and Compose configuration validation.
- Dictionary synchronization checks.
- Environment-example validation and secret-leak checks.

Use test doubles for Groq, Google APIs, Redis and other external services when testing business logic. Do not require paid provider calls for ordinary CI.

Do not claim tests have passed unless they were executed successfully.

Do not rebuild or redownload huge assets unnecessarily when running simple unit tests.

## 18. Create component-specific build and deployment automation

Create `.github/workflows/deploy-ec2.yml`.

The workflow should trigger on verified pushes to `main` after tests pass. Include a controlled `workflow_dispatch` path for the initial deployment and deliberate full redeployment.

Build images on GitHub-hosted runners, not the EC2 instance.

Publish each image using a verified Git commit SHA.

### Path detection

Use reliable path filtering:

- `backend/**` and its Docker build inputs trigger the core backend build.
- `video-service/**`, its requirements, Dockerfile and required model artifacts trigger the video-service build.
- Model-bundle changes trigger the video-service build only if those assets are supplied to CI securely and reproducibly.
- Frontend source changes trigger frontend checks and rebuild the web image only if web export is supported.
- Dictionary changes trigger the relevant backend/frontend builds and synchronization checks.
- Shared deployment or Compose changes trigger configuration validation and deployment updates without rebuilding unrelated application images.

For the initial deployment, explicitly build and publish all required images even if the detected changes do not cover every path.

If a model bundle is stored in private S3 instead of Git, build by retrieving the exact intended model artifact into the video image's build context. Provide a documented, authenticated update-and-redeploy path for future model changes.

Never publish a broken video image that silently omits the required classifier or task files.

### Build artifacts

Use separate image names and tags for each service.

Use maintained official build actions, check their current versions, and pin them appropriately where practical.

Configure Docker build caching so subsequent builds reuse unaffected layers.

Do not include `.env`, key files, Git history, Python virtual environments, `node_modules`, or unrelated project files in image build contexts.

## 19. Keep the CI/CD deployment process independent per service

On a video-only change:

1. Run the video-specific checks.
2. Build the video image.
3. Push the image to the video ECR repository.
4. Deploy only `video-service`.
5. Verify its health and model initialization.
6. Leave the backend, Redis, frontend and proxy running unless a verified shared configuration change requires otherwise.

On a backend-only change:

1. Run the backend checks.
2. Build and push the backend image.
3. Redeploy only the backend.
4. Verify the backend and cache behavior.
5. Do not restart the video service or clear Redis unnecessarily.

On a frontend-only change:

- Run frontend checks.
- Rebuild and redeploy the web image if supported.
- Do not rebuild the Python images.

If shared Compose, proxy, or deployment scripts change, validate and roll out the configuration safely.

The EC2 deployment directory must obtain its Compose and deployment configuration from the verified commit being deployed. Do not rely on stale configuration or untracked files that exist only on the server.

## 20. Configure production image and runtime versions

Keep image tags in a dedicated non-secret deployment environment file outside the source checkout, such as:

`/etc/signvision/compose.env`

Keep runtime credentials in separate protected service environment files, for example:

- `/etc/signvision/backend.env`
- `/etc/signvision/video.env`

Create these with safe permissions and maintain a clear separation of responsibilities.

Use the image tags passed by the GitHub deployment workflow.

Ensure a service-specific redeployment can update only that service's image tag without modifying unrelated versions.

Keep the last known-good image tags so rollback can be performed.

Authenticate to ECR from EC2 using its instance role, not manually supplied AWS credentials.

The deployment script must:

1. Obtain the exact commit SHA or image tag to deploy.
2. Synchronize the correct deployment configuration.
3. Pull only the affected image when possible.
4. Validate the resolved Compose configuration.
5. Recreate only the required service.
6. Wait for the service's actual health check.
7. Record the running image version and commit.
8. Return a nonzero exit status on a failed deployment.
9. Keep the previous image version available for rollback.

Do not mark the deployment successful merely because an image pull or SSM command submission succeeded.

## 21. Configure production runtime secrets from Parameter Store

For each runtime secret actually required by the current application:

- Use the current local `.env` as the initial source only if the value is present and is intended for this project.
- Store it in AWS Systems Manager Parameter Store as `SecureString`.
- Use a scoped prefix such as `/signvision/production/`.
- Use the AWS-managed SSM encryption key unless a documented requirement justifies another key.
- Ensure the EC2 role can read only the required parameters.
- Generate protected runtime environment files on EC2 without printing the values.
- Pass each service only the variables it needs.

Do not send application API keys through ordinary GitHub variables.

Do not assume `GEMINI_API_KEY` is necessary just because it appeared in an older version. Inspect current imports and configuration first.

Keep public URL configuration separate from application secrets.

If credentials are missing, report their names, continue safe independent work and do not invent values.

## 22. Synchronize configuration and update the real URLs

Where GitHub CLI access exists, configure the non-secret repository variables required by the actual workflow.

Potential variables include:

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `AWS_ACCOUNT_ID`
- `EC2_INSTANCE_ID`
- ECR repository names
- `EXPO_PUBLIC_CORE_API_URL`
- `EXPO_PUBLIC_VIDEO_API_URL`
- Public API origin and model artifact identifiers if needed.

Use the real values discovered from the created resources.

Do not create unnecessary GitHub Secrets for values that are not secret.

Update the local `Application/.env` directly with the verified current API URLs, preserving all unrelated variables.

Update `.env.example` accordingly using safe placeholders.

Verify that no stale Fedora LAN address remains in the active deployed frontend configuration.

If a build-time environment variable changes, rebuild the appropriate web image or document the native app rebuild needed to consume the new URLs.

Never commit the actual root `.env`, backend `.env`, frontend `.env`, AWS credentials, private keys or runtime secret files.

## 23. Add health checks and resource controls

Use real application health endpoints:

- Core backend: `/health`
- Video service: `/health`
- Redis: `redis-cli PING`
- Frontend web: its actual local health URL if built.

Start with one worker per Python service.

Set appropriate startup grace periods and health-check intervals.

Use bounded Docker logs.

Configure Redis with a reasonable memory limit and `allkeys-lru` where compatible with the current implementation.

Ensure Redis persistence remains disabled for the disposable translation cache unless a verified requirement exists.

Check the EC2 system memory, disk usage and container statistics after startup.

The current host has approximately 4 GiB physical memory and 30 GiB EBS storage. The video-service image and classifier must be sized and executed accordingly.

Avoid loading multiple copies of the same inference model unnecessarily.

Do not build large images on the EC2 instance.

If memory pressure appears, inspect actual process and container usage before applying resource changes. Do not claim production load capacity without testing.

## 24. Configure secure access and networking

Verify the existing security group.

Retain public access through ports 80 and 443 for the proxy, and maintain secure administrative access through SSM where possible.

Do not expose these ports publicly:

- 6379 — Redis
- 8000 — core backend
- 8001 — video service

Do not open new application ports simply because the containers use them internally.

Do not modify the security group in a way that could lock you out. If the SSH ingress is unrestricted, evaluate narrowing it to a verified source IP once SSM is online, and make the change only if access remains safe.

Keep API keys off the frontend and never expose them in logs.

Keep the sign-language S3 assets accessible according to the existing asset configuration without changing bucket policies unnecessarily.

## 25. Validate the local and remote deployment

### Local validation

Where Docker is available, run the actual configured checks, including equivalents of:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=200 backend video-service redis
```

Use the final filenames and actual configuration.

Run the backend tests, video-service tests, model smoke tests and frontend TypeScript checks.

Validate cache miss then hit using identical requests. Confirm that the successful repeated request returns the expected cache header and does not invoke Groq again.

### Remote validation

After deploying to the existing EC2 instance, verify:

- The correct instance ID and AWS account are targeted.
- Docker and Compose work.
- The backend starts and `/health` succeeds.
- The video service starts and `/health` succeeds.
- The Redis container responds to `PING`.
- The backend connects to `redis:6379`.
- The cache remains enabled and a repeated translation gives a cache hit.
- Existing speech-transcription functionality is preserved.
- The dictionary loads correctly.
- Fingerspelling and S3 URL resolution remain compatible.
- The video model loads from the correct container paths.
- The video-service sample inference succeeds if a repository-owned test clip exists.
- The frontend can reach both APIs through the intended public URLs.
- HTTPS and certificate trust are verified if HTTPS is configured.
- Redis is not publicly exposed.
- Ports 8000 and 8001 are not publicly exposed.
- The running containers match the intended commit/image tags.
- No critical service is repeatedly restarting or being killed due to memory pressure.

Do not make unnecessary paid inference calls. Use mocks for regression tests and only perform deliberate live requests when essential to validate the running application.

If no valid test video is available, report live video inference as unverified rather than claiming it passed.

## 26. Commit and push the necessary changes safely

The deployment workflow must exist in GitHub to run automatically.

Before committing:

1. Inspect the entire Git diff.
2. Confirm only the intended deployment files and necessary tested application changes are included.
3. Confirm all secret files are ignored and not staged.
4. Run the relevant tests and configuration checks.
5. Check dictionary synchronization.
6. Check the required model assets and the intended way they are supplied to CI.
7. Run `git diff --check`.

Do not use `git add -A` blindly.

Stage only the intended files. Include existing local application changes only if they are part of the tested version required for the deployment. Do not commit unrelated modifications.

Once the implementation is validated, commit and push the necessary changes to the verified `main` branch without force-pushing or rewriting history. Do not push real `.env` files or private model assets into a public repository without verifying that publication is explicitly intended.

If an essential source change is uncommitted and cannot be safely included, stop before deploying an older remote version and report the conflict.

## 27. Monitor and troubleshoot until deployment is verified

After the deployment workflow is pushed and triggered, monitor the actual GitHub Actions run.

Do not stop after generating workflow files.

If a workflow fails:

1. Inspect the failed job logs.
2. Identify the actual cause.
3. Determine whether the failure comes from tests, Docker build context, missing model files, dependency resolution, ECR permissions, OIDC trust, SSM, runtime secrets, health checks, network routing or the application itself.
4. Fix the cause if it can be done safely.
5. Rerun the relevant checks.
6. Rerun the deployment when the correction is ready.
7. Continue until the deployment succeeds or an external blocker is clearly identified.

Do not repeatedly rerun an unchanged failed workflow.

Use bounded polling and inspect the real SSM command result. Do not report success when a command was merely submitted.

If a failure cannot be resolved because a missing credential, permission, DNS record or other external authorization is required, complete all safe independent work and report the exact remaining blocker.

## 28. Required final documentation

Create an accurate deployment guide, for example:

`docs/DOCKER_AND_EC2_DEPLOYMENT.md`

Document:

- Local Docker setup.
- Environment variables and safe configuration examples.
- Local Compose commands.
- Production Compose configuration.
- Redis cache verification.
- How to inspect service health and logs.
- The existing EC2 instance ID, region and current public IP.
- Actual frontend URL configuration.
- AWS profile and account precautions.
- ECR repository names.
- GitHub OIDC role and trust-policy setup.
- EC2 SSM configuration.
- Runtime secret storage.
- How CI tests, builds, publishes and deploys images.
- How a video-only change is deployed independently.
- How to update the model bundle safely.
- How to roll back an unsuccessful release.
- HTTPS and browser camera requirements.
- Known resource and cost limitations.

Do not put secret values in the documentation.

## 29. Final completion report

When finished, provide the actual results in this order:

1. GitHub repository and committed deployment version.
2. AWS profile and verified account ID.
3. Existing EC2 instance ID and verified current public IP.
4. Docker images created and their ECR tags.
5. Compose and reverse-proxy configuration.
6. Redis configuration and cache verification.
7. Video-service model bundle and inference verification.
8. Production runtime secret configuration method.
9. Exact local and production API URLs.
10. GitHub Actions workflow and OIDC status.
11. SSM deployment status.
12. Tests and builds actually executed.
13. Verified live endpoint results.
14. Current running container image versions.
15. Any remaining blockers or unverified features.

Classify each relevant item as:

- Implemented.
- Tested successfully.
- Deployed successfully.
- Configured but not exercised.
- Blocked.

Do not invent benchmark results, successful inference results, test outcomes or deployment status.

## FINAL OBJECTIVE

Deploy the existing SignVision application to the already-created EC2 instance `i-0d53d656ca85c6851` using the verified AWS profile `newaccount` and account `777724728464`.

Use separate Docker images for the core NLP backend and local-ML video service, Redis as a private translation cache, and GitHub Actions with OIDC and SSM for automated service-specific deployments.

Update the actual environment URLs, handle runtime credentials securely, preserve the current application and model assets, and verify the running deployment.

Do not create another EC2 instance. Do not rebuild the application from scratch. Do not expose Redis or internal API ports. Do not claim completion without evidence.

**Implement, test, publish, deploy, verify and document the real deployment, continuing until it works or a specific external blocker is reached.**