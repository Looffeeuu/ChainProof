/**
 * 配色对比度自检：按 WCAG 2.2 的相对亮度公式逐对计算。
 * 颜色不写死在本文件里，而是从 src/styles/tokens.css 解析出来——
 * 令牌改了脚本自动跟着改，不会出现「脚本说 PASS 但界面已经是另一套颜色」。
 *
 *   node scripts/check-contrast.mjs
 *
 * 依据：https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const tokensPath = join(here, '..', 'src', 'styles', 'tokens.css')

/**
 * 从 tokens.css 里抽出颜色令牌，**按主题分成两套**。
 *
 * 不能平铺成一个对象：tokens.css 里亮暗两套用的是同名令牌，
 * 平铺的话后出现的暗色会把亮色覆盖掉，脚本就只测了暗色，
 * 亮色那一套悄悄失去覆盖——而且还是 PASS，看不出来。
 *
 * 做法是按大括号切块：`:root { … }` 那块是亮色基线，
 * 块选择器里带 `data-theme='dark'` 或处在 prefers-color-scheme: dark 里的是暗色。
 * 暗色以亮色为底再覆盖，因为暗色块只重定义了一部分令牌（间距、字体没有两套）。
 */
function readThemes(css) {
  const light = {}
  const dark = {}

  // 先把 CSS 注释去掉。tokens.css 的头部注释里就写着 :root[data-theme='dark']
  // 这样的说明文字，不去掉的话它会被当成选择器，
  // 把紧跟其后的**亮色**块误判成暗色块——结果亮色一个令牌都解析不到。
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')

  // 逐个 { … } 块地看，记下它前面那段选择器文本
  for (const m of clean.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1]
    const body = m[2]
    const vars = {}
    for (const v of body.matchAll(/(--c-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      vars[v[1]] = v[2]
    }
    if (Object.keys(vars).length === 0) continue

    const isDark = /data-theme=['"]dark['"]/.test(selector) || /not\(\[data-theme=['"]light['"]\]\)/.test(selector)
    Object.assign(isDark ? dark : light, vars)
  }

  // 暗色只重定义了一部分，缺的沿用亮色
  return { light, dark: { ...light, ...dark } }
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
  ['次要文字 / 卡片', '--c-text-soft', '--c-surface', 4.5],
  ['次要文字 / 页面底色', '--c-text-soft', '--c-bg', 4.5],
  ['主色文字 / 卡片', '--c-primary-text', '--c-surface', 4.5],
  ['主色文字 / 页面底色', '--c-primary-text', '--c-bg', 4.5],
  ['主色文字 / 主色浅底', '--c-primary-text', '--c-primary-weak', 4.5],
  // 压在实心主色上的文字必须有自己的令牌。
  // 这里原先写的是 --c-surface（拿"卡片白"当"白字"用），亮色下侥幸对，
  // 暗色下 --c-surface 是 #191919，等于拿深灰当白字，实测只有 3.27:1
  ['主按钮文字 / 主色填充', '--c-on-primary', '--c-primary', 4.5],
  ['主按钮填充 / 页面底色', '--c-primary', '--c-bg', 3.0],
  ['VERIFIED 徽章 文字/底', '--c-verified', '--c-verified-bg', 4.5],
  ['PENDING 徽章 文字/底', '--c-pending', '--c-pending-bg', 4.5],
  ['REJECTED 徽章 文字/底', '--c-rejected', '--c-rejected-bg', 4.5],
  ['控件边框 / 卡片', '--c-border-strong', '--c-surface', 3.0],
  ['控件边框 / 页面底色', '--c-border-strong', '--c-bg', 3.0],
  ['控件边框 / 弹层', '--c-border-strong', '--c-raised', 3.0]
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

console.log(failed === 0 ? '两套主题全部通过。' : `${failed} 项不达标。`)
process.exit(failed === 0 ? 0 : 1)
