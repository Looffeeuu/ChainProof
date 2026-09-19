/**
 * 项目相关的接口。一个接口一个导出函数，返回 spec/02 §2.1 的对象。
 *
 * 每个函数各自判断走真接口还是假数据——spec/02 §5.4 要求联调时
 * 「一个接口一个开关，不要一次全切」，所以开关必须落在函数这一级。
 */
import { get, post } from './client.js'
import * as mock from '../mock/handlers.js'
import { useMock } from './mode.js'
import { session } from '../stores/session.js'

/**
 * 项目列表。
 *
 * 真接口靠请求头 `X-Member-Id` 判断返回谁的项目（client.js 统一加），
 * 带了就只返回这个人参与的，没带就返回全部（docs/API.md §2）。
 * 假数据这边拿不到请求头，所以显式把当前身份传给假接口，
 * **保证两条路径的行为一致**——否则切到真接口那天，
 * 「换个身份看到的项目变少了」这个变化会突然冒出来。
 *
 * @returns {Promise<Array<{projectId:string,name:string,description:string,ownerId:string,members:string[],createdAt:string,status:string}>>}
 */
export const listProjects = () =>
  useMock('listProjects') ? mock.listProjects(session.currentMemberId) : get('/projects')

/** @returns {Promise<object>} 单个 Project */
export const getProject = (projectId) =>
  useMock('getProject') ? mock.getProject(projectId) : get(`/projects/${projectId}`)

/**
 * 创建项目。真接口的 ownerId 优先取请求头里的 `X-Member-Id`，
 * 但仍然在 body 里带一份——C 线说 Header 缺失时会兼容 body.ownerId（docs/API.md §2）。
 *
 * @returns {Promise<object>} 新建的 Project
 */
export const createProject = (payload) =>
  useMock('createProject') ? mock.createProject(payload) : post('/projects', payload)

/** @returns {Promise<{members: Array<{memberId:string, percentage:number}>, basedOnMilestones:number}>} */
export const getContributions = (projectId) =>
  useMock('getContributions') ? mock.getContributions(projectId) : get(`/projects/${projectId}/contributions`)
