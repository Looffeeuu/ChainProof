/**
 * 路由自检：把一串地址交给 vue-router 自己去匹配，打印每个地址落到了哪条路由。
 *
 *   node scripts/check-routes.mjs
 *
 * 为什么要有它：路由表最容易出的两个错——兜底 `/:pathMatch(.*)*` 的位置放错，
 * 把后面的路由全吃掉；以及 `/projects/new` 被 `/projects/:id` 抢走匹配成 id="new"。
 * 这两种错都不会让构建失败，只会在演示时点开一个空页面。
 *
 * 路径与名字从 src/router/index.js 的源码里解析，不在这里抄第二份；
 * 匹配交给真正的 vue-router 做，所以「谁抢了谁」的结论是可信的。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRouter, createMemoryHistory } from 'vue-router'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'src', 'router', 'index.js'), 'utf8')

// 逐个抓 `path: '...'` 与紧随其后的 `name: '...'`，顺序与源码一致。
// 顺序很重要：vue-router 的匹配依赖路由表的书写顺序。
const routes = [...src.matchAll(/path:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)'/g)].map(
  ([, path, name]) => ({ path, name, component: { render: () => null } })
)

if (routes.length === 0) {
  console.error('没有从 router/index.js 解析出任何路由，检查一下正则和源码格式是否对得上。')
  process.exit(1)
}

const router = createRouter({ history: createMemoryHistory(), routes })

// [要访问的地址, 期望命中的路由名]
const cases = [
  ['/', 'dashboard'],
  ['/projects', 'project-list'],
  ['/projects/new', 'project-create'],
  ['/projects/p-001', 'project-detail'],
  ['/projects/p-001/milestones/new', 'milestone-create'],
  ['/milestones/m-001', 'milestone-confirm'],
  ['/certificates/c-001', 'certificate'],
  ['/verify', 'verify'],
  ['/verify/c-001', 'verify'],
  ['/dev/components', 'dev-components'],
  ['/nope/nope', 'not-found']
]

let failed = 0
console.log(`从 router/index.js 解析出 ${routes.length} 条路由\n`)

for (const [url, expect] of cases) {
  const r = router.resolve(url)
  const ok = r.name === expect
  if (!ok) failed++
  const params = Object.keys(r.params).length ? `  params=${JSON.stringify(r.params)}` : ''
  console.log(`${url.padEnd(32)} → ${String(r.name).padEnd(18)}${ok ? 'OK  ' : `期望 ${expect}  FAIL`}${params}`)
}

console.log(failed === 0 ? '\n全部命中。' : `\n${failed} 条没命中期望的路由。`)
process.exit(failed === 0 ? 0 : 1)
