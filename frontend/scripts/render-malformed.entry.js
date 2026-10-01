/**
 * 畸形响应的渲染冒烟测试：**字段缺了、类型错了、枚举没见过，界面也不许炸。**
 *
 * 由 check-malformed.mjs 打印结果。
 *
 * —— 为什么单独一份夹具 ——
 *
 * `check:initial` 抓的是「data 还没到」（首屏那一帧，data 是 null），
 * 抓不到「data 来了但形状不对」。后者才是联调时真正会发生的：
 * 后端少给一个字段，前端某处 `result.milestoneIds.length` 直接抛 TypeError，
 * 而 Vue 的渲染函数一抛错，整个应用挂不上去——**白屏，不是少一行**。
 * 公开验证页就出过这个（2026-09-12 复审 §2.2）。
 *
 * 这份夹具**不能放进 `mock/fixtures.js`**：那里的东西会出现在概览、
 * 项目列表、验证页上，往里面塞一条坏证书等于把演示数据弄脏。
 * 所以畸形数据只活在这个文件里。
 *
 * 做法：拿一份好数据，逐个字段做手脚（删掉 / 置 null / 换成错类型），
 * 每种变体渲染一次，只判一件事——**没抛错**。
 * 内容对不对不在这里管，那是各自的 check:screens 在看。
 */
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter, createMemoryHistory } from 'vue-router'

import StatusBadge from '../src/components/base/StatusBadge.vue'
import HashText from '../src/components/base/HashText.vue'
import MemberAvatars from '../src/components/project/MemberAvatars.vue'
import ProjectCard from '../src/components/project/ProjectCard.vue'
import ContributionPanel from '../src/components/project/ContributionPanel.vue'
import ContributionBreakdown from '../src/components/project/ContributionBreakdown.vue'
import ClaimTable from '../src/components/milestone/ClaimTable.vue'
import ConfirmProgress from '../src/components/milestone/ConfirmProgress.vue'
import AwaitingYou from '../src/components/milestone/AwaitingYou.vue'
import MilestoneTimeline from '../src/components/milestone/MilestoneTimeline.vue'
import CertificateSheet from '../src/components/certificate/CertificateSheet.vue'

const Blank = { render: () => h('div') }

async function render(Component, props) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)*', component: Blank, meta: { title: 't' } }]
  })
  await router.push('/')
  await router.isReady()

  const app = createSSRApp({ render: () => h(Component, props) })
  app.use(router)
  // 属性类型不对时 Vue 会告警。这里要量的是「抛不抛错」，告警照单收下不算失败
  app.config.warnHandler = () => {}
  return renderToString(app)
}

// —— 好数据。字段照 docs/API.md §6，与 mock/fixtures.js 同形但内容无关 ——

const project = {
  projectId: 'PX01',
  name: '畸形夹具项目',
  description: '',
  ownerId: 'alice',
  members: ['alice', 'bob'],
  createdAt: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE'
}

const milestone = {
  milestoneId: 'MX01',
  projectId: 'PX01',
  title: '畸形夹具里程碑',
  description: '一句说明',
  fileName: 'x.zip',
  fileHash: 'b'.repeat(64),
  // PR #28 的两个字段。variants() 按键逐个做手脚，所以它们缺失、为 null、类型不对的情况自动都有
  submitterId: 'alice',
  requiredConfirmerIds: ['bob'],
  contributors: [
    { memberId: 'alice', percentage: 60 },
    { memberId: 'bob', percentage: 40 }
  ],
  confirmations: [{ memberId: 'bob', decision: 'CONFIRMED', timestamp: '2026-09-02T00:00:00.000Z' }],
  createdAt: '2026-09-01T01:00:00.000Z',
  status: 'PENDING_CONFIRMATION',
  txId: 'c'.repeat(64)
}

const certificate = {
  certificateId: 'CERT-PX01-ALICE',
  projectId: 'PX01',
  memberId: 'alice',
  contributionPercentage: 60,
  milestoneIds: ['MX01'],
  issuedAt: '2026-09-03T00:00:00.000Z',
  verificationStatus: 'VALID',
  txId: 'd'.repeat(64)
}

