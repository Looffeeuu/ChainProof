import { createRouter, createWebHistory } from 'vue-router'

/**
 * 全部路由。路径与页面的对应关系由 spec/01-设计系统.md §2.7 规定，
 * 这里是它唯一的落地处——加页面先改那张表，再改这里。
 *
 * 组件一律用 `() => import(...)` 动态引入：Vite 会把每个页面单独打成一个 chunk，
 * 首屏只下载当前页需要的那份。九个页面里有一半是演示时才点开的，
 * 静态引入会让它们全挤进首屏那个包。
 *
 * `meta.title` 供 afterEach 写进 document.title，`meta.nav` 标记它在侧栏里对应哪一项。
 */
const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { title: '概览', nav: 'dashboard' }
  },
  {
    path: '/projects',
    name: 'project-list',
    component: () => import('../views/ProjectListView.vue'),
    meta: { title: '项目', nav: 'projects' }
  },
  {
    path: '/projects/new',
    name: 'project-create',
    component: () => import('../views/ProjectCreateView.vue'),
    meta: { title: '创建项目', nav: 'projects' }
  },
  {
    path: '/projects/:id',
    name: 'project-detail',
    component: () => import('../views/ProjectDetailView.vue'),
    meta: { title: '项目详情', nav: 'projects' }
  },
  {
    path: '/projects/:id/milestones/new',
    name: 'milestone-create',
    component: () => import('../views/MilestoneCreateView.vue'),
    meta: { title: '提交里程碑', nav: 'projects' }
  },
  {
    path: '/milestones/:id',
    name: 'milestone-confirm',
    component: () => import('../views/MilestoneConfirmView.vue'),
    meta: { title: '贡献确认', nav: 'projects' }
  },
  {
    path: '/certificates/:id',
    name: 'certificate',
    component: () => import('../views/CertificateView.vue'),
    meta: { title: '贡献证书', nav: 'certificates' }
  },
  {
    // id 可选：不带 id 时显示输入框，带 id 时直接出结果（spec/01 §2.7）。
    path: '/verify/:id?',
    name: 'verify',
    component: () => import('../views/VerifyView.vue'),
    meta: { title: '公开验证', nav: 'verify' }
  },
  // 开发用：把基础组件的所有状态摆在一页，FE-4 的验收方式。
  // 它不属于 spec/01 §2.7 的页面清单，所以放在 /dev 前缀下。
  //
  // **只在开发构建里注册。** 光把侧栏入口藏进「开发视角」是不够的，
  // 路由还在，敲地址就能打开——而这一页上写着 WCAG 编号、组件名、padding 取值，
  // 是给改代码的人看的。生产构建里它连同那个 chunk 一起消失。
  ...(import.meta.env.DEV
    ? [
        {
          path: '/dev/components',
          name: 'dev-components',
          component: () => import('../views/ComponentsPreviewView.vue'),
          meta: { title: '基础组件预览' }
        }
      ]
    : []),
  {
    // 兜底必须放最后：路由表按顺序匹配，放前面会把后面的全吃掉
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: '页面不存在' }
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  // 切页后回到顶部；浏览器前进后退时恢复到原来的位置
  scrollBehavior: (to, from, saved) => saved ?? { top: 0 }
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · ChainProof` : 'ChainProof'
})

export default router
