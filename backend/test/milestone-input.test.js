import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { assertMatchingFileHash, parseContributors } from '../src/utils/milestone-input.js'

test('contributors 正常化后保持整数比例且总和为 100', () => {
  assert.deepEqual(
    parseContributors('[{"memberId":" alice ","percentage":60},{"memberId":"bob","percentage":40}]'),
    [
      { memberId: 'alice', percentage: 60 },
      { memberId: 'bob', percentage: 40 }
    ]
  )
})

test('contributors 总和不为 100 时返回固定错误码', () => {
  assert.throws(
    () => parseContributors('[{"memberId":"alice","percentage":99}]'),
    (error) => error.status === 400 && error.code === 'CONTRIBUTION_TOTAL_INVALID'
  )
})

test('contributors 拒绝小数、重复成员和损坏 JSON', () => {
  const invalid = [
    '[{"memberId":"alice","percentage":50.5},{"memberId":"bob","percentage":49.5}]',
    '[{"memberId":"alice","percentage":50},{"memberId":"alice","percentage":50}]',
    '{bad json'
  ]
  for (const raw of invalid) {
    assert.throws(
      () => parseContributors(raw),
      (error) => error.status === 400 && error.code === 'VALIDATION_ERROR'
    )
  }
})

test('双 SHA-256 一致时通过，不一致时返回两边前 8 位', () => {
  const server = createHash('sha256').update('server bytes').digest('hex')
  const client = createHash('sha256').update('client bytes').digest('hex')

  assert.doesNotThrow(() => assertMatchingFileHash(server, server))
  assert.throws(
    () => assertMatchingFileHash(client, server),
    (error) =>
      error.code === 'FILE_HASH_MISMATCH' &&
      error.message.includes(client.slice(0, 8)) &&
      error.message.includes(server.slice(0, 8))
  )
})

test('客户端哈希必须是 64 位小写十六进制', () => {
  assert.throws(
    () => assertMatchingFileHash('ABC', '0'.repeat(64)),
    (error) => error.code === 'VALIDATION_ERROR'
  )
})
