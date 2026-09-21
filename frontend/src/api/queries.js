/**
 * 跨资源的组合查询。
 *
 * **为什么要有这一层。** `api/{资源}.js` 管「某一个资源的传输」，
 * `views/` 管「某一屏怎么排」，**跨资源的组合查询**两边都不属于。
 * 没有这一层的话它只能塞进 view，于是概览页和项目列表页各写一遍
 * 「先取项目，再按项目取里程碑」，还各自绕过 `stores/projects.js` 的缓存。
 *
 * 另一个收益：接口里没有「取全部里程碑」的端点，只能按项目逐个取，是 N+1。
 * 组长 09-18 定的是 MVP 先不加批量接口，真出现性能问题再由 C 线补；
 * 补上之后只改这个文件，两个页面一行都不用动。
 */
import { ensureProjects } from '../stores/projects.js'
import { session } from '../stores/session.js'
import { listMilestones } from './milestones.js'
import { listCertificates } from './certificates.js'
import { getProject, getContributions } from './projects.js'

/**
 * 每个项目连同它自己的里程碑。项目列表页与概览页共用。
 *
 * 这里就是那个 N+1：一次取项目，再并发 N 次取里程碑。
 * 三个项目发四次请求，这个规模完全可以接受；真接口有了聚合端点再换。
 *
 * @returns {Promise<Array<{ project: object, milestones: object[] }>>}
 */
export async function projectsWithMilestones() {
  const projects = await ensureProjects()
  const lists = await Promise.all(projects.map((p) => listMilestones(p.projectId)))
  return projects.map((project, i) => ({ project, milestones: lists[i] }))
}

/**
 * 概览页要的那一份：项目 + 里程碑 + 证书，外加几个派生统计。
 *
 * 统计放在这里而不是放在页面里：`verifiedCount`、`recent` 这些是
 * 「这份数据说明了什么」，不是「这一屏怎么排」。哪天概览页改版，
 * 换的是排版，不是这几个数怎么算。
 *
 * **证书要按当前身份过滤**（`docs/API.md §5` 支持 memberId）。项目和里程碑本来
 * 就按 `X-Member-Id` 过滤，证书取全量的话，同一屏上半部分是「我的项目」、
 * 下半部分是「所有人的证书」，里面还会有我根本打不开的项目。
 *
 * @returns {Promise<{
 *   projects: object[], certificates: object[], milestones: object[],
 *   verifiedCount: number, recent: object[]
 * }>}
 */
export async function overview() {
  const [rows, certificates] = await Promise.all([
    projectsWithMilestones(),
    listCertificates({ memberId: session.currentMemberId })
  ])

  const projects = rows.map((r) => r.project)
  const milestones = rows.flatMap((r) => r.milestones)
  const nameOf = new Map(projects.map((p) => [p.projectId, p.name]))

  return {
    projects,
    // 带上项目名。概览是跨项目的一屏，只给 projectId 读者认不出是哪个项目——
    // 同一页上面的里程碑列表本来就显示名字，两处口径要一致
    certificates: certificates.map((c) => ({
      ...c,
      projectName: nameOf.get(c.projectId) ?? c.projectId
    })),
    milestones,
    verifiedCount: milestones.filter((m) => m.status === 'VERIFIED').length,
    // 最近五条，按提交时间倒序。带上项目名——概览页跨项目展示，
    // 只给 projectId 读者认不出是哪个项目
    recent: [...milestones]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((m) => ({ ...m, projectName: nameOf.get(m.projectId) ?? m.projectId }))
  }
}

/**
 * 项目详情页要的四块数据。
 *
 * **只有 `getProject` 决定这一页成不成。** 其余三块各自独立：任何一块失败，
 * 都只让它自己那一块降级，不把一个真实存在的项目判成「打不开」。
 *
 * 这不是想象出来的容错。2026-09-21 首批联调当天撞的就是它：`listProjects` 与
 * `getProject` 已经切到真后端，`getContributions` 还走假数据，而假数据只认识
 * 内置的那三个项目 ID，对链上项目抛 `PROJECT_NOT_FOUND`。原来四个调用挂在同一个
 * `Promise.all` 上，于是链上项目全都打不开——后端明明返回 200。
 * 逐接口切换本来就意味着**中间态是混着跑的**，这一层必须扛得住。
 *
 * 失败的那块返回 `{ ok: false, error }` 而不是空数组：**空数组是一句断言**
 * （「这个项目没有里程碑」），而当时的真相是「不知道」。页面据此显示
 * 「暂时读不到」，不是「0 条」。
 *
 * @param {string} projectId
 * @param {object} [deps] 只为自检注入替身用（scripts/check-degrade.mjs）。
 *   生产代码一律走默认值——多一个参数换来的是这条退化路径在没有后端的机器上也能验。
 * @returns {Promise<{
 *   project: object,
 *   milestones: { ok: boolean, value?: object[], error?: Error },
 *   contributions: { ok: boolean, value?: object, error?: Error },
 *   certificates: { ok: boolean, value?: object[], error?: Error }
 * }>}
 */
export async function loadProjectDetail(projectId, deps = {}) {
  const {
    getProject: fetchProject = getProject,
    listMilestones: fetchMilestones = listMilestones,
    getContributions: fetchContributions = getContributions,
    listCertificates: fetchCertificates = listCertificates
  } = deps

  /** 把一次调用变成「成了还是没成」，而不是让它掀桌 */
  const settle = (promise) =>
    promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }))

  // 四个调用仍然并发——串行要多等三个来回。区别只在于谁有权让整页失败：
  // getProject 直接挂在 Promise.all 上（它 404，这一页就该是 404），
  // 其余三个先被 settle 接住，永远不会 reject
  const [project, milestones, contributions, certificates] = await Promise.all([
    fetchProject(projectId),
    settle(fetchMilestones(projectId)),
    settle(fetchContributions(projectId)),
    settle(fetchCertificates({ projectId }))
  ])

  return { project, milestones, contributions, certificates }
}
