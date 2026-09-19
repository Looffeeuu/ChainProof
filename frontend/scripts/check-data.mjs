/**
 * 取数层自检：假数据是不是真的按 spec/02 §2 的契约在返回。
 *
 *   npm run check:data
 *
 * 这些模块都是纯 JavaScript，Node 可以直接 import，不需要构建。
 * （api/ 下的文件用了 import.meta.env，那是 Vite 才有的东西，
 *  所以这里测的是它背后的 mock/ 与 composables/。）
 */
import { projects, milestones, certificates } from '../src/mock/fixtures.js'
import * as api from '../src/mock/handlers.js'
import { useAsync } from '../src/composables/useAsync.js'
import { largestRemainder, sumPercentages, clampPercentage, contributionShares, compareUtf8 } from '../src/utils/percentage.js'
import { truncateHash, groupHash } from '../src/utils/format-hash.js'
import { confirmGate } from '../src/utils/confirm-gate.js'
import { Sha256, sha256Bytes, hashFile, hasNativeDigest } from '../src/utils/sha256.js'
import { createHash, randomBytes } from 'node:crypto'
import { formatDateTime, formatRelative } from '../src/utils/format-time.js'
import { MAX_FILE_BYTES, MAX_FILE_LABEL, isTooLarge, formatBytes } from '../src/utils/file-limit.js'
import { API_NAMES, useMock } from '../src/api/mode.js'
import { readFileSync } from 'node:fs'

let failed = 0
const results = []

function check(label, fn) {
  return Promise.resolve()
    .then(fn)
    .then((detail) => results.push(['OK  ', label, detail ?? '']))
    .catch((e) => {
      failed++
      results.push(['FAIL', label, e.message])
    })
}

function assert(cond, message) {
  if (!cond) throw new Error(message)
}

// —— 契约：字段与 spec/02 §2 的表逐项对齐，不多不少 ——
const FIELDS = {
  Project: ['projectId', 'name', 'description', 'ownerId', 'members', 'createdAt', 'status'],
  Milestone: ['milestoneId', 'projectId', 'title', 'description', 'fileName', 'fileHash',
    'contributors', 'confirmations', 'createdAt', 'status', 'txId'],
  Certificate: ['certificateId', 'projectId', 'memberId', 'contributionPercentage',
    'milestoneIds', 'issuedAt', 'verificationStatus', 'txId']
}

function sameFields(obj, expected, where) {
  const got = Object.keys(obj).sort()
  const want = [...expected].sort()
  const extra = got.filter((k) => !want.includes(k))
  const missing = want.filter((k) => !got.includes(k))
  assert(extra.length === 0 && missing.length === 0,
    `${where} 字段对不上：多了 [${extra}]，少了 [${missing}]`)
}

await check('Project 字段与 spec/02 §2.1 一致', () => {
  projects.forEach((p) => sameFields(p, FIELDS.Project, `项目 ${p.projectId}`))
  return `${projects.length} 个项目`
})

await check('Milestone 字段与 spec/02 §2.2 一致', () => {
  milestones.forEach((m) => sameFields(m, FIELDS.Milestone, `里程碑 ${m.milestoneId}`))
  return `${milestones.length} 条里程碑`
})

await check('Certificate 字段与 spec/02 §2.4 一致', () => {
  certificates.forEach((c) => sameFields(c, FIELDS.Certificate, `证书 ${c.certificateId}`))
  return `${certificates.length} 张证书`
})

await check('枚举取值都在 spec/02 §2.3 的清单里', () => {
  const S = ['PENDING_CONFIRMATION', 'VERIFIED', 'REJECTED']
  const D = ['CONFIRMED', 'REJECTED']
  milestones.forEach((m) => {
    assert(S.includes(m.status), `${m.milestoneId} 的 status=${m.status} 不在清单里`)
    m.confirmations.forEach((c) =>
      assert(D.includes(c.decision), `${m.milestoneId} 的 decision=${c.decision} 不在清单里`))
  })
  projects.forEach((p) => assert(p.status === 'ACTIVE', `${p.projectId} 的 status 不是 ACTIVE`))
})

// 证书用 VALID，里程碑用 VERIFIED。这两个词同形不同义，是最容易写混的一处：
// 前端一度按 VERIFIED 判断证书是否有效，而 C 线定的是 VALID（spec/03 §9）
await check('证书的 verificationStatus 是 VALID，不是 VERIFIED', () => {
  certificates.forEach((c) =>
    assert(c.verificationStatus === 'VALID',
      `${c.certificateId} 的 verificationStatus=${c.verificationStatus}`))
})

await check('txId 都是 64 位十六进制，且与 fileHash 不是同一个值', () => {
  milestones.forEach((m) => {
    assert(/^[0-9a-f]{64}$/.test(m.txId), `${m.milestoneId} 的 txId 格式不对`)
    assert(m.txId !== m.fileHash, `${m.milestoneId} 的 txId 和 fileHash 一样，多半是复制错了`)
  })
  certificates.forEach((c) =>
    assert(/^[0-9a-f]{64}$/.test(c.txId), `${c.certificateId} 的 txId 格式不对`))
})

