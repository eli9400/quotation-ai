# Quotation AI
Quotation AI is a full-stack system for service providers:
- Upload historical quote files (PDF/DOCX/XLSX/CSV)
- Train pricing intelligence from real line-items
- Manage model line-items and client form fields
- Handle incoming quote requests
## 1) What This Project Does
- Authenticates service providers (Firebase Auth)
- Stores model/training/docs data (Firestore)
- Stores uploaded files (Firebase Storage)
- Extracts pricing text and runs training
- Serves provider line-items to a client-facing quote flow
Main flow:
1. Provider signs in.
2. Provider uploads quote documents.
3. System validates and extracts pricing lines.
4. Provider starts training.
5. Learned items become available in model/editor/form preview.
## 2) Tech Stack
- Frontend: React 19, TypeScript, Vite
- Backend: Node.js, Express 5, TypeScript
- Firebase: Auth, Firestore, Storage
- AI and parsing:
  - OpenAI API (optional but recommended)
  - `pdf-parse`, `mammoth`, `xlsx`
## 3) Project Structure
```text
quotation-ai/
  src/                                # Frontend (Vite)
  server/
    src/                              # Backend (Express)
    scripts/                          # Retrain / rollback / normalization scripts
    .env.example                      # Backend env template
  .env.example                        # Frontend env template
  firebase-service-account.example.json
```
## 4) Prerequisites
- Node.js 20+, npm 10+
- Firebase project with:
  - Email/Password Auth
  - Firestore
  - Storage bucket
- Access to that Firebase project
- Optional OpenAI API key for AI features
## 5) Installation
```bash
npm install
npm --prefix server install
```
## 6) Environment Setup
### Frontend (`.env.local`)
Create from template:
```bash
cp .env.example .env.local
```
Fill:
```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```
### Backend (`server/.env`)
Create from template:
```bash
cp server/.env.example server/.env
```
Minimum runtime values:
```env
PORT=4000
WEB_ORIGIN=http://localhost:5173
UPLOADS_DIR=./uploads
UPLOADS_MAX_MB=10
CLIENT_FORM_MAX_ITEMS=40
FIREBASE_STORAGE_BUCKET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional model retraining scheduler
MODEL_RETRAIN_SCHEDULER_ENABLED=false
MODEL_RETRAIN_INTERVAL_MINUTES=360
MODEL_RETRAIN_MIN_EXAMPLES=50
MODEL_CANARY_TRAFFIC_PERCENT=10
MODEL_CANARY_MAX_MAE_INCREASE_PCT=0.15
MODEL_CANARY_MAX_SMAPE_INCREASE_PCT=0.2
MODEL_ALERTS_ENABLED=true
MODEL_ALERT_MIN_ERROR_SAMPLES=20
MODEL_ALERT_MAX_MAE_INCREASE_PCT=0.35
MODEL_ALERT_MAX_SMAPE_INCREASE_PCT=0.35
```
## 7) Firebase Admin Setup Options
### Option A: Local service account JSON (recommended)
1. Copy `firebase-service-account.example.json` to `server/firebase-service-account.json`
2. Put real credentials in that file
3. In `server/.env`:
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```
### Option B: Direct env values
In `server/.env`:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
`FIREBASE_PRIVATE_KEY` supports escaped newlines (`\n`).
### Cloud Run compatibility
Still supported:
```env
FIREBASE_USE_ADC=true
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-bucket
```
## 8) Files Missing From Git (Must Come From Project Owner)
- `.env.local` values
- `server/.env` values
- Real Firebase Admin credentials:
  - `server/firebase-service-account.json`, or
  - direct Firebase Admin env vars
- Firebase project access permissions
- OpenAI API key (if AI features are required)
## 9) Run Locally
Terminal 1 (backend):
```bash
npm --prefix server run dev
```
Terminal 2 (frontend):
```bash
npm run dev
```
## 10) Expected Local Result
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health endpoint: `GET http://localhost:4000/api/health`
  - Expected response contains:
    - `"ok": true`
    - `"service": "quotation-ai-server"`
UI expectations:
- First screen: hero + provider login/signup
- After login:
  - Documents panel (upload/remove/clear)
  - Training panel with stages/progress
  - Client form preview and items editor
  - Quotes history section
## 11) Helpful Scripts
- Frontend:
  - `npm run lint`
  - `npm run build`
- Backend:
  - `npm --prefix server run typecheck`
  - `npm --prefix server run test`
  - `npm --prefix server run build`
  - `npm --prefix server run audit:training -- --uid=<SERVICE_PROVIDER_UID>`
  - `npm --prefix server run train:model:v1 -- --uid=<SERVICE_PROVIDER_UID> --mode=canary --canary=10`
  - Rollout/monitoring API:
    - `GET /api/model/rollout`
    - `GET /api/model/monitoring`
    - `POST /api/model/rollout/promote`
    - `POST /api/model/rollout/rollback`
    - `POST /api/model/rollback-previous`
- Utilities:
  - `npx --prefix server tsx server/scripts/full-retrain.ts --uid=<SERVICE_PROVIDER_UID>`
  - `npx --prefix server tsx server/scripts/normalize-pricing-items.ts --uid=<SERVICE_PROVIDER_UID>`
  - `npx --prefix server tsx server/scripts/rollback-training-job.ts --jobId=<JOB_ID>`
## 12) Troubleshooting
- `Firebase Admin is not configured`:
  - Configure Option A or Option B (or ADC on Cloud Run)
  - Ensure `FIREBASE_STORAGE_BUCKET` is set
- Service account path not found:
  - Verify `FIREBASE_SERVICE_ACCOUNT_PATH`
  - Recommended local file: `server/firebase-service-account.json`
- Invalid private key:
  - Keep full key with BEGIN/END markers
  - For env mode, use `\n` escaped newlines
## 13) Security Note
- Never commit `.env`, `.env.local`, service account JSON, or API keys.
- Use local env files, secret manager, or CI/CD secrets.
