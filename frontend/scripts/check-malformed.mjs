/**
 * 跑 render-malformed.entry.js 的结果并汇报。
 *   npm run check:malformed
 *
 * 判据只有一条：**没抛错**。渲染函数一抛错整个应用挂不上去，
 * 那不是「少显示一行」，是白屏。内容对不对由 check:screens 管。
 *
 * 输出按组件归并——一个组件几十个变体，全绿时没必要刷几十行。
 */
import { run } from '../dist-ssr/malformed/render-malformed.entry.js'

const results = await run()
const failed = results.filter((r) => !r.ok)

const byComponent = new Map()
for (const r of results) {
  if (!byComponent.has(r.component)) byComponent.set(r.component, [])
  byComponent.get(r.component).push(r)
}

for (const [component, rows] of byComponent) {
  const bad = rows.filter((r) => !r.ok)
  if (bad.length === 0) {
    console.log(`OK    ${component.padEnd(24)} ${rows.length} 个畸形变体都渲染出来了`)
    continue
  }
  console.log(`FAIL  ${component.padEnd(24)} ${bad.length}/${rows.length} 个变体抛错`)
  for (const r of bad) console.log(`        ${r.label} —— ${r.detail}`)
}

console.log(
  failed.length === 0
    ? `\n${results.length} 个畸形变体，没有一个把渲染搞崩。`
    : `\n${failed.length} 个变体会让页面白屏。`
)
process.exit(failed.length === 0 ? 0 : 1)