await check('每条里程碑的贡献比例都是整数且总和为 100', () => {
  milestones.forEach((m) => {
    m.contributors.forEach((c) =>
      assert(Number.isInteger(c.percentage), `${m.milestoneId} 的 ${c.memberId} 比例不是整数`))
    assert(sumPercentages(m.contributors) === 100, `${m.milestoneId} 比例总和不是 100`)
  })
})

await check('fileHash 都是 64 位十六进制', () => {
  milestones.forEach((m) =>
    assert(/^[0-9a-f]{64}$/.test(m.fileHash), `${m.milestoneId} 的哈希不是 64 位十六进制`))
})

await check('假数据里有一个空 description，兜底分支才跑得到', () => {
  assert(projects.some((p) => p.description === ''), '没有任何项目的 description 是空的')
})

// —— 行为：延迟、深拷贝、错误形状 ——
await check('假接口带 200–600ms 延迟（spec/02 §3.3）', async () => {
  const t = Date.now()
  await api.listProjects()
  const ms = Date.now() - t
  assert(ms >= 200 && ms < 900, `实测 ${ms}ms，不在预期区间`)
  return `实测 ${ms}ms`
})

await check('返回的是深拷贝，页面改不动「服务器上的数据」', async () => {
  const first = await api.listProjects()
  first[0].name = '被页面改坏了'
  const second = await api.listProjects()
  assert(second[0].name !== '被页面改坏了', '两次调用拿到了同一个对象')
})

await check('错误形状与 spec/02 §2.6 一致（code + message）', async () => {
  try {
    await api.getProject('NOT-EXIST')
    throw new Error('本该抛错却成功返回了')
  } catch (e) {
    assert(e.code === 'PROJECT_NOT_FOUND', `code 是 ${e.code}`)
    assert(typeof e.message === 'string' && e.message.length > 0, 'message 为空')
    return `${e.code} / ${e.message}`
  }
})

await check('里程碑按时间正序返回（spec/02 §5.1）', async () => {
  const list = await api.listMilestones('P001')
  const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  assert(JSON.stringify(list) === JSON.stringify(sorted), '顺序不是正序')
  return list.map((m) => m.milestoneId).join(' → ')
})

await check('累计比例只算已验证的里程碑，按契约取整，带 projectId、按 memberId 排', async () => {
  const r = await api.getContributions('P001')
  // M001 48/26/26 + M002 40/35/25，N = 2 → sum 88/61/51 → floor 44/30/25，余 0/1/1
  // 差 1 个百分点，bob 与 charlie 余数平局，按字节序给 bob
  const got = r.members.map((m) => `${m.memberId}=${m.percentage}`).join(' ')
  assert(got === 'alice=44 bob=31 charlie=25', `得到 ${got}`)
  assert(r.projectId === 'P001', `projectId 是 ${r.projectId}`)
  assert(r.basedOnMilestones === 2, `统计了 ${r.basedOnMilestones} 条已验证里程碑，预期 2`)
  return got
})

await check('确认后返回更新过的完整 Milestone，全员确认即转为 VERIFIED', async () => {
  const before = await api.getMilestone('M004')
  assert(before.status === 'PENDING_CONFIRMATION', 'M004 初始状态不对')
  const after = await api.confirmMilestone('M004', { memberId: 'charlie', decision: 'CONFIRMED' })
  sameFields(after, FIELDS.Milestone, '确认后的里程碑')
  assert(after.status === 'VERIFIED', `确认后状态是 ${after.status}`)
  return `${before.status} → ${after.status}`
})

await check('同一个人不能重复表态', async () => {
  try {
    await api.confirmMilestone('M004', { memberId: 'charlie', decision: 'CONFIRMED' })
    throw new Error('本该被拒绝')
  } catch (e) {
    assert(['ALREADY_DECIDED', 'MILESTONE_CLOSED'].includes(e.code), `code 是 ${e.code}`)
    return `${e.code} / ${e.message}`
  }
})

await check('不在声明里的人不能确认', async () => {
  try {
    await api.confirmMilestone('M002', { memberId: 'dave', decision: 'CONFIRMED' })
    throw new Error('本该被拒绝')
  } catch (e) {
    assert(e.code === 'MEMBER_NOT_IN_CLAIM' || e.code === 'MILESTONE_CLOSED', `code 是 ${e.code}`)
    return `${e.code} / ${e.message}`
  }
})

await check('比例总和不是 100 时提交被拒，且错误信息说清当前是多少', async () => {
  try {
    await api.createMilestone('P001', {
      title: 't',
      contributors: [{ memberId: 'alice', percentage: 97 }]
    })
    throw new Error('本该被拒绝')
  } catch (e) {
    assert(e.code === 'CONTRIBUTION_TOTAL_INVALID', `code 是 ${e.code}`)
    assert(e.message.includes('97'), '错误信息里没说当前是多少')
    return e.message
  }
})

