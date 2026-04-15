import { fileURLToPath } from 'node:url'

const defaultUploadsDir = fileURLToPath(new URL('../../uploads', import.meta.url))

export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  maxUploadSizeMb: Number(process.env.UPLOADS_MAX_MB ?? 10),
  clientFormMaxItems: Number(process.env.CLIENT_FORM_MAX_ITEMS ?? 40),
  uploadsDir: process.env.UPLOADS_DIR ?? defaultUploadsDir,
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ?? '',
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? '',
  firebaseUseAdc:
    (process.env.FIREBASE_USE_ADC ?? '').trim().toLowerCase() === 'true',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  openAiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
  modelRetrainSchedulerEnabled:
    (process.env.MODEL_RETRAIN_SCHEDULER_ENABLED ?? '').trim().toLowerCase() === 'true',
  modelRetrainIntervalMinutes: Number(process.env.MODEL_RETRAIN_INTERVAL_MINUTES ?? 360),
  modelRetrainMinExamples: Number(process.env.MODEL_RETRAIN_MIN_EXAMPLES ?? 50),
  modelCanaryTrafficPercent: Number(process.env.MODEL_CANARY_TRAFFIC_PERCENT ?? 10),
  modelCanaryMaxMaeIncreasePct: Number(process.env.MODEL_CANARY_MAX_MAE_INCREASE_PCT ?? 0.15),
  modelCanaryMaxSmapeIncreasePct: Number(process.env.MODEL_CANARY_MAX_SMAPE_INCREASE_PCT ?? 0.2),
  modelAlertsEnabled: (process.env.MODEL_ALERTS_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
  modelAlertMinErrorSamples: Number(process.env.MODEL_ALERT_MIN_ERROR_SAMPLES ?? 20),
  modelAlertMaxMaeIncreasePct: Number(process.env.MODEL_ALERT_MAX_MAE_INCREASE_PCT ?? 0.35),
  modelAlertMaxSmapeIncreasePct: Number(process.env.MODEL_ALERT_MAX_SMAPE_INCREASE_PCT ?? 0.35),
}
