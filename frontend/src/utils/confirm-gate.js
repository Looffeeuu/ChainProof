/**
 * 「这个人现在能不能对这条里程碑表态」的判断。
 * 纯函数，不 import 本项目任何模块（spec/02 §1.2 规则 4）。
 *
 * 抽出来的理由：这是四条互斥规则的组合，而它决定了确认页上按钮出不出现。
 * 写在组件里的话，「已经表过态的人再打开这一页会怎样」只能靠切演示身份手点，
 * 一次点不全四种情况。抽成纯函数后，四种情况在自检脚本里一次跑完。
 *
 * 返回的是**原因码**而不是给人看的句子：句子里要带时间，
 * 而时间的格式化属于展示层（utils/format-time.js），
 * 由调用方去拼，这个文件就不必知道时间该长什么样。
 *
 * @param {object|null} milestone spec/02 §2.2 的 Milestone
 * @param {string} memberId 要表态的人
 * @returns {{ can: boolean, reason: '' | 'NO_DATA' | 'CLOSED' | 'NOT_IN_CLAIM' | 'ALREADY_DECIDED',
 *             share: number|null, decidedAt: string|null }}
 */
export function confirmGate(milestone, memberId) {
  const base = { can: false, reason: 'NO_DATA', share: null, decidedAt: null }
  if (!milestone) return base

  const contributor = (milestone.contributors ?? []).find((c) => c.memberId === memberId)
  const decision = (milestone.confirmations ?? []).find((c) => c.memberId === memberId)

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
