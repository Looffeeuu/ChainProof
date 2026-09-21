/**
 * 外壳与交互组件的渲染冒烟测试。
 *
 * check:initial 渲染的是 views/，覆盖不到 layouts/ 和不属于任何一页的组件。
 * 而「公开验证页出不去」那个 bug 就在外壳里——外壳一样会出事。
 *
 * 这里把外壳和两个交互组件各渲染一次，判据是不许抛错；
 * 另外断言侧栏里存在一个指向应用首页的链接——那个 bug 就是链接指向了自己，
 * 把页面变成了死胡同。
 */
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter, createMemoryHistory } from 'vue-router'

import AppShell from '../src/layouts/AppShell.vue'
import HelpTip from '../src/components/base/HelpTip.vue'
import IdentityMenu from '../src/components/base/IdentityMenu.vue'
import ThemeToggle from '../src/components/base/ThemeToggle.vue'

const Blank = { render: () => h('div') }

async function render(Component, slots) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:all(.*)*', component: Blank, meta: { title: 't' } }]
  })
  await router.push('/')
  await router.isReady()

  const app = createSSRApp({ render: () => h(Component, null, slots) })
  app.use(router)
  app.config.warnHandler = () => {}
  return renderToString(app)
}

export async function run() {
  const results = []

  const cases = [
    ['AppShell 外壳', AppShell, undefined],
    // 原先这里是 SettingsMenu（一枚齿轮）。齿轮的画法和主题开关里的太阳同构，
    // 两个图标按钮并排分不清，已经拆成「三格主题开关 + 身份胶囊」两个组件
    ['IdentityMenu 身份胶囊', IdentityMenu, undefined],
    ['ThemeToggle 主题开关', ThemeToggle, undefined],
    ['HelpTip 问号', HelpTip, { default: () => '一句说明' }]
  ]

  for (const [label, Component, slots] of cases) {
    try {
      const html = await render(Component, slots)
      results.push({ ok: true, label, detail: `${html.length} 字符`, html })
    } catch (e) {
      results.push({ ok: false, label, detail: `${e.constructor.name}: ${e.message}` })
    }
  }

  const shell = results.find((r) => r.label.startsWith('AppShell'))
  if (shell?.ok) {
    // 每一页都要能回到首页。曾经公开验证页用的是另一套无侧栏外壳，
    // 那套外壳的品牌链接指向自己，进去就出不来。现在统一成 AppShell，
    // 这条钉住「侧栏里始终有一个指向 / 的链接」
    const hasHome = shell.html.includes('href="/"')
    results.push({
      ok: hasHome,
      label: '侧栏有通向首页的链接',
      detail: hasHome ? '找到 href="/"' : '侧栏里没有任何指向 / 的链接'
    })
  }

  return results.map(({ html, ...rest }) => rest)
}
