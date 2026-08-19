#!/bin/bash
# =====================================================
# NahSehat AdBrief Dashboard — Full Stack Deployment Script
# =====================================================
# Deploys Backend (server/) and Frontend (root) to Google Cloud Run.
#
# Project structure:
#   ./                     ← Frontend (React + Vite + nginx, Dockerfile)
#   ./server/              ← Backend  (Express + MySQL2, server/Dockerfile)
#
# Usage:
#   ./deploy-all.sh                    # Deploy both with defaults
#   ./deploy-all.sh --clean            # Clean build then deploy
#   ./deploy-all.sh --backend-only     # Deploy only backend
#   ./deploy-all.sh --frontend-only    # Deploy only frontend (needs backend URL)
#   ./deploy-all.sh --project my-project --region asia-southeast2
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated (gcloud auth login)
#   2. Docker installed and running
#   3. env.cloud-run.yaml created (cp env.cloud-run.yaml.example env.cloud-run.yaml)
#   4. Artifact Registry repo created (or let --setup-repo create it)
#
# Frontend API routing on Cloud Run:
#   The frontend is built with VITE_BE_API=<backend-url> so RTK Query
#   calls the backend directly. The backend CORS_ORIGIN must include
#   the frontend URL (set in env.cloud-run.yaml).
# =====================================================

set -e

# ─── Default Configuration ───────────────────────────
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-project-digital-admedika}"
REGION="asia-southeast2"
REPO_NAME="cloud-run-source-deploy"
IMAGE_TAG="latest"
CLEAN_BUILD=false
SETUP_REPO=false

# Backend config
BACKEND_SERVICE="adbriefns-backend"
BACKEND_MEMORY="512Mi"
BACKEND_CPU="1"
BACKEND_MIN_INSTANCES="0"
BACKEND_MAX_INSTANCES="3"
BACKEND_PORT="8080"
# VPC connector for Cloud SQL access (leave empty to skip)
VPC_CONNECTOR="${VPC_CONNECTOR:-}"
VPC_EGRESS="private-ranges-only"

# Frontend config
FRONTEND_SERVICE="adbriefns"
FRONTEND_MEMORY="256Mi"
FRONTEND_CPU="1"
FRONTEND_MIN_INSTANCES="0"
FRONTEND_MAX_INSTANCES="3"
FRONTEND_PORT="80"

# External API URLs (third-party services — same for dev and prod)
NAHSEHAT_API_V3="${VITE_NAHSEHAT_API_V3:-https://repi-api-336781009919.asia-southeast2.run.app/api/v3}"
NAHSEHAT_ADBRIEF_API_V3="${VITE_NAHSEHAT_ADBRIEF_API_V3:-https://repi2-server-dev-336781009919.asia-southeast2.run.app/adbrief/nahsehat/api/v3}"

# Deployment flags
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
# If deploying frontend-only, allow passing a known backend URL
BACKEND_URL_OVERRIDE=""

# ─── Parse Command Line Arguments ────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --project) PROJECT_ID="$2"; shift 2;;
    --region) REGION="$2"; shift 2;;
    --tag) IMAGE_TAG="$2"; shift 2;;
    --clean) CLEAN_BUILD=true; shift;;
    --setup-repo) SETUP_REPO=true; shift;;
    --backend-only) DEPLOY_FRONTEND=false; shift;;
    --frontend-only) DEPLOY_BACKEND=false; shift;;
    --backend-url) BACKEND_URL_OVERRIDE="$2"; shift 2;;
    --vpc-connector) VPC_CONNECTOR="$2"; shift 2;;
    --backend-memory) BACKEND_MEMORY="$2"; shift 2;;
    --backend-cpu) BACKEND_CPU="$2"; shift 2;;
    --frontend-memory) FRONTEND_MEMORY="$2"; shift 2;;
    --frontend-cpu) FRONTEND_CPU="$2"; shift 2;;
    --nahsehat-api) NAHSEHAT_API_V3="$2"; shift 2;;
    --adbrief-api) NAHSEHAT_ADBRIEF_API_V3="$2"; shift 2;;
    -h|--help)
      echo "Usage: ./deploy-all.sh [options]"
      echo ""
      echo "Options:"
      echo "  --project <project-id>        Google Cloud Project ID"
      echo "  --region <region>              Deployment region (default: asia-southeast2)"
      echo "  --tag <tag>                    Docker image tag (default: latest)"
      echo "  --clean                        Clean build (remove node_modules and rebuild)"
      echo "  --setup-repo                   Create Artifact Registry repo if missing"
      echo "  --backend-only                 Deploy only backend"
      echo "  --frontend-only                Deploy only frontend"
      echo "  --backend-url <url>            Backend URL (for --frontend-only without redeploying backend)"
      echo "  --vpc-connector <name>         VPC connector for Cloud SQL (skip if not set)"
      echo "  --backend-memory <memory>      Backend memory (e.g., 512Mi)"
      echo "  --backend-cpu <cpu>            Backend CPU (e.g., 1)"
      echo "  --frontend-memory <memory>     Frontend memory (e.g., 256Mi)"
      echo "  --frontend-cpu <cpu>           Frontend CPU (e.g., 1)"
      echo "  --nahsehat-api <url>           External NahSeHat API v3 URL"
      echo "  --adbrief-api <url>            External AdBrief API v3 URL"
      echo "  -h, --help                     Show this help message"
      exit 0
    ;;
    *)
      echo "Unknown option: $1"
      echo "Use -h or --help for usage information"
      exit 1
    ;;
  esac
