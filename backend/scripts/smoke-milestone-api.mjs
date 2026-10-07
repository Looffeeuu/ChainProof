import { createHash } from 'node:crypto'

const BASE = (process.env.CHAINPROOF_API_URL || 'http://127.0.0.1:3000/api/').replace(/\/?$/, '/')
const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const projectId = `P-W2-${nonce}`
const fileBytes = Buffer.from(`ChainProof Week 2 smoke ${nonce}\n`, 'utf8')
const fileHash = createHash('sha256').update(fileBytes).digest('hex')

async function json(path, options = {}, expected = 200) {
  const response = await fetch(new URL(path, BASE), options)
  const payload = await response.json().catch(() => null)
  if (response.status !== expected) {
    throw new Error(`${options.method || 'GET'} ${path}: expected ${expected}, got ${response.status} ${JSON.stringify(payload)}`)
  }
  return payload
}

function as(memberId, options = {}) {
  return { ...options, headers: { ...(options.headers || {}), 'X-Member-Id': memberId } }
}

function uploadForm(title, clientFileHash = fileHash, contributors = [
  { memberId: 'alice', percentage: 60 },
  { memberId: 'bob', percentage: 40 }
]) {
  const form = new FormData()
  form.set('title', title)
  form.set('description', 'Week 2 真实链路验收')
  form.set('contributors', JSON.stringify(contributors))
  form.set('clientFileHash', clientFileHash)
  form.set('file', new Blob([fileBytes]), 'week2-smoke.txt')
  return form
}

function decision(memberId, value) {
  return as(memberId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: value })
  })
}

await json('health')
await json('projects', as('alice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ projectId, name: `Week 2 ${nonce}`, members: ['alice', 'bob', 'charlie'] })
}), 201)

const mismatch = await json(`projects/${projectId}/milestones`, as('alice', {
  method: 'POST',
  body: uploadForm('哈希不一致', '0'.repeat(64))
}), 400)
if (mismatch.error?.code !== 'FILE_HASH_MISMATCH') throw new Error('expected FILE_HASH_MISMATCH')
if (!mismatch.error.message.includes('00000000') || !mismatch.error.message.includes(fileHash.slice(0, 8))) {
  throw new Error('FILE_HASH_MISMATCH message does not include both hash prefixes')
}

const created = await json(`projects/${projectId}/milestones`, as('alice', {
  method: 'POST',
  body: uploadForm('确认闭环')
}), 201)
if (
  created.fileHash !== fileHash ||
  created.status !== 'PENDING_CONFIRMATION' ||
  created.submitterId !== 'alice' ||
  JSON.stringify(created.requiredConfirmerIds) !== JSON.stringify(['bob', 'charlie']) ||
  !created.txId
) {
  throw new Error(`unexpected created milestone ${JSON.stringify(created)}`)
}

const listed = await json(`projects/${projectId}/milestones`, as('alice'))
if (!listed.some((item) => item.milestoneId === created.milestoneId)) throw new Error('milestone missing from project list')
await json(`milestones/${created.milestoneId}`, as('alice'))

const missingDownloadIdentity = await json(`milestones/${created.milestoneId}/file`, {}, 400)
if (missingDownloadIdentity.error?.code !== 'VALIDATION_ERROR') {
  throw new Error('expected download without X-Member-Id to fail with VALIDATION_ERROR')
}

const deniedDownload = await json(
  `milestones/${created.milestoneId}/file`,
  as('dave'),
  403
)
if (deniedDownload.error?.code !== 'MEMBER_NOT_IN_CLAIM') {
  throw new Error('expected non-member download to fail with MEMBER_NOT_IN_CLAIM')
}

const downloaded = await fetch(new URL(`milestones/${created.milestoneId}/file`, BASE), as('alice'))
if (!downloaded.ok) throw new Error(`download failed: ${downloaded.status}`)
const downloadedHash = createHash('sha256').update(Buffer.from(await downloaded.arrayBuffer())).digest('hex')
if (downloadedHash !== fileHash) throw new Error('downloaded file hash mismatch')

const selfDecision = await json(
  `milestones/${created.milestoneId}/confirmations`,
  decision('alice', 'CONFIRMED'),
  403
)
if (selfDecision.error?.code !== 'SUBMITTER_CANNOT_CONFIRM') {
  throw new Error('expected SUBMITTER_CANNOT_CONFIRM')
}

const outsider = await json(
  `milestones/${created.milestoneId}/confirmations`,
  decision('dave', 'CONFIRMED'),
  403
)
if (outsider.error?.code !== 'MEMBER_NOT_REVIEWER') throw new Error('expected MEMBER_NOT_REVIEWER')

const firstConfirmation = await json(
  `milestones/${created.milestoneId}/confirmations`,
  decision('bob', 'CONFIRMED')
)
if (firstConfirmation.status !== 'PENDING_CONFIRMATION') {
  throw new Error('first independent confirmation must keep milestone pending')
}

const duplicate = await json(
  `milestones/${created.milestoneId}/confirmations`,
  decision('bob', 'CONFIRMED'),
  409
)
if (duplicate.error?.code !== 'ALREADY_DECIDED') throw new Error('expected ALREADY_DECIDED')

const verified = await json(
  `milestones/${created.milestoneId}/confirmations`,
  decision('charlie', 'CONFIRMED')
)
if (verified.status !== 'VERIFIED' || verified.confirmations.length !== 2 || !verified.txId) {
  throw new Error(`milestone did not become VERIFIED: ${JSON.stringify(verified)}`)
}
const closed = await json(`milestones/${created.milestoneId}/confirmations`, decision('bob', 'CONFIRMED'), 409)
if (closed.error?.code !== 'MILESTONE_CLOSED') throw new Error('expected MILESTONE_CLOSED')

const contributions = await json(`projects/${projectId}/contributions`, as('alice'))
if (contributions.basedOnMilestones !== 1) throw new Error('basedOnMilestones should be 1')
const shares = Object.fromEntries(contributions.members.map((item) => [item.memberId, item.percentage]))
if (shares.alice !== 60 || shares.bob !== 40) throw new Error(`unexpected contributions ${JSON.stringify(contributions)}`)

const rejectedSeed = await json(`projects/${projectId}/milestones`, as('alice', {
  method: 'POST',
  body: uploadForm('拒绝闭环')
}), 201)
const rejected = await json(`milestones/${rejectedSeed.milestoneId}/confirmations`, decision('bob', 'REJECTED'))
if (rejected.status !== 'REJECTED') throw new Error('milestone did not become REJECTED')
const rejectedClosed = await json(`milestones/${rejectedSeed.milestoneId}/confirmations`, decision('bob', 'CONFIRMED'), 409)
if (rejectedClosed.error?.code !== 'MILESTONE_CLOSED') throw new Error('rejected milestone should be closed')

console.log(JSON.stringify({ projectId, milestoneId: created.milestoneId, fileHash, txId: verified.txId }, null, 2))
