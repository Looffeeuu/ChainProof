/**
 * 基础组件自检：在没有浏览器的环境里确认组件真的渲染出了预期的内容。
 *
 *   npm run check:components
 *
 * 做法是把 /dev/components 那一页用 Vue 的服务端渲染跑成 HTML 字符串，
 * 再在字符串里找几处「改坏了就一定会消失」的标志。
 *
 * 它检查的是**内容**不是外观：徽章有没有文字、哈希是不是首尾各 8 位、
 * 未知状态有没有被吞掉。外观仍然要靠浏览器看，这个脚本替代不了。
 *
 * 依赖 dist-ssr/ 下的构建产物，所以 npm 脚本里先 build 再跑本文件。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, '..', 'dist-ssr', 'components', 'render-components.entry.js')

if (!existsSync(bundle)) {
  console.error('没有找到 dist-ssr/render-components.entry.js，先跑：')
  console.error('  npx vite build --ssr scripts/render-components.entry.js --outDir dist-ssr/components')
  process.exit(1)
}

const render = (await import(pathToFileURL(bundle).href)).default
const html = await render()
const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

// [说明, 必须出现的片段]
const expectations = [
  ['三级按钮都在', ['主按钮', '次按钮', '文字按钮']],
  ['加载中按钮换了文案', ['提交中…']],
  ['加载中按钮被禁用', [/<button[^>]*disabled[^>]*aria-busy="true"/]],
  ['徽章带符号 + 文字，三种里程碑状态齐全', [
    '● 链上已验证', '◐ 待确认', '✕ 已拒绝'
  ]],
  ['清单外的状态原样显示，没被吞掉', ['○ SOMETHING_NEW']],
  ['哈希中间省略、首尾各 8 位', ['84a8d6e4…74cbcccf']],
  ['完整哈希每 8 位断开', ['84a8d6e4 b1c2f309 45ac77e0']],
  ['完整值放进了 title，悬停可见', [
    /title="84a8d6e4b1c2f30945ac77e0d3915bb27f4e6a18cd90b2e1a3746cf074cbcccf"/
  ]],
  ['复制按钮有无障碍标签', [/aria-label="复制文件哈希"/]],
  ['空状态说明了「将会出现什么」并给了行动', [
    '这个项目还没有里程碑', '它会以时间线的形式出现在这里', '提交里程碑'
  ]],
  ['错误信息原样显示，没被替换成通用文案', ['贡献比例总和是 97%，还差 3%。']],
  ['错误码单独给出', ['INVALID_PERCENTAGE_SUM']],
  ['错误块对读屏可见', [/role="alert"/]],
  ['spinner 在减少动效时不会被冻住', [/data-motion="essential"/]]
]

let failed = 0
for (const [label, needles] of expectations) {
  const missing = needles.filter((n) =>
    typeof n === 'string' ? !text.includes(n) : !n.test(html)
  )
  if (missing.length) {
    failed++
    console.log(`FAIL  ${label}`)
    for (const m of missing) console.log(`        缺：${m}`)
  } else {
    console.log(`OK    ${label}`)
  }
}

console.log(`\n渲染出 ${html.length} 字符，${expectations.length} 项检查，${failed} 项不通过。`)
process.exit(failed === 0 ? 0 : 1)
