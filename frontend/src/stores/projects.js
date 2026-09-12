import { shallowRef } from 'vue'
import { listProjects } from '../api/projects.js'

/**
 * 项目列表的共享缓存。
 *
 * **存在的理由不是省一次请求，是消除不一致。** 原先四个地方各取各的
 * （`AppShell` 的侧栏、概览页、项目列表页、组件预览页），于是：
 *
 * - 打开概览页会打两次 `/api/projects`，两次返回时间不同，
 *   侧栏的计数和正文的统计卡先后跳出来；
 * - 其中一次失败时，界面会同时显示「侧栏 3 个项目」和「正文读取失败」；
 * - 创建完项目之后，只有当前页重取了，侧栏的计数与「最近项目」还是旧的，
 *   要切身份或刷新才会变。
 *
 * 第三条是最实际的：用户刚建完项目，侧栏却当它不存在。
 *
 * 不引 Pinia。`stores/` 现在用的是裸 `reactive` / `shallowRef` + 模块级单例，
 * 这个规模下够用，多一个状态库只是多一层要解释的东西。
 *
 * 用 `shallowRef` 与 `api/` 层保持一致：拿到的是纯数据，页面只读不改。
 */
const data = shallowRef(null)

/**
 * 正在飞的那次请求。
 *
 * 只判断 `data` 为空是不够的：侧栏与页面几乎同时挂载，
 * 第一次的请求还没回来，第二次就已经进来了，照样发两次。
 * 让后来者复用同一个 Promise 才真的合并。
 */
let inflight = null

/**
 * 取项目列表。已经有了就直接给，正在取就等同一个请求。
 *
 * 失败时 `inflight` 会被清空、`data` 保持为空，下次调用重新发起——
 * 这是想要的：一次网络抖动不该让整个会话都拿不到项目。
 * 异常本身照常抛出，交给调用方的 `useAsync` 变成 error 态。
 */
export function ensureProjects() {
  if (data.value) return Promise.resolve(data.value)
  if (!inflight) {
    inflight = listProjects()
      .then((rows) => {
        data.value = rows
        return rows
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * 让缓存失效并**立刻重取**。数据变了就调它：创建项目之后、换身份之后。
 *
 * 换身份必须失效——`listProjects` 是按 `X-Member-Id` 过滤的
 * （`api/projects.js`），换个人看到的本来就是另一份列表。
 *
 * **只置空是不够的。** 侧栏只在挂载和换身份时取数，创建完项目之后置空缓存，
 * 它的项目计数与「最近项目」会整块消失，一直到用户自己走到某个会取数的页面为止——
 * 而这正好发生在用户刚建完项目的那一刻。所以这里失效之后自己接一次重取。
 *
 * 失败时吞掉异常：调用方大多不 await 它，不吞会变成一次未处理的 Promise 拒绝。
 * 真正需要显示错误的地方（侧栏）自己也调了一次 `ensureProjects`，
 * 那一次会共用同一个请求，错误照样能拿到。
 */
export function invalidateProjects() {
  data.value = null
  inflight = null
  return ensureProjects().catch(() => {})
}

export { data as projects }
