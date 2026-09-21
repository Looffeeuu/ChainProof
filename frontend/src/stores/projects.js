import { listProjects } from '../api/projects.js'
import { createCache } from './create-cache.js'

/**
 * 项目列表的共享缓存。
 *
 * **存在的理由不是省一次请求，是消除不一致。** 侧栏、概览页、项目列表页
 * 各取各的话：同一份数据打两次请求、两次返回时间不同，侧栏计数和正文统计
 * 先后跳出来；其中一次失败时界面会同时显示「侧栏 3 个项目」和「正文读取失败」；
 * 创建完项目之后只有当前页重取，侧栏当这个项目不存在。
 *
 * 合并请求、失效重取、旧请求不许写新缓存，三件事都在 `create-cache.js` 里，
 * 那边有各自的理由。
 *
 * **换身份必须 `invalidateProjects()`**——`listProjects` 是按 `X-Member-Id`
 * 过滤的（`api/projects.js`），换个人看到的本来就是另一份列表。
 * 创建项目之后同理。
 */
const cache = createCache(listProjects)

export const ensureProjects = cache.ensure
export const invalidateProjects = cache.invalidate
export const projects = cache.data