await check('验证不存在的证书返回 NOT_FOUND 而不是抛错', async () => {
  const r = await api.verifyCertificate('CERT-NOPE')
  assert(r.verificationStatus === 'NOT_FOUND', `返回了 ${r.verificationStatus}`)
})

// 命中时是个信封，证书本体在 certificate 里（docs/API.md §5）。
// 拆信封的是 api/certificates.js，这里量的是假接口有没有照那个形状回
await check('验证存在的证书回一个信封，本体在 certificate 里', async () => {
  const r = await api.verifyCertificate('CERT-P001-ALICE')
  assert(r.verificationStatus === 'VALID', `外层 verificationStatus 是 ${r.verificationStatus}`)
  assert(r.certificate && typeof r.certificate === 'object', '没有 certificate 这一层')
  assert(/^[0-9a-f]{64}$/.test(r.certificate.txId), '没带 txId，验证页就没有链上依据可显示')
  return `${r.verificationStatus} · ${r.certificate.txId.slice(0, 16)}…`
})

// C 线规则（spec/03 §6）：带了 X-Member-Id 只返回这个人参与的项目，
// 不带返回全部。假接口必须同口径，否则切真接口那天行为会突变
await check('项目列表按成员过滤，不传成员时返回全部', async () => {
  const all = await api.listProjects()
  const bobs = await api.listProjects('bob')
  assert(all.length === projects.length, `不传成员时返回了 ${all.length} 个`)
  assert(bobs.every((p) => p.members.includes('bob')), '返回了 bob 没参与的项目')
  assert(bobs.length < all.length, 'bob 看到的项目数应当少于全部（P003 里没有 bob）')
  return `全部 ${all.length} 个，bob 能看到 ${bobs.length} 个`
})

// —— 证书签发（spec/03 §8）——
await check('签发证书要求成员属于该项目', async () => {
  try {
    await api.createCertificate('P003', { memberId: 'bob' })   // P003 只有 alice 和 charlie
    throw new Error('本该被拒绝')
  } catch (e) {
    assert(e.code === 'MEMBER_NOT_IN_CLAIM', `code 是 ${e.code}`)
    return `${e.code} / ${e.message}`
  }
})

await check('没有已验证里程碑时不能签发证书：409 NO_VERIFIED_CONTRIBUTION', async () => {
  try {
    await api.createCertificate('P003', { memberId: 'charlie' })  // P003 一条里程碑都没有
    throw new Error('本该被拒绝')
  } catch (e) {
    assert(e.code === 'NO_VERIFIED_CONTRIBUTION' && e.status === 409, `得到 ${e.code} / ${e.status}`)
    assert(e.message === '累计贡献比例为 0%，不能签发证书。', `message 是「${e.message}」`)
    return `${e.code} / ${e.message}`
  }
})

await check('没有已验证里程碑时，贡献面板返回全体成员、全员 0', async () => {
  const r = await api.getContributions('P003')
  const got = r.members.map((m) => `${m.memberId}=${m.percentage}`).join(' ')
  assert(got === 'alice=0 charlie=0', `得到 ${got}`)
  assert(r.basedOnMilestones === 0, `basedOnMilestones 是 ${r.basedOnMilestones}`)
  return got
})

await check('签发证书是幂等的：重复请求返回同一张，不新签', async () => {
  const first = await api.createCertificate('P001', { memberId: 'bob' })
  sameFields(first, FIELDS.Certificate, '新签的证书')
  assert(first.verificationStatus === 'VALID', `verificationStatus 是 ${first.verificationStatus}`)

  const again = await api.createCertificate('P001', { memberId: 'bob' })
  assert(again.certificateId === first.certificateId,
    `第二次拿到的是 ${again.certificateId}，与第一次 ${first.certificateId} 不同`)

  const list = await api.listCertificates({ projectId: 'P001', memberId: 'bob' })
  assert(list.length === 1, `P001 里 bob 有 ${list.length} 张证书，应当只有 1 张`)
  return first.certificateId
})

await check('证书列表的两个筛选参数都生效，也都可以不传', async () => {
  const all = await api.listCertificates()
  const byProject = await api.listCertificates({ projectId: 'P001' })
  const byMember = await api.listCertificates({ memberId: 'alice' })
  assert(byProject.every((c) => c.projectId === 'P001'), 'projectId 筛选没生效')
  assert(byMember.every((c) => c.memberId === 'alice'), 'memberId 筛选没生效')
  assert(all.length >= byProject.length && all.length >= byMember.length, '不传参数应当返回最多')
  return `全部 ${all.length} · P001 ${byProject.length} · alice ${byMember.length}`
})

