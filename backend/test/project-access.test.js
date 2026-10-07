import test from 'node:test'
import assert from 'node:assert/strict'
import { isProjectMember, publicProject, visibleProjects } from '../src/utils/project-access.js'

const projects = [
  { projectId: 'P001', members: ['alice', 'bob'] },
  { projectId: 'P002', members: ['bob', 'charlie'] },
  { projectId: 'P003', members: null }
]

test('returns all projects when the identity header is absent', () => {
  assert.deepEqual(visibleProjects(projects, null), projects)
})

test('filters GetAllProjects results by member identity', () => {
  assert.deepEqual(
    visibleProjects(projects, ' alice '),
    [{ projectId: 'P001', members: ['alice', 'bob'] }]
  )
})

test('returns an empty array for a malformed ledger result', () => {
  assert.deepEqual(visibleProjects(null, 'alice'), [])
})


test('REST Project exposes txId but not ledger-only fields', () => {
  const ledgerProject = {
    docType: 'project',
    projectId: 'P001',
    name: 'Demo',
    description: '',
    ownerId: 'alice',
    members: ['alice'],
    createdAt: '2026-09-22T00:00:00.000Z',
    status: 'ACTIVE',
    txId: 'a'.repeat(64),
    internalNote: 'ledger only'
  }
  assert.deepEqual(publicProject(ledgerProject), {
    projectId: 'P001',
    name: 'Demo',
    description: '',
    ownerId: 'alice',
    members: ['alice'],
    createdAt: '2026-09-22T00:00:00.000Z',
    status: 'ACTIVE',
    txId: 'a'.repeat(64)
  })
})

test('REST Project keeps txId optional for older records', () => {
  const project = {
    projectId: 'P-OLD',
    name: 'Old',
    description: '',
    ownerId: 'alice',
    members: ['alice'],
    createdAt: '2026-09-22T00:00:00.000Z',
    status: 'ACTIVE'
  }
  assert.deepEqual(publicProject({ ...project, docType: 'project' }), project)
})

test('recognizes only an explicitly listed project member', () => {
  const project = { projectId: 'P001', members: ['alice', 'bob'] }
  assert.equal(isProjectMember(project, ' alice '), true)
  assert.equal(isProjectMember(project, 'charlie'), false)
})

test('rejects missing identity and malformed member lists', () => {
  assert.equal(isProjectMember({ members: ['alice'] }, null), false)
  assert.equal(isProjectMember({ members: null }, 'alice'), false)
  assert.equal(isProjectMember(null, 'alice'), false)
})
