<script setup>
import { computed } from 'vue'

/**
 * 确认进度：「2/3 已确认」。
 *
 * 一条里程碑要等声明里的每个人都表态。这个数字是 Timeline 上最能说明
 * 「还差什么」的一处信息，所以单独成组件——它在 Timeline、确认页各用一次。
 *
 * 被拒绝的情况不显示分数，显示「1 人拒绝」：分数会让人以为还在等其他人，
 * 而实际上流程已经停了。
 */
const props = defineProps({
  milestone: { type: Object, required: true }
})

const total = computed(() => props.milestone.contributors?.length ?? 0)

const confirmed = computed(
  () => (props.milestone.confirmations ?? []).filter((c) => c.decision === 'CONFIRMED').length
)

const rejected = computed(
  () => (props.milestone.confirmations ?? []).filter((c) => c.decision === 'REJECTED').length
)

const text = computed(() => {
  if (rejected.value > 0) return `${rejected.value} 人拒绝`
  return `${confirmed.value}/${total.value} 已确认`
})

const tone = computed(() => {
  if (rejected.value > 0) return 'rejected'
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