await check('确认导致状态变化后，txId 会换成新的那笔交易', async () => {
  const before = await api.getMilestone('M001')      // 已经是 VERIFIED，拿它的 txId 当基线
  assert(/^[0-9a-f]{64}$/.test(before.txId), 'M001 没有 txId')

  const target = await api.createMilestone('P001', {
    title: '自检用·txId 更新', description: '', fileName: 'x.zip', fileHash: 'a'.repeat(64),
    contributors: [{ memberId: 'alice', percentage: 100 }]
  })
  const created = target.txId
  const after = await api.confirmMilestone(target.milestoneId, {
    memberId: 'alice', decision: 'CONFIRMED'
  })
  assert(after.status === 'VERIFIED', `确认后状态是 ${after.status}`)
  assert(after.txId !== created, 'txId 没变——它应当指向最近一次让状态改变的交易')
  return `${created.slice(0, 12)}… → ${after.txId.slice(0, 12)}…`
})

// —— useAsync 的三态 ——
// loading 默认从 true 开始。这不是随手定的默认值，是白屏事故的修复：
// 首次渲染发生在 onMounted 之前，那时如果 loading 是 false，
// 三个状态会同时为假，AsyncSection 就当数据已经到了，去读 null 的属性然后抛错——
// 浏览器里的表现是整页空白。详见 useAsync.js 里的注释。
await check('useAsync：loading 默认从 true 开始（数据还没到）', () => {
  const { data, loading, error } = useAsync(api.listProjects)
  assert(loading.value === true, '初始 loading 不是 true，白屏会再来一次')
  assert(data.value === null && error.value === null, '初始 data / error 不对')
})

await check('useAsync：lazy 时 loading 从 false 开始（等用户触发）', () => {
  const { loading } = useAsync(api.listProjects, { lazy: true })
  assert(loading.value === false, 'lazy 时初始 loading 应当是 false')
})

await check('useAsync：成功路径 loading 起落、data 有值、error 为空', async () => {
  const { data, loading, error, run } = useAsync(api.listProjects)
  const p = run()
  assert(loading.value === true, '调用后 loading 没有变 true')
  await p
  assert(loading.value === false, '结束后 loading 没有回落')
  assert(Array.isArray(data.value) && data.value.length > 0, 'data 没拿到')
  assert(error.value === null, 'error 不该有值')
})

await check('useAsync：失败路径 error 原样保留 code 与 message', async () => {
  const { data, loading, error, run } = useAsync(() => api.getProject('NOT-EXIST'))
  await run()
  assert(loading.value === false, 'loading 没回落')
  assert(data.value === null, '失败时 data 不该被写入')
  assert(error.value?.code === 'PROJECT_NOT_FOUND', `error.code 是 ${error.value?.code}`)
  return `${error.value.code} / ${error.value.message}`
})

await check('useAsync：连发两次时先发后回的结果被丢弃（竞态）', async () => {
  let calls = 0
  const { data, run } = useAsync(async (value, ms) => {
    calls++
    await new Promise((r) => setTimeout(r, ms))
    return value
  })
  const slow = run('旧的', 120)   // 先发，后回
  const fast = run('新的', 10)    // 后发，先回
  await Promise.all([slow, fast])
  assert(data.value === '新的', `最终 data 是「${data.value}」，先发后回的结果没有被丢掉`)
  return `两次调用都执行了（${calls} 次），但只有最新一次的结果被采用`
})

// —— 纯函数 ——
await check('largestRemainder 无论输入怎么分，和恒等于 100', () => {
  const cases = [[1, 1, 1], [88, 62, 50], [1, 0, 0], [7, 7, 7, 7, 7, 7, 7], [33.3, 33.3, 33.4]]
  cases.forEach((c) => {
    const r = largestRemainder(c)
    assert(r.reduce((a, b) => a + b, 0) === 100, `${JSON.stringify(c)} → ${JSON.stringify(r)}`)
    r.forEach((v) => assert(Number.isInteger(v), '出现了非整数'))
  })
  assert(largestRemainder([0, 0, 0]).join() === '0,0,0', '全 0 时应当全返回 0')
  return `${cases.length} 组输入都合规`
})

await check('confirmGate 四种情况各给一个原因码', () => {
  // 直接用 fixtures 里的原始数据，不经过假接口——
  // 假接口的 db 是可写的，前面的检查已经改过 M004 的状态
  const pending = milestones.find((m) => m.milestoneId === 'M004')  // 待确认，alice/bob 已表态
  const rejected = milestones.find((m) => m.milestoneId === 'M003') // 已拒绝
  const verified = milestones.find((m) => m.milestoneId === 'M002') // 已验证

  const cases = [
    [pending, 'charlie', true, '', '在名单里、还没表态 → 可以表态'],
    [pending, 'alice', false, 'ALREADY_DECIDED', '已经表过态'],
    [pending, 'dave', false, 'NOT_IN_CLAIM', '不在这份声明里'],
    [rejected, 'charlie', false, 'CLOSED', '整条已被拒绝'],
    [verified, 'alice', false, 'CLOSED', '整条已验证'],
    [null, 'alice', false, 'NO_DATA', '还没有数据']
  ]

  cases.forEach(([m, who, can, reason, label]) => {
    const g = confirmGate(m, who)
    assert(g.can === can && g.reason === reason,
      `${label}：得到 can=${g.can} reason=${g.reason}`)
  })

  // 已表态时要能拿到时间，页面才说得出「你已经在 X 表过态了」
  assert(confirmGate(pending, 'alice').decidedAt, 'ALREADY_DECIDED 没有带上表态时间')
  // 优先级：整条已关闭时，即使这个人不在名单里，也先说「已经有结果了」
  assert(confirmGate(rejected, 'dave').reason === 'CLOSED', '原因码的优先级不对')
  return `${cases.length} 种情况都对`
})

