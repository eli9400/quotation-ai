# Quotation AI

Web app for service providers and clients:
- Providers upload historical quotes and train a pricing model.
- Clients submit quote requests through a dynamic form.
- Providers review, edit, approve, and continue improving the model.

Tech stack:
- Frontend: `React + TypeScript + Vite`
- Backend: `Node.js + Express + TypeScript`
- Data/Auth/Storage: `Firebase (Firestore, Auth, Storage)`

---

## Project Structure

```text
quotation-ai/
  src/                    # Frontend (Vite)
  server/
    src/                  # Backend (Express)
    scripts/              # Utility scripts (seed/retrain)
  .env.example            # Frontend env template
  server/.env.example     # Backend env template
```

---

## Prerequisites

- Node.js `20+`
- npm `10+`
- Firebase project with:
  - Authentication (Email/Password)
  - Firestore
  - Storage
- OpenAI API key (recommended for AI extraction/parser improvements)

---

## Installation

From repository root:

```bash
npm install
npm --prefix server install
```

---

## Files Missing From Git (You Must Provide Them)

These files are intentionally not committed and are required for local setup:

1. Frontend env file: `.env.local`
2. Backend env file: `server/.env`
3. Firebase Admin credentials:
   - Either a JSON service account file (for `FIREBASE_SERVICE_ACCOUNT_PATH`)
   - Or raw Firebase admin env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)

Why they are missing:
- Secrets and private credentials are excluded by `.gitignore`.

---

## Environment Setup

### 1) Frontend env (`.env.local`)

Create from template:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set values in `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### 2) Backend env (`server/.env`)

Create from template:

```bash
cp server/.env.example server/.env
```

Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

Set values in `server/.env`:

```env
PORT=4000
WEB_ORIGIN=http://localhost:5173
UPLOADS_MAX_MB=10
CLIENT_FORM_MAX_ITEMS=40

# Firebase admin (option A: path to JSON)
FIREBASE_SERVICE_ACCOUNT_PATH=../your-service-account.json

# Firebase admin (option B: direct vars)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

Notes:
- `FIREBASE_STORAGE_BUCKET` is required by backend Firebase initialization.
- If `OPENAI_API_KEY` is empty, some AI parsing features may fallback to non-LLM logic.

---

## Run Locally

Start backend:

```bash
npm --prefix server run dev
```

Start frontend (another terminal):

```bash
npm run dev
```

App URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/api/health`

---

## Helpful Scripts

### Frontend

```bash
npm run lint
npm run build
```

### Backend

```bash
npm --prefix server run typecheck
npm --prefix server run build
```

### Seed default intake templates (Firestore)

```bash
cd server
npx tsx scripts/seed-intake-templates.ts
```

### Full retrain utility

```bash
cd server
npx tsx scripts/full-retrain.ts --uid=<SERVICE_PROVIDER_UID>
```

---

## Collaboration Checklist (For New Developers)

When onboarding a developer, provide:

1. `.env.local` values (frontend Firebase + API URL)
2. `server/.env` values (backend secrets and runtime config)
3. Firebase admin credentials (JSON or env values)
4. Access to Firebase project (Auth/Firestore/Storage)
5. (Optional) OpenAI key for AI extraction features

Do not commit secret files to git.

---

## Deployment Direction (Current)

Recommended production architecture:
- Frontend: Firebase Hosting
- Backend API: Cloud Run
- Firestore/Auth/Storage: Firebase

Important before full production:
- Current document uploads are local (`server/uploads`).
- For stable cloud runtime, move document file persistence to Firebase Storage.

---

## Cloud Run Deployment (PowerShell)

Use this exact flow on Windows PowerShell.

### 1) Configure gcloud

```powershell
gcloud config set project quotation-ai-1934f
gcloud config set run/region us-central1

gcloud services enable run.googleapis.com `
  cloudbuild.googleapis.com `
  artifactregistry.googleapis.com `
  secretmanager.googleapis.com `
  iam.googleapis.com
```

### 2) Service Account + IAM

```powershell
gcloud iam service-accounts create quotation-ai-api `
  --display-name "Quotation AI API"

gcloud projects add-iam-policy-binding quotation-ai-1934f `
  --member="serviceAccount:quotation-ai-api@quotation-ai-1934f.iam.gserviceaccount.com" `
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding quotation-ai-1934f `
  --member="serviceAccount:quotation-ai-api@quotation-ai-1934f.iam.gserviceaccount.com" `
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding quotation-ai-1934f `
  --member="serviceAccount:quotation-ai-api@quotation-ai-1934f.iam.gserviceaccount.com" `
  --role="roles/firebaseauth.admin"

gcloud projects add-iam-policy-binding quotation-ai-1934f `
  --member="serviceAccount:quotation-ai-api@quotation-ai-1934f.iam.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

### 3) Secret Manager (OpenAI key)

```powershell
gcloud secrets describe openai-api-key 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud secrets create openai-api-key --replication-policy="automatic"
}

$OPENAI_KEY = Read-Host "Paste OPENAI_API_KEY"
$OPENAI_KEY | gcloud secrets versions add openai-api-key --data-file=-
```

### 4) Create Storage bucket for documents

```powershell
gcloud storage buckets create gs://quotation-ai-1934f-documents `
  --project=quotation-ai-1934f `
  --location=us-central1 `
  --uniform-bucket-level-access
```

### 5) Deploy backend to Cloud Run

From repo root:

```powershell
gcloud run deploy quotation-ai-api `
  --source ".\server" `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --service-account quotation-ai-api@quotation-ai-1934f.iam.gserviceaccount.com `
  --set-secrets OPENAI_API_KEY=openai-api-key:latest `
  --set-env-vars "NODE_ENV=production,WEB_ORIGIN=http://localhost:5173,FIREBASE_PROJECT_ID=quotation-ai-1934f,FIREBASE_STORAGE_BUCKET=quotation-ai-1934f-documents,FIREBASE_USE_ADC=true,UPLOADS_DIR=/tmp/uploads,UPLOADS_MAX_MB=10,CLIENT_FORM_MAX_ITEMS=120,OPENAI_MODEL=gpt-4.1-mini,OPENAI_BASE_URL=https://api.openai.com/v1"
```

Get URL:

```powershell
gcloud run services describe quotation-ai-api --region us-central1 --format="value(status.url)"
```

Health check:

```powershell
Invoke-WebRequest "https://quotation-ai-api-ckaczwaj3q-uc.a.run.app/api/health"

```

### 6) Migrate old local uploads to Firebase Storage (one-time)

```powershell
cd server
npx tsx scripts/migrate-local-documents-to-storage.ts
```

Expected result includes:
- `"uploaded": <number>`
- `"missingLocalFile": 0`

### 7) Frontend config for cloud API

Set `.env.local`:

```env
VITE_API_BASE_URL=https://<YOUR_CLOUD_RUN_URL>/api
```
