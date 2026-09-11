/**
 * 首屏自检：把每个页面在「数据还没到」的状态下渲染一次，看会不会抛错。
 *
 * 这是白屏事故之后补的。事故是这样的：组件首次渲染发生在 onMounted 之前，
 * 那一瞬间 useAsync 给出的三个状态是「没在加载、没出错、没数据」，
 * AsyncSection 于是认为数据已经到了，直接渲染数据分支，模板里读 `data.recent`
 * 拿到 null 抛错。Vue 的渲染函数一抛错，整个应用挂不上去，页面一片空白。
 *
 * **原来的 119 项自检结构上抓不到它**：check-screens 是把组件连同假数据一起渲染的，
 * 走的永远是「数据已经有了」那条路径，而出事的恰好是「数据还没有」那条。
 * 构建也不会报错——它只管编译，不管渲染。
 *
 * 所以这里刻意不喂任何数据，只把页面挂上去。判据只有一条：**不许抛错**。
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
