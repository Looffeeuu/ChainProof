/**
 * 时间显示。纯函数，不 import 本项目任何模块（spec/02 §1.2 规则 4）。
 * 接口给的都是 ISO 8601 字符串（spec/02 §2.1），展示前一律过这里。
 */

/**
 * 2026-09-09T06:22:00.000Z → 2026-09-09 14:22（按浏览器本地时区）
 *
 * 不用 toLocaleString 的默认格式：它在不同系统上给出的样子不一样
 * （有的是 2026/9/9 下午2:22），演示时截图对不上。这里手动拼，结果稳定。
 *
 * @param {string} iso
 * @returns {string} 解析失败时返回空串，不返回 "Invalid Date"
 */
export function formatDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 只要日期那一段：2026-09-09 */
export function formatDate(iso) {
  return formatDateTime(iso).slice(0, 10)
}

/**
 * 相对时间：3 分钟前 / 2 小时前 / 3 天前。超过 30 天回落成绝对日期——
 * 「247 天前」这种说法反而要读者自己换算。
 *
 * @param {string} iso
 * @param {Date} [now] 传入固定的「现在」便于测试
 */
export function formatRelative(iso, now = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)} 小时前`
  if (diffMin < 60 * 24 * 30) return `${Math.floor(diffMin / (60 * 24))} 天前`
  return formatDate(iso)
}
