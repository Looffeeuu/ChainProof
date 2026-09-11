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

/** 从 tokens.css 里抽出 `--c-*: #rrggbb` 形式的颜色令牌 */
function readTokens(css) {
  const out = {}
  for (const m of css.matchAll(/(--c-[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2]
  }
  return out
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

const t = readTokens(readFileSync(tokensPath, 'utf8'))

// [说明, 前景令牌, 背景令牌, 需要达到的比值]
// 4.5 = SC 1.4.3 正文；3.0 = SC 1.4.11 非文本控件边框
const pairs = [
  ['正文 text / 页面底色 bg', '--c-text', '--c-bg', 4.5],
  ['正文 text / 卡片 surface', '--c-text', '--c-surface', 4.5],
  ['次要文字 textSoft / surface', '--c-text-soft', '--c-surface', 4.5],
  ['次要文字 textSoft / bg', '--c-text-soft', '--c-bg', 4.5],
  ['主色文字 primary / surface', '--c-primary', '--c-surface', 4.5],
  ['主按钮文字 白 / primary', '--c-surface', '--c-primary', 4.5],
  ['主色 primary / 浅底 primaryWeak', '--c-primary', '--c-primary-weak', 4.5],
  ['VERIFIED 徽章 文字/底', '--c-verified', '--c-verified-bg', 4.5],
  ['PENDING 徽章 文字/底', '--c-pending', '--c-pending-bg', 4.5],
  ['REJECTED 徽章 文字/底', '--c-rejected', '--c-rejected-bg', 4.5],
  ['控件边框 borderStrong / surface', '--c-border-strong', '--c-surface', 3.0],
  ['控件边框 borderStrong / bg', '--c-border-strong', '--c-bg', 3.0]
]

let failed = 0
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)))

for (const [label, fg, bg, need] of pairs) {
  const missing = [fg, bg].filter((k) => !t[k])
  if (missing.length) {
    console.log(`${pad(label, 36)} 令牌缺失：${missing.join(' ')}`)
    failed++
    continue
  }
  const r = ratio(t[fg], t[bg])
  const ok = r >= need
  if (!ok) failed++
  console.log(
    `${pad(label, 36)} ${t[fg]} on ${t[bg]} = ${r.toFixed(2).padStart(5)}:1 ` +
    `(需 ${need.toFixed(1)}:1) ${ok ? 'PASS' : 'FAIL'}`
  )
}

console.log(failed === 0 ? '\n全部通过。' : `\n${failed} 项不达标。`)
process.exit(failed === 0 ? 0 : 1)