await check('clampPercentage 把各种输入都收成 0–100 的整数', () => {
  const cases = [
    ['33.7', 34], ['33.2', 33], [-5, 0], [1e3, 100], ['', 0], ['abc', 0],
    [null, 0], [undefined, 0], [100, 100], ['0', 0], [NaN, 0], [Infinity, 0]   // 非有限值一律当 0，不猜用户想填 100
  ]
  cases.forEach(([input, want]) => {
    const got = clampPercentage(input)
    assert(got === want, `clampPercentage(${String(input)}) = ${got}，预期 ${want}`)
  })
  return `${cases.length} 种输入都被收住`
})

await check('truncateHash 保留首尾各 8 位，短串不截', () => {
  const h = milestones[2].fileHash
  assert(truncateHash(h) === `${h.slice(0, 8)}…${h.slice(-8)}`, '截断结果不对')
  assert(truncateHash('abc') === 'abc', '短串不该被截')
  assert(truncateHash(null) === '', '非字符串该返回空串')
  return truncateHash(h)
})

await check('groupHash 每 8 位断开，共 8 组', () => {
  const parts = groupHash(milestones[2].fileHash).split(' ')
  assert(parts.length === 8, `分成了 ${parts.length} 组`)
  assert(parts.every((p) => p.length === 8), '有的组不是 8 位')
})

await check('时间格式稳定，非法输入返回空串', () => {
  const s = formatDateTime('2026-09-09T06:22:00.000Z')
  assert(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$/.test(s), `格式是 ${s}`)
  assert(formatDateTime('不是时间') === '', '非法输入该返回空串')
  const now = new Date('2026-09-09T08:00:00.000Z')
  assert(formatRelative('2026-09-09T07:30:00.000Z', now) === '30 分钟前', '相对时间不对')
  return `${s} · ${formatRelative('2026-09-09T07:30:00.000Z', now)}`
})

// —— SHA-256（utils/sha256.js）——
//
// 这份实现是为了在 http 下也能算哈希而自己写的（那里没有 crypto.subtle）。
// 密码学代码错一位就全错，而且错得很安静——算出来照样是 64 个十六进制字符，
// 只是和别人算的对不上。所以这里拿两个独立的参照物卡它：
// FIPS 180-4 的标准测试向量，以及 Node 自带的实现。

await check('SHA-256 对上 FIPS 180-4 的标准测试向量', () => {
  const enc = new TextEncoder()
  const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
    ['a'.repeat(1000000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0']
  ]
  for (const [input, want] of vectors) {
    const got = sha256Bytes(enc.encode(input))
    assert(got === want, `长度 ${input.length} 的那条算出 ${got}`)
  }
  return `${vectors.length} 条标准向量`
})

await check('SHA-256 与 Node 内置实现在各种长度上一致', () => {
  // 55/56/63/64/65 这些是填充逻辑的分界点，错误最容易藏在这里
  const lengths = [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 121, 127, 128, 129, 5000]
  for (const n of lengths) {
    const bytes = randomBytes(n)
    const want = createHash('sha256').update(bytes).digest('hex')
    const got = sha256Bytes(new Uint8Array(bytes))
    assert(got === want, `${n} 字节时算出 ${got}，应为 ${want}`)
  }
  return `${lengths.length} 种长度`
})

await check('SHA-256 分块喂入：怎么切都是同一个结果', () => {
  // hashFile 按 1MB 一片读文件，所以「分片不能影响结果」必须成立
  const bytes = randomBytes(300000)
  const want = createHash('sha256').update(bytes).digest('hex')
  for (const size of [1, 7, 64, 1000, 65536]) {
    const h = new Sha256()
    for (let i = 0; i < bytes.length; i += size) {
      h.update(new Uint8Array(bytes.subarray(i, i + size)))
    }
    assert(h.digest() === want, `每次喂 ${size} 字节时结果不一致`)
  }
  return '5 种分片大小'
})

await check('hashFile 在没有 crypto.subtle 时仍然能算（http 场景）', async () => {
  const bytes = randomBytes(200000)
  const want = createHash('sha256').update(bytes).digest('hex')

  // Node 里有 crypto.subtle，先确认原生路径正确
  assert(hasNativeDigest(), '这个 Node 版本没有 crypto.subtle，测不了原生路径')
  assert((await hashFile(new Blob([bytes]))) === want, '原生路径算错了')

  // 再把它藏起来，模拟 http 下的浏览器，验证兜底路径
  const real = globalThis.crypto
  try {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    assert(!hasNativeDigest(), '没能模拟出「没有 crypto.subtle」的环境')
    assert((await hashFile(new Blob([bytes]))) === want, '兜底路径算错了')
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true })
  }
  return '原生路径与兜底路径结果一致'
})

