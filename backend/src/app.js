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
  const mapped = mapApplicationError(err)
  res.status(mapped.status).json({
    error: {
      code: mapped.code,
      message: mapped.message
    }
  })
})

function mapApplicationError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')

  let match = message.match(/Project\s+([^\s]+)\s+does not exist/i)
  if (match) {
    return { status: 404, code: 'PROJECT_NOT_FOUND', message: `项目 ${match[1]} 不存在。` }
  }

  match = message.match(/Milestone\s+([^\s]+)\s+does not exist/i)
  if (match) {
    return { status: 404, code: 'MILESTONE_NOT_FOUND', message: `里程碑 ${match[1]} 不存在。` }
  }

  if (/Project\s+.+\s+already exists/i.test(message)) {
    return { status: 409, code: 'PROJECT_ALREADY_EXISTS', message: '该项目 ID 已存在，请更换后重试。' }
  }

  if (/Milestone\s+.+\s+already exists/i.test(message)) {
    return { status: 409, code: 'MILESTONE_ALREADY_EXISTS', message: '该里程碑 ID 已存在，请更换后重试。' }
  }

  if (/Contribution percentages must sum to 100/i.test(message)) {
    return { status: 400, code: 'CONTRIBUTION_TOTAL_INVALID', message: '贡献比例总和必须正好等于 100%。' }
  }

  if (/not a contributor/i.test(message)) {
    return { status: 403, code: 'MEMBER_NOT_IN_CLAIM', message: '当前成员不在这份贡献声明中，无法表态。' }
  }

  if (/already decided|already confirmed|already rejected/i.test(message)) {
    return { status: 409, code: 'ALREADY_DECIDED', message: '当前成员已经表过态，MVP 中不能撤回或改票。' }
  }

  if (/milestone.*closed|already verified|already rejected|no longer accepts/i.test(message)) {
    return { status: 409, code: 'MILESTONE_CLOSED', message: '该里程碑已经结束，不再接受新的表态。' }
  }

  if (/Decision must be CONFIRMED or REJECTED/i.test(message)) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'decision 只能是 CONFIRMED 或 REJECTED。' }
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误，请查看后端日志。'
  }
}

app.listen(env.port, () => {
  console.log(`ChainProof backend listening on http://localhost:${env.port}`)
})
