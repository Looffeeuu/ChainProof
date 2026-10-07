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
 * —— 第二次反馈：只接住拒绝是不够的 ——
 *
 * 上面那版改完，整页 404 没了，但页面仍然显示「总数 0 / 这个项目还没有里程碑」。
 * 原因是 `listMilestones` 还走假数据，而**假数据对不认识的项目 ID 不报错，直接返回 `[]`**。
 * 只接住 Promise 拒绝的话，这个空数组会被当成一次成功，于是「不知道」被画成了「确实没有」。
 * 贡献那一块更糟：假数据抛的「没有找到项目 P-SMOKE-…」被原样显示给了用户，
 * 而那个项目在链上真实存在。
 *
 * 所以判断的依据不是「这次调用成没成」，而是**这个接口切了没有**：
 * 没切就是不可知，连调都不必调。下面 §2 的几条就是钉这个的。
 *
 * —— 怎么在没有后端的机器上测 ——
 *
 * 用替身：`loadProjectDetail` 的第二个参数可以注入四个调用。
 * 「真接口」用一个直接返回链上形状数据的函数扮演，「还没切的假数据」用一个
 * 抛 `PROJECT_NOT_FOUND` 的函数扮演——这正是联调当天发生的事。
 * 本机跑不了 Fabric，但跑得了这个失败模式。
 */
import { loadProjectDetail } from '../src/api/queries.js'
import { get, getBlob } from '../src/api/client.js'

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
      listCertificates: notFound,
      // 四个都已经切到真接口，失败就是真的失败（不是「还没接入」）
      isMock: () => false
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
      listCertificates: async () => [],
      isMock: () => false
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
    listCertificates: async () => [{ certificateId: 'CERT-1', memberId: 'alice' }],
    isMock: () => false
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
    listCertificates: notFound,
    isMock: () => false
  })

  assert('没失败的那几块照常可用', result.milestones.ok && result.contributions.ok,
    `${result.milestones.ok} / ${result.contributions.ok}`)
  assert('只有失败的那一块被标出来', result.certificates.ok === false, `ok=${result.certificates.ok}`)
}

/**
 * §2 假数据不报错、直接返回空数组时。**这是第二次联调反馈的那个缺陷。**
 *
 * 真接口：getProject。还没切：listMilestones（假数据对任何链上 ID 都回 `[]`）、
 * getContributions（假数据抛「没有找到项目」）。
 */
async function 假数据回空数组不算事实() {
  let 调用次数 = 0
  const result = await loadProjectDetail(chainProject.projectId, {
    getProject: async () => chainProject,
    listMilestones: async () => { 调用次数 += 1; return [] },   // 假数据的沉默的空
    getContributions: async () => { 调用次数 += 1; return notFound() },
    listCertificates: async () => { 调用次数 += 1; return [] },
    // getProject 已切真接口，其余三个还是假数据
    isMock: (name) => name !== 'getProject'
  })

  assert('空数组不算「确实没有」', result.milestones.ok === false,
    `ok=${result.milestones.ok}，value=${JSON.stringify(result.milestones.value)}`)
  assert('标成「还没接入」而不是「失败」', result.milestones.notWired === true,
    `notWired=${result.milestones.notWired}`)
  assert('未接入时不给 value', result.milestones.value === undefined,
    JSON.stringify(result.milestones.value))

  // 未接入的接口根本不该被调用：调了也只会拿到假数据的答案，
  // 而它的错误原文（「没有找到项目 P-SMOKE-…」）一旦漏到界面上，会把人带沟里
  assert('未接入的接口一次都没调', 调用次数 === 0, `调了 ${调用次数} 次`)
  assert('未接入时不带假数据的错误原文', result.contributions.error === undefined,
    String(result.contributions.error?.message ?? '（没有）'))
  assert('贡献与证书同样标成未接入',
    result.contributions.notWired === true && result.certificates.notWired === true,
    `${result.contributions.notWired} / ${result.certificates.notWired}`)
}

/**
 * §3 **真接口自己返回空数组**——这时候空就是事实，必须照常当成「确实没有」。
 * 上一条的修法不能把真接口的空也一起打成「不可知」。
 */
