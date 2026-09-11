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
import { largestRemainder, sumPercentages, clampPercentage } from '../src/utils/percentage.js'
import { truncateHash, groupHash } from '../src/utils/format-hash.js'
import { confirmGate } from '../src/utils/confirm-gate.js'
import { Sha256, sha256Bytes, hashFile, hasNativeDigest } from '../src/utils/sha256.js'
import { createHash, randomBytes } from 'node:crypto'
import { formatDateTime, formatRelative } from '../src/utils/format-time.js'

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
    'contributors', 'confirmations', 'createdAt', 'status'],
  Certificate: ['certificateId', 'projectId', 'memberId', 'contributionPercentage',
    'milestoneIds', 'issuedAt', 'verificationStatus']
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

await check('累计比例只算已验证的里程碑，且总和恰好 100', async () => {
  const { members, basedOnMilestones } = await api.getContributions('P001')
  const total = members.reduce((a, m) => a + m.percentage, 0)
  assert(total === 100, `总和是 ${total}`)
  assert(basedOnMilestones === 2, `统计了 ${basedOnMilestones} 条已验证里程碑，预期 2`)
  return members.map((m) => `${m.memberId} ${m.percentage}%`).join(' · ')
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

// —— useAsync 的三态 ——
await check('useAsync：成功路径 loading 起落、data 有值、error 为空', async () => {
  const { data, loading, error, run } = useAsync(api.listProjects)
  assert(loading.value === false && data.value === null, '初始状态不对')
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

for (const [tag, label, detail] of results) {
  console.log(`${tag}  ${label}${detail ? `\n        ${detail}` : ''}`)
}
console.log(`\n${results.length} 项检查，${failed} 项不通过。`)
process.exit(failed === 0 ? 0 : 1)
