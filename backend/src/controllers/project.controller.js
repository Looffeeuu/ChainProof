import { randomUUID } from 'node:crypto'
import { evaluateTransaction, submitTransaction } from '../services/fabric.service.js'
import { visibleProjects } from '../utils/project-access.js'

function currentMemberId(req) {
  const headerValue = req.get('X-Member-Id')
  return typeof headerValue === 'string' && headerValue.trim() ? headerValue.trim() : null
}

export async function listProjects(req, res, next) {
  try {
    const memberId = currentMemberId(req)
    const projects = await evaluateTransaction('GetAllProjects')
    res.json(visibleProjects(projects, memberId))
  } catch (error) {
    next(error)
  }
}

export async function createProject(req, res, next) {
  try {
    const { name, description = '', members } = req.body
    const ownerId = currentMemberId(req) || req.body.ownerId

    if (!name || !ownerId || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '项目名称、负责人身份和非空成员列表为必填项。'
        }
      })
    }

    const normalizedMembers = [...new Set(members.map(String))]
    if (!normalizedMembers.includes(ownerId)) {
      normalizedMembers.unshift(ownerId)
    }

    const projectId = req.body.projectId || `P-${randomUUID()}`
    const project = await submitTransaction(
      'CreateProject',
      projectId,
      name,
      description,
      ownerId,
      JSON.stringify(normalizedMembers)
    )

    res.status(201).json(project)
  } catch (error) {
    next(error)
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await evaluateTransaction('GetProject', req.params.projectId)
    res.json(project)
  } catch (error) {
    next(error)
  }
}

