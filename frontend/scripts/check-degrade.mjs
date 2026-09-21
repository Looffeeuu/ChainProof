/**
 * 混合模式自检：**一部分接口已经切到真后端、另一部分还走假数据时，页面还能不能用。**
 *
 *   npm run check:degrade
 *
 * —— 为什么要有这一条 ——
 *
 * 2026-09-21 首批联调当天撞了一个本该被自检拦住的缺陷：`listProjects` 与
 * `getProject` 已经切到真后端，链上六个项目在列表里显示正常，但**点开任何一个都是
 * `PROJECT_NOT_FOUND`**。后端没问题——同一个 ID 直接请求返回 200 和完整 Project。
 *
 * 真正的原因在前端：项目详情页把四个调用挂在同一个 `Promise.all` 上，而
 * `getContributions` 还走假数据，假数据只认识内置的三个项目 ID，对链上项目抛
 * `PROJECT_NOT_FOUND`。一块假数据的失败，把一个真实存在的项目判成了打不开。
 *
 * **当时的 14 个脚本一条都没拦住，原因是它们全都跑在单一模式下**：13 个全假数据，
 * `check:contract` 全真接口。而「逐接口切换」的定义本身就是中间那一段混着跑，
 * 那一段一条检查都没有。这个脚本补的就是那一段。
 *
 * —— 怎么在没有后端的机器上测 ——
 *
 * 用替身：`loadProjectDetail` 的第二个参数可以注入四个调用。
 * 「真接口」用一个直接返回链上形状数据的函数扮演，「还没切的假数据」用一个
 * 抛 `PROJECT_NOT_FOUND` 的函数扮演——这正是联调当天发生的事。
 * 本机跑不了 Fabric，但跑得了这个失败模式。
 */
import { loadProjectDetail } from '../src/api/queries.js'

const results = []

function assert(label, ok, detail = '') {
  results.push({ ok: Boolean(ok), label, detail })
}

/** 假数据在遇到它不认识的项目 ID 时抛的就是这个（mock/handlers.js） */
function notFound() {
  const e = new Error('没有这个项目。')
  e.code = 'PROJECT_NOT_FOUND'
  e.status = 404
  return Promise.reject(e)
}

/** 链上真实项目的形状，照 docs/API.md §6。ID 用联调当天那一个 */
const chainProject = {
  projectId: 'P-SMOKE-33b9745e4a',
  name: '冒烟测试项目',
  description: '',
  ownerId: 'alice',
  members: ['alice', 'bob'],
  createdAt: '2026-09-21T02:00:00.000Z',
  status: 'ACTIVE'
}

/**
 * 场景一：**真项目 + 其余三个仍走假数据**。这就是联调当天的状态。
 *
 * 要的结果是「这一页打得开，只是三块数据各自标成读不到」——
 * 而不是整页 404。
 */
async function 真项目其余仍是假数据() {
  let result
  try {
    result = await loadProjectDetail(chainProject.projectId, {
      getProject: async () => chainProject,
      listMilestones: notFound,
      getContributions: notFound,
      listCertificates: notFound
    })
  } catch (e) {
    assert('真项目不该因为别的接口失败而打不开', false, `整个抛了 ${e.code ?? e.message}`)
    return
  }

  assert('页面拿到了真项目本身', result.project?.projectId === chainProject.projectId,
    result.project?.projectId ?? '（没有）')
  assert('里程碑那块标成读不到', result.milestones.ok === false, `ok=${result.milestones.ok}`)
  assert('贡献比例那块标成读不到', result.contributions.ok === false, `ok=${result.contributions.ok}`)
  assert('证书那块标成读不到', result.certificates.ok === false, `ok=${result.certificates.ok}`)

  // 失败的那块必须带着原始错误：页面要显示后端给的 message，
  // 而不是自己编一句「加载失败」
  assert('失败的那块带着原始错误', result.milestones.error?.code === 'PROJECT_NOT_FOUND',
    result.milestones.error?.code ?? '（没有 code）')

  // **这一条是这个脚本的核心。** 读不到时不许给出 value——
  // 一旦给了空数组，页面就会画成「0 条里程碑」「还没有可统计的贡献比例」，
  // 把「不知道」说成「确实没有」
  const 摆出了假的空 = [result.milestones, result.contributions, result.certificates]
    .filter((b) => b.value !== undefined)
  assert('读不到时不给空值冒充「确实没有」', 摆出了假的空.length === 0,
    摆出了假的空.length ? `${摆出了假的空.length} 块给了 value` : '三块都只有 error')
}

