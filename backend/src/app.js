import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fabricConfig } from './config/fabric.config.js'
import { closeGateway } from './services/fabric.service.js'
import projectsRouter from './routes/projects.routes.js'
import milestonesRouter from './routes/milestones.routes.js'
import certificatesRouter from './routes/certificates.routes.js'
import verifyRouter from './routes/verify.routes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'chainproof-backend',
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/projects', projectsRouter)
app.use('/api/milestones', milestonesRouter)
app.use('/api/certificates', certificatesRouter)
app.use('/api/verify', verifyRouter)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err?.message || 'Unexpected server error.',
    },
  })
})

const server = app.listen(fabricConfig.port, () => {
  console.log(`ChainProof backend listening on http://localhost:${fabricConfig.port}`)
})

function shutdown () {
  console.log('Shutting down...')
  closeGateway()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
