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
