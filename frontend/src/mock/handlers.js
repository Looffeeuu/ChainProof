/**
 * 假接口。只被 api/ 引用（spec/02 §1.2 规则 2），页面永远看不到这个文件。
 *
 * 三条自我约束，都是为了让「接真接口」那天不出意外：
 * 1. **一律返回 Promise 并带 200–600ms 延迟**（spec/02 §3.3）。
 *    同步返回的话，加载态在开发时永远看不见，等上线才发现它是坏的。
 * 2. **返回深拷贝**。直接返回 fixtures 里的对象，页面改一下就把「服务器上的数据」改了，
 *    真接口不会有这种行为，本地就不该有。
 * 3. **错误照 spec/02 §2.6 的形状抛**，让页面的错误分支跑在和真接口一样的数据上。
 */
import { projects, milestones, certificates } from './fixtures.js'
import { largestRemainder } from '../utils/percentage.js'

const clone = (v) => JSON.parse(JSON.stringify(v))

const delay = () => new Promise((r) => setTimeout(r, 200 + Math.random() * 400))

/** 造一个和 api/client.js 抛出的形状一致的错误 */
function fail(code, message, status = 400) {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

/** 演示用的可写副本：创建项目、提交确认都写在这里，刷新页面即还原 */
const db = {
  projects: clone(projects),
  milestones: clone(milestones),
  certificates: clone(certificates)
}

/** 造一个 64 位十六进制的假交易 ID。真接口给的是 Fabric 的 transaction ID */
function fakeTxId() {
  let hex = ''
  while (hex.length < 64) hex += Math.floor(Math.random() * 16).toString(16)
  return hex
}

/**
 * 项目列表。
 *
 * C 线的规则（spec/03 §6）：带了 `X-Member-Id` 就只返回这个人参与的项目，
 * 没带就返回全部（演示 / 调试的降级模式）。假接口照同一口径实现——
 * 否则切到真接口那天，「切换身份看到的项目不一样」这个行为会突然冒出来。
 */
export async function listProjects(memberId) {
  await delay()
  const list = memberId
    ? db.projects.filter((p) => p.members.includes(memberId))
    : db.projects
  return clone(list)
}

export async function getProject(projectId) {
  await delay()
  const found = db.projects.find((p) => p.projectId === projectId)
  if (!found) throw fail('PROJECT_NOT_FOUND', `没有找到项目 ${projectId}。`, 404)
  return clone(found)
}

export async function createProject(payload) {
  await delay()
  const created = {
    projectId: `P${String(db.projects.length + 1).padStart(3, '0')}`,
    name: payload.name,
    description: payload.description ?? '',
    ownerId: payload.ownerId,
    members: payload.members ?? [],
    createdAt: new Date().toISOString(),
    status: 'ACTIVE'
  }
  db.projects.unshift(created)
  return clone(created)
}

/** 按时间正序返回（spec/02 §5.1 那一行要求的顺序） */
export async function listMilestones(projectId) {
  await delay()
  return clone(
    db.milestones
      .filter((m) => m.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  )
}

export async function getMilestone(milestoneId) {
  await delay()
  const found = db.milestones.find((m) => m.milestoneId === milestoneId)
  if (!found) throw fail('MILESTONE_NOT_FOUND', `没有找到里程碑 ${milestoneId}。`, 404)
  return clone(found)
}

export async function createMilestone(projectId, payload) {
  await delay()
  const total = (payload.contributors ?? []).reduce((sum, c) => sum + c.percentage, 0)
  // 这条校验前端已经拦过一次（spec/01 §2.6），这里再拦一次是为了让
  // 「接口拒绝」这条路径在开发时也能被走到、被看见
  if (total !== 100) {
    throw fail('CONTRIBUTION_TOTAL_INVALID', `贡献比例总和是 ${total}%，必须正好是 100%。`)
  }
  const created = {
    milestoneId: `M${Date.now().toString().slice(-6)}`,
    projectId,
    title: payload.title,
    description: payload.description ?? '',
    fileName: payload.fileName ?? '',
    fileHash: payload.fileHash ?? '',
    contributors: clone(payload.contributors ?? []),
    confirmations: [],
    createdAt: new Date().toISOString(),
    status: 'PENDING_CONFIRMATION',
    // 真接口给的是这次写入 Fabric 的交易 ID（spec/03 §5）
    txId: fakeTxId()
  }
  db.milestones.push(created)
  return clone(created)
}

/**
 * 提交一次确认，返回**更新后的完整 Milestone**。
 * 这正是 spec/02 §5.1 里那个还没问 C 线的问题——假接口先按前端需要的形状实现，
 * 真接口如果给不了，适配写在 api/ 那一层，视图不动。
 */
export async function confirmMilestone(milestoneId, { memberId, decision }) {
  await delay()
  const found = db.milestones.find((m) => m.milestoneId === milestoneId)
  if (!found) throw fail('MILESTONE_NOT_FOUND', `没有找到里程碑 ${milestoneId}。`, 404)

  if (!found.contributors.some((c) => c.memberId === memberId)) {
    throw fail('MEMBER_NOT_IN_CLAIM', `${memberId} 不在这份贡献声明里，无法确认。`, 403)
  }
  if (found.confirmations.some((c) => c.memberId === memberId)) {
    throw fail('ALREADY_DECIDED', `${memberId} 已经表过态了，不能重复提交。`, 409)
  }
  if (found.status !== 'PENDING_CONFIRMATION') {
    throw fail('MILESTONE_CLOSED', '这条里程碑已经有结果了，不再接受确认。', 409)
  }

  found.confirmations.push({ memberId, decision, timestamp: new Date().toISOString() })

  // 一人拒绝即整条拒绝；全员确认才验证通过（spec/03 §4.2，B 线已按此实现）
  if (decision === 'REJECTED') {
    found.status = 'REJECTED'
  } else if (found.confirmations.length === found.contributors.length) {
    found.status = 'VERIFIED'
  }
  // 状态变了就换一个新的 txId：里程碑上挂的那个，指的是
  // 「最近一次让它进入当前状态」的那笔交易，不是创建时那笔（spec/03 §5）
  found.txId = fakeTxId()
  return clone(found)
}

/** 累计比例只统计已验证的里程碑——这条规则同时写在项目详情页的说明文字里 */
export async function getContributions(projectId) {
  await delay()
  const verified = db.milestones.filter(
    (m) => m.projectId === projectId && m.status === 'VERIFIED'
  )
  const totals = new Map()
  for (const m of verified) {
    for (const c of m.contributors) {
      totals.set(c.memberId, (totals.get(c.memberId) ?? 0) + c.percentage)
    }
  }
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1])
  // 直接 Math.round 会得到 44 + 31 + 26 = 101 这种结果，用最大余数法保证和恰好是 100
  const shares = largestRemainder(entries.map(([, value]) => value))
  return {
    members: entries.map(([memberId], i) => ({ memberId, percentage: shares[i] })),
    basedOnMilestones: verified.length
  }
}

