/**
 * 项目相关的接口。一个接口一个导出函数，返回 spec/02 §2.1 的对象。
 *
 * 每个函数各自判断走真接口还是假数据——spec/02 §5.4 要求联调时
 * 「一个接口一个开关，不要一次全切」，所以开关必须落在函数这一级。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'

// 默认走假数据。要连真接口就在 frontend/.env.local 里写 VITE_USE_MOCK=false
const useMock = import.meta.env.VITE_USE_MOCK !== 'false'

/** @returns {Promise<Array<{projectId:string,name:string,description:string,ownerId:string,members:string[],createdAt:string,status:string}>>} */
export const listProjects = () => (useMock ? mock.listProjects() : get('/projects'))

/** @returns {Promise<object>} 单个 Project */
export const getProject = (projectId) =>
  useMock ? mock.getProject(projectId) : get(`/projects/${projectId}`)

/** @returns {Promise<object>} 新建的 Project */
export const createProject = (payload) =>
  useMock ? mock.createProject(payload) : post('/projects', payload)

/** @returns {Promise<{members: Array<{memberId:string, percentage:number}>, basedOnMilestones:number}>} */
export const getContributions = (projectId) =>
  useMock ? mock.getContributions(projectId) : get(`/projects/${projectId}/contributions`)
