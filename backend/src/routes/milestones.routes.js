import { Router } from 'express'
import { submitTransaction, evaluateTransaction, toHttpError } from '../services/fabric.service.js'

const router = Router()

function memberId (req) {
  return req.headers['x-member-id'] || 'alice'
}

router.get('/:milestoneId', async (req, res, next) => {
  try {
    const milestone = await evaluateTransaction('GetMilestone', req.params.milestoneId)
    res.json(milestone)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.post('/:milestoneId/confirmations', async (req, res, next) => {
  try {
    const { decision } = req.body
    if (!decision || !['CONFIRMED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'decision 只能是 CONFIRMED 或 REJECTED' },
      })
    }
    const updated = await submitTransaction(
      'ConfirmContribution',
      req.params.milestoneId,
      memberId(req),
      decision,
    )
    res.json(updated)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

export default router
