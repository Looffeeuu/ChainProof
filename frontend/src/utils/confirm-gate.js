import { asList, asObjectList } from './list.js'

/**
 * 这条里程碑的确认人：创建时保存的 `requiredConfirmerIds` 快照（docs/API.md §6，PR #28）。
 *
 * **确认资格只看这份快照，与 contributors 无关。** 提交者以外的每位项目成员都在里面，
 * 包括贡献为 0%、没被写进 contributors 的人——他没参与这次成果，
 * 但仍要以旁观者的身份核对这份声明是否属实，这正是「独立确认」的意思。
 *
 * 不是数组、或者里面混了非字符串时，按「没有确认人」处理：
 * 页面上表现为谁都不能表态，而不是退回旧的「contributors 确认」规则——
 * 那条规则允许单人提交「自己 100%」再自己确认，正是 #24 要堵的口子。
 *
 * @param {object|null} milestone
 * @returns {string[]}
 */
export function confirmersOf(milestone) {
  return asList(milestone?.requiredConfirmerIds).filter((id) => typeof id === 'string' && id !== '')
}

/**
 * 提交者。不是非空字符串时返回空串，调用方据此判断「不知道是谁提交的」。
 *
 * @param {object|null} milestone
 * @returns {string}
 */
export function submitterOf(milestone) {
  const id = milestone?.submitterId
  return typeof id === 'string' ? id : ''
}

/**
 * 「这个人现在能不能对这条里程碑表态」。纯函数，只依赖同为纯函数的 list.js。
 *
 * 抽出来是为了能测：五条互斥规则决定按钮出不出现，写在组件里只能靠切身份手点。
 * 返回**原因码**而不是句子——句子要带时间，格式化属于展示层。
 *
 * @param {object|null} milestone docs/API.md §6 的 Milestone
 * @param {string} memberId 要表态的人
 * @returns {{ can: boolean,
 *             reason: '' | 'NO_DATA' | 'CLOSED' | 'SUBMITTER' | 'NOT_REVIEWER' | 'ALREADY_DECIDED',
 *             share: number|null, decidedAt: string|null }}
 */
export function confirmGate(milestone, memberId) {
  const base = { can: false, reason: 'NO_DATA', share: null, decidedAt: null }
  if (!milestone) return base

  // asObjectList 而不是 `?? []`：这两个字段来自接口，可能是 null，
  // 也可能根本不是数组（scripts/check-malformed.mjs 守着这条）
  const contributor = asObjectList(milestone.contributors).find((c) => c.memberId === memberId)
  const decision = asObjectList(milestone.confirmations).find((c) => c.memberId === memberId)

  // share 只用于展示「这份声明记在你名下多少」；确认人不一定在 contributors 里，所以可能是 null
  const share = contributor ? contributor.percentage : null
  const decidedAt = decision ? decision.timestamp : null

  // 顺序即优先级，与链码 ConfirmContribution 的判定顺序一致（关闭 → 提交者 → 确认人 → 重复）。
  // 先看这条还开不开着：一条已经作废的里程碑对提交者说「你不能确认自己的提交」——
  // 那句话没错，但它不是此刻最要紧的事实。
  if (milestone.status !== 'PENDING_CONFIRMATION') {
    return { can: false, reason: 'CLOSED', share, decidedAt }
  }
  if (memberId && memberId === submitterOf(milestone)) {
    return { can: false, reason: 'SUBMITTER', share, decidedAt }
  }
  if (!confirmersOf(milestone).includes(memberId)) {
    return { can: false, reason: 'NOT_REVIEWER', share, decidedAt }
  }
  if (decision) {
    return { can: false, reason: 'ALREADY_DECIDED', share, decidedAt }
  }
  return { can: true, reason: '', share, decidedAt }
}
