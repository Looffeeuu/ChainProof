import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { removeUpload, storeUpload, uploadPath } from '../src/services/file-storage.service.js'

test('链下文件按 milestoneId 的安全散列路径保存并可清理', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chainproof-upload-'))
  try {
    const bytes = Buffer.from('原始成果文件')
    const stored = await storeUpload('../M001', bytes, root)

    assert.equal(stored, uploadPath('../M001', root))
    assert.equal(stored.startsWith(root), true)
    assert.deepEqual(await readFile(stored), bytes)

    await removeUpload('../M001', root)
    await assert.rejects(readFile(stored), { code: 'ENOENT' })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('同一里程碑不会静默覆盖已有链下文件', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chainproof-upload-'))
  try {
    await storeUpload('M001', Buffer.from('first'), root)
    await assert.rejects(storeUpload('M001', Buffer.from('second'), root), { code: 'EEXIST' })
    assert.equal((await readFile(uploadPath('M001', root))).toString(), 'first')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
