import express from 'express'
import cors from 'cors'

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({
    service: 'chainproof-backend',
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unexpected server error.'
    }
  })
})

app.listen(port, () => {
  console.log(`ChainProof backend listening on http://localhost:${port}`)
})
