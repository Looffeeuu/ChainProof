/**
 * 契约形状自检：**每个接口返回的东西，逐字段对照 `spec/03` 的表。**
 *
 *   npm run check:contract                      # 量假接口
 *   CONTRACT_BASE=http://localhost:3000/api npm run check:contract   # 量真接口
 *
 * —— 和 check:data 的分工 ——
 *
 * `check:data` 量的是**行为**（延迟、深拷贝、幂等、竞态、错误分支），
 * 它的字段检查只覆盖 `mock/fixtures.js` 那三个数组，也就是**写死的那份数据**。
 * 这里量的是**每个接口实际返回的对象**——包括 `createMilestone`、
 * `createCertificate`、`confirmMilestone` 这些**现造出来**的返回值，
 * 那几个是最容易少一个字段的：夹具是照着表抄的，新造的是照着记忆写的。
 * 而且这里连**类型**一起查（`members` 是不是数组、`percentage` 是不是整数、
 * `createdAt` 是不是解析得动的 ISO 串），字段名对了类型不对照样会在界面上炸。
 *
 * —— 为什么要能指向真接口 ——
 *
 * FE-12 是「一个接口一个开关地切」。切的那天最先撞上的一定是形状分歧：
 * 少一个字段、`percentage` 回了小数、`status` 多了一个没见过的取值。
 * 与其到时候在界面上一个个撞，不如让同一张表去量真接口——
 * 所以这个脚本的判据与取数完全分开：`CONTRACT_BASE` 一设，
 * 同一套 SCHEMA 打在真响应上，**不用改一行判据**。
 *
 * 假接口模式下 Node 直接 import `mock/handlers.js`（纯 JS，不需要构建）；
 * 真接口模式下走 fetch，身份用 `X-Member-Id`（spec/03 §2.1）。
 */
import * as mock from '../src/mock/handlers.js'

const BASE = process.env.CONTRACT_BASE ?? ''
const AS = process.env.CONTRACT_MEMBER ?? 'alice'

// ——————————————————————————————————————————————————————————
// 判据：spec/03 §5 的四张表
// ——————————————————————————————————————————————————————————

const hex64 = (v) => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)
const iso = (v) => typeof v === 'string' && !Number.isNaN(new Date(v).getTime())
const str = (v) => typeof v === 'string'
const int = (v) => Number.isInteger(v)
const pct = (v) => Number.isInteger(v) && v >= 0 && v <= 100
const arrayOf = (fn) => (v) => Array.isArray(v) && v.every(fn)
const oneOf = (...values) => (v) => values.includes(v)

/** `describe` 只用于失败时说人话，判据本身在 test 里 */
const rule = (describe, test) => ({ describe, test })

/** 可选字段：给了就得对，不给不算问题 */
const opt = (spec) => ({ ...spec, optional: true })

const R = {
  str: rule('字符串', str),
  hex64: rule('64 位小写十六进制', hex64),
  // 空串是允许的：spec/02 §2.2 说 fileName 可能为空；fileHash 在没有文件时也可能空
  hex64OrEmpty: rule('64 位小写十六进制或空串', (v) => v === '' || hex64(v)),
  iso: rule('ISO 8601 时间串', iso),
  pct: rule('0–100 的整数', pct),
  int: rule('整数', int),
  strArray: rule('字符串数组', arrayOf(str)),
  milestoneStatus: rule(
    'PENDING_CONFIRMATION / VERIFIED / REJECTED',
    oneOf('PENDING_CONFIRMATION', 'VERIFIED', 'REJECTED')
  ),
  projectStatus: rule('ACTIVE', oneOf('ACTIVE')),
  decision: rule('CONFIRMED / REJECTED', oneOf('CONFIRMED', 'REJECTED')),
  // 证书用 VALID，不是 VERIFIED——两个词同形不同义，这是最容易写混的一处
  certStatus: rule('VALID / NOT_FOUND', oneOf('VALID', 'NOT_FOUND'))
}

