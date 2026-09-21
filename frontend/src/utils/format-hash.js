/**
 * 哈希与 ID 的显示格式。纯函数，不 import 本项目任何模块（spec/02 §1.2 规则 4）。
 */

/**
 * 中间省略，保留首尾各 keep 位：
 *   84a8d6e4…74cbcccf
 *
 * 为什么保留首尾而不是只截右边：人核对哈希时看的就是头和尾，
 * 只截右边等于没法核对（前 8 位相同的两个哈希看起来会一模一样）。
 * 依据见 spec/01 §1 里区块浏览器的通行做法。
 *
 * 短于 keep*2+1 的字符串原样返回——截了反而更长的情况不截。
 *
 * @param {string} value 完整哈希
 * @param {number} [keep] 首尾各保留几位
 * @returns {string}
 */
export function truncateHash(value, keep = 8) {
  if (typeof value !== 'string') return ''
  if (value.length <= keep * 2 + 1) return value
  return `${value.slice(0, keep)}…${value.slice(-keep)}`
}

/**
 * 每 8 位断一次，用于详情页里独占一行的完整哈希。
 * 64 个连续字符没有落点，肉眼逐位比对会串行；分组后可以按组比。
 *
 * @param {string} value
 * @param {number} [group]
 * @returns {string}
 */
export function groupHash(value, group = 8) {
  if (typeof value !== 'string') return ''
  return value.replace(new RegExp(`(.{${group}})`, 'g'), '$1 ').trim()
}
