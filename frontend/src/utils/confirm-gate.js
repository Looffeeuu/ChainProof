import { asObjectList } from './list.js'

/**
 * 「这个人现在能不能对这条里程碑表态」。纯函数，只依赖同为纯函数的 list.js。
 *
 * 抽出来是为了能测：四条互斥规则决定按钮出不出现，写在组件里只能靠切身份手点。
 * 返回**原因码**而不是句子——句子要带时间，格式化属于展示层。
 *
 * @param {object|null} milestone spec/02 §2.2 的 Milestone
 * @param {string} memberId 要表态的人
 * @returns {{ can: boolean, reason: '' | 'NO_DATA' | 'CLOSED' | 'NOT_IN_CLAIM' | 'ALREADY_DECIDED',
 *             share: number|null, decidedAt: string|null }}
 */
export function confirmGate(milestone, memberId) {
  const base = { can: false, reason: 'NO_DATA', share: null, decidedAt: null }
  if (!milestone) return base

  // asObjectList 而不是 `?? []`：这两个字段来自接口，可能是 null，
  // 也可能根本不是数组（scripts/check-malformed.mjs 守着这条）
  const contributor = asObjectList(milestone.contributors).find((c) => c.memberId === memberId)
  const decision = asObjectList(milestone.confirmations).find((c) => c.memberId === memberId)

  const share = contributor ? contributor.percentage : null
  const decidedAt = decision ? decision.timestamp : null

  // 顺序即优先级：先看这条还开不开着，再看这个人在不在名单里，最后看他表过态没有。
  // 反过来判的话，一条已经作废的里程碑会对不在名单里的人说「你不在名单里」——
  // 那句话没错，但它不是此刻最要紧的事实。
  if (milestone.status !== 'PENDING_CONFIRMATION') {
    return { can: false, reason: 'CLOSED', share, decidedAt }
  }
  if (!contributor) {
    return { can: false, reason: 'NOT_IN_CLAIM', share, decidedAt }
  }
  if (decision) {
    return { can: false, reason: 'ALREADY_DECIDED', share, decidedAt }
  }
  return { can: true, reason: '', share, decidedAt }
}
