import test from 'node:test'
import assert from 'node:assert/strict'
import { mapApplicationError } from '../src/utils/application-error.js'

const structuredCases = [
  ['PROJECT_NOT_FOUND', 404],
  ['MILESTONE_NOT_FOUND', 404],
  ['CERTIFICATE_NOT_FOUND', 404],
  ['CONTRIBUTION_TOTAL_INVALID', 400],
  ['MEMBER_NOT_IN_CLAIM', 403],
  ['ALREADY_DECIDED', 409],
  ['MILESTONE_CLOSED', 409],
  ['FILE_HASH_MISMATCH', 400],
  ['NO_VERIFIED_CONTRIBUTION', 409],
  ['VALIDATION_ERROR', 400]
]

for (const [code, status] of structuredCases) {
  test(`maps structured Chaincode error ${code}`, () => {
    const error = new Error(`EndorseError: chaincode response 500, ${code}: 中文业务说明。`)
    assert.deepEqual(mapApplicationError(error), {
      status,
      code,
      message: '中文业务说明。'
    })
  })
}

test('keeps compatibility with the original English Chaincode errors', () => {
  assert.deepEqual(mapApplicationError(new Error('Project P001 does not exist')), {
    status: 404,
    code: 'PROJECT_NOT_FOUND',
    message: '项目 P001 不存在。'
  })
})

test('maps an unknown error to INTERNAL_ERROR', () => {
  assert.deepEqual(mapApplicationError(new Error('connection reset')), {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: '服务器内部错误，请查看后端日志。'
  })
})