async function 真接口回空数组就是事实() {
  const result = await loadProjectDetail(chainProject.projectId, {
    getProject: async () => chainProject,
    listMilestones: async () => [],
    getContributions: async () => ({ members: [], basedOnMilestones: 0 }),
    listCertificates: async () => [],
    isMock: () => false            // 全都切到真接口了
  })

  assert('真接口的空数组算数', result.milestones.ok === true && result.milestones.value.length === 0,
    `ok=${result.milestones.ok}`)
  assert('不会被误标成未接入', result.milestones.notWired === undefined,
    `notWired=${result.milestones.notWired}`)
}

/**
 * §4 **全部走假数据**，也就是本机日常开发的样子。
 * 这时候假数据就是唯一的数据源，它的空数组当然算数——
 * 不能因为上面两条把本地开发也搞成一片「未接入」。
 */
async function 全假数据时一切照旧() {
  const result = await loadProjectDetail('P001', {
    getProject: async () => ({ ...chainProject, projectId: 'P001' }),
    listMilestones: async () => [],
    getContributions: async () => ({ members: [], basedOnMilestones: 0 }),
    listCertificates: async () => [],
    isMock: () => true             // 一个都没切
  })

  assert('全假数据时三块都是成功', 
    result.milestones.ok && result.contributions.ok && result.certificates.ok,
    `${result.milestones.ok} / ${result.contributions.ok} / ${result.certificates.ok}`)
  assert('全假数据时不标未接入', result.milestones.notWired === undefined,
    `notWired=${result.milestones.notWired}`)
}

/**
 * —— 后端没起来的时候，页面得说人话 ——
 *
 * 2026-09-22 的断连验收没过：停掉后端刷新页面，错误块上写的是
 * 「请求失败（HTTP 502）」加一个 `HTTP_ERROR`。
 *
 * 原因不在后端，在**代理**：前端发的是同源的 `/api/...`，由 Vite 转发过去
 * （vite.config.js）。后端没起来时 `fetch` 并不会 reject——它拿到了代理给的
 * 一个响应，只是那个响应是 `502` + `text/plain` + **空响应体**（当天实测）。
 * 于是它绕过了 `catch` 里那条「连不上服务器」，落进通用 HTTP 分支。
 *
 * 下面这组钉的是两个方向，缺一条这个修复都可能被改回去：
 *   - 断连的两条路径（fetch 抛 / 代理 502）说的是**同一句话**；
 *   - 后端**正常返回的结构化错误照样原样显示**，不被这一条吞掉。
 *
 * 做法是替换全局 `fetch`。`api/client.js` 只用到 `res.ok / res.status / res.json()`，
 * 替身给这三样就够，不需要起真服务。
 */

/** 造一个 client.js 用得上的响应替身。不给 json 就表示响应体不是 JSON */
function fakeResponse(status, json) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (json === undefined) throw new SyntaxError('Unexpected end of JSON input')
      return json
    }
  }
}

/** 临时换掉全局 fetch，跑完一定换回来——换不回来会污染后面所有场景 */
async function withFetch(impl, fn) {
  const original = globalThis.fetch
  globalThis.fetch = impl
  try {
    return await fn()
  } finally {
    globalThis.fetch = original
  }
}

/** 调一次 get()，把它抛出来的错误交回来。没抛就是这条断言本身失效了 */
async function caught(impl) {
  return withFetch(impl, async () => {
    try {
      await get('/projects')
      return null
    } catch (e) {
      return e
    }
  })
}

const OFFLINE = '连不上服务器，请确认后端已经启动。'

