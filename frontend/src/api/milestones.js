/**
 * 里程碑相关的接口，返回 spec/02 §2.2 的对象。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'

const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

/** 某个项目的里程碑，按时间正序 */
export const listMilestones = (projectId) =>
  useMock ? mock.listMilestones(projectId) : get(`/projects/${projectId}/milestones`)

export const getMilestone = (milestoneId) =>
  useMock ? mock.getMilestone(milestoneId) : get(`/milestones/${milestoneId}`)

/**
 * 提交里程碑。真接口是 multipart/form-data（spec/02 §5.1），
 * 所以这里把对象转成 FormData；假数据直接吃对象。
 */
export const createMilestone = (projectId, payload) => {
  if (useMock) return mock.createMilestone(projectId, payload)
  const form = new FormData()
  form.append('title', payload.title)
  form.append('description', payload.description ?? '')
  form.append('contributors', JSON.stringify(payload.contributors ?? []))
  if (payload.file) form.append('file', payload.file)
  // 浏览器算出来的那份摘要。后端算完自己那份后与它比对，
  // 不一致返回 FILE_HASH_MISMATCH（spec/03 §4.2）。
  // 后端不做比对也没关系——多一个字段，忽略即可。
  if (payload.fileHash) form.append('clientFileHash', payload.fileHash)
  return post(`/projects/${projectId}/milestones`, form)
}

/**
 * 提交一次确认，返回更新后的完整 Milestone。
 * 真接口给不了完整对象时，适配写在这一行，视图不动（spec/02 §5.2 规则 1）。
 */
export const confirmMilestone = (milestoneId, decision) =>
  useMock
    ? mock.confirmMilestone(milestoneId, decision)
    : post(`/milestones/${milestoneId}/confirmations`, decision)
