/**
 * 首屏自检：每个页面在「数据还没到」的状态下渲染一次，判据是**不许抛错**。
 * 抛错在浏览器里的表现就是整页空白。
 *
 * check-screens 抓不到这类问题——它连同假数据一起渲染，走的永远是
 * 「数据已经有了」那条路径；构建也只管编译不管渲染。所以这里刻意不喂数据。
 */
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter, createMemoryHistory } from 'vue-router'

const VIEWS = {
  '概览 /': ['../src/views/DashboardView.vue', '/'],
  '项目列表 /projects': ['../src/views/ProjectListView.vue', '/projects'],
  '创建项目 /projects/new': ['../src/views/ProjectCreateView.vue', '/projects/new'],
  '项目详情 /projects/:id': ['../src/views/ProjectDetailView.vue', '/projects/P001'],
  '提交里程碑': ['../src/views/MilestoneCreateView.vue', '/projects/P001/milestones/new'],
  '贡献确认 /milestones/:id': ['../src/views/MilestoneConfirmView.vue', '/milestones/M004'],
  '贡献证书 /certificates/:id': ['../src/views/CertificateView.vue', '/certificates/CERT-P001-ALICE'],
  '公开验证（无 id）': ['../src/views/VerifyView.vue', '/verify'],
  '公开验证（带 id）': ['../src/views/VerifyView.vue', '/verify/CERT-P001-ALICE'],
  '404': ['../src/views/NotFoundView.vue', '/nope'],
  '组件预览': ['../src/views/ComponentsPreviewView.vue', '/dev/components']
}

const modules = import.meta.glob('../src/views/*.vue')

export async function run() {
  const results = []

  for (const [label, [path, url]] of Object.entries(VIEWS)) {
    try {
      const mod = await modules[path]()
      const Component = mod.default

      // 路由表里每条路径都指向同一个组件：这里只关心「这一页自己渲不渲得出来」，
      // 不关心跳转目标。但 RouterLink 需要目标存在，否则它会警告
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:all(.*)*', component: Component, meta: { title: label } }]
      })
      await router.push(url)
      await router.isReady()

      const app = createSSRApp(Component)
      app.use(router)
      // 渲染期的警告不算失败，只有抛错算——警告在 SSR 下很多是环境噪音
      app.config.warnHandler = () => {}

      const html = await renderToString(app)
      results.push({ ok: true, label, detail: `${html.length} 字符` })
    } catch (e) {
      results.push({ ok: false, label, detail: `${e.constructor.name}: ${e.message}` })
    }
  }

  return results
}
