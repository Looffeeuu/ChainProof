import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { env } from './config/env.js'
import { projectRouter } from './routes/project.routes.js'
import { milestoneRouter } from './routes/milestone.routes.js'
import { certificateRouter, verificationRouter } from './routes/certificate.routes.js'
import { mapApplicationError } from './utils/application-error.js'

export const app = express()

app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'chainproof-backend',
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.use('/api/projects', projectRouter)
app.use('/api/milestones', milestoneRouter)
app.use('/api/certificates', certificateRouter)
app.use('/api/verify', verificationRouter)

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `未找到接口：${req.method} ${req.originalUrl}`
    }
  })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  const mapped = mapApplicationError(err)
  res.status(mapped.status).json({
    error: {
      code: mapped.code,
      message: mapped.message
    }
  })
})

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  app.listen(env.port, () => {
    console.log(`ChainProof backend listening on http://localhost:${env.port}`)
  })
}

