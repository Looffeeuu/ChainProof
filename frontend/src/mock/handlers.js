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
import { contributionShares, compareUtf8 } from '../utils/percentage.js'
import { MAX_FILE_LABEL, isTooLarge } from '../utils/file-limit.js'

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
 * C 线的规则（docs/API.md §2）：带了 `X-Member-Id` 就只返回这个人参与的项目，
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

/** 按时间正序返回（docs/API.md §2） */
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
  // 同上，前端选文件时已经拦过。码与状态按组长 09-18 的答复：413 + FILE_TOO_LARGE
  if (isTooLarge(payload.file)) {
    throw fail('FILE_TOO_LARGE', `单个文件不能超过 ${MAX_FILE_LABEL}。`, 413)
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
    // 真接口给的是这次写入 Fabric 的交易 ID（docs/API.md §6）
    txId: fakeTxId()
  }
  db.milestones.push(created)
  return clone(created)
}

/**
 * 提交一次确认，返回**更新后的完整 Milestone**（docs/API.md §3）。
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

  // 一人拒绝即整条拒绝；全员确认才验证通过（docs/API.md §3，B 线已按此实现）
  if (decision === 'REJECTED') {
    found.status = 'REJECTED'
  } else if (found.confirmations.length === found.contributors.length) {
    found.status = 'VERIFIED'
  }
  // 状态变了就换一个新的 txId：里程碑上挂的那个，指的是
  // 「最近一次让它进入当前状态」的那笔交易，不是创建时那笔（docs/API.md §6）
  found.txId = fakeTxId()
  return clone(found)
}

/**
 * 累计比例（docs/API.md §4，PR #9 定稿）。算法在 utils/percentage.js 的
 * contributionShares，这里只负责挑出数据：项目全部成员、项目全部已验证里程碑。
 *
 * 返回**全部成员**，0% 的也在；按 memberId 字节序排列。页面想按比例排，自己排。
 */
function sharesOf(project) {
  const verified = db.milestones.filter(
    (m) => m.projectId === project.projectId && m.status === 'VERIFIED'
  )
  return { verified, members: contributionShares(project.members, verified) }
}

export async function getContributions(projectId) {
  await delay()
  const project = db.projects.find((p) => p.projectId === projectId)
  if (!project) throw fail('PROJECT_NOT_FOUND', `没有找到项目 ${projectId}。`, 404)
  const { verified, members } = sharesOf(project)
  return { projectId, members, basedOnMilestones: verified.length }
}

export async function getCertificate(certificateId) {
  await delay()
  const found = db.certificates.find((c) => c.certificateId === certificateId)
  if (!found) throw fail('CERTIFICATE_NOT_FOUND', `没有找到证书 ${certificateId}。`, 404)
  return clone(found)
}

/** 证书列表。两个筛选参数都可选（docs/API.md §5） */
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

/** 两种「没有可证明的贡献」共用一句话，逐字照 docs/API.md §5 */
const NO_CONTRIBUTION = '累计贡献比例为 0%，不能签发证书。'

/**
 * 签发贡献证明。检查顺序逐条照 docs/API.md §5（PR #9 定稿），**顺序本身就是规则**：
 *
 * 1. 这个人在这个项目已有证书 → 直接返回原证书，后面的都不查。
 *    证书是签发那一刻的快照，之后比例怎么变都不影响它，也不会因此拿不回来。
 * 2. 不是项目成员 → 拒绝。
 * 3. 项目没有已验证里程碑 → 409 NO_VERIFIED_CONTRIBUTION。
 * 4. 取整之后本人比例为 0 → 同上。判的是**取整后**的数，也就是面板上显示的那个，
 *    所以「实际参与过、但分到 0%」的人同样不能签发。
 *
 * 前端据此决定按钮能不能点，这里仍然再判一次——
 * 页面判断失误时要能被接口拦住，而不是造出一张没有依据的证书。
 */
export async function createCertificate(projectId, { memberId } = {}) {
  await delay()
  const project = db.projects.find((p) => p.projectId === projectId)
  if (!project) throw fail('PROJECT_NOT_FOUND', `没有找到项目 ${projectId}。`, 404)

  const existing = db.certificates.find(
    (c) => c.projectId === projectId && c.memberId === memberId
  )
  if (existing) return clone(existing)

  if (!project.members.includes(memberId)) {
    throw fail('MEMBER_NOT_IN_CLAIM', `${memberId} 不是项目 ${projectId} 的成员。`, 403)
  }

  const { verified, members } = sharesOf(project)
  const share = members.find((m) => m.memberId === memberId)?.percentage ?? 0
  if (verified.length === 0 || share === 0) {
    throw fail('NO_VERIFIED_CONTRIBUTION', NO_CONTRIBUTION, 409)
  }

  // 只列他实际参与（percentage > 0）的那几条，按 createdAt、再按 milestoneId 正序。
  // 条数一般少于 basedOnMilestones——比例按全部已验证的算，证书只列他参与的
  const milestoneIds = verified
    .filter((m) => m.contributors.some((c) => c.memberId === memberId && c.percentage > 0))
    .sort((a, b) => compareUtf8(a.createdAt, b.createdAt) || compareUtf8(a.milestoneId, b.milestoneId))
    .map((m) => m.milestoneId)

  const created = {
    certificateId: `CERT-${projectId}-${String(memberId).toUpperCase()}`,
    projectId,
    memberId,
    contributionPercentage: share,
    milestoneIds,
    issuedAt: new Date().toISOString(),
    verificationStatus: 'VALID',
    txId: fakeTxId()
  }
  db.certificates.push(created)
  return clone(created)
}

/**
 * 公开验证。
 *
 * 查不到**不抛错**，返回 200 + `verificationStatus: 'NOT_FOUND'`——
 * 「查无此证」是一次有效的验证结果，不是接口错误。
 * 查得到时这个字段是 `VALID`，注意它和 Milestone.status 的 `VERIFIED` 不是一回事。
 *
 * **命中时返回的是一个信封，证书本体在 `certificate` 里**，照 `docs/API.md §5`
 * （组长 09-18 确认）。不要改成直接返回扁平的 Certificate：假接口必须和真接口同形，
 * 演示走的和联调走的才是同一条代码路径。
 * 拆信封在 `api/certificates.js`，视图只看得到扁平的 Certificate。
 */
export async function verifyCertificate(certificateId) {
  await delay()
  const found = db.certificates.find((c) => c.certificateId === certificateId)
  if (!found) return { certificateId, verificationStatus: 'NOT_FOUND' }
  return {
    certificateId,
    verificationStatus: found.verificationStatus,
    certificate: clone(found)
  }
}