await check('hashFile 收到已取消的 signal 时抛 AbortError，不返回结果', async () => {
  const controller = new AbortController()
  controller.abort()
  let thrown = null
  try {
    await hashFile(new Blob([randomBytes(1000)]), { signal: controller.signal })
  } catch (e) {
    thrown = e
  }
  assert(thrown, '已取消的 signal 应当让它抛错，而不是照常算完')
  assert(thrown.name === 'AbortError', `抛的是 ${thrown.name}，应当是 AbortError`)
  return '开算前就检查一次'
})

await check('hashFile 在计算途中被取消，不会把结果算完返回（兜底路径）', async () => {
  // 兜底路径按 1MB 分片，每片之间检查一次 signal。
  // 造一个 3MB 的输入，第一次进度回调时叫停，它应当在下一片之前退出。
  const bytes = randomBytes(3 * 1024 * 1024)
  const real = globalThis.crypto
  try {
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    assert(!hasNativeDigest(), '没能模拟出「没有 crypto.subtle」的环境')

    const controller = new AbortController()
    let thrown = null
    try {
      await hashFile(new Blob([bytes]), {
        signal: controller.signal,
        onProgress: (r) => { if (r > 0 && r < 1) controller.abort() }
      })
    } catch (e) {
      thrown = e
    }
    assert(thrown?.name === 'AbortError', '中途取消应当抛 AbortError')
  } finally {
    Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true })
  }
  return '每片之间都检查'
})

/**
 * 这条守的是一个**正确性缺陷**，不是体验问题。
 *
 * 提交里程碑那一页原先没有任何竞态保护：先选大文件、没算完又换小文件时，
 * 小文件先算完写进 fileHash，大文件后算完把它覆盖掉——
 * 最终提交的是「文件 B + 文件 A 的哈希」，一条错误的存证记录。
 *
 * 组件里的票据没法在这里直接测（要跑 Vue），所以这里测的是同一套逻辑的骨架：
 * 只有「最后一次发起的」才有权写结果。写法与
 * MilestoneCreateView.pickFile / FileHashCheck.check 里的一致，
 * 那两处改坏了这条不会红，但它至少钉住了这个模式本身是对的。
 */
await check('后发起的哈希计算不会被先发起的覆盖（票据模式）', async () => {
  let seq = 0
  let written = null

  async function pick(bytes, delayMs) {
    const mine = ++seq
    const hash = await new Promise((resolve) =>
      setTimeout(() => resolve(createHash('sha256').update(bytes).digest('hex')), delayMs)
    )
    if (mine !== seq) return          // 已经有更新的一次了，作废
    written = hash
  }

  const big = randomBytes(64)
  const small = randomBytes(64)
  // 先发起「慢的那次」，再发起「快的那次」
  const slow = pick(big, 40)
  const fast = pick(small, 5)
  await Promise.all([slow, fast])

  const wantSmall = createHash('sha256').update(small).digest('hex')
  assert(written === wantSmall, '先发起的那次把后发起的结果覆盖了')
  return '慢的那次回来时已经作废'
})

await check('提交里程碑时，前端算出的哈希会被带进新建的里程碑', async () => {
  const hash = sha256Bytes(new TextEncoder().encode('假装这是一个成果文件'))
  const created = await api.createMilestone('P001', {
    title: '自检用', description: '', fileName: 'demo.zip', fileHash: hash,
    contributors: [{ memberId: 'alice', percentage: 100 }]
  })
  assert(created.fileHash === hash,
    `新建的里程碑 fileHash 是 ${JSON.stringify(created.fileHash)}，应为前端算出的那个`)
  assert(/^[0-9a-f]{64}$/.test(created.fileHash), 'fileHash 不是 64 位小写十六进制')
  return created.fileHash
})

// —— 累计比例与证书，PR #9 定稿（docs/API.md §4、§5）——

const verifiedOf = (...claims) => claims.map((c) => ({
  contributors: Object.entries(c).map(([memberId, percentage]) => ({ memberId, percentage }))
}))
const show = (rows) => rows.map((m) => `${m.memberId}=${m.percentage}`).join(' ')

await check('判定用例：M1 alice 100%、M2 bob 100% → 50% / 50%（组长任务单点名）', () => {
  const got = show(contributionShares(['alice', 'bob'], verifiedOf({ alice: 100 }, { bob: 100 })))
  assert(got === 'alice=50 bob=50', `得到 ${got}`)
  return got
})

await check('余数用整数比：199/3、100/3、1/3 三方平局，按字节序给 alice → 67/33/0', () => {
  // 用浮点余数算，这三个数的小数部分互不相等，会给出 66/34/0——PR #9 评论里的例子
  const got = show(contributionShares(['alice', 'bob', 'charlie'],
    verifiedOf({ alice: 99, charlie: 1 }, { alice: 100 }, { bob: 100 })))
  assert(got === 'alice=67 bob=33 charlie=0', `得到 ${got}`)
  return got
})

