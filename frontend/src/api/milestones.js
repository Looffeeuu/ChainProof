/**
 * 里程碑相关的接口，返回 spec/02 §2.2 的对象。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'
import { useMock } from './mode.js'

/** 某个项目的里程碑，按时间正序 */
export const listMilestones = (projectId) =>
  useMock('listMilestones') ? mock.listMilestones(projectId) : get(`/projects/${projectId}/milestones`)

export const getMilestone = (milestoneId) =>
  useMock('getMilestone') ? mock.getMilestone(milestoneId) : get(`/milestones/${milestoneId}`)

/**
 * 提交里程碑。真接口是 multipart/form-data（docs/API.md §3），
 * 所以这里把对象转成 FormData；假数据直接吃对象。
 *
 * 提交者（submitterId）真接口取自请求头 `X-Member-Id`，由 client.js 统一带上，
 * **不进表单**——两处都写的话，一旦不一致就说不清以哪个为准。
 * 假接口拿不到请求头，所以 payload 里显式带一个 submitterId 给它。
 */
export const createMilestone = (projectId, payload) => {
  if (useMock('createMilestone')) return mock.createMilestone(projectId, payload)
  const form = new FormData()
  form.append('title', payload.title)
  form.append('description', payload.description ?? '')
  form.append('contributors', JSON.stringify(payload.contributors ?? []))
  if (payload.file) form.append('file', payload.file)
  // 浏览器算出来的那份摘要。后端算完自己那份后与它比对，
  // 不一致返回 FILE_HASH_MISMATCH（docs/API.md §3）。
  // 后端不做比对也没关系——多一个字段，忽略即可。
  if (payload.fileHash) form.append('clientFileHash', payload.fileHash)
  return post(`/projects/${projectId}/milestones`, form)
}

/**
 * 提交一次确认，返回**更新后的完整 Milestone**（C 线已确认按此返回，docs/API.md §3）。
 *
 * 注意真接口的请求体**只有 `decision`**——表态的人是谁由请求头 `X-Member-Id` 决定，
 * 不在 body 里重复一遍。两处都写的话，一旦不一致就说不清以哪个为准。
 * 假接口拿不到请求头，所以显式收一个 memberId。
 *
 * @param {string} milestoneId
 * @param {{memberId: string, decision: 'CONFIRMED'|'REJECTED'}} payload
 */
export const confirmMilestone = (milestoneId, payload) =>
  useMock('confirmMilestone')
    ? mock.confirmMilestone(milestoneId, payload)
    : post(`/milestones/${milestoneId}/confirmations`, { decision: payload.decision })

/**
 * 下载里程碑的链下原始文件（docs/API.md §3）。
 *
 * 后端返回的是二进制流 + Content-Disposition，所以不能走 client.js 的 JSON 解析。
 * 自己发 fetch，拿到 blob 后造一个临时 <a> 触发下载。
 *
 * 文件名取自后端根据链上 fileName 设的 Content-Disposition；
 * 拿不到时后端会用 `${milestoneId}.bin`，浏览器从 Content-Disposition 取。
 */
export async function downloadMilestoneFile(milestoneId) {
  if (useMock('downloadMilestoneFile')) {
    return mock.downloadMilestoneFile(milestoneId)
  }
  const { session } = await import('../stores/session.js')
  const headers = {}
  if (session.currentMemberId) headers['X-Member-Id'] = session.currentMemberId

  let res
  try {
    res = await fetch(`/api/milestones/${milestoneId}/file`, { headers })
  } catch {
    throw new Error('连不上服务器，请确认后端已经启动。')
  }

  if (!res.ok) {
    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
    const err = payload?.error ?? {}
    throw new Error(err.message ?? `下载失败（HTTP ${res.status}）。`)
  }

  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)"?/i)
  const fileName = match ? decodeURIComponent(match[1]) : `${milestoneId}.bin`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