const SCHEMA = {
  Contributor: {
    memberId: R.str,
    percentage: R.pct
  },
  Confirmation: {
    memberId: R.str,
    decision: R.decision,
    timestamp: R.iso
  },
  Project: {
    projectId: R.str,
    name: R.str,
    description: R.str,
    ownerId: R.str,
    members: R.strArray,
    createdAt: R.iso,
    status: R.projectStatus
  },
  Milestone: {
    milestoneId: R.str,
    projectId: R.str,
    title: R.str,
    description: R.str,
    fileName: R.str,
    fileHash: R.hex64OrEmpty,
    contributors: { each: 'Contributor' },
    confirmations: { each: 'Confirmation' },
    createdAt: R.iso,
    status: R.milestoneStatus,
    txId: R.hex64
  },
  Certificate: {
    certificateId: R.str,
    projectId: R.str,
    memberId: R.str,
    contributionPercentage: R.pct,
    milestoneIds: R.strArray,
    issuedAt: R.iso,
    verificationStatus: R.certStatus,
    txId: R.hex64
  },
  Contributions: {
    // PR #9 定稿后是必有字段（组长任务单：Mock 返回 projectId）。前端不读它
    projectId: R.str,
    members: { each: 'Share' },
    basedOnMilestones: R.int
  },
  Share: {
    memberId: R.str,
    percentage: R.pct
  },
  /** 查无此证：只有这两个字段，多一个都不该有（spec/03 §9） */
  NotFound: {
    certificateId: R.str,
    verificationStatus: R.certStatus
  },
  /**
   * 公开验证命中时的信封（docs/API.md §5）：证书本体在 `certificate` 里。
   * 拆信封在 `api/certificates.js`，视图看到的是扁平的 Certificate。
   */
  VerifyEnvelope: {
    certificateId: R.str,
    verificationStatus: R.certStatus,
    certificate: { one: 'Certificate' }
  }
}

/**
 * 逐字段校验一个对象。返回问题清单，空数组表示通过。
 *
 * **多出来的字段也算问题。** 前端只渲染契约里写过的字段，
 * 多一个说明两边对这个资源的理解已经分叉了——那正是联调时最难查的一类。
 */
function validate(value, typeName, where, problems = []) {
  const shape = SCHEMA[typeName]
  if (!value || typeof value !== 'object') {
    problems.push(`${where} 不是对象（拿到 ${JSON.stringify(value)}）`)
    return problems
  }

  for (const [key, spec] of Object.entries(shape)) {
    const got = value[key]
    if (got === undefined) {
      if (!spec.optional) problems.push(`${where} 少字段 ${key}`)
      continue
    }
    if (spec.one) {
      validate(got, spec.one, `${where}.${key}`, problems)
      continue
    }
    if (spec.each) {
      if (!Array.isArray(got)) {
        problems.push(`${where}.${key} 应该是数组`)
        continue
      }
      got.forEach((item, i) => validate(item, spec.each, `${where}.${key}[${i}]`, problems))
      continue
    }
    if (!spec.test(got)) {
      problems.push(`${where}.${key} 应该是${spec.describe}，拿到 ${JSON.stringify(got)}`)
    }
  }

  for (const key of Object.keys(value)) {
    if (!(key in shape)) problems.push(`${where} 多了字段 ${key}`)
  }
  return problems
}

// ——————————————————————————————————————————————————————————
// 取数：假接口直接调，真接口走 fetch
// ——————————————————————————————————————————————————————————

async function http(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Member-Id': AS, ...(options.headers ?? {}) }
  })
  if (res.status === 204) return null
  return res.json()
}

/**
 * 每个端点一个取数函数。两种模式必须**返回同样形状的东西**，
 * 否则这张表就只在其中一边有意义。
 */
const CALLS = BASE
  ? {
      listProjects: () => http('/projects'),
      getProject: (id) => http(`/projects/${id}`),
      listMilestones: (id) => http(`/projects/${id}/milestones`),
      getMilestone: (id) => http(`/milestones/${id}`),
      getContributions: (id) => http(`/projects/${id}/contributions`),
      listCertificates: () => http('/certificates'),
      getCertificate: (id) => http(`/certificates/${id}`),
      verifyCertificate: (id) => http(`/verify/${id}`)
    }
  : {
      listProjects: () => mock.listProjects(AS),
      getProject: (id) => mock.getProject(id),
      listMilestones: (id) => mock.listMilestones(id),
      getMilestone: (id) => mock.getMilestone(id),
      getContributions: (id) => mock.getContributions(id),
      listCertificates: () => mock.listCertificates(),
      getCertificate: (id) => mock.getCertificate(id),
      verifyCertificate: (id) => mock.verifyCertificate(id)
    }

// ——————————————————————————————————————————————————————————

const results = []
let failed = 0

function report(label, problems, detail = '') {
  const ok = problems.length === 0
  if (!ok) failed++
  results.push({ ok, label, detail: ok ? detail : problems.join('；') })
}