await check('参与过但取整后为 0 的人，结果就是 0（资格按取整后判断）', () => {
  const got = show(contributionShares(['alice', 'bob', 'charlie'],
    verifiedOf({ alice: 99, charlie: 1 }, { bob: 100 })))
  assert(got === 'alice=50 bob=50 charlie=0', `得到 ${got}`)
  return got
})

await check('没参与任何一条的成员也在结果里，N = 0 时全员 0', () => {
  const some = show(contributionShares(['dave', 'alice'], verifiedOf({ alice: 100 })))
  assert(some === 'alice=100 dave=0', `得到 ${some}`)
  const none = show(contributionShares(['bob', 'alice'], []))
  assert(none === 'alice=0 bob=0', `N = 0 时得到 ${none}`)
  return `${some}；N=0：${none}`
})

await check('随机 2000 组：总和恒为 100，与「整数 div/mod + 字节序」的独立实现逐一相同', () => {
  // 独立写一遍，不复用被测代码，免得两边错成一样。字节序用 Node 的 Buffer.compare，
  // 也就是 B 线在 PR #9 里建议链码用的那个
  const byBytes = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))
  const reference = (ids, claims) => {
    const n = claims.length
    const rows = [...ids].sort(byBytes).map((id) => {
      const sum = claims.reduce((a, c) => a + (c[id] ?? 0), 0)
      return { id, q: Math.trunc(sum / n), r: sum % n }
    })
    let rest = 100 - rows.reduce((a, x) => a + x.q, 0)
    for (const x of [...rows].sort((a, b) => b.r - a.r || byBytes(a.id, b.id))) {
      if (rest-- > 0) x.q++
    }
    return rows.map((x) => `${x.id}=${x.q}`).join(' ')
  }
  // 后两个名字专门挑来区分字节序与 JS 的 <：一个带重音，一个在 BMP 之外
  const people = ['alice', 'bob', 'charlie', 'dave', 'Émile', '\u{1F600}x']
  for (let t = 0; t < 2000; t++) {
    const ids = people.slice(0, 2 + (t % 5))
    const claims = Array.from({ length: 1 + (t % 7) }, () => {
      // 随机把 100 拆给随机几个人
      const c = {}
      let left = 100
      for (let i = 0; i < ids.length - 1 && left > 0; i++) {
        const v = Math.floor(Math.random() * (left + 1))
        if (v) c[ids[i]] = v
        left -= v
      }
      if (left) c[ids[ids.length - 1]] = left
      return c
    })
    const got = contributionShares(ids, verifiedOf(...claims))
    const total = got.reduce((a, m) => a + m.percentage, 0)
    assert(total === 100, `第 ${t} 组总和是 ${total}`)
    const want = reference(ids, claims)
    assert(show(got) === want, `第 ${t} 组：得到 ${show(got)}，应为 ${want}`)
  }
  return '2000 组全部一致'
})

await check('compareUtf8 按 UTF-8 字节比，和 JS 的 < 在 BMP 外字符上结论相反', () => {
  // U+FF5E 是 3 字节 EF BD 9E；U+1F600 是 4 字节 F0 9F 98 80。按 UTF-8 前者在前；
  // 按 UTF-16 码元，U+1F600 的高位代理 D83D 小于 FF5E，JS 的 < 认为它在前
  const wave = '～'
  const face = '\u{1F600}'
  assert(compareUtf8(wave, face) < 0, '字节序下 U+FF5E 应在 U+1F600 之前')
  assert(face < wave, '（前提）JS 的 < 认为 U+1F600 在前')
  assert(compareUtf8('bob', 'bob') === 0 && compareUtf8('ab', 'abc') < 0, '相等与前缀的情况不对')
  return 'U+FF5E < U+1F600（字节序）'
})

await check('0% 成员：面板里有他，签发被 409 拒绝；参与者的证书只列自己参与的', async () => {
  // P003 成员是 alice 与 charlie。提交一条只有 alice 的里程碑并确认，charlie 就是 0%
  const m = await api.createMilestone('P003', {
    title: '只有 alice 的成果', fileName: 'a.txt', fileHash: '0'.repeat(64),
    contributors: [{ memberId: 'alice', percentage: 100 }]
  })
  const done = await api.confirmMilestone(m.milestoneId, { memberId: 'alice', decision: 'CONFIRMED' })
  assert(done.status === 'VERIFIED', `确认后是 ${done.status}`)

  const r = await api.getContributions('P003')
  assert(show(r.members) === 'alice=100 charlie=0', `面板是 ${show(r.members)}`)

  let err = null
  try { await api.createCertificate('P003', { memberId: 'charlie' }) } catch (e) { err = e }
  assert(err?.code === 'NO_VERIFIED_CONTRIBUTION' && err.status === 409,
    `charlie 签发得到 ${err ? `${err.code} / ${err.status}` : '一张证书'}`)

  const cert = await api.createCertificate('P003', { memberId: 'alice' })
  assert(JSON.stringify(cert.milestoneIds) === JSON.stringify([m.milestoneId]),
    `alice 的 milestoneIds 是 ${JSON.stringify(cert.milestoneIds)}`)
  assert(cert.contributionPercentage === 100, `比例是 ${cert.contributionPercentage}`)
  return `charlie → ${err.code}；alice → ${cert.milestoneIds}`
})