done

# ─── Validate Required Parameters ────────────────────
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: PROJECT_ID is required."
  echo "   Set GOOGLE_CLOUD_PROJECT env var or use --project flag"
  exit 1
fi

# ─── Resolve Script Directory ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Check Prerequisites ─────────────────────────────
echo "🔍 Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
  echo "❌ Error: gcloud CLI is not installed."
  echo "   Install from: https://cloud.google.com/sdk/docs/install"
  echo "   Then run: gcloud auth login && gcloud config set project ${PROJECT_ID}"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "❌ Error: Docker is not installed."
  echo "   Install from: https://docs.docker.com/get-docker/"
  exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
  echo "❌ Error: Docker daemon is not running."
  echo "   Start Docker Desktop and try again."
  exit 1
fi

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  echo "❌ Error: gcloud is not authenticated."
  echo "   Run: gcloud auth login"
  exit 1
fi

echo "✅ Prerequisites check passed"
echo "   Project:  ${PROJECT_ID}"
echo "   Region:  ${REGION}"
echo "   Backend:  ${BACKEND_SERVICE} (port ${BACKEND_PORT})"
echo "   Frontend: ${FRONTEND_SERVICE} (port ${FRONTEND_PORT})"
if [ -n "$VPC_CONNECTOR" ]; then
  echo "   VPC:     ${VPC_CONNECTOR} (${VPC_EGRESS})"
else
  echo "   VPC:     (none — backend must reach MySQL via public IP)"
fi
echo ""

# ─── Check env.cloud-run.yaml ─────────────────────────
if [ "$DEPLOY_BACKEND" = true ]; then
  if [ ! -f "${SCRIPT_DIR}/env.cloud-run.yaml" ]; then
    echo "⚠️  Warning: env.cloud-run.yaml not found."
    echo "   Backend will deploy without database env vars."
    echo "   Create it: cp env.cloud-run.yaml.example env.cloud-run.yaml"
    echo ""
  fi
fi

# ─── Optional: Create Artifact Registry Repo ─────────
if [ "$SETUP_REPO" = true ]; then
  echo "📦 Creating Artifact Registry repository (if needed)..."
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="Cloud Run source deploy images" 2>/dev/null || true
  echo "✅ Artifact Registry ready: ${REPO_NAME}"
  echo ""
fi

# ─── Clean Build (Optional) ─────────────────────────
if [ "$CLEAN_BUILD" = true ]; then
  echo "🧹 Cleaning build artifacts..."

  # Frontend (root)
  if [ -d "${SCRIPT_DIR}/node_modules" ]; then
    rm -rf "${SCRIPT_DIR}/node_modules"
    echo "   ✓ Removed node_modules/"
  fi
  if [ -d "${SCRIPT_DIR}/dist" ]; then
    rm -rf "${SCRIPT_DIR}/dist"
    echo "   ✓ Removed dist/"
  fi

  # Backend (server/)
  if [ -d "${SCRIPT_DIR}/server/node_modules" ]; then
    rm -rf "${SCRIPT_DIR}/server/node_modules"
    echo "   ✓ Removed server/node_modules"
  fi
  if [ -d "${SCRIPT_DIR}/server/dist" ]; then
    rm -rf "${SCRIPT_DIR}/server/dist"
    echo "   ✓ Removed server/dist"
  fi

  echo ""
  echo "📦 Reinstalling dependencies..."
  # Frontend deps
  cd "${SCRIPT_DIR}"
  npm install
  echo "   ✓ Frontend dependencies installed"

  # Backend deps
  cd "${SCRIPT_DIR}/server"
  npm install
  echo "   ✓ Backend dependencies installed"

  echo ""
  echo "🔨 Building backend..."
  npm run build
  echo "   ✓ Backend built"

  echo ""
  echo "🔨 Building frontend..."
  cd "${SCRIPT_DIR}"
  npm run build
  echo "   ✓ Frontend built"

  echo ""
  echo "✅ Clean build complete!"
  echo ""

  cd "${SCRIPT_DIR}"
