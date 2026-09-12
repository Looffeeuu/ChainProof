/**
 * 配色对比度自检：按 WCAG 2.2 的相对亮度公式逐对计算。
 * 颜色不写死在本文件里，而是从 src/styles/tokens.css 解析出来——
 * 令牌改了脚本自动跟着改，不会出现「脚本说 PASS 但界面已经是另一套颜色」。
 *
 *   node scripts/check-contrast.mjs
 *
 * 依据：https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const tokensPath = join(here, '..', 'src', 'styles', 'tokens.css')

/**
 * 从 tokens.css 里抽出颜色令牌，**按主题分成两套**。
 *
 * tokens.css 现在用 `light-dark(亮, 暗)` 把两套值写在同一行（spec/01 §2.5），
 * 所以这里一条正则就能同时拿到两套，不需要再按大括号分块判断选择器。
 *
 * **这个正则是这份脚本最脆的地方。** 它认不出令牌写法时，
 * 解析结果是空对象，而空对象会让下面所有断言「没有令牌可测」——
 * 如果不显式拦一道，脚本会一路 PASS 到底并报告全部通过。
 * 一个假装在检查的脚本比没有脚本更危险，所以下面有一条哨兵。
 * 改 tokens.css 的令牌写法时，务必回来做一次反向验证：
 * 故意把某个颜色改成明显不达标的值，确认这里会报错。
 */
