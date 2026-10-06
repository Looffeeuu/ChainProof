<script setup>
import { computed } from 'vue'
import { asObjectList } from '../../utils/list.js'
import { confirmersOf } from '../../utils/confirm-gate.js'
import { session } from '../../stores/session.js'

/**
 * 确认进度：「1/2 已确认」。
 *
 * 一条里程碑要等每位确认人都表态。确认人是创建时保存的 `requiredConfirmerIds`
 * 快照——提交者以外的全部项目成员，与 contributors 无关（PR #28）。
 * 所以分母不是「声明里有几个人」，提交者自己不计入。
 * 这个数字是 Timeline 上最能说明「还差什么」的一处信息，所以单独成组件——
 * 它在 Timeline、确认页各用一次。
 *
 * 被拒绝的情况不显示分数，显示是**谁**拒绝的：分数会让人以为还在等其他人，
 * 而实际上流程已经停了。
 *
 * 点名而不是「1 人拒绝」：拒绝的人是谁，是这条记录上最要紧的一个事实。
 * 当事人自己看到的是「你拒绝了」——同一句话对当事人和旁观者不该一样
 * （视角化的理由见 AwaitingYou.vue 的注释）。
 */
const props = defineProps({
  milestone: { type: Object, required: true }
})

const confirmers = computed(() => confirmersOf(props.milestone))
const total = computed(() => confirmers.value.length)

// 只数确认人名单里的那几条：分子和分母要数的是同一批人
const confirmed = computed(
  () => asObjectList(props.milestone.confirmations)
    .filter((c) => c.decision === 'CONFIRMED' && confirmers.value.includes(c.memberId)).length
)

const rejecters = computed(
  () => asObjectList(props.milestone.confirmations).filter((c) => c.decision === 'REJECTED')
)

const text = computed(() => {
  const rows = rejecters.value
  if (rows.length === 0) return `${confirmed.value}/${total.value} 已确认`

  const first = rows[0].memberId === session.currentMemberId ? '你' : rows[0].memberId
  // 一人拒绝就作废，理论上不会有第二个人再表态；真出现了也照实说，
  // 不要把多出来的那条悄悄吞掉
  return rows.length === 1 ? `${first} 拒绝` : `${first} 等 ${rows.length} 人拒绝`
})

const tone = computed(() => {
  if (rejecters.value.length > 0) return 'rejected'
  if (total.value > 0 && confirmed.value === total.value) return 'verified'
  return 'soft'
})
</script>

<template>
  <span class="progress t-small t-nums" :class="`tone--${tone}`">{{ text }}</span>
</template>

<style scoped>
.progress { white-space: nowrap; font-weight: 600; }
.tone--verified { color: var(--c-verified); }
.tone--rejected { color: var(--c-rejected); }
.tone--soft { color: var(--c-text-soft); }
</style>