fi

# ─── Configure Docker Auth ───────────────────────────
echo "🔧 Configuring Docker auth for Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
echo "✅ Docker auth configured"
echo ""

# ─── Deploy Backend ──────────────────────────────────
if [ "$DEPLOY_BACKEND" = true ]; then
  BACKEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${BACKEND_SERVICE}:${IMAGE_TAG}"

  echo "============================================"
  echo "🚀 Deploying Backend to Cloud Run"
  echo "============================================"
  echo "  Service:  ${BACKEND_SERVICE}"
  echo "  Image:    ${BACKEND_IMAGE}"
  echo "  Memory:   ${BACKEND_MEMORY}"
  echo "  CPU:      ${BACKEND_CPU}"
  echo "  Build:    server/ (server/Dockerfile)"
  echo "============================================"
  echo ""

  # Build backend image from server/ directory
  echo "🏗️  Building backend image..."
  docker build --platform linux/amd64 \
    -t "${BACKEND_IMAGE}" \
    -f "${SCRIPT_DIR}/server/Dockerfile" \
    "${SCRIPT_DIR}/server"
  echo "✅ Backend image built"
  echo ""

  # Push backend
  echo "📦 Pushing backend image..."
  docker push "${BACKEND_IMAGE}"
  echo "✅ Backend image pushed"
  echo ""

  # Build Cloud Run deploy flags
  ENV_VARS_FILE=""
  if [ -f "${SCRIPT_DIR}/env.cloud-run.yaml" ]; then
    ENV_VARS_FILE="--env-vars-file ${SCRIPT_DIR}/env.cloud-run.yaml"
    echo "   Using env vars from: env.cloud-run.yaml"
  fi

  VPC_FLAGS=""
  if [ -n "$VPC_CONNECTOR" ]; then
    VPC_FLAGS="--vpc-connector ${VPC_CONNECTOR} --vpc-egress ${VPC_EGRESS}"
    echo "   Using VPC connector: ${VPC_CONNECTOR}"
  fi

  # Deploy backend
  echo "🚀 Deploying backend to Cloud Run..."
  gcloud run deploy "${BACKEND_SERVICE}" \
    --image "${BACKEND_IMAGE}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --platform managed \
    --allow-unauthenticated \
    --port "${BACKEND_PORT}" \
    --memory "${BACKEND_MEMORY}" \
    --cpu "${BACKEND_CPU}" \
    --min-instances "${BACKEND_MIN_INSTANCES}" \
    --max-instances "${BACKEND_MAX_INSTANCES}" \
    ${VPC_FLAGS} \
    ${ENV_VARS_FILE}

  BACKEND_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format "value(status.url)")

  echo ""
  echo "✅ Backend deployed: ${BACKEND_URL}"
  echo ""
fi