await check('证书只列本人 percentage > 0 的已验证里程碑，按 createdAt 正序', async () => {
  const cert = await api.createCertificate('P001', { memberId: 'charlie' })
  const all = (await api.listMilestones('P001')).filter((x) => x.status === 'VERIFIED')
  const mine = all.filter((x) => x.contributors.some((c) => c.memberId === 'charlie' && c.percentage > 0))
  assert(JSON.stringify(cert.milestoneIds) === JSON.stringify(mine.map((x) => x.milestoneId)),
    `得到 ${cert.milestoneIds}，应为 ${mine.map((x) => x.milestoneId)}`)
  return cert.milestoneIds.join(' → ')
})

await check('先判幂等：已有证书原样返回，比例后来变了也不重算', async () => {
  // CERT-P001-ALICE 签发时是 44%。前面的自检又让 P001 多了两条已验证里程碑
  // （M004，以及 txId 那条只有 alice 的），alice 现在的累计比例已经不是 44
  const now = (await api.getContributions('P001')).members.find((m) => m.memberId === 'alice').percentage
  const cert = await api.createCertificate('P001', { memberId: 'alice' })
  assert(cert.certificateId === 'CERT-P001-ALICE', `拿到的是 ${cert.certificateId}`)
  assert(cert.contributionPercentage === 44, `比例被改成了 ${cert.contributionPercentage}`)
  assert(now !== 44, `（前提）alice 现在的比例应当已经变了，实际是 ${now}`)
  return `证书 44%，现在 ${now}%`
})

// —— 文件大小上限（utils/file-limit.js）——

await check('上限是 50 MiB，边界上的那一个字节判得对', () => {
  assert(MAX_FILE_BYTES === 52428800, `上限是 ${MAX_FILE_BYTES}，应为 52428800`)
  assert(MAX_FILE_LABEL === '50 MB', `显示成 ${MAX_FILE_LABEL}`)
  assert(!isTooLarge({ size: MAX_FILE_BYTES }), '恰好 50 MiB 被判成超限')
  assert(isTooLarge({ size: MAX_FILE_BYTES + 1 }), '多一个字节没判成超限')
  assert(!isTooLarge(null) && !isTooLarge(undefined), '没有文件时被判成超限')
  assert(formatBytes(3 * 1024 ** 3) === '3.0 GB', `3 GiB 显示成 ${formatBytes(3 * 1024 ** 3)}`)
  return `${MAX_FILE_BYTES} 字节`
})

await check('假接口对超限文件回 413 + FILE_TOO_LARGE', async () => {
  let err = null
  try {
    await api.createMilestone('P001', {
      title: '超限', fileName: 'huge.bin', fileHash: '0'.repeat(64),
      file: { size: MAX_FILE_BYTES + 1 },
      contributors: [{ memberId: 'alice', percentage: 100 }]
    })
  } catch (e) {
    err = e
  }
  assert(err, '超限文件被收下了')
  assert(err.code === 'FILE_TOO_LARGE' && err.status === 413, `得到 ${err.code} / ${err.status}`)
  return err.message
})

// —— 逐接口切换（api/mode.js）——

await check('没配环境变量时，每个接口都走假数据', () => {
  const real = API_NAMES.filter((n) => !useMock(n))
  assert(real.length === 0, `这些默认走了真接口：${real}`)
  return `${API_NAMES.length} 个接口`
})

await check('api/ 里每一处 useMock(名字) 都登记在 API_NAMES 里，且一个不多', () => {
  // 名字写错不会报错，只会让那个接口永远走假数据——联调那天以为切过去了
  const used = ['projects', 'milestones', 'certificates'].flatMap((f) =>
    [...readFileSync(new URL(`../src/api/${f}.js`, import.meta.url), 'utf8')
      .matchAll(/useMock\('(\w+)'\)/g)].map((m) => m[1])
  )
  const unknown = used.filter((n) => !API_NAMES.includes(n))
  const unused = API_NAMES.filter((n) => !used.includes(n))
  assert(unknown.length === 0, `没登记的：${unknown}`)
  assert(unused.length === 0, `登记了却没人用的：${unused}`)
  assert(new Set(used).size === used.length, '同一个名字被两个接口用了')
  return used.join(' ')
})

for (const [tag, label, detail] of results) {
  console.log(`${tag}  ${label}${detail ? `\n        ${detail}` : ''}`)
}
console.log(`\n${results.length} 项检查，${failed} 项不通过。`)
process.exit(failed === 0 ? 0 : 1)
