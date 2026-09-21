import { Router } from 'express'
import { evaluateTransaction } from '../services/fabric.service.js'

const router = Router()

router.get('/:certificateId', async (req, res, next) => {
  try {
    const result = await evaluateTransaction('VerifyCertificate', req.params.certificateId)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
