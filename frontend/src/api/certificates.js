/**
 * 证书相关的接口，返回 spec/02 §2.4 的对象。
 */
import { get, post, ApiError } from './client.js'
import * as mock from '../mock/handlers.js'
import { useMock } from './mode.js'
import { certificateProblems } from '../utils/certificate-shape.js'

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
 * 不拆的话它们全是 undefined。
 *
 * **说「有效」就必须拿得出依据。** 所以 `VALID` 的响应在这里要过一遍体检，
 * 三件事全过才算数：
 *
 * 1. **Certificate 的八个字段齐全且类型、取值都对**——判据在
 *    `utils/certificate-shape.js`，与 `docs/API.md` §6 的字段表同源。
 *    不要在这里另列一份字段名：PR #13 第二轮 review 抓到的就是这个——
 *    这里曾经只校验四项，缺 `issuedAt`、缺 `txId` 的响应照样放行，
 *    公开页于是挂着绿徽章说「一致」，而签发时间是「—」、链上交易那行不显示。
 * 2. **信封内外层的 `certificateId` 与 `verificationStatus` 一致**。
 *    外层说 VALID、内层写着 NOT_FOUND，这种自相矛盾的响应不能当成核验通过。
 * 3. 本体的 `verificationStatus` 必须就是 `VALID`。
 *
 * 任一不满足就按数据异常抛出去，页面走错误态说「没能完成这次核对」——
 * **不能挂着绿徽章说「与存证记录一致」，而下面几项显示「—」**。
 * 对一个给项目外的人看的页面，那比报错更糟：报错只是没答案，
 * 前者是给了一个没有依据的答案。
 *
 * 扁平形状也收（信封缺失但八项齐全时），真接口哪一版直接回扁平的也不会坏。
 */

/** 导出只为让 check:data 能直接喂各种畸形响应，页面不要引用它 */
export function unwrapVerify(res) {
  const outer = res && typeof res === 'object' ? res : {}
  const inner = outer.certificate && typeof outer.certificate === 'object' ? outer.certificate : null
  const status = outer.verificationStatus ?? inner?.verificationStatus

  if (status !== 'VALID') {
    // NOT_FOUND 与其它状态原样交给视图：查无此证也是一次有效的核对结果
    if (!inner) return outer
    return { ...inner, certificateId: outer.certificateId ?? inner.certificateId, verificationStatus: status }
  }

  const body = { ...(inner ?? outer) }
  // 信封的外层字段是权威的那一份，但只有在与内层一致时才允许覆盖（见下面的冲突判断）
  if (outer.certificateId !== undefined) body.certificateId = body.certificateId ?? outer.certificateId
  body.verificationStatus = body.verificationStatus ?? outer.verificationStatus

  const conflict =
    inner !== null &&
    ((outer.certificateId !== undefined &&
      inner.certificateId !== undefined &&
      outer.certificateId !== inner.certificateId) ||
      (outer.verificationStatus !== undefined &&
        inner.verificationStatus !== undefined &&
        outer.verificationStatus !== inner.verificationStatus))

  const problems = certificateProblems(body)
  if (conflict || problems.length > 0 || body.verificationStatus !== 'VALID') {
    // code 供分支判断，message 给用户看：不说「字段」「字段名」这类内部词汇
    throw new ApiError(
      '这次核对没能拿到完整的存证记录，无法给出结论。请稍后重试，或与项目成员核实这个编号。',
      'VERIFY_RESPONSE_INCOMPLETE',
      200
    )
  }

  return body
}

/** 公开验证：ID 不存在时返回 verificationStatus: 'NOT_FOUND'，不抛错（docs/API.md §5） */
export const verifyCertificate = async (certificateId) =>
  unwrapVerify(
    useMock('verifyCertificate') ? await mock.verifyCertificate(certificateId) : await get(`/verify/${certificateId}`)
  )
