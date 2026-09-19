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