# ─── Deploy Frontend ─────────────────────────────────
if [ "$DEPLOY_FRONTEND" = true ]; then
  FRONTEND_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${FRONTEND_SERVICE}:${IMAGE_TAG}"

  # Determine backend URL for VITE_BE_API
  # VITE_BE_API must include the /api/v1 suffix because the frontend code
  # builds endpoint URLs like `${VITE_BE_API}/auth` and uses VITE_BE_API
  # directly as the CMS base URL.
  if [ -n "$BACKEND_URL_OVERRIDE" ]; then
    FRONTEND_API_URL="${BACKEND_URL_OVERRIDE}"
  elif [ -n "$BACKEND_URL" ]; then
    FRONTEND_API_URL="${BACKEND_URL}"
  else
    # Try to fetch existing backend URL
    FRONTEND_API_URL=$(gcloud run services describe "${BACKEND_SERVICE}" \
      --region "${REGION}" \
      --project "${PROJECT_ID}" \
      --format "value(status.url)" 2>/dev/null || echo "")
    if [ -z "$FRONTEND_API_URL" ]; then
      echo "❌ Error: Could not determine backend URL."
      echo "   Deploy backend first, or use --backend-url <url>"
      exit 1
    fi
  fi

  # Append /api/v1 if not already present — Cloud Run status.url has no path.
  if [[ "${FRONTEND_API_URL}" != */api/v1 ]]; then
    FRONTEND_API_URL="${FRONTEND_API_URL%/}/api/v1"
  fi

  echo "============================================"
  echo "🚀 Deploying Frontend to Cloud Run"
  echo "============================================"
  echo "  Service:    ${FRONTEND_SERVICE}"
  echo "  Image:      ${FRONTEND_IMAGE}"
  echo "  Memory:     ${FRONTEND_MEMORY}"
  echo "  CPU:        ${FRONTEND_CPU}"
  echo "  Build:      ./ (Dockerfile)"
  echo "  API URL:    ${FRONTEND_API_URL}"
  echo "  NahSeHat:   ${NAHSEHAT_API_V3}"
  echo "  AdBrief:    ${NAHSEHAT_ADBRIEF_API_V3}"
  echo "============================================"
  echo ""

  # Build frontend image with VITE env vars as build args
  echo "🏗️  Building frontend image..."
  docker build --platform linux/amd64 \
    -t "${FRONTEND_IMAGE}" \
    -f "${SCRIPT_DIR}/Dockerfile" \
    --build-arg "VITE_BE_API=${FRONTEND_API_URL}" \
    --build-arg "VITE_NAHSEHAT_API_V3=${NAHSEHAT_API_V3}" \
    --build-arg "VITE_NAHSEHAT_ADBRIEF_API_V3=${NAHSEHAT_ADBRIEF_API_V3}" \
    --build-arg "VITE_APP_NAME=NahSehat Dashboard" \
    --build-arg "VITE_ENV=production" \
    --build-arg "VITE_ENABLE_MOCK=false" \
    --build-arg "VITE_ENABLE_DEVTOOLS=false" \
    "${SCRIPT_DIR}"
  echo "✅ Frontend image built"
  echo ""

  # Push frontend
  echo "📦 Pushing frontend image..."
  docker push "${FRONTEND_IMAGE}"
  echo "✅ Frontend image pushed"
  echo ""

  # Deploy frontend
  echo "🚀 Deploying frontend to Cloud Run..."
  gcloud run deploy "${FRONTEND_SERVICE}" \
    --image "${FRONTEND_IMAGE}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --platform managed \
    --allow-unauthenticated \
    --port "${FRONTEND_PORT}" \
    --memory "${FRONTEND_MEMORY}" \
    --cpu "${FRONTEND_CPU}" \
    --min-instances "${FRONTEND_MIN_INSTANCES}" \
    --max-instances "${FRONTEND_MAX_INSTANCES}"

  FRONTEND_URL=$(gcloud run services describe "${FRONTEND_SERVICE}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format "value(status.url)")

  echo ""
  echo "✅ Frontend deployed: ${FRONTEND_URL}"
  echo ""
fi

# ─── Summary ─────────────────────────────────────────
echo "============================================"
echo "✨ Deployment Complete!"
echo "============================================"
if [ "$DEPLOY_BACKEND" = true ] || [ -n "$BACKEND_URL_OVERRIDE" ]; then
  if [ -n "$BACKEND_URL_OVERRIDE" ]; then
    echo "  Backend URL:  ${BACKEND_URL_OVERRIDE}"
  else
    echo "  Backend URL:  ${BACKEND_URL}"
  fi
fi
if [ "$DEPLOY_FRONTEND" = true ]; then
  echo "  Frontend URL: ${FRONTEND_URL}"
fi
echo "============================================"
echo ""
echo "📋 Next Steps:"
echo "   1. Update CORS_ORIGIN in env.cloud-run.yaml with the frontend URL"
echo "      (if not already set), then redeploy backend:"
echo "      ./deploy-all.sh --backend-only"
echo ""
echo "📋 Useful Commands:"
echo "   View backend logs:  gcloud run logs read --service=${BACKEND_SERVICE} --region=${REGION} --limit=50"
echo "   View frontend logs: gcloud run logs read --service=${FRONTEND_SERVICE} --region=${REGION} --limit=50"
echo "   Backend health:     curl ${BACKEND_URL:-<backend-url>}/health"
echo "   Frontend health:    curl ${FRONTEND_URL:-<frontend-url>}/health"
echo ""
echo "✨ Done!"