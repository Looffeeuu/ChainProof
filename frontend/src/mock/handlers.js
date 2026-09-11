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

export async function listProjects() {
  await delay()
  return clone(db.projects)
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
    status: 'PENDING_CONFIRMATION'
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

  // 一人拒绝即整条拒绝；全员确认才验证通过
  if (decision === 'REJECTED') {
    found.status = 'REJECTED'
  } else if (found.confirmations.length === found.contributors.length) {
    found.status = 'VERIFIED'
  }
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

export async function listCertificates() {
  await delay()
  return clone(db.certificates)
}

export async function verifyCertificate(certificateId) {
  await delay()
  const found = db.certificates.find((c) => c.certificateId === certificateId)
  // 验证接口对不存在的 ID 不该抛错——「查无此证」本身就是一个有效的验证结果
  if (!found) return { certificateId, verificationStatus: 'NOT_FOUND' }
  return { ...clone(found), verificationStatus: found.verificationStatus }
}