export async function getCertificate(certificateId) {
  await delay()
  const found = db.certificates.find((c) => c.certificateId === certificateId)
  if (!found) throw fail('CERTIFICATE_NOT_FOUND', `没有找到证书 ${certificateId}。`, 404)
  return clone(found)
}

/** 证书列表。两个筛选参数都可选（spec/03 §8.1） */
export async function listCertificates({ projectId, memberId } = {}) {
  await delay()
  return clone(
    db.certificates.filter(
      (c) =>
        (!projectId || c.projectId === projectId) &&
        (!memberId || c.memberId === memberId)
    )
  )
}

/**
 * 签发贡献证明（spec/03 §8.2、§8.3）。
 *
 * 两个前置条件：这个人得是项目成员，项目里得至少有一条已验证的里程碑。
 * 前端据此决定按钮什么时候可以点，但这里仍然再判一次——
 * 页面判断失误时要能被接口拦住，而不是造出一张没有依据的证书。
 *
 * **幂等**：同一个 projectId + memberId 重复请求，返回已有的那张，
 * 不新签一张。所以演示时多点几次不会生出一堆重复证书。
 */
export async function createCertificate(projectId, { memberId } = {}) {
  await delay()
  const project = db.projects.find((p) => p.projectId === projectId)
  if (!project) throw fail('PROJECT_NOT_FOUND', `没有找到项目 ${projectId}。`, 404)

  if (!project.members.includes(memberId)) {
    throw fail('MEMBER_NOT_IN_CLAIM', `${memberId} 不是项目 ${projectId} 的成员。`, 403)
  }

  const existing = db.certificates.find(
    (c) => c.projectId === projectId && c.memberId === memberId
  )
  if (existing) return clone(existing)

  const verified = db.milestones.filter(
    (m) => m.projectId === projectId && m.status === 'VERIFIED'
  )
  if (verified.length === 0) {
    // 用 VALIDATION_ERROR 而不是自己起一个码：docs/API.md 的错误码表里
    // 没有给这种情况专门的码，普通参数校验失败一律归到它。
    // 假接口要产出真接口会产出的东西，不然错误分支测的是一个不存在的情况。
    throw fail(
      'VALIDATION_ERROR',
      '这个项目还没有任何一条里程碑通过全员确认，暂时不能签发贡献证明。'
    )
  }

  // 比例只按已验证的里程碑算，与贡献面板同一口径（spec/03 §8.4）
  const { members } = await getContributions(projectId)
  const share = members.find((m) => m.memberId === memberId)?.percentage ?? 0

  const created = {
    certificateId: `CERT-${projectId}-${String(memberId).toUpperCase()}`,
    projectId,
    memberId,
    contributionPercentage: share,
    milestoneIds: verified.map((m) => m.milestoneId),
    issuedAt: new Date().toISOString(),
    verificationStatus: 'VALID',
    txId: fakeTxId()
  }
  db.certificates.push(created)
  return clone(created)
}

/**
 * 公开验证（spec/03 §9）。
 *
 * 查不到**不抛错**，返回 200 + `verificationStatus: 'NOT_FOUND'`——
 * 「查无此证」是一次有效的验证结果，不是接口错误。
 * 查得到时这个字段是 `VALID`，注意它和 Milestone.status 的 `VERIFIED` 不是一回事。
 */
export async function verifyCertificate(certificateId) {
  await delay()
  const found = db.certificates.find((c) => c.certificateId === certificateId)
  if (!found) return { certificateId, verificationStatus: 'NOT_FOUND' }
  return clone(found)
}
