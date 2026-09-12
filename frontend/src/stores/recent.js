import { ref } from 'vue'

/**
 * 最近访问过的项目。侧栏的「最近项目」按它排序。
 *
 * **为什么需要它。** 侧栏那个列表原先按 `createdAt` 倒序，
 * 也就是「最新创建的项目」。但「最近项目」在所有产品里的默认含义是
 * **最近访问**——一个天天在改的老项目永远不会出现在列表里，
 * 反而是建完就没再打开过的那个一直挂在最上面。
 * 而这个列表存在的全部理由是「省掉概览 → 项目 → 找一遍这三步」，
 * 按创建时间排达不到这个目的。
 *
 * **只记 ID 和时间，不记别的。** 项目名、成员这些都从接口拿，
 * 这里存的只是「我在这台机器上打开过哪几个」。
 * 换台机器就没有，这是对的——它是本机的使用习惯，不是账号数据。
 *
 * localStorage 的存取全部包 try/catch：隐私窗口里读它本身就会抛错，
 * 服务端渲染时它根本不存在。取不到就退回按创建时间排，不影响任何功能。
 */
const KEY = 'chainproof.recent'

/** 记多少条。侧栏只显示三条，多存几条是为了删掉一个项目后还有后备 */
const CAP = 10

function load() {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]')
    // 存进去的是自己写的格式，但用户可能手改过，也可能是旧版本留下的。
    // 形状不对就当没有，不要让一条脏数据把侧栏搞崩
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.projectId === 'string') : []
  } catch {
    return []
  }
}

/** [{ projectId, at }]，最近的在前 */
export const recentVisits = ref(load())

/** 打开某个项目时调一次。同一个项目只留最新的那条记录 */
export function markVisited(projectId) {
  if (!projectId) return
  const next = [
    { projectId: String(projectId), at: new Date().toISOString() },
    ...recentVisits.value.filter((r) => r.projectId !== String(projectId))
  ].slice(0, CAP)

  recentVisits.value = next
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    // 存不下就算了，这一次会话内的排序仍然是对的
  }
}

/**
 * 按「最近访问」给一批项目排序。
 *
 * 没访问过的排在访问过的后面，它们之间按创建时间倒序——
 * 也就是说，一次都没点过的时候，行为和改造之前完全一样。
 *
 * @param {Array<{projectId: string, createdAt: string}>} projects
 */
export function sortByRecent(projects = []) {
  const rank = new Map(recentVisits.value.map((r, i) => [r.projectId, i]))
  return [...projects].sort((a, b) => {
    const ra = rank.has(a.projectId) ? rank.get(a.projectId) : Infinity
    const rb = rank.has(b.projectId) ? rank.get(b.projectId) : Infinity
    if (ra !== rb) return ra - rb
    return b.createdAt.localeCompare(a.createdAt)
  })
}
