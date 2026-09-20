import { randomBytes } from 'node:crypto'

const configuredBase = process.env.CHAINPROOF_API_URL || 'http://127.0.0.1:3000/api/'
const baseUrl = new URL(configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`)
const projectId = `P-SMOKE-${randomBytes(5).toString('hex')}`

function requireResult(condition, description, actual) {
  if (!condition) {
    throw new Error(`${description}: ${JSON.stringify(actual)}`)
  }
  console.log(`OK  ${description}`)
}

async function request(path, { method = 'GET', memberId, body } = {}) {
  const headers = {}
  if (memberId) headers['X-Member-Id'] = memberId
  if (body) headers['Content-Type'] = 'application/json'

  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const raw = await response.text()
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    value = raw
  }
  return { status: response.status, value }
}

async function main() {
  console.log(`Project API smoke: ${baseUrl}`)
  console.log('This check creates one uniquely named demo project on the local Fabric ledger.')

  const health = await request('health')
  requireResult(health.status === 200 && health.value?.status === 'ok',
    'backend health is OK', health)

  const created = await request('projects', {
    method: 'POST',
    memberId: 'alice',
    body: {
      projectId,
      name: 'ChainProof Project API smoke',
      description: 'Local Fabric integration check',
      ownerId: 'wrong-body-owner',
      members: ['alice', 'bob']
    }
  })
  requireResult(created.status === 201 && created.value?.projectId === projectId,
    'POST /projects writes and returns a Project', created)
  requireResult(created.value.ownerId === 'alice',
    'X-Member-Id takes precedence over body.ownerId', created.value)
  requireResult(/^[0-9a-f]{64}$/i.test(created.value.txId ?? ''),
    'created Project includes a Fabric transaction ID', created.value)

  const fetched = await request(`projects/${projectId}`, { memberId: 'alice' })
  requireResult(fetched.status === 200 &&
    fetched.value?.projectId === projectId &&
    fetched.value?.txId === created.value.txId,
  'GET /projects/:id reads the same Project from Fabric', fetched)

  const aliceList = await request('projects', { memberId: 'alice' })
  requireResult(aliceList.status === 200 &&
    Array.isArray(aliceList.value) &&
    aliceList.value.some((project) => project.projectId === projectId),
  'alice can list her Project', aliceList)

  const outsiderList = await request('projects', { memberId: 'outsider' })
  requireResult(outsiderList.status === 200 &&
    Array.isArray(outsiderList.value) &&
    !outsiderList.value.some((project) => project.projectId === projectId),
  'non-member does not see the Project in the list', outsiderList)

  const unfilteredList = await request('projects')
  requireResult(unfilteredList.status === 200 &&
    Array.isArray(unfilteredList.value) &&
    unfilteredList.value.some((project) => project.projectId === projectId),
  'header-free demo list includes the Project', unfilteredList)

  const missing = await request(`projects/${projectId}-missing`, { memberId: 'alice' })
  requireResult(missing.status === 404 &&
    missing.value?.error?.code === 'PROJECT_NOT_FOUND',
  'missing Project maps to HTTP 404 + PROJECT_NOT_FOUND', missing)

  const duplicate = await request('projects', {
    method: 'POST',
    memberId: 'alice',
    body: { projectId, name: 'duplicate', members: ['alice'] }
  })
  requireResult(duplicate.status === 400 &&
    duplicate.value?.error?.code === 'VALIDATION_ERROR',
  'duplicate Project maps the Chaincode business error to HTTP 400', duplicate)

  console.log(`PASS Project API smoke: projectId=${projectId}, txId=${created.value.txId}`)
}

main().catch((error) => {
  console.error(`FAIL Project API smoke: ${error.message}`)
  if (error.cause) console.error(`Cause: ${error.cause.message}`)
  process.exitCode = 1
})