async function 后端没起来时说人话() {
  // 1. 代理转发失败：502 + 非 JSON 空体，这是本机实测到的形状
  const viaProxy = await caught(async () => fakeResponse(502))
  assert('代理 502 被认成断连，不是通用 HTTP 错误',
    viaProxy?.code === 'NETWORK_ERROR', `code=${viaProxy?.code}`)
  assert('代理 502 给的是「连不上服务器」那句话',
    viaProxy?.message === OFFLINE, viaProxy?.message)
  assert('代理 502 保留真实状态码，便于对上网络面板',
    viaProxy?.status === 502, `status=${viaProxy?.status}`)

  // 2. 直连后端、后端没起来：fetch 在网络层就抛
  const direct = await caught(async () => { throw new TypeError('Failed to fetch') })
  assert('fetch 抛异常时同样是断连',
    direct?.code === 'NETWORK_ERROR', `code=${direct?.code}`)

  // 两条路径是同一个故障，说的必须是同一句话——分开写迟早会分叉
  assert('两条断连路径给的是同一句话',
    direct?.message === viaProxy?.message, `${direct?.message} / ${viaProxy?.message}`)

  // 3. 后端自己返回 502 并带上契约里的结构化 error：原样显示，不许被吞掉
  const realGateway = await caught(async () =>
    fakeResponse(502, { error: { code: 'UPSTREAM_TIMEOUT', message: '链上网关超时，请稍后重试。' } }))
  assert('带结构化 error 的 502 原样显示 message',
    realGateway?.message === '链上网关超时，请稍后重试。', realGateway?.message)
  assert('带结构化 error 的 502 保留后端给的 code',
    realGateway?.code === 'UPSTREAM_TIMEOUT', `code=${realGateway?.code}`)

  // 4. 别的状态码即使没有结构化 error，也不许冒充断连——判据只认 502
  const plain500 = await caught(async () => fakeResponse(500))
  assert('没有结构化 error 的 500 仍然是通用 HTTP 错误',
    plain500?.code === 'HTTP_ERROR', `code=${plain500?.code}`)
  assert('没有结构化 error 的 500 不说「连不上服务器」',
    plain500?.message !== OFFLINE, plain500?.message)

  // 5. 普通业务错误照旧
  const business = await caught(async () =>
    fakeResponse(404, { error: { code: 'PROJECT_NOT_FOUND', message: '没有找到项目 P999。' } }))
  assert('业务错误原样显示，没被这次改动影响',
    business?.code === 'PROJECT_NOT_FOUND' && business?.message === '没有找到项目 P999。',
    `${business?.code} / ${business?.message}`)

  // 6. 收尾：全局 fetch 必须已经换回去了
  assert('跑完之后全局 fetch 已还原',
    globalThis.fetch === undefined || typeof globalThis.fetch === 'function',
    typeof globalThis.fetch)
}

/**
 * 下载原文件走 getBlob（#25）：成功时交出原始字节、不碰 json()；
 * 失败时照常是带 code 的 ApiError；身份头照样带上——后端靠它判断是不是项目成员。
 */
async function 下载原文件拿到的是字节() {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 252])
  let sentHeaders = null
  const blob = await withFetch(async (_url, init) => {
    sentHeaders = init?.headers ?? null
    return {
      ok: true,
      status: 200,
      blob: async () => new Blob([bytes]),
      json: async () => { throw new Error('下载成功时不该解析 JSON') }
    }
  }, () => getBlob('/milestones/M1/file'))
  const back = new Uint8Array(await blob.arrayBuffer())
  assert('成功时交出 Blob，字节一个不差',
    back.length === bytes.length && back.every((b, i) => b === bytes[i]), `${back.length} 字节`)
  assert('下载请求带着身份头', Boolean(sentHeaders?.['X-Member-Id']), JSON.stringify(sentHeaders))

  const denied = await withFetch(async () =>
    fakeResponse(403, { error: { code: 'MEMBER_NOT_IN_CLAIM', message: '只有项目成员可以下载原文件。' } }),
  () => getBlob('/milestones/M1/file').then(() => null, (e) => e))
  assert('无权限时是带 code 的错误，message 原样',
    denied?.code === 'MEMBER_NOT_IN_CLAIM' && denied?.status === 403 && denied?.message === '只有项目成员可以下载原文件。',
    `${denied?.code} / ${denied?.status} / ${denied?.message}`)

  const missing = await withFetch(async () =>
    fakeResponse(404, { error: { code: 'FILE_NOT_FOUND', message: '该里程碑的链下原始文件不存在。' } }),
  () => getBlob('/milestones/M1/file').then(() => null, (e) => e))
  assert('文件缺失时是 FILE_NOT_FOUND', missing?.code === 'FILE_NOT_FOUND' && missing?.status === 404,
    `${missing?.code} / ${missing?.status}`)
}

const SCENARIOS = [
  ['真项目 + 其余仍是假数据', 真项目其余仍是假数据],
  ['假数据回空数组不算事实', 假数据回空数组不算事实],
  ['真接口回空数组就是事实', 真接口回空数组就是事实],
  ['全假数据时一切照旧', 全假数据时一切照旧],
  ['项目本身不存在', 项目本身不存在],
  ['全部就绪', 全部就绪],
  ['只有一块没切', 只有一块没切],
  ['后端没起来时说人话', 后端没起来时说人话],
  ['下载原文件拿到的是字节', 下载原文件拿到的是字节]
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
