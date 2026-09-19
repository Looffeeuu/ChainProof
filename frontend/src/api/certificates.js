/**
 * 证书相关的接口，返回 spec/02 §2.4 的对象。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'
import { useMock } from './mode.js'

/**
 * 证书列表。两个筛选参数都可选（docs/API.md §5）。
 *
 * @param {{projectId?: string, memberId?: string}} [filter]
 * @returns {Promise<object[]>}
 */
export const listCertificates = (filter = {}) => {
  if (useMock('listCertificates')) return mock.listCertificates(filter)
  const query = new URLSearchParams()
  if (filter.projectId) query.set('projectId', filter.projectId)
  if (filter.memberId) query.set('memberId', filter.memberId)
  const suffix = query.toString()
  return get(`/certificates${suffix ? `?${suffix}` : ''}`)
}

export const getCertificate = (certificateId) =>
  useMock('getCertificate') ? mock.getCertificate(certificateId) : get(`/certificates/${certificateId}`)

/**
 * 签发贡献证明（docs/API.md §5）。
 *
 * **幂等**：同一个 projectId + memberId 重复请求返回已有的那张，不新签。
 * 所以调用方不需要先查有没有，直接调即可。
 *
 * @param {string} projectId
 * @param {{memberId: string}} payload
 */
export const createCertificate = (projectId, payload) =>
  useMock('createCertificate')
    ? mock.createCertificate(projectId, payload)
    : post(`/projects/${projectId}/certificates`, payload)

/**
 * 拆掉公开验证响应的信封，让视图只看到一个扁平的 Certificate。
 *
 * `docs/API.md §5` 规定命中时返回
 * `{ certificateId, verificationStatus, certificate: {…} }`，查不到时只有前两项。
 * 视图要读的是 `memberId`、`contributionPercentage`、`milestoneIds` 这些，
 * 不拆的话它们全是 undefined——页面不会报错，只会挂着「证书有效」的绿徽章
 * 说「与存证记录一致」，而下面六项事实里五项显示「—」。
 * **对一个给项目外的人看的页面，这比白屏更糟。**
 *
 * 两种形状都收：万一哪一版真接口直接回扁平的，这里也不会坏。
 * 外层的 `verificationStatus` 优先——查不到时只有外层有。
 */
function unwrapVerify(res) {
  const inner = res?.certificate
  if (!inner || typeof inner !== 'object') return res
  return {
    ...inner,
    certificateId: res.certificateId ?? inner.certificateId,
    verificationStatus: res.verificationStatus ?? inner.verificationStatus
  }
}

/** 公开验证：ID 不存在时返回 verificationStatus: 'NOT_FOUND'，不抛错（docs/API.md §5） */
export const verifyCertificate = async (certificateId) =>
  unwrapVerify(
    useMock('verifyCertificate') ? await mock.verifyCertificate(certificateId) : await get(`/verify/${certificateId}`)
  )
