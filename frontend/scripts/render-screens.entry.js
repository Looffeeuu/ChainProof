/**
 * 页面级服务端渲染入口，被 scripts/check-screens.mjs 调用。
 *
 * 和 render-components.entry.js 的区别：这里的组件用到了 <RouterLink> 与路由参数，
 * 所以要装一个内存路由（createMemoryHistory）并等它就绪，否则渲染会因为
 * 找不到 RouterLink 而报错。
 *
 * 注意：服务端渲染不会触发 onMounted，因此靠 onMounted 取数的页面
 * 在这里渲染出的是「还没开始取数」的样子。所以数据相关的断言都放在
 * 直接接收 props 的组件上（ProjectCard 这种），不放在自己取数的页面上。
 */
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter, createMemoryHistory } from 'vue-router'

import ProjectCard from '../src/components/project/ProjectCard.vue'
import ProjectCreateView from '../src/views/ProjectCreateView.vue'
import MilestoneTimeline from '../src/components/milestone/MilestoneTimeline.vue'
import ContributionAllocator from '../src/components/milestone/ContributionAllocator.vue'
import ClaimTable from '../src/components/milestone/ClaimTable.vue'
import CertificateSheet from '../src/components/certificate/CertificateSheet.vue'
import VerifyView from '../src/views/VerifyView.vue'
import CertificateView from '../src/views/CertificateView.vue'
import ContributionPanel from '../src/components/project/ContributionPanel.vue'
import ContributionBreakdown from '../src/components/project/ContributionBreakdown.vue'
import { projects, milestones, certificates } from '../src/mock/fixtures.js'

// 按 createdAt 正序排——接口就是这么给的（docs/API.md §2），
// 喂给组件的数据必须和真接口同形，否则测的是一个不存在的情况
const p001 = milestones
  .filter((m) => m.projectId === 'P001')
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

const Harness = {
  setup() {
    return () =>
      h('div', [
        ...projects.map((project) =>
          h(ProjectCard, {
            key: project.projectId,
            project,
            milestones: milestones.filter((m) => m.projectId === project.projectId)
          })
        ),
        // P001 的四条里程碑覆盖三种状态，Timeline 的分支一次全能走到
        h(MilestoneTimeline, { milestones: p001 }),
        h(ContributionPanel, {
          members: [
            { memberId: 'alice', percentage: 44 },
            { memberId: 'bob', percentage: 31 },
            { memberId: 'charlie', percentage: 25 }
          ],
          basedOnMilestones: 2
        }),
        // 分配器的三种总和：不足、刚好、超出。三种提示语各不相同
        h(ContributionAllocator, {
          modelValue: [
            { memberId: 'alice', percentage: 40 },
            { memberId: 'bob', percentage: 30 },
            { memberId: 'charlie', percentage: 27 }
          ]
        }),
        h(ContributionAllocator, {
          modelValue: [
            { memberId: 'alice', percentage: 50 },
            { memberId: 'bob', percentage: 30 },
            { memberId: 'charlie', percentage: 20 }
          ]
        }),
        h(ContributionAllocator, {
          modelValue: [
            { memberId: 'alice', percentage: 60 },
            { memberId: 'bob', percentage: 55 }
          ]
        }),
        // 声明表：M004 里 alice/bob 已表态、charlie 还没，三种行状态一次能看全
        h(ContributionBreakdown, {
          milestones: p001,
          members: [
            { memberId: 'alice', percentage: 44 },
            { memberId: 'bob', percentage: 31 },
            { memberId: 'charlie', percentage: 25 }
          ]
        }),
        // 一条已验证里程碑都没有时的空状态
        h(ContributionPanel, { members: [], basedOnMilestones: 0 }),
        h(ClaimTable, {
          milestone: milestones.find((m) => m.milestoneId === 'M004'),
          highlight: 'charlie'
        }),
        h(CertificateSheet, {
          certificate: certificates[0],
          projectName: 'VLA 安全性基准测试',
          verifyUrl: 'http://localhost:5173/verify/CERT-P001-ALICE'
        }),
        // 证书页本身：它靠 onMounted 之后的取数填内容，服务端渲染只到加载态为止，
        // 所以这里能验的是它的外围——那排打印时不该进纸的工具栏
        h(CertificateView),
        h(VerifyView),
        h(ProjectCreateView)
      ])
  }
}

export default async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/projects', component: { render: () => null } },
      { path: '/projects/new', component: { render: () => null } },
      { path: '/projects/:id', component: { render: () => null } },
      { path: '/milestones/:id', component: { render: () => null } },
      { path: '/verify/:id?', component: { render: () => null } },
      { path: '/certificates/:id', component: { render: () => null } }
    ]
  })
  router.push('/projects/new')
  await router.isReady()

  const app = createSSRApp(Harness)
  app.use(router)
  return renderToString(app)
}