function readThemes(css) {
  const light = {}
  const dark = {}

  // 先去注释。tokens.css 的说明文字里就出现着 `--c-x: #hex;` 这样的示例
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')

  // 同时支持两种写法：
  //   --c-x: light-dark(#亮, #暗);
  //   --c-x: #hex;              （两套同值，目前没有这种，留着兜底）
  const RE = /(--c-[\w-]+)\s*:\s*(?:light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)|(#[0-9a-fA-F]{3,8}))\s*;/g

  for (const m of clean.matchAll(RE)) {
    if (m[2]) {
      light[m[1]] = m[2]
      dark[m[1]] = m[3]
    } else {
      light[m[1]] = m[4]
      dark[m[1]] = m[4]
    }
  }

  return { light, dark }
}

/** #rgb / #rrggbb → [r, g, b]，取值 0–255 */
function toRgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** WCAG 相对亮度：每个通道先归一化再做 sRGB 反伽马，最后按人眼敏感度加权 */
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 对比度 = (亮者 + 0.05) / (暗者 + 0.05)，取值 1–21 */
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const themes = readThemes(readFileSync(tokensPath, 'utf8'))

// 哨兵：解析不到令牌就直接失败，不要静默通过。
// tokens.css 现在有三十多个 --c-* 令牌，解析出来少于 20 个一定是正则失配了。
if (Object.keys(themes.light).length < 20) {
  console.error(
    `只从 tokens.css 解析到 ${Object.keys(themes.light).length} 个颜色令牌，` +
    '正则多半和令牌写法对不上了。先修 readThemes()，不要让这个脚本假装通过。'
  )
  process.exit(1)
}

// [说明, 前景令牌, 背景令牌, 需要达到的比值]
// 4.5 = SC 1.4.3 正文；3.0 = SC 1.4.11 非文本控件与边框
//
// 主色拆成了两个令牌（spec/01 §2.8.2），所以这里也要分开测：
// --c-primary 只当实心填充，测的是「白字压在上面」以及「按钮相对页面」；
// --c-primary-text 当文字，测的是「它在各种表面上读不读得清」。
const pairs = [
  ['正文 / 页面底色', '--c-text', '--c-bg', 4.5],
  ['正文 / 卡片', '--c-text', '--c-surface', 4.5],
  ['正文 / 弹层', '--c-text', '--c-raised', 4.5],
  ['正文 / 凹面', '--c-text', '--c-sunken', 4.5],
  ['次要文字 / 卡片', '--c-text-soft', '--c-surface', 4.5],
  ['次要文字 / 页面底色', '--c-text-soft', '--c-bg', 4.5],
  ['次要文字 / 凹面', '--c-text-soft', '--c-sunken', 4.5],
  ['次要文字 / 弹层', '--c-text-soft', '--c-raised', 4.5],
  ['主色文字 / 卡片', '--c-primary-text', '--c-surface', 4.5],
  ['主色文字 / 页面底色', '--c-primary-text', '--c-bg', 4.5],
  ['主色文字 / 主色浅底', '--c-primary-text', '--c-primary-weak', 4.5],
  // 压在实心主色上的文字必须有自己的令牌。
  // 这里原先写的是 --c-surface（拿"卡片白"当"白字"用），亮色下侥幸对，
  // 暗色下 --c-surface 是 #191919，等于拿深灰当白字，实测只有 3.27:1
  ['主按钮文字 / 主色填充', '--c-on-primary', '--c-primary', 4.5],
  ['主按钮填充 / 页面底色', '--c-primary', '--c-bg', 3.0],
  ['主按钮文字 / 主色悬停', '--c-on-primary', '--c-primary-hover', 4.5],
  // 存证色走的是细线与等宽文字，不是实心块，所以每一种它可能落在的表面都要测
  ['存证色 / 卡片', '--c-chain', '--c-surface', 4.5],
  ['存证色 / 页面底色', '--c-chain', '--c-bg', 4.5],
  ['存证色 / 凹面', '--c-chain', '--c-sunken', 4.5],
  ['存证色 / 存证浅底', '--c-chain', '--c-chain-weak', 4.5],
  ['人物色 1 文字/浅底', '--c-member-1', '--c-member-1-weak', 4.5],
  ['人物色 1 实心/卡片', '--c-member-1', '--c-surface', 3.0],
  ['人物色 2 文字/浅底', '--c-member-2', '--c-member-2-weak', 4.5],
  ['人物色 2 实心/卡片', '--c-member-2', '--c-surface', 3.0],
  ['人物色 3 文字/浅底', '--c-member-3', '--c-member-3-weak', 4.5],
  ['人物色 3 实心/卡片', '--c-member-3', '--c-surface', 3.0],
  ['人物色 4 文字/浅底', '--c-member-4', '--c-member-4-weak', 4.5],
  ['人物色 4 实心/卡片', '--c-member-4', '--c-surface', 3.0],
  ['VERIFIED 徽章 文字/底', '--c-verified', '--c-verified-bg', 4.5],
  ['PENDING 徽章 文字/底', '--c-pending', '--c-pending-bg', 4.5],
  ['REJECTED 徽章 文字/底', '--c-rejected', '--c-rejected-bg', 4.5],
  ['控件边框 / 卡片', '--c-border-strong', '--c-surface', 3.0],
  ['控件边框 / 页面底色', '--c-border-strong', '--c-bg', 3.0],
  ['控件边框 / 弹层', '--c-border-strong', '--c-raised', 3.0],
  ['控件边框 / 凹面', '--c-border-strong', '--c-sunken', 3.0],
  // 焦点环。SC 1.4.11 要求「识别控件所必需」的部分 ≥ 3:1，键盘焦点框算在内。
  // 它可能落在任何一种表面上——按钮多半在卡片上，弹层里的按钮在弹层上，
  // 徽章附近的链接在徽章底上，所以八种表面全测。
  ['焦点环 / 页面底色', '--c-focus', '--c-bg', 3.0],
  ['焦点环 / 凹面', '--c-focus', '--c-sunken', 3.0],
  ['焦点环 / 卡片', '--c-focus', '--c-surface', 3.0],
  ['焦点环 / 弹层', '--c-focus', '--c-raised', 3.0],
  ['焦点环 / 主色浅底', '--c-focus', '--c-primary-weak', 3.0],
  ['焦点环 / VERIFIED 底', '--c-focus', '--c-verified-bg', 3.0],
  ['焦点环 / PENDING 底', '--c-focus', '--c-pending-bg', 3.0],
  ['焦点环 / REJECTED 底', '--c-focus', '--c-rejected-bg', 3.0]
]

const pad = (s, n) =>
  s + ' '.repeat(Math.max(0, n - [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)))

let failed = 0

for (const [themeName, t] of [['亮色', themes.light], ['暗色', themes.dark]]) {
  console.log(`—— ${themeName} ——`)
  for (const [label, fg, bg, need] of pairs) {
    const missing = [fg, bg].filter((k) => !t[k])
    if (missing.length) {
      console.log(`${pad(label, 24)} 令牌缺失：${missing.join(' ')}`)
      failed++
      continue
    }
    const r = ratio(t[fg], t[bg])
    const ok = r >= need
    if (!ok) failed++
    console.log(
      `${pad(label, 24)} ${t[fg]} on ${t[bg]} = ${r.toFixed(2).padStart(5)}:1 ` +
      `(需 ${need.toFixed(1)}) ${ok ? 'PASS' : 'FAIL'}`
    )
  }
  console.log('')
}

/**
 * 第二件事：tokens.css 之外不许出现字面量颜色（spec/01 §2.5）。
 *
 * 规范里一直写着「这条由 check:contrast 负责」，但脚本从来没有真的做过——
 * 于是这条规则实际上只靠自觉。补上：扫全部 .vue 与 .css，
 * 命中十六进制、rgb()、hsl() 与具名颜色就报错。
 *
 * 三处例外，都不是「界面颜色」：
 *   - tokens.css 自己，它就是唯一的颜色出处
 *   - `transparent` / `currentColor` / `inherit`，它们不携带具体颜色
 *   - 投影里的 rgba(黑或近黑, 透明度)：投影是「一层暗」不是「一个颜色」，
 *     而且它只写在 tokens.css 里，这里只是兜底
 */
const SRC = join(here, '..', 'src')
const NAMED = /(?:^|[\s:(,])(red|blue|green|black|white|gray|grey|orange|purple|pink|yellow|cyan|magenta|silver|navy|teal|olive|maroon|lime|aqua|fuchsia)(?=[\s;,)]|$)/i
const HEXY = /#[0-9a-fA-F]{3,8}/
const FUNCY = /(?:rgba?|hsla?|oklch|lab|color-mix)\s*\(/

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (/\.(vue|css)$/.test(e.name) && !full.endsWith(join('styles', 'tokens.css'))) out.push(full)
  }
  return out
}

let literals = 0
for (const file of walk(SRC)) {
  // 去掉注释：注释里出现 #2b52d8 这种「解释为什么不用它」的说明是合理的
  const text = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  text.split(/\r?\n/).forEach((line, i) => {
    // data:image/svg+xml 里的 %23xxxxxx 是图标描边色，走 currentColor 改不了，
    // 但工程里目前没有这种写法；真出现了应该报出来，所以不放过
    if (!HEXY.test(line) && !FUNCY.test(line) && !NAMED.test(line)) return
    if (/currentColor|transparent|inherit/.test(line) && !HEXY.test(line) && !FUNCY.test(line)) return
    literals++
    console.log(`字面量颜色  ${file.slice(SRC.length + 1)}:${i + 1}  ${line.trim()}`)
  })
}
console.log(literals === 0 ? 'tokens.css 之外没有字面量颜色。' : `${literals} 处字面量颜色，应改用令牌。`)
console.log('')

const bad = failed + literals
console.log(bad === 0 ? '两套主题全部通过。' : `${bad} 项不达标。`)
process.exit(bad === 0 ? 0 : 1)
