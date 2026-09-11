/**
 * 百分比计算。纯函数，不 import 本项目任何模块（spec/02 §1.2 规则 4）。
 *
 * spec/02 §2.5 规定 percentage 一律按整数处理，而「把几个数按比例缩放到总和 100」
 * 这件事一旦四舍五入就会出问题：44.4 / 30.6 / 25.0 各自取整是 44 / 31 / 25 = 100 还好，
 * 换一组就可能得到 101 或 99——界面上显示「总和 101%」，而它本该是恒等于 100 的。
 */

/**
 * 最大余数法（largest remainder method）：先给每个数取下整，
 * 剩下的名额按小数部分从大到小依次分配。结果保证是整数且总和恰好等于 total。
 *
 * 这是分配议席的经典算法，用在这里的理由一样——
 * 要把一个固定的总量拆成整数份，且拆完必须还是那个总量。
 *
 * @param {number[]} weights 任意非负权重，不需要预先归一化
 * @param {number} [total] 目标总和
 * @returns {number[]} 与 weights 等长的整数数组，和为 total（weights 全为 0 时返回全 0）
 */
export function largestRemainder(weights, total = 100) {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) return weights.map(() => 0)

  const exact = weights.map((w) => (w / sum) * total)
  const floors = exact.map(Math.floor)
  let rest = total - floors.reduce((a, b) => a + b, 0)

  // 按小数部分从大到小排，把剩下的名额一个一个发出去
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floors]
  for (let i = 0; rest > 0; i = (i + 1) % order.length) {
    result[order[i].index] += 1
    rest -= 1
  }
  return result
}

/**
 * 整数相加求和。不做浮点比较——spec/02 §2.5 第 1 条：
 * 用小数会出现「界面显示 100% 但提交被拒」。
 *
 * @param {{percentage: number}[]} contributors
 * @returns {number}
 */
export function sumPercentages(contributors) {
  return (contributors ?? []).reduce((sum, c) => sum + (Number(c.percentage) || 0), 0)
}

/**
 * 把用户输入的任意内容收成 0–100 的整数。
 *
 * 数字输入框拦不住的东西比想象中多：粘贴进来的 "33.7"、"-5"、"1e3"、
 * 全角数字、空字符串。`type="number"` 只管住了键盘直接敲的部分。
 * 所以取值一律过这个函数，而不是相信控件。
 *
 * 抽成纯函数是为了能单独测——它在组件里的话，
 * 「粘贴一个负数会怎样」这种情况只能靠手点。
 *
 * @param {unknown} raw
 * @returns {number} 0–100 的整数；无法解析时返回 0
 */
export function clampPercentage(raw) {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}
