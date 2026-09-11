<script setup>
import MemberAvatars from './MemberAvatars.vue'

/**
 * 累计贡献比例。数据来自 GET /api/projects/:id/contributions（spec/02 §5.1），
 * 前端只负责画，不在这里算——比例怎么算是后端与链上的事。
 *
 * 一条横条按比例分段，下面配一份文字清单。只有横条是不够的：
 * 「alice 比 bob 多一点」看得出来，「多多少」看不出来，而这正是这个项目要证明的东西。
 */
defineProps({
  members: { type: Array, default: () => [] },
  basedOnMilestones: { type: Number, default: 0 }
})

const TONES = ['primary', 'verified', 'pending', 'rejected']
</script>

<template>
  <!-- 一条已验证的里程碑都没有时，比例是空的。这不是出错，也不是「暂无数据」，
       而是一个有原因的状态：还没有任何声明走完确认流程。说清楚它，
       用户才不会去怀疑是不是页面坏了。 -->
  <div v-if="members.length === 0" class="empty">
    <p class="t-soft">还没有可统计的贡献比例。</p>
    <p class="t-small t-soft">
      比例只统计状态为「链上已验证」的里程碑。这个项目目前还没有任何一条走完全员确认，
      等第一条通过之后，这里会出现每位成员的累计占比。
    </p>
  </div>

  <div v-else class="panel">
    <div class="bar" role="img" :aria-label="members.map((m) => `${m.memberId} ${m.percentage}%`).join('，')">
      <span
        v-for="(m, i) in members"
        :key="m.memberId"
        class="seg"
        :class="`tone--${TONES[i % TONES.length]}`"
        :style="{ width: `${m.percentage}%` }"
      ></span>
    </div>

    <ul class="legend">
      <li v-for="(m, i) in members" :key="m.memberId" class="row">
        <span class="swatch" :class="`tone--${TONES[i % TONES.length]}`" aria-hidden="true"></span>
        <MemberAvatars :members="[m.memberId]" :size="20" />
        <span class="name">{{ m.memberId }}</span>
        <span class="t-nums pct">{{ m.percentage }}%</span>
      </li>
    </ul>

    <p class="t-small t-soft">
      基于 {{ basedOnMilestones }} 个已验证里程碑。比例只统计状态为「链上已验证」的里程碑；
      待确认与已拒绝的不计入。
    </p>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: var(--sp-4); }
.empty { display: grid; gap: var(--sp-2); max-width: 52ch; }

.bar {
  display: flex;
  height: var(--sp-3);
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--c-bg);
}

.seg { display: block; height: 100%; }

.legend { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }

.row { display: flex; align-items: center; gap: var(--sp-2); }

.swatch {
  width: var(--sp-3);
  height: var(--sp-3);
  border-radius: var(--r-sm);
  flex-shrink: 0;
}

.name { flex: 1; }
.pct { font-weight: 600; }

.tone--primary { background: var(--c-primary); }
.tone--verified { background: var(--c-verified); }
.tone--pending { background: var(--c-pending); }
.tone--rejected { background: var(--c-rejected); }
</style>