const contributions = { members: [{ memberId: 'alice', percentage: 60 }], basedOnMilestones: 1 }

/**
 * 一份数据能坏成什么样。
 *
 * 三种做手脚的方式各对应一类真实情况：
 *   删掉  —— 后端这一版还没有这个字段；
 *   null  —— 数据库里是 NULL，序列化出来就是 null；
 *   错类型 —— 数字回成字符串、数组回成对象，是跨语言序列化的经典分歧。
 */
function variants(obj, label) {
  const out = [{ label: `${label}（完好）`, value: obj }]
  for (const key of Object.keys(obj)) {
    const deleted = { ...obj }
    delete deleted[key]
    out.push({ label: `${label} 缺 ${key}`, value: deleted })
    out.push({ label: `${label} 的 ${key} 是 null`, value: { ...obj, [key]: null } })
    // 换成一个「类型明显不对」的值：原来是数组就给对象，否则给数组
    const wrong = Array.isArray(obj[key]) ? {} : ['?']
    out.push({ label: `${label} 的 ${key} 类型不对`, value: { ...obj, [key]: wrong } })
  }
  return out
}

/** 每个组件：怎么把一份（可能已经坏了的）数据变成它的 props */
const TARGETS = [
  ['StatusBadge', StatusBadge, [
    { label: 'status 是没见过的取值', value: { status: 'REVOKED' } },
    { label: 'status 是空串', value: { status: '' } }
  ]],
  ['HashText', HashText, [
    { label: 'value 是空串', value: { value: '' } },
    { label: 'value 不是字符串', value: { value: 123 } }
  ]],
  ['MemberAvatars', MemberAvatars, [
    { label: 'members 是空数组', value: { members: [] } },
    { label: 'members 里混了 null', value: { members: ['alice', null] } }
  ]],
  ['ProjectCard', ProjectCard, variants(project, 'project').map((v) => ({
    label: v.label,
    value: { project: v.value, milestones: [milestone] }
  }))],
  ['ClaimTable', ClaimTable, variants(milestone, 'milestone').map((v) => ({
    label: v.label,
    value: { milestone: v.value, highlight: 'alice' }
  }))],
  ['ConfirmProgress', ConfirmProgress, variants(milestone, 'milestone').map((v) => ({
    label: v.label,
    value: { milestone: v.value }
  }))],
  ['AwaitingYou', AwaitingYou, variants(milestone, 'milestone').map((v) => ({
    label: v.label,
    value: { milestone: v.value }
  }))],
  ['MilestoneTimeline', MilestoneTimeline, [
    ...variants(milestone, 'milestone').map((v) => ({
      label: v.label,
      value: { milestones: [v.value] }
    })),
    { label: 'milestones 是空数组', value: { milestones: [] } },
    { label: 'milestones 里混了 null', value: { milestones: [null] } }
  ]],
  ['CertificateSheet', CertificateSheet, variants(certificate, 'certificate').map((v) => ({
    label: v.label,
    value: { certificate: v.value, projectName: '', verifyUrl: '' }
  }))],
  ['ContributionPanel', ContributionPanel, variants(contributions, 'contributions').map((v) => ({
    label: v.label,
    value: { members: v.value?.members, basedOnMilestones: v.value?.basedOnMilestones }
  }))],
  ['ContributionBreakdown', ContributionBreakdown, [
    { label: 'milestones 是空数组', value: { milestones: [], members: contributions.members } },
    { label: 'members 是空数组', value: { milestones: [milestone], members: [] } },
    {
      label: '某条里程碑缺 contributors',
      value: { milestones: [{ ...milestone, status: 'VERIFIED', contributors: undefined }], members: contributions.members }
    },
    {
      label: '某条里程碑缺 createdAt',
      value: { milestones: [{ ...milestone, status: 'VERIFIED', createdAt: undefined }], members: contributions.members }
    }
  ]]
]

export async function run() {
  const results = []

  for (const [name, Component, cases] of TARGETS) {
    for (const { label, value } of cases) {
      try {
        await render(Component, value)
        results.push({ ok: true, component: name, label })
      } catch (e) {
        results.push({ ok: false, component: name, label, detail: `${e.constructor.name}: ${e.message}` })
      }
    }
  }

  return results
}
