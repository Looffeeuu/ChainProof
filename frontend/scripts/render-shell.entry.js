/**
 * 外壳与新组件的渲染冒烟测试。
 *
 * check:initial 渲染的是 views/，覆盖不到 layouts/ 和不属于任何一页的组件。
 * 而「公开验证页出不去」那个 bug 就在 BareLayout 里——外壳一样会出事。
 *
 * 这里把两个外壳和两个交互组件各渲染一次，判据只有一条：不许抛错。
 * 顺带断言 BareLayout 里存在一个指向应用首页的链接——
 * 它曾经指向 /verify（自己），把这一页变成了死胡同。
 */
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createRouter, createMemoryHistory } from 'vue-router'

import AppShell from '../src/layouts/AppShell.vue'
import BareLayout from '../src/layouts/BareLayout.vue'
import HelpTip from '../src/components/base/HelpTip.vue'
import SettingsMenu from '../src/components/base/SettingsMenu.vue'

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
    ['AppShell（带侧栏）', AppShell, undefined],
    ['BareLayout（无侧栏）', BareLayout, undefined],
    ['SettingsMenu 齿轮', SettingsMenu, undefined],
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

  // BareLayout 必须有一条通向应用首页的路。它是无侧栏的，
  // 这里要是没有出口，进来的人只能按浏览器后退
  const bare = results.find((r) => r.label.startsWith('BareLayout'))
  if (bare?.ok) {
    const hasExit = /href="\/"/.test(bare.html)
    results.push({
      ok: hasExit,
      label: 'BareLayout 有通向首页的出口',
      detail: hasExit ? '找到 href="/"' : '没有任何指向 / 的链接——这一页是死胡同'
    })
  }

  return results.map(({ html, ...rest }) => rest)
}
