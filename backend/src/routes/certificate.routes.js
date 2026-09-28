import { Router } from 'express'
import {
  getCertificate,
  listCertificates,
  verifyCertificate
} from '../controllers/certificate.controller.js'

export const certificateRouter = Router()
export const verificationRouter = Router()

certificateRouter.get('/', listCertificates)
certificateRouter.get('/:certificateId', getCertificate)
verificationRouter.get('/:certificateId', verifyCertificate)
