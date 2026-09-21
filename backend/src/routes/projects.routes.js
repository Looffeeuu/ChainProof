import { Router } from 'express'
import { submitTransaction, evaluateTransaction, toHttpError } from '../services/fabric.service.js'
import { sha256Buffer } from '../services/hash.service.js'
import { upload } from '../services/file.service.js'
import { readFileSync } from 'node:fs'

const router = Router()

function memberId (req) {
  return req.headers['x-member-id'] || 'alice'
}

function genProjectId () {
  return `P${Date.now()}`
}

function genMilestoneId () {
  return `M${Date.now()}`
}

router.get('/', async (_req, res, next) => {
  try {
    const projects = await evaluateTransaction('GetAllProjects')
    res.json(projects)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, description, members, ownerId: bodyOwnerId } = req.body
    const owner = memberId(req)
    const projectId = genProjectId()
    const membersArr = members || [owner]
    const project = await submitTransaction(
      'CreateProject',
      projectId,
      name,
      description || '',
      bodyOwnerId || owner,
      JSON.stringify(membersArr),
    )
    res.status(201).json(project)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.get('/:projectId', async (req, res, next) => {
  try {
    const project = await evaluateTransaction('GetProject', req.params.projectId)
    res.json(project)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.get('/:projectId/milestones', async (req, res, next) => {
  try {
    const milestones = await evaluateTransaction('GetProjectMilestones', req.params.projectId)
    res.json(milestones)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.post('/:projectId/milestones', upload.single('file'), async (req, res, next) => {
  try {
    const { projectId } = req.params
    const { title, description, contributors: contributorsStr, clientFileHash } = req.body

    if (!req.file) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '缺少上传文件' } })
    }

    const fileBuffer = readFileSync(req.file.path)
    const serverHash = sha256Buffer(fileBuffer)

    if (clientFileHash && clientFileHash !== serverHash) {
      return res.status(400).json({
        error: { code: 'FILE_HASH_MISMATCH', message: `文件哈希不一致：客户端=${clientFileHash}，服务端=${serverHash}` },
      })
    }

    const milestoneId = genMilestoneId()
    const contributors = JSON.parse(contributorsStr || '[]')

    const milestone = await submitTransaction(
      'CreateMilestone',
      milestoneId,
      projectId,
      title,
      description || '',
      req.file.originalname,
      serverHash,
      JSON.stringify(contributors),
    )
    res.status(201).json(milestone)
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'contributors 不是合法 JSON' } })
    }
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.get('/:projectId/history', async (req, res, next) => {
  try {
    const history = await evaluateTransaction('GetProjectHistory', req.params.projectId)
    res.json(history)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.get('/:projectId/contributions', async (req, res, next) => {
  try {
    const contributions = await evaluateTransaction('GetProjectContributions', req.params.projectId)
    res.json(contributions)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.post('/:projectId/certificates', async (req, res, next) => {
  try {
    const { projectId } = req.params
    const { memberId: targetMember } = req.body
    const certificateId = `CP-${Date.now()}`
    const certificate = await submitTransaction(
      'IssueCertificate',
      certificateId,
      projectId,
      targetMember || memberId(req),
    )
    res.status(201).json(certificate)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

export default router
