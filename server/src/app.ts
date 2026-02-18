import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { env } from './config/env.js'
import { documentsRouter } from './routes/documents.route.js'
import { healthRouter } from './routes/health.route.js'
import { quotesRouter } from './routes/quotes.route.js'
import { trainingRouter } from './routes/training.route.js'

export const app = express()

app.use(cors({ origin: env.webOrigin }))
app.use(express.json({ limit: '5mb' }))

app.use('/api', healthRouter)
app.use('/api', documentsRouter)
app.use('/api', trainingRouter)
app.use('/api', quotesRouter)

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ ok: false, message: error.message })
    return
  }
  if (error instanceof Error) {
    res.status(400).json({ ok: false, message: error.message })
    return
  }
  res.status(500).json({ ok: false, message: 'Unexpected server error.' })
})
