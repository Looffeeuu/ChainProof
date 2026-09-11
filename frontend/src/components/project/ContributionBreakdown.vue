<script setup>
import { computed } from 'vue'
import { formatDate } from '../../utils/format-time.js'

/**
 * 累计比例的明细：每条已验证的里程碑各人占多少。
 *
 * 累计比例只有一行数字（alice 44%），看的人无从判断这个数字是怎么来的——
 * 而这个项目的整个卖点就是「可核对」。把参与计算的每一条列出来，
 * 累计数字才是可追溯的，而不是又一个需要信任的黑箱。
 *
 * 只列已验证的：待确认与已拒绝的不计入累计（与 ContributionPanel 的说明一致）。
 */
const props = defineProps({
  milestones: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] }
})

const verified = computed(() =>
  props.milestones
    .filter((m) => m.status === 'VERIFIED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
)

/** 表头就是累计比例里出现过的那几个人，顺序保持一致，两张表才对得上 */
const columns = computed(() => props.members.map((m) => m.memberId))

function shareOf(milestone, memberId) {
  return milestone.contributors.find((c) => c.memberId === memberId)?.percentage ?? null
}

/** 每个人在所有已验证里程碑上的原始比例之和。累计比例是它归一化之后的结果 */
const rawTotals = computed(() =>
  columns.value.map((memberId) =>
    verified.value.reduce((sum, m) => sum + (shareOf(m, memberId) ?? 0), 0)
  )
)
</script>

<template>
  <table class="breakdown">
    <caption class="sr-only">每条已验证里程碑上各成员声明的贡献比例</caption>
    <thead>
      <tr>
        <th scope="col" class="t-label">里程碑</th>
        <th v-for="memberId in columns" :key="memberId" scope="col" class="t-label num">
          {{ memberId }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="m in verified" :key="m.milestoneId">
        <th scope="row" class="name">
          <RouterLink :to="`/milestones/${m.milestoneId}`">{{ m.title }}</RouterLink>
          <span class="t-small t-soft date">{{ formatDate(m.createdAt) }}</span>
        </th>
        <td v-for="memberId in columns" :key="memberId" class="num t-nums">
          <template v-if="shareOf(m, memberId) !== null">{{ shareOf(m, memberId) }}%</template>
          <span v-else class="t-soft" :title="`${memberId} 不在这条里程碑的声明里`">—</span>
        </td>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <th scope="row" class="t-small">各条相加</th>
        <td v-for="(value, i) in rawTotals" :key="i" class="num t-nums total">{{ value }}%</td>
      </tr>
    </tfoot>
  </table>
</template>

<style scoped>
.breakdown { width: 100%; }

th, td {
  padding: var(--sp-2);
  text-align: left;
  border-bottom: 1px solid var(--c-border-subtle);
  font-weight: 400;
}
thead th { border-bottom-color: var(--c-border-strong); }

.num { text-align: right; }

.name { display: grid; gap: var(--sp-1); min-width: 200px; }
.date { white-space: nowrap; }

tfoot th, tfoot td {
  border-bottom: none;
  border-top: 1px solid var(--c-border-strong);
  color: var(--c-text-soft);
}
.total { font-weight: 600; }
</style>
