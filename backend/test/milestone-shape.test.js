import test from 'node:test'
import assert from 'node:assert/strict'
import { publicMilestone } from '../src/utils/milestone-shape.js'

test('publicMilestone exposes independent confirmation fields and hides docType', () => {
  const milestone = publicMilestone({
    docType: 'milestone',
    milestoneId: 'M001',
    projectId: 'P001',
    title: '成果',
    description: '',
    fileName: 'result.zip',
    fileHash: 'a'.repeat(64),
    submitterId: 'alice',
    requiredConfirmerIds: ['bob', 'charlie'],
    contributors: [{ memberId: 'alice', percentage: 100 }],
    confirmations: [],
    createdAt: '2026-09-29T00:00:00.000Z',
    status: 'PENDING_CONFIRMATION',
    txId: 'b'.repeat(64)
  })

  assert.equal(milestone.submitterId, 'alice')
  assert.deepEqual(milestone.requiredConfirmerIds, ['bob', 'charlie'])
  assert.equal('docType' in milestone, false)
})
