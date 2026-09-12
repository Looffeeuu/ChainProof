<script setup>
import { computed } from 'vue'
import { session } from '../../stores/session.js'

/**
 * 确认进度：「2/3 已确认」。
 *
 * 一条里程碑要等声明里的每个人都表态。这个数字是 Timeline 上最能说明
 * 「还差什么」的一处信息，所以单独成组件——它在 Timeline、确认页各用一次。
 *
 * 被拒绝的情况不显示分数，显示是**谁**拒绝的：分数会让人以为还在等其他人，
 * 而实际上流程已经停了。
 *
 * 点名而不是「1 人拒绝」：拒绝的人是谁，是这条记录上最要紧的一个事实，
 * 而它本来就在 confirmations 里，只是原先没显示出来。
 * 当事人自己看到的是「你拒绝了」——同一句话对当事人和旁观者不该一样
 * （视角化的理由见 AwaitingYou.vue 的注释）。
 */
const props = defineProps({
  milestone: { type: Object, required: true }
})

const total = computed(() => props.milestone.contributors?.length ?? 0)

const confirmed = computed(
  () => (props.milestone.confirmations ?? []).filter((c) => c.decision === 'CONFIRMED').length
)

const rejecters = computed(
  () => (props.milestone.confirmations ?? []).filter((c) => c.decision === 'REJECTED')
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
