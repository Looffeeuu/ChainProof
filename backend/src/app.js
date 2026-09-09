import express from 'express'
import cors from 'cors'
import { env } from './config/env.js'
import { projectRouter } from './routes/project.routes.js'

const app = express()

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

  const message = err instanceof Error ? err.message : 'Unexpected server error.'
  const isFabricInputError = /already exists|does not exist|must contain|must sum|not a contributor|Decision must/i.test(message)

  res.status(isFabricInputError ? 400 : 500).json({
    error: {
      code: isFabricInputError ? 'FABRIC_TRANSACTION_REJECTED' : 'INTERNAL_ERROR',
      message
    }
  })
})

app.listen(env.port, () => {
  console.log(`ChainProof backend listening on http://localhost:${env.port}`)
})
