import { Router } from 'express'
import { evaluateTransaction, toHttpError } from '../services/fabric.service.js'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { projectId, memberId } = req.query
    const certs = await evaluateTransaction('GetCertificates', projectId || '', memberId || '')
    res.json(certs)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

router.get('/:certificateId', async (req, res, next) => {
  try {
    const cert = await evaluateTransaction('GetCertificate', req.params.certificateId)
    res.json(cert)
  } catch (err) {
    const httpErr = toHttpError(err)
    res.status(httpErr.status).json(httpErr.body)
  }
})

export default router