async function main() {
  console.log(BASE ? `量的是真接口 ${BASE}（身份 ${AS}）\n` : `量的是假接口（身份 ${AS}）\n`)

  const projects = await CALLS.listProjects()
  if (!Array.isArray(projects) || projects.length === 0) {
    console.log('FAIL  项目列表为空或不是数组，后面的检查都没法做')
    process.exit(1)
  }
  report(
    'GET /projects 的每一项都是 Project',
    projects.flatMap((p, i) => validate(p, 'Project', `projects[${i}]`)),
    `${projects.length} 个项目`
  )

  const first = projects[0]

  report(
    'GET /projects/:id 是 Project',
    validate(await CALLS.getProject(first.projectId), 'Project', first.projectId)
  )

  const milestones = await CALLS.listMilestones(first.projectId)
  report(
    'GET /projects/:id/milestones 的每一项都是 Milestone',
    milestones.flatMap((m, i) => validate(m, 'Milestone', `milestones[${i}]`)),
    `${milestones.length} 条`
  )

  if (milestones.length) {
    report(
      'GET /milestones/:id 是 Milestone',
      validate(await CALLS.getMilestone(milestones[0].milestoneId), 'Milestone', milestones[0].milestoneId)
    )
  }

  report(
    'GET /projects/:id/contributions 形状正确',
    validate(await CALLS.getContributions(first.projectId), 'Contributions', 'contributions')
  )

  const certificates = await CALLS.listCertificates()
  report(
    'GET /certificates 的每一项都是 Certificate',
    certificates.flatMap((c, i) => validate(c, 'Certificate', `certificates[${i}]`)),
    `${certificates.length} 张`
  )

  if (certificates.length) {
    const id = certificates[0].certificateId
    report('GET /certificates/:id 是 Certificate', validate(await CALLS.getCertificate(id), 'Certificate', id))
    // 命中时是信封，不是裸的 Certificate——这一处两边曾经各填各的，
    // 前端按扁平实现、docs/API.md 写的是嵌套。判据以 docs/API.md 为准
    report(
      'GET /verify/:id 命中时返回信封，本体在 certificate 里',
      validate(await CALLS.verifyCertificate(id), 'VerifyEnvelope', id)
    )
  }

  // 查不到是 200 + NOT_FOUND，不是 404、不是抛错（spec/03 §9）。
  // 这条前端依赖得很硬：公开验证页把「查无此证」当成一个正常结果渲染
  const missing = await CALLS.verifyCertificate('CERT-NO-SUCH-THING')
  report(
    'GET /verify/:id 查不到时返回 200 + NOT_FOUND',
    validate(missing, 'NotFound', 'verify(不存在)'),
    `verificationStatus=${missing?.verificationStatus}`
  )

  // —— 写操作的返回值。这三个是现造出来的，最容易少字段 ——
  if (!BASE) {
    const created = await mock.createProject({
      name: '契约自检项目', description: '', ownerId: AS, members: [AS, 'bob', 'charlie']
    })
    report('POST /projects 回的是 Project', validate(created, 'Project', '新建项目'))

    const m = await mock.createMilestone(created.projectId, {
      title: '契约自检里程碑',
      description: '',
      fileName: 'x.bin',
      fileHash: 'a'.repeat(64),
      contributors: [
        { memberId: AS, percentage: 50 },
        { memberId: 'bob', percentage: 50 }
      ]
    })
    report('POST /projects/:id/milestones 回的是 Milestone', validate(m, 'Milestone', '新建里程碑'))

    const confirmed = await mock.confirmMilestone(m.milestoneId, { memberId: AS, decision: 'CONFIRMED' })
    report(
      'POST /milestones/:id/confirmations 回的是完整 Milestone',
      validate(confirmed, 'Milestone', '表态后的里程碑')
    )

    await mock.confirmMilestone(m.milestoneId, { memberId: 'bob', decision: 'CONFIRMED' })
    const cert = await mock.createCertificate(created.projectId, { memberId: AS })
    report('POST /projects/:id/certificates 回的是 Certificate', validate(cert, 'Certificate', '新签发的证书'))
  } else {
    results.push({
      ok: true,
      label: '写操作的返回值',
      detail: 'SKIP —— 真接口模式下不造数据，避免往联调环境里写垃圾'
    })
  }

  for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label.padEnd(42)} ${r.detail}`)
  console.log(
    failed === 0
      ? `\n${results.length} 个返回值，字段与类型都对得上 spec/03 §5。`
      : `\n${failed} 处形状对不上。`
  )
  process.exit(failed === 0 ? 0 : 1)
}

await main()
