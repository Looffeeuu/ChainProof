import { randomUUID } from 'node:crypto'
import { evaluateTransaction, submitTransaction } from '../services/fabric.service.js'
import { ApplicationError } from '../utils/application-error.js'
import { publicCertificate, publicVerification } from '../utils/certificate-shape.js'

function optionalFilter(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function listCertificates(req, res, next) {
  try {
    const certificates = await evaluateTransaction(
      'GetCertificates',
      optionalFilter(req.query.projectId),
      optionalFilter(req.query.memberId)
    )
    res.json(certificates.map(publicCertificate))
  } catch (error) {
    next(error)
  }
}

export async function issueCertificate(req, res, next) {
  try {
    const memberId = typeof req.body?.memberId === 'string' ? req.body.memberId.trim() : ''
    if (!memberId) {
      throw new ApplicationError(400, 'VALIDATION_ERROR', 'memberId 为必填项。')
    }

    const certificate = await submitTransaction(
      'IssueCertificate',
      `CP-${randomUUID()}`,
      req.params.projectId,
      memberId
    )
    res.json(publicCertificate(certificate))
  } catch (error) {
    next(error)
  }
}

export async function getCertificate(req, res, next) {
  try {
    const certificate = await evaluateTransaction('GetCertificate', req.params.certificateId)
    res.json(publicCertificate(certificate))
  } catch (error) {
    next(error)
  }
}

export async function verifyCertificate(req, res, next) {
  try {
    const result = await evaluateTransaction('VerifyCertificate', req.params.certificateId)
    res.json(publicVerification(result))
  } catch (error) {
    next(error)
  }
}
