/**
 * Certificate 的字段判据。纯函数，不 import 本项目任何模块。
 *
 * **一份表，两处用**：`api/certificates.js` 用它校验公开验证的响应，
 * `check:data` 用它盯住「这张表覆盖了 docs/API.md §6 的每一个字段」。
 *
 * 为什么要抽出来：PR #13 的第二轮 review 抓到一处——注释里写「六项事实齐全」，
 * 代码里只校验了四个字段，于是缺 `issuedAt`、缺 `txId` 的响应照样被当成有效证书，
 * 公开页挂着绿徽章，而签发时间显示「—」。**判据散在各处就一定会漂**，
 * 所以字段表只留这一份，改契约时改这里。
 *
 * 字段与类型对照 docs/API.md §6（与 `scripts/check-contract.mjs` 的 Certificate 同源）。
 */

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== ''

/**
 * 每个字段一条判据。返回 true 表示这个值可以接受。
 *
 * `verificationStatus` 这里只要求是非空字符串——「必须是 VALID」是
 * **公开验证那条路径**的额外要求，不是 Certificate 实体本身的规则
 * （证书列表里也可能出现别的状态），所以那一条判在调用方。
 */
export const CERTIFICATE_FIELDS = {
  certificateId: isNonEmptyString,
  projectId: isNonEmptyString,
  memberId: isNonEmptyString,
  // 整数 0–100：docs/API.md §0「percentage 使用整数」
  contributionPercentage: (v) => Number.isInteger(v) && v >= 0 && v <= 100,
  milestoneIds: (v) => Array.isArray(v) && v.every(isNonEmptyString),
  // ISO 8601：能被 Date 解析出一个真实时刻，不然页面上就是一个「Invalid Date」
  issuedAt: (v) => isNonEmptyString(v) && !Number.isNaN(Date.parse(v)),
  verificationStatus: isNonEmptyString,
  // Fabric 的交易 ID，64 位十六进制。这是证书「凭什么可信」的那一项，
  // 空着或格式不对，证书上的「链上交易」那一行就没有依据
  txId: (v) => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v)
}

/**
 * 逐字段挑毛病。
 *
 * @param {unknown} obj 一份待校验的 Certificate
 * @returns {string[]} 不合格的字段名；空数组表示八项都合格
 */
export function certificateProblems(obj) {
  if (!obj || typeof obj !== 'object') return Object.keys(CERTIFICATE_FIELDS)
  return Object.entries(CERTIFICATE_FIELDS)
    .filter(([name, ok]) => !ok(obj[name]))
    .map(([name]) => name)
}
