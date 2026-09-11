/**
 * 证书相关的接口，返回 spec/02 §2.4 的对象。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'

const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

/**
 * 证书列表。两个筛选参数都可选（spec/03 §8.1）。
 *
 * @param {{projectId?: string, memberId?: string}} [filter]
 * @returns {Promise<object[]>}
 */
export const listCertificates = (filter = {}) => {
  if (useMock) return mock.listCertificates(filter)
  const query = new URLSearchParams()
  if (filter.projectId) query.set('projectId', filter.projectId)
  if (filter.memberId) query.set('memberId', filter.memberId)
  const suffix = query.toString()
  return get(`/certificates${suffix ? `?${suffix}` : ''}`)
}

export const getCertificate = (certificateId) =>
  useMock ? mock.getCertificate(certificateId) : get(`/certificates/${certificateId}`)

/**
 * 签发贡献证明（spec/03 §8.2）。
 *
 * **幂等**：同一个 projectId + memberId 重复请求返回已有的那张，不新签。
 * 所以调用方不需要先查有没有，直接调即可。
 *
 * @param {string} projectId
 * @param {{memberId: string}} payload
 */
export const createCertificate = (projectId, payload) =>
  useMock
    ? mock.createCertificate(projectId, payload)
    : post(`/projects/${projectId}/certificates`, payload)

/** 公开验证：ID 不存在时返回 verificationStatus: 'NOT_FOUND'，不抛错（spec/03 §9） */
export const verifyCertificate = (certificateId) =>
  useMock ? mock.verifyCertificate(certificateId) : get(`/verify/${certificateId}`)
