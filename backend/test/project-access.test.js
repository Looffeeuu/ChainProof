import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleProjects } from '../src/utils/project-access.js'

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

