import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { app } from '../src/app.js'

test('Week 2/3 路由已注册且在访问 Fabric 前完成必填校验', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`

  const health = await fetch(`${base}/api/health`)
  assert.equal(health.status, 200)

  const confirmation = await fetch(`${base}/api/milestones/M001/confirmations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: 'CONFIRMED' })
  })
  assert.equal(confirmation.status, 400)
  assert.deepEqual(await confirmation.json(), {
    error: {
      code: 'VALIDATION_ERROR',
      message: '请求头 X-Member-Id 为必填项。'
    }
  })

  const form = new FormData()
  form.set('title', '缺少文件')
  form.set('contributors', JSON.stringify([{ memberId: 'alice', percentage: 100 }]))
  form.set('clientFileHash', '0'.repeat(64))
  const upload = await fetch(`${base}/api/projects/P001/milestones`, {
    method: 'POST',
    body: form
  })
  assert.equal(upload.status, 400)
  assert.equal((await upload.json()).error.code, 'VALIDATION_ERROR')

  const certificate = await fetch(`${base}/api/projects/P001/certificates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  assert.equal(certificate.status, 400)
  assert.deepEqual(await certificate.json(), {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'memberId 为必填项。'
    }
  })
})
