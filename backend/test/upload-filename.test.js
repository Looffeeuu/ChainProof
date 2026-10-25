import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import express from 'express'
import { upload } from '../src/routes/project.routes.js'

test('上传的中文文件名按 UTF-8 解析，不出现乱码', async (t) => {
  const app = express()
  app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ originalname: req.file.originalname })
  })
  const server = app.listen(0)
  t.after(() => server.close())
  await once(server, 'listening')
  const { port } = server.address()

  // 按浏览器的方式手写 multipart：filename 参数里是原始 UTF-8 字节
  const boundary = '----chainproof-test'
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="`),
    Buffer.from('答辩成果-v1.pdf', 'utf8'),
    Buffer.from(`"\r\nContent-Type: application/pdf\r\n\r\nhello\r\n--${boundary}--\r\n`),
  ])
  const response = await fetch(`http://127.0.0.1:${port}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { originalname: '答辩成果-v1.pdf' })
})
