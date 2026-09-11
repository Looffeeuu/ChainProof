/**
 * 跑 render-shell.entry.js 的结果并汇报。
 *   npm run check:shell
 */
import { run } from '../dist-ssr/shell/render-shell.entry.js'

const results = await run()
const failed = results.filter((r) => !r.ok)

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label.padEnd(26)} ${r.detail}`)
}

console.log(`\n${results.length} 项，${failed.length} 项不通过。`)
if (failed.length) process.exit(1)
