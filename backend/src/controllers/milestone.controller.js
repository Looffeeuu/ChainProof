import { randomUUID } from 'node:crypto'
import { access } from 'node:fs/promises'
import { evaluateTransaction, submitTransaction } from '../services/fabric.service.js'
import { sha256Buffer } from '../services/hash.service.js'
import { removeUpload, storeUpload, uploadPath } from '../services/file-storage.service.js'
import { ApplicationError } from '../utils/application-error.js'
import { assertMatchingFileHash, parseContributors } from '../utils/milestone-input.js'
import { publicMilestone } from '../utils/milestone-shape.js'
import { currentMemberId } from '../utils/request-member.js'

export async function listMilestones(req, res, next) {
  try {
    const milestones = await evaluateTransaction('GetProjectMilestones', req.params.projectId)
    res.json(milestones.map(publicMilestone))
  } catch (error) {
    next(error)
  }
}

export async function createMilestone(req, res, next) {
  const milestoneId = req.body.milestoneId || `M-${randomUUID()}`
  let stored = false
  let committed = false

  try {
    const submitterId = currentMemberId(req)
    if (!submitterId) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', '请求头 X-Member-Id 为必填项。')
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    if (!title) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', '里程碑标题为必填项。')
    }
    if (!req.file?.buffer) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', '必须上传原始成果文件。')
    }

    const contributors = parseContributors(req.body.contributors)
    const serverFileHash = sha256Buffer(req.file.buffer)
    assertMatchingFileHash(req.body.clientFileHash, serverFileHash)

    await storeUpload(milestoneId, req.file.buffer)
    stored = true

    const milestone = await submitTransaction(
      'CreateMilestone',
      milestoneId,
      req.params.projectId,
      title,
      typeof req.body.description === 'string' ? req.body.description : '',
      req.file.originalname || '',
      serverFileHash,
      JSON.stringify(contributors),
      submitterId
    )
    committed = true
    res.status(201).json(publicMilestone(milestone))
  } catch (error) {
    if (stored && !committed) {
      await removeUpload(milestoneId).catch(() => {})
    }
    next(error)
  }
}

export async function getMilestone(req, res, next) {
  try {
    const milestone = await evaluateTransaction('GetMilestone', req.params.milestoneId)
    res.json(publicMilestone(milestone))
  } catch (error) {
    next(error)
  }
}

export async function confirmMilestone(req, res, next) {
  try {
    const memberId = currentMemberId(req)
    if (!memberId) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', '请求头 X-Member-Id 为必填项。')
    }
    const decision = req.body?.decision
    if (decision !== 'CONFIRMED' && decision !== 'REJECTED') {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'decision 只能是 CONFIRMED 或 REJECTED。')
    }
    const milestone = await submitTransaction(
      'ConfirmContribution',
      req.params.milestoneId,
      memberId,
      decision
    )
    res.json(publicMilestone(milestone))
  } catch (error) {
    next(error)
  }
}

export async function getContributions(req, res, next) {
  try {
    const result = await evaluateTransaction('GetProjectContributions', req.params.projectId)
    res.json(result)
  } catch (error) {
    next(error)
  }
}

export async function downloadMilestoneFile(req, res, next) {
  try {
    const milestone = await evaluateTransaction('GetMilestone', req.params.milestoneId)
    const path = uploadPath(req.params.milestoneId)
    await access(path)
    res.download(path, milestone.fileName || `${req.params.milestoneId}.bin`, (error) => {
      if (error && !res.headersSent) next(error)
    })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return next(new ApplicationError(404, 'FILE_NOT_FOUND', '该里程碑的链下原始文件不存在。'))
    }
    next(error)
  }
}
