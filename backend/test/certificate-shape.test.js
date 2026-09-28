import assert from 'node:assert/strict'
import test from 'node:test'
import { publicCertificate, publicVerification } from '../src/utils/certificate-shape.js'

const certificate = {
  docType: 'certificate',
  certificateId: 'CP-001',
  projectId: 'P001',
  memberId: 'alice',
  contributionPercentage: 60,
  milestoneIds: ['M001'],
  issuedAt: '2026-09-28T00:00:00.000Z',
  verificationStatus: 'VALID',
  txId: 'a'.repeat(64),
  internalOnly: true
}

test('publicCertificate only exposes the REST contract fields', () => {
  assert.deepEqual(publicCertificate(certificate), {
    certificateId: 'CP-001',
    projectId: 'P001',
    memberId: 'alice',
    contributionPercentage: 60,
    milestoneIds: ['M001'],
    issuedAt: '2026-09-28T00:00:00.000Z',
    verificationStatus: 'VALID',
    txId: 'a'.repeat(64)
  })
})

test('publicVerification preserves the VALID envelope and strips internal fields', () => {
  assert.deepEqual(publicVerification({
    certificateId: 'CP-001',
    verificationStatus: 'VALID',
    certificate
  }), {
    certificateId: 'CP-001',
    verificationStatus: 'VALID',
    certificate: publicCertificate(certificate)
  })
})

test('publicVerification keeps NOT_FOUND as a successful two-field result', () => {
  assert.deepEqual(publicVerification({
    certificateId: 'CP-MISSING',
    verificationStatus: 'NOT_FOUND'
  }), {
    certificateId: 'CP-MISSING',
    verificationStatus: 'NOT_FOUND'
  })
})
