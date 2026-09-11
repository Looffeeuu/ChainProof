/**
 * 证书相关的接口，返回 spec/02 §2.4 的对象。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'

const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

/**
 * 证书列表。spec/02 §5.1 记着这个接口还没有——Dashboard 的「证书数」需要它。
 * 假数据先按前端需要的形状实现，真接口就绪前这一行不会走到分支的另一边。
 */
export const listCertificates = () => (useMock ? mock.listCertificates() : get('/certificates'))

export const getCertificate = (certificateId) =>
  useMock ? mock.getCertificate(certificateId) : get(`/certificates/${certificateId}`)

export const createCertificate = (projectId, payload) =>
  useMock
    ? mock.getCertificate('CERT-P001-ALICE')
    : post(`/projects/${projectId}/certificates`, payload)

/** 公开验证：ID 不存在时返回 verificationStatus: 'NOT_FOUND'，不抛错 */
export const verifyCertificate = (certificateId) =>
  useMock ? mock.verifyCertificate(certificateId) : get(`/verify/${certificateId}`)
