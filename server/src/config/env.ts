import { fileURLToPath } from 'node:url'

const defaultUploadsDir = fileURLToPath(new URL('../../uploads', import.meta.url))

export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  maxUploadSizeMb: Number(process.env.UPLOADS_MAX_MB ?? 10),
  uploadsDir: process.env.UPLOADS_DIR ?? defaultUploadsDir,
}