/**
 * 场景二：**项目本身 404**。这时候整页就该失败——
 * 上一条的修法不能把真的 404 也一起吞掉。
 */
async function 项目本身不存在() {
  try {
    await loadProjectDetail('P-NOT-EXIST', {
      getProject: notFound,
      listMilestones: async () => [],
      getContributions: async () => ({ members: [], basedOnMilestones: 0 }),
      listCertificates: async () => []
    })
    assert('项目本身 404 时整页要失败', false, '没有抛错，页面会显示一个空壳')
  } catch (e) {
    assert('项目本身 404 时整页要失败', e.code === 'PROJECT_NOT_FOUND', `抛的是 ${e.code ?? e.message}`)
  }
}

/** 场景三：全部就绪时，三块都是 ok，值原样透出 */
async function 全部就绪() {
  const result = await loadProjectDetail(chainProject.projectId, {
    getProject: async () => chainProject,
    listMilestones: async () => [{ milestoneId: 'M-1', status: 'VERIFIED' }],
    getContributions: async () => ({ members: [{ memberId: 'alice', percentage: 100 }], basedOnMilestones: 1 }),
    listCertificates: async () => [{ certificateId: 'CERT-1', memberId: 'alice' }]
  })

  assert('三块都标成拿到了',
    result.milestones.ok && result.contributions.ok && result.certificates.ok,
    `${result.milestones.ok} / ${result.contributions.ok} / ${result.certificates.ok}`)
  assert('里程碑的值原样透出', result.milestones.value?.[0]?.milestoneId === 'M-1',
    JSON.stringify(result.milestones.value))
  assert('贡献比例的值原样透出', result.contributions.value?.basedOnMilestones === 1,
    JSON.stringify(result.contributions.value))
}

/**
 * 场景四：**只有一块失败**。最可能的现实情况——里程碑接口已经切了，证书还没切。
 * 没失败的那几块不受影响。
 */
async function 只有一块没切() {
  const result = await loadProjectDetail(chainProject.projectId, {
    getProject: async () => chainProject,
    listMilestones: async () => [{ milestoneId: 'M-1', status: 'VERIFIED' }],
    getContributions: async () => ({ members: [{ memberId: 'alice', percentage: 100 }], basedOnMilestones: 1 }),
    listCertificates: notFound
  })

  assert('没失败的那几块照常可用', result.milestones.ok && result.contributions.ok,
    `${result.milestones.ok} / ${result.contributions.ok}`)
  assert('只有失败的那一块被标出来', result.certificates.ok === false, `ok=${result.certificates.ok}`)
}

const SCENARIOS = [
  ['真项目 + 其余仍是假数据', 真项目其余仍是假数据],
  ['项目本身不存在', 项目本身不存在],
  ['全部就绪', 全部就绪],
  ['只有一块没切', 只有一块没切]
]

for (const [name, run] of SCENARIOS) {
  console.log(`—— ${name} ——`)
  const from = results.length
  try {
    await run()
  } catch (e) {
    assert(`${name}：场景本身跑挂了`, false, `${e.constructor.name}: ${e.message}`)
  }
  for (const r of results.slice(from)) {
    console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label.padEnd(34)} ${r.detail}`)
  }
  console.log('')
}

const failed = results.filter((r) => !r.ok).length
console.log(
  failed === 0
    ? `${SCENARIOS.length} 个混合模式场景、${results.length} 项断言，全部通过。`
    : `${results.length} 项断言里 ${failed} 项不通过。`
)
process.exit(failed === 0 ? 0 : 1)
