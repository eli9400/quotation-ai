import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { env } from './config/env.js'
import { documentsRouter } from './routes/documents.route.js'
import { healthRouter } from './routes/health.route.js'
import { modelRouter } from './routes/model.route.js'
import { providerQuotesRouter } from './routes/provider-quotes.route.js'
import { quotesRouter } from './routes/quotes.route.js'
import { serviceProvidersRouter } from './routes/service-providers.route.js'
import { trainingRouter } from './routes/training.route.js'

export const app = express()

app.use(cors({ origin: env.webOrigin }))
app.use(express.json({ limit: '5mb' }))

app.use('/api', healthRouter)
app.use('/api', serviceProvidersRouter)
app.use('/api', documentsRouter)
app.use('/api', trainingRouter)
app.use('/api', modelRouter)
app.use('/api', quotesRouter)
app.use('/api', providerQuotesRouter)

function mapMulterErrorMessage(error: multer.MulterError): string {
  if (error.code === 'LIMIT_FILE_COUNT') {
    return 'Too many files in one upload request. Split into smaller batches.'
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return 'One or more files exceed the allowed size limit.'
  }
  return error.message
}

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next
  if (error instanceof multer.MulterError) {
    res.status(400).json({ ok: false, message: mapMulterErrorMessage(error) })
    return
  }
  if (error instanceof Error) {
    res.status(400).json({ ok: false, message: error.message })
    return
  }
  res.status(500).json({ ok: false, message: 'Unexpected server error.' })
})
