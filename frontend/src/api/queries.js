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
import { useMock, isReal } from './mode.js'

/**
 * 主数据走真接口、附属数据还走假数据时，**假数据的回答不算数**。
 *
 * 这是 2026-09-21 第二次联调反馈出的缺陷，比第一次隐蔽：`listMilestones` 还走假数据，
 * 而假数据对任何一个不认识的项目 ID 都**不报错，直接返回 `[]`**。上一版只接住了
 * Promise 拒绝，于是这个空数组被当成「成功」，页面照着它说「这个项目还没有里程碑」——
 * 把一句我们根本不知道的话，说得像一件已经核实过的事。
 *
 * 所以判断不能只看调用成不成，要看**这个接口切了没有**：没切就是不可知，
 * 连调都不必调（调了也只会拿到假数据的答案，还可能把假数据的错误原文摆给用户看）。
 *
 * 三种结果各有各的意思，页面要分别对待：
 *
 *   { ok: true, value }          拿到了，这是事实
 *   { ok: false, notWired: true } 这个接口还没接入真实数据，**不可知**
 *   { ok: false, error }          接口切了但这次失败了，把后端的说法显示给用户
 *
 * @param {string} name 附属接口在 `api/mode.js` API_NAMES 里的名字
 * @param {() => Promise<any>} call 真正发请求的调用
 * @param {{ primary: string, isMock: (name: string) => boolean }} ctx
 */
function attach(name, call, { primary, isMock }) {
  if (!isMock(primary) && isMock(name)) {
    return Promise.resolve({ ok: false, notWired: true })
  }
  return call().then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }))
}

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

  // 项目已经是链上的、里程碑接口还没切时，假数据对每个链上项目都会返回 []。
  // 那不是「这个项目没有里程碑」，是「不知道」——`milestones` 给 null，
  // 让卡片和统计去说「未接入」，而不是画一条 0 的进度条
  if (isReal('listProjects') && !isReal('listMilestones')) {
    return projects.map((project) => ({ project, milestones: null }))
  }

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

  /* 里程碑与证书**未接入时是不可知的，不是 0**。概览页的三块数字照这两个旗标
     决定是报数还是报「未接入」——报一个假的 0，用户会当成已经核实过的事实。 */
  const milestonesKnown = rows.every((r) => r.milestones !== null)
  const certificatesKnown = isReal('listProjects') ? isReal('listCertificates') : true

  const milestones = milestonesKnown ? rows.flatMap((r) => r.milestones) : []
  const nameOf = new Map(projects.map((p) => [p.projectId, p.name]))

  return {
    projects,
    milestonesKnown,
    certificatesKnown,
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
    listCertificates: fetchCertificates = listCertificates,
    isMock = useMock
  } = deps

  const ctx = { primary: 'getProject', isMock }

  // 四个调用仍然并发——串行要多等三个来回。区别只在于谁有权让整页失败：
  // getProject 直接挂在 Promise.all 上（它 404，这一页就该是 404），
  // 其余三个经过 attach，既不会 reject，也不会把假数据的答案当成事实
  const [project, milestones, contributions, certificates] = await Promise.all([
    fetchProject(projectId),
    attach('listMilestones', () => fetchMilestones(projectId), ctx),
    attach('getContributions', () => fetchContributions(projectId), ctx),
    attach('listCertificates', () => fetchCertificates({ projectId }), ctx)
  ])

  return { project, milestones, contributions, certificates }
}
