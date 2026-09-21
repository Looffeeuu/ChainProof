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

const utf8 = new TextEncoder()

/**
 * 按 UTF-8 无符号字节序比较两个字符串。`docs/API.md` §4 规定 memberId 的排序与平局
 * 都用这个顺序，链码那边是 `Buffer.compare()`。
 *
 * **不能用 `<` 代替。** JS 的 `<` 比的是 UTF-16 码元，遇到 BMP 以外的字符（emoji 等）
 * 与 U+E000–U+FFFF 之间的字符时，两者的先后是反的。也不能用 `localeCompare()`，
 * 它的结果随运行环境的区域设置变化。
 *
 * @returns {number} 负数 / 0 / 正数
 */
export function compareUtf8(a, b) {
  const x = utf8.encode(String(a))
  const y = utf8.encode(String(b))
  const n = Math.min(x.length, y.length)
  for (let i = 0; i < n; i++) {
    if (x[i] !== y[i]) return x[i] - y[i]
  }
  return x.length - y.length
}

/**
 * 累计贡献比例，**逐字照 `docs/API.md` §4（PR #9 定稿）实现**，
 * 链码与后端按同一算法，三处对同一组数据必须给出同一组数。
 *
 * 1. N = 已验证里程碑条数。N = 0 时全员 0，不做除法。
 * 2. 每人 sum = 他在全部已验证里程碑里 percentage 之和，没参与的那条计 0。
 * 3. floor = sum div N，remainder = sum mod N，**全程整数**。
 *    不要改成 sum / N 再取小数部分：浮点余数会把本该相等的余数算成不等，
 *    平局规则就不生效了（实例：199/3、100/3、1/3 的浮点小数部分三个都不相等）。
 * 4. 剩下的 100 − Σfloor 个百分点按 remainder 从大到小发，平局按 memberId 字节序。
 *
 * 和上面的 largestRemainder 不是一回事：那个是提交页「平均分配」用的通用工具，
 * 不受契约约束；**累计比例只准用这一个**。
 *
 * @param {string[]} memberIds 项目全部成员，0% 的也在结果里
 * @param {{contributors: {memberId:string, percentage:number}[]}[]} verified 已验证的里程碑
 * @returns {{memberId:string, percentage:number}[]} 按 memberId 字节序排列
 */
export function contributionShares(memberIds, verified) {
  const n = verified.length
  const rows = [...new Set(memberIds)].sort(compareUtf8).map((memberId) => {
    let sum = 0
    for (const m of verified) {
      for (const c of m.contributors ?? []) {
        if (c.memberId === memberId) sum += c.percentage
      }
    }
    return { memberId, sum }
  })

  if (n === 0) return rows.map(({ memberId }) => ({ memberId, percentage: 0 }))

  const result = rows.map((r) => {
    const remainder = r.sum % n
    // (sum − remainder) / N 恰好整除，结果就是 sum div N，中间不经过任何舍入
    return { memberId: r.memberId, percentage: (r.sum - remainder) / n, remainder }
  })
  let rest = 100 - result.reduce((a, r) => a + r.percentage, 0)
  const order = [...result].sort(
    (a, b) => b.remainder - a.remainder || compareUtf8(a.memberId, b.memberId)
  )
  for (let i = 0; rest > 0 && i < order.length; i++, rest--) order[i].percentage += 1

  return result.map(({ memberId, percentage }) => ({ memberId, percentage }))
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
