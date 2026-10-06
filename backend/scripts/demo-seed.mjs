/**
 * Demo seed script — 通过真实 Backend API 写入答辩演示数据。
 *
 * 用法：npm run demo:seed
 * 前置：Backend 已在 http://127.0.0.1:3000 运行且 Fabric 网络已部署链码。
 *
 * 写入内容：
 *   - 3 个项目（P001 / P002 / P003）
 *   - 5 个里程碑（覆盖 VERIFIED / REJECTED / PENDING_CONFIRMATION）
 *   - 2 张贡献证书
 *   - 1 个 NOT_FOUND 演示 ID
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEMO_FILES = join(__dirname, 'demo-files')

const BASE = (process.env.CHAINPROOF_API_URL || 'http://127.0.0.1:3000/api/').replace(/\/?$/, '/')

// ─── 工具函数 ────────────────────────────────────────────────────────────────

async function api (path, options = {}, expected = 200) {
  const url = new URL(path, BASE)
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => null)
  if (response.status !== expected) {
    const body = JSON.stringify(payload, null, 2)
    throw new Error(`${options.method || 'GET'} ${path} → ${response.status}（期望 ${expected}）\n${body}`)
  }
  return payload
}

function as (memberId, options = {}) {
  return { ...options, headers: { ...(options.headers || {}), 'X-Member-Id': memberId } }
}

function postJson (body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

function fileHash (filePath) {
  const bytes = readFileSync(filePath)
  return createHash('sha256').update(bytes).digest('hex')
}

function uploadForm (title, description, contributors, filePath, submitterId) {
  const bytes = readFileSync(filePath)
  const fileName = filePath.split(/[/\\]/).pop()
  const hash = createHash('sha256').update(bytes).digest('hex')
  const form = new FormData()
  form.set('title', title)
  form.set('description', description)
  form.set('contributors', JSON.stringify(contributors))
  form.set('clientFileHash', hash)
  form.set('file', new Blob([bytes]), fileName)
  return { form, hash, submitterId }
}

function log (icon, msg) {
  console.log(`  ${icon}  ${msg}`)
}

// ─── 主流程 ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════')
console.log('  ChainProof Demo Seed — 答辩演示数据写入')
console.log('══════════════════════════════════════════════════\n')

// 0) 健康检查
log('🔍', '检查 Backend 健康状态...')
const health = await api('health')
log('✅', `Backend 正常：${health.service} @ ${health.timestamp}`)

// ─── P001: VLA 安全性基准测试 ─────────────────────────────────────────────────
console.log('\n─── P001: VLA 安全性基准测试 ───')

log('📁', '创建项目 P001...')
const P001 = await api('projects', as('alice', postJson({
  projectId: 'P001',
  name: 'VLA 安全性基准测试',
  description: '面向视觉—语言—动作模型的安全性评测集，包含 200 条标注样本、评测脚本与基线结果。',
  members: ['alice', 'bob', 'charlie']
})), 201)
log('✅', `P001 已创建（owner: ${P001.ownerId}, txId: ${P001.txId.slice(0, 12)}...）`)

// M001: VERIFIED — alice 提交，bob + charlie 确认
log('📦', '创建里程碑 M001（选题报告与分工方案）...')
const m001 = uploadForm(
  '选题报告与分工方案',
  '确定选题、评测范围与三人分工，附课程选题表。',
  [
    { memberId: 'alice', percentage: 48 },
    { memberId: 'bob', percentage: 26 },
    { memberId: 'charlie', percentage: 26 }
  ],
  join(DEMO_FILES, 'proposal.txt'),
  'alice'
)
let milestone = await api(`projects/P001/milestones`, as(m001.submitterId, {
  method: 'POST',
  body: m001.form
}), 201)
log('✅', `M001 已创建（status: ${milestone.status}, submitter: ${milestone.submitterId}）`)

log('🗳️', 'bob 确认 M001...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('bob', postJson({ decision: 'CONFIRMED' })))
log('🗳️', 'charlie 确认 M001...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('charlie', postJson({ decision: 'CONFIRMED' })))
log('✅', `M001 → ${milestone.status}`)

// M002: VERIFIED — bob 提交，alice + charlie 确认
log('📦', '创建里程碑 M002（数据标注规范与 200 条样本）...')
const m002 = uploadForm(
  '数据标注规范与 200 条样本',
  '标注规范 v1.0，200 条样本双人交叉标注，一致率 0.91。',
  [
    { memberId: 'alice', percentage: 40 },
    { memberId: 'bob', percentage: 35 },
    { memberId: 'charlie', percentage: 25 }
  ],
  join(DEMO_FILES, 'annotation.txt'),
  'bob'
)
milestone = await api(`projects/P001/milestones`, as(m002.submitterId, {
  method: 'POST',
  body: m002.form
}), 201)
log('✅', `M002 已创建（status: ${milestone.status}, submitter: ${milestone.submitterId}）`)

log('🗳️', 'alice 确认 M002...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('alice', postJson({ decision: 'CONFIRMED' })))
log('🗳️', 'charlie 确认 M002...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('charlie', postJson({ decision: 'CONFIRMED' })))
log('✅', `M002 → ${milestone.status}`)

// M003: REJECTED — alice 提交，bob 拒绝
log('📦', '创建里程碑 M003（初版评测指标与权重）...')
const m003 = uploadForm(
  '初版评测指标与权重',
  'bob 拒绝：指标权重与分工记录不一致，比例需要重新分配后再提交。',
  [
    { memberId: 'alice', percentage: 60 },
    { memberId: 'bob', percentage: 20 },
    { memberId: 'charlie', percentage: 20 }
  ],
  join(DEMO_FILES, 'metrics.txt'),
  'alice'
)
milestone = await api(`projects/P001/milestones`, as(m003.submitterId, {
  method: 'POST',
  body: m003.form
}), 201)
log('✅', `M003 已创建（status: ${milestone.status}, submitter: ${milestone.submitterId}）`)

log('🗳️', 'bob 拒绝 M003...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('bob', postJson({ decision: 'REJECTED' })))
log('✅', `M003 → ${milestone.status}`)

// M004: PENDING_CONFIRMATION — alice 提交，bob 确认，charlie 未确认
log('📦', '创建里程碑 M004（基准测试集 v0.3 与评测脚本）...')
const m004 = uploadForm(
  '基准测试集 v0.3 与评测脚本',
  '新增 60 条对抗样本；评测脚本改为按场景分组输出。等待 charlie 确认。',
  [
    { memberId: 'alice', percentage: 50 },
    { memberId: 'bob', percentage: 30 },
    { memberId: 'charlie', percentage: 20 }
  ],
  join(DEMO_FILES, 'benchmark.txt'),
  'alice'
)
milestone = await api(`projects/P001/milestones`, as(m004.submitterId, {
  method: 'POST',
  body: m004.form
}), 201)
log('✅', `M004 已创建（status: ${milestone.status}, submitter: ${milestone.submitterId}）`)

log('🗳️', 'bob 确认 M004...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('bob', postJson({ decision: 'CONFIRMED' })))
log('⏳', `M004 → ${milestone.status}（等待 charlie 确认）`)

// P001 贡献统计
const contribP001 = await api('projects/P001/contributions')
log('📊', `P001 贡献统计：基于 ${contribP001.basedOnMilestones} 个 VERIFIED 里程碑`)
for (const m of contribP001.members) {
  log('   ', `${m.memberId}: ${m.percentage}%`)
}

// P001 证书 — alice
log('📜', '为 alice 签发 P001 贡献证书...')
const certP001Alice = await api('projects/P001/certificates', as('alice', postJson({ memberId: 'alice' })))
log('✅', `证书 ${certP001Alice.certificateId}：alice 贡献 ${certP001Alice.contributionPercentage}%，覆盖 ${certP001Alice.milestoneIds.join(', ')}`)

// ─── P002: 课程实验报告归档 ──────────────────────────────────────────────────
console.log('\n─── P002: 课程实验报告归档 ───')

log('📁', '创建项目 P002...')
const P002 = await api('projects', as('bob', postJson({
  projectId: 'P002',
  name: '课程实验报告归档',
  description: '四次实验的报告与代码存证，用于结课材料核对。',
  members: ['alice', 'bob', 'charlie']
})), 201)
log('✅', `P002 已创建（owner: ${P002.ownerId}, txId: ${P002.txId.slice(0, 12)}...）`)

// M101: VERIFIED — bob 提交，alice + charlie 确认
log('📦', '创建里程碑 M101（实验一至实验四报告归档）...')
const m101 = uploadForm(
  '实验一至实验四报告归档',
  '四次实验的报告、代码与运行结果，打包存证。',
  [
    { memberId: 'alice', percentage: 34 },
    { memberId: 'bob', percentage: 33 },
    { memberId: 'charlie', percentage: 33 }
  ],
  join(DEMO_FILES, 'labs.txt'),
  'bob'
)
milestone = await api(`projects/P002/milestones`, as(m101.submitterId, {
  method: 'POST',
  body: m101.form
}), 201)
log('✅', `M101 已创建（status: ${milestone.status}, submitter: ${milestone.submitterId}）`)

log('🗳️', 'alice 确认 M101...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('alice', postJson({ decision: 'CONFIRMED' })))
log('🗳️', 'charlie 确认 M101...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('charlie', postJson({ decision: 'CONFIRMED' })))
log('✅', `M101 → ${milestone.status}`)

// P002 贡献统计
const contribP002 = await api('projects/P002/contributions')
log('📊', `P002 贡献统计：基于 ${contribP002.basedOnMilestones} 个 VERIFIED 里程碑`)
for (const m of contribP002.members) {
  log('   ', `${m.memberId}: ${m.percentage}%`)
}

// P002 证书 — bob
log('📜', '为 bob 签发 P002 贡献证书...')
const certP002Bob = await api('projects/P002/certificates', as('bob', postJson({ memberId: 'bob' })))
log('✅', `证书 ${certP002Bob.certificateId}：bob 贡献 ${certP002Bob.contributionPercentage}%，覆盖 ${certP002Bob.milestoneIds.join(', ')}`)

// ─── P003: 答辩演示脚本 ──────────────────────────────────────────────────────
console.log('\n─── P003: 答辩演示脚本 ───')

log('📁', '创建项目 P003...')
const P003 = await api('projects', as('charlie', postJson({
  projectId: 'P003',
  name: '答辩演示脚本',
  description: '',
  members: ['alice', 'charlie']
})), 201)
log('✅', `P003 已创建（owner: ${P003.ownerId}, description 为空以触发兜底显示）`)

// M301: VERIFIED — alice 提交，charlie 确认，charlie 贡献 0%
log('📦', '创建里程碑 M301（答辩演示脚本初稿）...')
const m301 = uploadForm(
  '答辩演示脚本初稿',
  'charlie 是项目成员但未贡献任何内容，贡献比例为 0%。',
  [
    { memberId: 'alice', percentage: 100 },
    { memberId: 'charlie', percentage: 0 }
  ],
  join(DEMO_FILES, 'script.txt'),
  'alice'
)
milestone = await api(`projects/P003/milestones`, as(m301.submitterId, {
  method: 'POST',
  body: m301.form
}), 201)
log('✅', `M301 已创建（status: ${milestone.status}, submitter: ${milestone.submitterId}）`)

log('🗳️', 'charlie 确认 M301...')
milestone = await api(`milestones/${milestone.milestoneId}/confirmations`, as('charlie', postJson({ decision: 'CONFIRMED' })))
log('✅', `M301 → ${milestone.status}`)

// P003 贡献统计
const contribP003 = await api('projects/P003/contributions')
log('📊', `P003 贡献统计：基于 ${contribP003.basedOnMilestones} 个 VERIFIED 里程碑`)
for (const m of contribP003.members) {
  log('   ', `${m.memberId}: ${m.percentage}%`)
}

// charlie 尝试签发证书 → NO_VERIFIED_CONTRIBUTION
log('🚫', 'charlie 尝试签发 P003 证书（0% 贡献）...')
const charlieCertError = await api('projects/P003/certificates', as('charlie', postJson({ memberId: 'charlie' })), 409)
log('✅', `预期错误：${charlieCertError.error.code} — ${charlieCertError.error.message}`)

// ─── 公开验证演示 ────────────────────────────────────────────────────────────
console.log('\n─── 公开验证演示 ───')

log('🔍', `验证证书 ${certP001Alice.certificateId}...`)
const verifyValid = await api(`verify/${certP001Alice.certificateId}`)
log('✅', `验证结果：${verifyValid.verificationStatus}`)

const NOT_FOUND_ID = 'CP-DEMO-NOT-FOUND'
log('🔍', `验证不存在的证书 ${NOT_FOUND_ID}...`)
const verifyNotFound = await api(`verify/${NOT_FOUND_ID}`)
log('✅', `验证结果：${verifyNotFound.verificationStatus}（用于演示 NOT_FOUND 状态）`)

// ─── 汇总 ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════')
console.log('  Demo Seed 完成！')
console.log('══════════════════════════════════════════════════\n')

console.log('项目：')
console.log(`  P001  VLA 安全性基准测试    成员: alice, bob, charlie`)
console.log(`  P002  课程实验报告归档      成员: alice, bob, charlie`)
console.log(`  P003  答辩演示脚本          成员: alice, charlie（description 为空）`)

console.log('\n里程碑：')
console.log(`  M001  选题报告与分工方案          → VERIFIED`)
console.log(`  M002  数据标注规范与 200 条样本   → VERIFIED`)
console.log(`  M003  初版评测指标与权重          → REJECTED`)
console.log(`  M004  基准测试集 v0.3 与评测脚本  → PENDING_CONFIRMATION（1/2 已确认）`)
console.log(`  M101  实验一至实验四报告归档      → VERIFIED`)
console.log(`  M301  答辩演示脚本初稿            → VERIFIED（charlie 贡献 0%）`)

console.log('\n证书：')
console.log(`  ${certP001Alice.certificateId}  alice @ P001  ${certP001Alice.contributionPercentage}%`)
console.log(`  ${certP002Bob.certificateId}    bob @ P002    ${certP002Bob.contributionPercentage}%`)

console.log('\nNOT_FOUND 演示 ID：')
console.log(`  ${NOT_FOUND_ID}`)

console.log('\n前端入口：')
console.log(`  Dashboard    →  /`)
console.log(`  项目详情     →  /projects/P001`)
console.log(`  里程碑确认   →  /projects/P001/milestones/M004  （PENDING 状态）`)
console.log(`  贡献证书     →  /projects/P001/certificates/${certP001Alice.certificateId}`)
console.log(`  公开验证     →  /verify/${certP001Alice.certificateId}`)
console.log(`  公开验证 404 →  /verify/${NOT_FOUND_ID}`)
console.log()
