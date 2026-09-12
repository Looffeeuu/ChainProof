/**
 * 跨资源的组合查询。
 *
 * **为什么要多这一层。** 原先的分层是 `api/{资源}.js`（一个端点一个函数）
 * → `views/`（页面）。中间缺一格：**跨资源的组合查询**。
 * 它既不属于「某一个资源的传输」，也不属于「某一个页面的呈现」，
 * 于是被塞进了 view——结果是概览页和项目列表页里各写了一遍
 * 「先取项目，再按项目取里程碑」。
 *
 * 现在这两页共用同一条取数路径，也就顺带共用了 `stores/projects.js` 的缓存。
 *
 * **还有一个将来的收益。** `spec/04 议题三` 还没定后端要不要给聚合端点
 * （没有「取全部里程碑」的端点，只能按项目逐个取，是 N+1）。
 * 定下来之后只改这个文件，两个页面一行都不用动。
 */
import { ensureProjects } from '../stores/projects.js'
import { session } from '../stores/session.js'
import { listMilestones } from './milestones.js'
import { listCertificates } from './certificates.js'

/**
 * 每个项目连同它自己的里程碑。项目列表页与概览页共用。
 *
 * 这里就是 `spec/04 议题三` 说的那个 N+1：一次取项目，再并发 N 次取里程碑。
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
 * **证书按当前身份过滤。** 项目和里程碑本来就是按 `X-Member-Id` 过滤的，
 * 而证书原先取的是全量——同一屏上半部分是「我的项目」，下半部分是
 * 「所有人的证书」，其中可能包含我根本打不开的项目。接口支持 memberId 筛选
 * （spec/03 §8.1），用上即可。
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
