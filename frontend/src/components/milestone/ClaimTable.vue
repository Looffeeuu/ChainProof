<script setup>
import { computed } from 'vue'
import { asObjectList } from '../../utils/list.js'
import { confirmersOf, submitterOf } from '../../utils/confirm-gate.js'
import MemberAvatars from '../project/MemberAvatars.vue'
import StatusBadge from '../base/StatusBadge.vue'
import { formatDateTime } from '../../utils/format-time.js'

/**
 * 贡献声明表：每位相关成员一行，显示他被声明的比例、以及他表态了没有。
 *
 * 「谁还没表态」是确认页上最需要一眼看清的东西，
 * 所以未表态不是留空，而是明写「等待中」——留空会被读成「没有数据」。
 *
 * **行不再只取 contributors（PR #28）。** 确认人是创建时的 `requiredConfirmerIds` 快照：
 * 提交者以外的全部项目成员，包括没分到比例的人。只列 contributors 的话，
 * 一个 0% 的确认人在表里根本不出现，而进度却在等他——「还差谁」就对不上了。
 * 现在的顺序是：提交者在最上面，然后是确认人（快照本身已按字节序排好）。
 * 万一有 contributor 既不是提交者也不在快照里（不该出现，但接口给了就照实列），排在最后。
 */
const props = defineProps({
  milestone: { type: Object, required: true },
  /** 高亮哪一行（当前演示身份），空串表示不高亮 */
  highlight: { type: String, default: '' }
})

const decisionOf = (memberId) =>
  asObjectList(props.milestone.confirmations).find((c) => c.memberId === memberId)

const rows = computed(() => {
  const contributors = asObjectList(props.milestone.contributors)
  const shareOf = (memberId) => contributors.find((c) => c.memberId === memberId)?.percentage ?? 0

  const submitter = submitterOf(props.milestone)
  const confirmers = confirmersOf(props.milestone)
  const ids = [
    ...(submitter ? [submitter] : []),
    ...confirmers,
    ...contributors.map((c) => c.memberId)
  ]

  return [...new Set(ids)].map((memberId) => ({
    memberId,
    percentage: shareOf(memberId),
    role: memberId === submitter ? 'SUBMITTER' : confirmers.includes(memberId) ? 'CONFIRMER' : 'OTHER',
    decision: decisionOf(memberId)
  }))
})
</script>

<template>
  <table class="claim">
    <caption class="sr-only">这份声明里每位成员的贡献比例与表态情况</caption>
    <thead>
      <tr>
        <th scope="col" class="t-label">成员</th>
        <th scope="col" class="t-label num">声明的比例</th>
        <th scope="col" class="t-label">表态</th>
        <th scope="col" class="t-label">时间</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.memberId" :class="{ 'is-me': row.memberId === highlight }">
        <td>
          <span class="who">
            <MemberAvatars :members="[row.memberId]" :size="24" />
            {{ row.memberId }}
            <span v-if="row.memberId === highlight" class="t-small tag">你</span>
          </span>
        </td>
        <td class="num t-nums pct" :class="{ 't-soft': row.percentage === 0 }">{{ row.percentage }}%</td>
        <td>
          <StatusBadge v-if="row.decision" :status="row.decision.decision" />
          <span v-else-if="row.role === 'SUBMITTER'" class="t-small t-soft">提交者，无需表态</span>
          <span v-else-if="row.role === 'OTHER'" class="t-small t-soft">不在确认名单</span>
          <span v-else class="t-small t-soft">等待中</span>
        </td>
        <td class="t-small t-soft t-nums">
          {{ row.decision ? formatDateTime(row.decision.timestamp) : '—' }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.claim { width: 100%; }

th, td {
  padding: var(--sp-3) var(--sp-2);
  text-align: left;
  border-bottom: 1px solid var(--c-border-subtle);
}
th { border-bottom-color: var(--c-border-strong); }
tbody tr:last-child td { border-bottom: none; }

.num { text-align: right; }
.pct { font-weight: 600; }

.who { display: inline-flex; align-items: center; gap: var(--sp-2); }

.tag {
  padding: 0 var(--sp-1);
  border-radius: var(--r-sm);
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-weight: 600;
}

.is-me { background: var(--c-primary-weak); }

@media (max-width: 900px) {
  th:last-child, td:last-child { display: none; }
}
</style>
