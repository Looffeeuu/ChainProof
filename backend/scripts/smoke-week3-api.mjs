import { createHash } from 'node:crypto'

const BASE = (process.env.CHAINPROOF_API_URL || 'http://127.0.0.1:3000/api/').replace(/\/?$/, '/')
const nonce = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const projectId = `P-W3-${nonce}`
const emptyProjectId = `P-W3-EMPTY-${nonce}`
const members = ['alice', 'bob', 'charlie']

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

function postJson(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

async function createProject(id, projectMembers) {
  return json('projects', as(projectMembers[0], postJson({
    projectId: id,
    name: `Week 3 ${id}`,
    description: 'Week 3 证书与公开验证真实链路验收',
    members: projectMembers
  })), 201)
}

async function createVerifiedMilestone(title, contributors) {
  const bytes = Buffer.from(`${title} ${nonce}\n`, 'utf8')
  const fileHash = createHash('sha256').update(bytes).digest('hex')
  const form = new FormData()
  form.set('title', title)
  form.set('description', 'Week 3 smoke')
  form.set('contributors', JSON.stringify(contributors))
  form.set('clientFileHash', fileHash)
  form.set('file', new Blob([bytes]), `${title}.txt`)

  const milestone = await json(`projects/${projectId}/milestones`, as('alice', {
    method: 'POST',
    body: form
  }), 201)

  let current = milestone
  for (const contributor of contributors) {
    current = await json(
      `milestones/${milestone.milestoneId}/confirmations`,
      as(contributor.memberId, postJson({ decision: 'CONFIRMED' }))
    )
  }
  if (current.status !== 'VERIFIED') {
    throw new Error(`${title} did not become VERIFIED: ${JSON.stringify(current)}`)
  }
  return current
}

function expectCertificate(value, memberId, percentage) {
  if (
    !value?.certificateId ||
    value.projectId !== projectId ||
    value.memberId !== memberId ||
    value.contributionPercentage !== percentage ||
    value.verificationStatus !== 'VALID' ||
    !value.issuedAt ||
    !value.txId ||
    !Array.isArray(value.milestoneIds) ||
    'docType' in value
  ) {
    throw new Error(`unexpected Certificate: ${JSON.stringify(value)}`)
  }
}

await json('health')
const createdProject = await createProject(projectId, members)
await createProject(emptyProjectId, ['dave'])

const empty = await json(
  `projects/${emptyProjectId}/certificates`,
  postJson({ memberId: 'dave' }),
  409
)
if (
  empty.error?.code !== 'NO_VERIFIED_CONTRIBUTION' ||
  empty.error?.message !== '累计贡献比例为 0%，不能签发证书。'
) {
  throw new Error(`unexpected empty-project error: ${JSON.stringify(empty)}`)
}

const first = await createVerifiedMilestone('alice-work', [
  { memberId: 'alice', percentage: 100 },
  { memberId: 'bob', percentage: 0 },
  { memberId: 'charlie', percentage: 0 }
])
const second = await createVerifiedMilestone('bob-work', [
  { memberId: 'alice', percentage: 0 },
  { memberId: 'bob', percentage: 100 },
  { memberId: 'charlie', percentage: 0 }
])

const contributions = await json(`projects/${projectId}/contributions`)
const shares = Object.fromEntries(contributions.members.map((item) => [item.memberId, item.percentage]))
if (
  contributions.basedOnMilestones !== 2 ||
  shares.alice !== 50 ||
  shares.bob !== 50 ||
  shares.charlie !== 0
) {
  throw new Error(`unexpected contributions: ${JSON.stringify(contributions)}`)
}

const zero = await json(
  `projects/${projectId}/certificates`,
  postJson({ memberId: 'charlie' }),
  409
)
if (
  zero.error?.code !== 'NO_VERIFIED_CONTRIBUTION' ||
  zero.error?.message !== '累计贡献比例为 0%，不能签发证书。'
) {
  throw new Error(`unexpected zero-contribution error: ${JSON.stringify(zero)}`)
}

const alice = await json(`projects/${projectId}/certificates`, postJson({ memberId: 'alice' }))
expectCertificate(alice, 'alice', 50)
if (alice.milestoneIds.length !== 1 || alice.milestoneIds[0] !== first.milestoneId) {
  throw new Error(`alice milestoneIds should only contain her positive milestone: ${JSON.stringify(alice)}`)
}

const duplicate = await json(`projects/${projectId}/certificates`, postJson({ memberId: 'alice' }))
if (duplicate.certificateId !== alice.certificateId || duplicate.txId !== alice.txId) {
  throw new Error('idempotent issuance did not return the original Certificate')
}

const bob = await json(`projects/${projectId}/certificates`, postJson({ memberId: 'bob' }))
expectCertificate(bob, 'bob', 50)
if (bob.milestoneIds.length !== 1 || bob.milestoneIds[0] !== second.milestoneId) {
  throw new Error(`bob milestoneIds should only contain his positive milestone: ${JSON.stringify(bob)}`)
}

const byId = await json(`certificates/${alice.certificateId}`)
if (byId.certificateId !== alice.certificateId) throw new Error('GET Certificate returned the wrong record')

const byProject = await json(`certificates?projectId=${encodeURIComponent(projectId)}`)
if (byProject.length !== 2) throw new Error(`project Certificate filter returned ${byProject.length}, expected 2`)
const byMember = await json('certificates?memberId=alice')
if (!byMember.some((item) => item.certificateId === alice.certificateId)) {
  throw new Error('member Certificate filter did not include alice Certificate')
}
const exact = await json(`certificates?projectId=${encodeURIComponent(projectId)}&memberId=bob`)
if (exact.length !== 1 || exact[0].certificateId !== bob.certificateId) {
  throw new Error(`combined Certificate filter was not exact: ${JSON.stringify(exact)}`)
}

const verified = await json(`verify/${alice.certificateId}`)
if (
  verified.certificateId !== alice.certificateId ||
  verified.verificationStatus !== 'VALID' ||
  verified.certificate?.certificateId !== alice.certificateId
) {
  throw new Error(`unexpected verify response: ${JSON.stringify(verified)}`)
}

const missingId = `CP-MISSING-${nonce}`
const missing = await json(`verify/${missingId}`)
if (missing.certificateId !== missingId || missing.verificationStatus !== 'NOT_FOUND' || missing.certificate) {
  throw new Error(`unexpected NOT_FOUND verify response: ${JSON.stringify(missing)}`)
}

const history = await json(`projects/${projectId}/history`)
if (
  history.length < 1 ||
  !history.some((entry) => entry.txId === createdProject.txId) ||
  history.some((entry) => entry.value && 'docType' in entry.value)
) {
  throw new Error(`unexpected project history: ${JSON.stringify(history)}`)
}

console.log(JSON.stringify({
  projectId,
  basedOnMilestones: contributions.basedOnMilestones,
  certificateIds: [alice.certificateId, bob.certificateId],
  verifiedTxId: alice.txId,
  projectHistoryEntries: history.length
}, null, 2))
