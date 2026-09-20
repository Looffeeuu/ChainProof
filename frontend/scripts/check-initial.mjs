/**
 * 跑 render-initial.entry.js 的结果并汇报。
 *
 *   npm run check:initial
 *
 * 判据只有一条：每个页面在「数据还没到」的状态下都要能渲染出来，不许抛错。
 * 抛错 = 浏览器里白屏。
 */
import { run } from '../dist-ssr/initial/render-initial.entry.js'

const results = await run()
const failed = results.filter((r) => !r.ok)

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label.padEnd(26)} ${r.detail}`)
}

console.log(`\n${results.length} 个页面的首屏，${failed.length} 个不通过。`)

if (failed.length) {
  console.log('\n抛错就是浏览器里的白屏。多半是模板在 data 还是 null 时就读了它的属性——')
  console.log('检查这一页的 AsyncSection 的 empty 判断，null 时应当为真。')
  process.exit(1)
}
