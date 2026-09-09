import { randomUUID } from 'node:crypto'
import { evaluateTransaction, submitTransaction } from '../services/fabric.service.js'

export async function createProject(req, res, next) {
  try {
    const { name, description = '', ownerId, members } = req.body

    if (!name || !ownerId || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'name、ownerId 和非空 members 为必填项。'
        }
      })
    }

    const projectId = req.body.projectId || `P-${randomUUID()}`
    const project = await submitTransaction(
      'CreateProject',
      projectId,
      name,
      description,
      ownerId,
      JSON.stringify(members)
    )

    res.status(201).json({ data: project })
  } catch (error) {
    next(error)
  }
}

export async function getProject(req, res, next) {
  try {
    const project = await evaluateTransaction('GetProject', req.params.projectId)
    res.json({ data: project })
  } catch (error) {
    next(error)
  }
}
