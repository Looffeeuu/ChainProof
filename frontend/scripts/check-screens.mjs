/**
 * 页面自检：确认项目卡片与创建表单渲染出了预期的内容。
 *
 *   npm run check:screens
 *
 * 和 check-components.mjs 同一套做法（服务端渲染成字符串再找标志），
 * 区别是这里检查的是**业务规则的呈现**：
 * 三种项目状态各自说了什么、空描述有没有兜底、表单的必填校验起没起作用。
 *
 * 依赖 dist-ssr/ 下的构建产物，所以 npm 脚本里先 build 再跑本文件。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const bundle = join(here, '..', 'dist-ssr', 'screens', 'render-screens.entry.js')

if (!existsSync(bundle)) {
  console.error('没有找到 dist-ssr/render-screens.entry.js，先跑：')
  console.error('  npx vite build --ssr scripts/render-screens.entry.js --outDir dist-ssr/screens')
  process.exit(1)
}

const render = (await import(pathToFileURL(bundle).href)).default
const html = await render()
const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

/** 明细表那一块的作用域：从它给读屏的 caption 开始，到这张表结束 */
const BREAKDOWN = /<caption[^>]*>每条已验证里程碑上各成员声明的贡献比例[\s\S]*?<\/table>/

const expectations = [
  ['三个项目的卡片都渲染了', ['VLA 安全性基准测试', '课程实验报告归档', '答辩演示脚本']],
  ['有待确认时，摘要说清还剩几条', ['◐ 1 条待确认']],
  ['全部通过时说「全部已验证」', ['● 全部已验证']],
  ['一条里程碑都没有时说「尚无里程碑」', ['○ 尚无里程碑']],
  ['描述为空的项目有兜底文案，不是一片空白', ['这个项目还没有填写描述。']],
  ['里程碑计数按项目分别统计', ['4 个里程碑 · 2 个已验证', '1 个里程碑 · 1 个已验证', '0 个里程碑 · 0 个已验证']],
  ['卡片链接指向对应的详情页', [/href="\/projects\/P001"/, /href="\/projects\/P003"/]],
  ['成员头像组对读屏可读，不只是几个圆圈', ['成员：alice、bob、charlie']],
  // —— Timeline（FE-7）——
  ['Timeline 倒序排列，最新的一条在最上面', [/基准测试集 v0\.3 与评测脚本[\s\S]*选题报告与分工方案/]],
  ['三种里程碑状态在 Timeline 上都渲染了', ['● 链上已验证', '◐ 待确认', '✕ 已拒绝']],
  ['待确认的那条显示确认进度分数', ['2/3 已确认']],
  ['全员确认的那条显示满分', ['3/3 已确认']],
  ['被拒绝的那条不显示分数，改说几人拒绝', ['1 人拒绝']],
  ['每行都有截断后的哈希', ['9f2c4b7a…6f970a4b', '84a8d6e4…74cbcccf']],
  ['每行都有可读的时间', [/2026-09-0\d \d{2}:\d{2}/]],
  ['每行都能进入确认页', [/href="\/milestones\/M004"/, /href="\/milestones\/M001"/]],
  ['贡献比例横条按比例分段', [/width:44%/, /width:31%/, /width:25%/]],
  ['比例对读屏可读，不只是一条彩色横条', [/aria-label="alice 44%，bob 31%，charlie 25%"/]],
  ['说明了比例只算已验证的里程碑', ['基于 2 个已验证里程碑']],

  // —— 比例分配器（FE-8）——
  ['总和不足时说清还差多少', ['还差 3%']],
  ['总和刚好时明确说「刚好」', ['刚好']],
  ['总和超出时说清超出多少', ['超出 15%']],
  ['每人一个滑块，且滑块对读屏可读', [/type="range"[^>]*aria-label="alice 的贡献比例"/]],
  ['每人一个数字框，按整数走（step=1）', [/type="number"[^>]*step="1"/]],
  ['数字框开了等宽数字，几行数字能对齐', [/class="t-nums"[^>]*type="number"|type="number"[^>]*class="t-nums"/]],
  ['有「平均分配」的快捷入口', ['平均分配']],
  ['总和刚好时，补差额的按钮是禁用的', [/disabled[^>]*>\s*补 0%\s*</]],
  ['补差额的按钮有说得通的文字，不是光一个「+8」', [/>\s*补 \d+%\s*<|>\s*减 \d+%\s*<|>\s*补 0%\s*</]],
  ['补差额的按钮对读屏说得清它会干什么', [/aria-label="把[^"]*记到 alice 头上"/]],
  ['分配器的总和是活区域，变了会播报', [/class="bar-head"[^>]*aria-live="polite"|aria-live="polite"[^>]*class="bar-head"/]],

  // —— 贡献统计面板（FE-10）。作用域限定在明细表那张表里 ——
  [
    '明细表列出了两条已验证的里程碑',
    ['选题报告与分工方案', '数据标注规范与 200 条样本'],
    BREAKDOWN
  ],
  [
    '明细表不列待确认与已拒绝的里程碑',
    [{ absent: '初版评测指标与权重' }, { absent: '基准测试集 v0.3 与评测脚本' }],
    BREAKDOWN
  ],
  ['给出各条相加的原始和，说明累计比例的来历', ['各条相加', '88%', '61%', '51%'], BREAKDOWN],
  ['明细表的列顺序与累计比例一致', [/alice[\s\S]*bob[\s\S]*charlie/], BREAKDOWN],
  ['没有已验证里程碑时，说清比例为什么是空的', ['还没有可统计的贡献比例。']],

  // —— 贡献确认页（FE-9）——
  ['声明表列出了每个人的比例', ['50%', '30%', '20%']],
  ['已表态的人显示徽章', ['● 已确认']],
  ['没表态的人明写「等待中」，不是留空', ['等待中']],
  ['当前身份那一行标了「你」', [/is-me/, />你</]],
  ['表格有给读屏的说明', ['这份声明里每位成员的贡献比例与表态情况']],

  // —— 证书页与公开验证页（FE-11）——
  ['证书写清了是谁、在哪个项目、占多少', ['alice', 'VLA 安全性基准测试', '44']],
  ['证书说明了这个比例的依据', ['该比例依据下列 2 条已通过全体成员确认的里程碑计算得出。']],
  ['证书列出了涵盖的里程碑编号', ['M001', 'M002']],
  ['证书印了可自行核验的地址', ['http://localhost:5173/verify/CERT-P001-ALICE']],
  ['打印时不进纸的部分标了 data-print', [/data-print="hide"/]],
  ['验证页有输入框和验证按钮', ['证书编号', '验证']],
  ['验证页说明了不需要登录', ['不需要登录']],

  // —— 创建表单（FE-6）——
  ['创建表单三个字段都在', ['项目名称', '项目描述', '成员']],
  ['必填字段有标记，且读屏能听到「必填」', ['必填']],
  ['标签与控件用 for/id 关联', [/<label for="([^"]+)"[\s\S]*?id="\1"/]],
  ['名称为空时提交按钮是禁用的（前端先拦一道）', [/type="submit"[^>]*disabled/]],
  ['描述有字数计数', ['0 / 200']],
  ['负责人默认勾选且不能取消', [/type="checkbox"[^>]*checked[^>]*disabled|type="checkbox"[^>]*disabled[^>]*checked/]]
]

/**
 * 每条期望是 [说明, 标志们, 作用域正则?]。标志有三种写法：
 *   '文字'          —— 纯文本里必须出现
 *   /正则/          —— 原始 HTML 里必须匹配
 *   { absent: 'x' } —— 必须**不**出现（用于「这里不该有某样东西」）
 *
 * 第三个参数把检查限制在文档的一小块里。没有它的话，
 * 「明细表里不该出现被拒绝的里程碑」这种断言没法写——
 * 同一个标题在页面别处（时间线）是应该出现的。
 */
let failed = 0
for (const [label, needles, scope] of expectations) {
  const slice = scope ? (html.match(scope)?.[0] ?? '') : html
  const sliceText = slice.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

  if (scope && !slice) {
    failed++
    console.log(`FAIL  ${label}\n        作用域正则没匹配到任何内容：${scope}`)
    continue
  }

  const problems = []
  for (const n of needles) {
    if (typeof n === 'string') {
      if (!sliceText.includes(n)) problems.push(`缺：${n}`)
    } else if (n instanceof RegExp) {
      if (!n.test(slice)) problems.push(`缺：${n}`)
    } else if (n && n.absent !== undefined) {
      if (sliceText.includes(n.absent)) problems.push(`不该出现却出现了：${n.absent}`)
    }
  }

  if (problems.length) {
    failed++
    console.log(`FAIL  ${label}`)
    for (const p of problems) console.log(`        ${p}`)
  } else {
    console.log(`OK    ${label}`)
  }
}

console.log(`\n渲染出 ${html.length} 字符，${expectations.length} 项检查，${failed} 项不通过。`)
process.exit(failed === 0 ? 0 : 1)
