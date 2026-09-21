/**
 * 间距档位自检。
 *
 *   npm run check:spacing
 *
 * spec/01 §2.2 规定间距只能取八档（4/8/12/16/24/32/48/64，即 --sp-1..8）。
 * 这条规则原先写的是「禁止出现档位以外的数值」，验证方式是「目视 + grep」。
 *
 * **两处都要改。**
 *
 * 一是「目视」——扫一遍 margin / padding / gap 的数值其实完全可以自动化，
 * 「没找到可靠办法」这个说法当时没有验证过。实测扫下来十处，零误报。
 *
 * 二是「禁止」这个词太绝对。十处里有八处是 1–3px 的次档间距：
 * 22px 高的徽章内边距、列表之间的发丝缝、文字与图标的光学对齐——
 * 八档从 4px 起步，对这些地方太粗了。它们是合理的例外，不是失误。
 *
 * 所以照 §2.3 处理字号的同一套办法：**档位以外的必须登记，没登记的才算失误**。
 * 登记表就在下面。加一条登记之前先问自己：这真的是「八档太粗」，
 * 还是「随手写了个数」？后者要改回令牌。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')

/** spec/01 §2.2 的八档。0 一律允许——它是「没有间距」，不是一个档位 */
const SCALE = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64])

/**
 * 登记在册的例外。键是 `文件:属性:数值`，值是理由。
 *
 * 理由要写「为什么八档不够用」，不是「这里就是这么写的」。
 * 写不出理由的，说明它是失误。
 */
const REGISTERED = {
  'components/base/HashText.vue:padding:2':
    '哈希槽只有 22px 高，4px 上下内边距会把等宽字挤到贴边',
  'components/base/StatusBadge.vue:padding:3':
    '徽章 22px 高，同上；3px 让 12px 的字上下留白相等',
  'components/base/FlashNotice.vue:margin-top:2':
    '对勾图标与第一行文字的基线对齐，纯光学值',
  'components/project/ProjectCard.vue:padding-top:3':
    '右上角摘要与 20px 标题的视觉基线对齐，纯光学值',
  'components/project/ProjectCard.vue:gap:2':
    '进度条内部三段之间的发丝缝，4px 会把短段挤没',
  'components/milestone/AwaitingYou.vue:padding:3':
    '与 StatusBadge 同高同内边距，两者常并排出现',
  'layouts/AppShell.vue:gap:2':
    '导航项之间的发丝缝。4px 会让三条导航看起来像三块独立的东西',
  'layouts/AppShell.vue:gap:1':
    '「最近项目」三行之间几乎不留缝，它是一组而不是三项',
  'views/DashboardView.vue:gap:1':
    '统计卡里数字、标签、注解三行是一体的，行距靠 line-height 而不是 gap',
  'styles/base.css:margin:-1':
    '.sr-only 的标准写法，配合 clip 把元素移出可视区。不是间距',
  'styles/base.css:margin-top:-5':
    '滑块把手垂直居中：(轨道 6 - 把手 16) / 2。是几何计算，不是间距'
}

const PROP = /(?<![-\w])((?:margin|padding|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline))?)\s*:\s*([^;{}]+);/g
const PX = /(-?\d+(?:\.\d+)?)px/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(vue|css)$/.test(entry.name)) out.push(full)
  }
  return out
}

let unregistered = 0
const seen = new Set()

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/')
  // 去注释：注释里写着「原先这里是 10px」是合理的记录
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')

  for (const m of text.matchAll(PROP)) {
    const prop = m[1]
    for (const n of m[2].matchAll(PX)) {
      const value = Number(n[1])
      if (SCALE.has(Math.abs(value))) continue

      const key = `${rel}:${prop}:${value}`
      seen.add(key)
      if (REGISTERED[key]) continue

      unregistered++
      console.log(`FAIL  ${key}`)
      console.log(`        不在 §2.2 的八档里，也没有登记。`)
      console.log('        要么改用 var(--sp-N)，要么在 check-spacing.mjs 的 REGISTERED 里写明为什么八档不够用。')
    }
  }
}

// 登记了却已经不存在的条目也要报出来：留着一条没人用的例外，
// 下次有人照抄它就多了一个没有理由的破例
const stale = Object.keys(REGISTERED).filter((k) => !seen.has(k))
for (const k of stale) {
  console.log(`WARN  ${k} 登记了但代码里已经没有了，可以从 REGISTERED 里删掉`)
}

console.log(
  unregistered === 0
    ? `\n间距全部落在八档里，或已登记（${Object.keys(REGISTERED).length - stale.length} 处例外）。`
    : `\n${unregistered} 处未登记的间距，见 spec/01 §2.2。`
)
process.exit(unregistered === 0 ? 0 : 1)
