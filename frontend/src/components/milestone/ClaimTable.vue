<script setup>
import { computed } from 'vue'
import { asObjectList } from '../../utils/list.js'
import MemberAvatars from '../project/MemberAvatars.vue'
import StatusBadge from '../base/StatusBadge.vue'
import { formatDateTime } from '../../utils/format-time.js'

/**
 * 贡献声明表：每位成员一行，显示他被声明的比例、以及他表态了没有。
 *
 * 「谁还没表态」是确认页上最需要一眼看清的东西，
 * 所以未表态不是留空，而是明写「等待中」——留空会被读成「没有数据」。
 */
const props = defineProps({
  milestone: { type: Object, required: true },
  /** 高亮哪一行（当前演示身份），空串表示不高亮 */
  highlight: { type: String, default: '' }
})

const decisionOf = (memberId) =>
  asObjectList(props.milestone.confirmations).find((c) => c.memberId === memberId)

const rows = computed(() =>
  asObjectList(props.milestone.contributors).map((c) => ({
    ...c,
    decision: decisionOf(c.memberId)
  }))
)
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
        <td class="num t-nums pct">{{ row.percentage }}%</td>
        <td>
          <StatusBadge v-if="row.decision" :status="row.decision.decision" />
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
