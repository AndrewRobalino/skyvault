#!/usr/bin/env bash
# deploy/gcp_setup.sh — one-time GCP setup for SkyVault (Phase 5 plan Task 14).
# Run once in Cloud Shell as the project owner, from the repo root:
#   bash deploy/gcp_setup.sh <PROJECT_ID>
# Safe to re-run: "create" steps that already exist are skipped.
set -euo pipefail
PROJECT_ID="${1:?usage: bash deploy/gcp_setup.sh <PROJECT_ID>}"
REGION=us-east1
REPO="AndrewRobalino/skyvault"
gcloud config set project "$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "== APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com cloudbilling.googleapis.com \
  billingbudgets.googleapis.com pubsub.googleapis.com cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com eventarc.googleapis.com

echo "== Artifact Registry (keeps the last 3 images)"
gcloud artifacts repositories create skyvault --repository-format=docker \
  --location="$REGION" --description="SkyVault API images" || true
gcloud artifacts repositories set-cleanup-policies skyvault --location="$REGION" \
  --policy=deploy/ar-cleanup-policy.json --no-dry-run

echo "== Service accounts"
RUNTIME_SA="skyvault-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA="skyvault-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create skyvault-runtime --display-name="SkyVault API runtime (no roles)" || true
gcloud iam service-accounts create skyvault-deployer --display-name="SkyVault CI deployer" || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/run.developer --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/artifactregistry.writer --condition=None >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser >/dev/null

echo "== Workload Identity Federation (GitHub Actions -> deployer, this repo only)"
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions" || true
gcloud iam workload-identity-pools providers create-oidc github --location=global \
  --workload-identity-pool=github --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" || true
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}" >/dev/null

echo "== First deploy (Google's sample container, real limits, public once)"
# CI later swaps only the image; its run.developer role can't (and needn't)
# change IAM, so the one-time allUsers invoker binding happens here.
gcloud run deploy skyvault-api --image=us-docker.pkg.dev/cloudrun/container/hello \
  --region="$REGION" --service-account="$RUNTIME_SA" --max-instances=1 --cpu=1 \
  --memory=512Mi --concurrency=10 --timeout=30 --allow-unauthenticated

URL=$(gcloud run services describe skyvault-api --region="$REGION" --format='value(status.url)')
cat <<OUT

Done. Set these as GitHub repository VARIABLES
(Settings > Secrets and variables > Actions > Variables tab):
  GCP_PROJECT_ID=$PROJECT_ID
  GCP_WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github
  GCP_DEPLOY_SA=$DEPLOY_SA
  GCP_RUNTIME_SA=$RUNTIME_SA

Cloudflare Pages build variable:
  VITE_API_BASE=${URL}/api/v1
OUT
