<script setup>
import MemberAvatars from './MemberAvatars.vue'
import { memberTone } from '../../utils/member-tone.js'

/**
 * 累计贡献比例。数据来自 GET /api/projects/:id/contributions（spec/02 §5.1），
 * 前端只负责画，不在这里算——比例怎么算是后端与链上的事。
 *
 * 一条横条按比例分段，下面配一份文字清单。只有横条是不够的：
 * 「alice 比 bob 多一点」看得出来，「多多少」看不出来，而这正是这个项目要证明的东西。
 *
 * 分段的颜色用**人物色**（--c-member-N），不再借状态色。
 * 原先第二段套的是 --c-verified，于是同一页上绿色既是「链上已验证」
 * 又是「bob」；而且颜色是按数组下标取的，和头像那边按 ID 折算的结果对不上，
 * 同一个人在条上和在头像上是两个颜色。两处现在共用 utils/member-tone.js。
 */
defineProps({
  members: { type: Array, default: () => [] },
  basedOnMilestones: { type: Number, default: 0 }
})

</script>

<template>
  <!-- 一条已验证的里程碑都没有时，比例是空的。这不是出错，也不是「暂无数据」，
       而是一个有原因的状态：还没有任何声明走完确认流程。说清楚它，
       用户才不会去怀疑是不是页面坏了。 -->
  <div v-if="members.length === 0" class="empty">
    <p class="t-soft">还没有可统计的贡献比例。</p>
    <p class="t-small t-soft">里程碑通过全员确认后，这里会出现每人的累计占比。</p>
  </div>

  <div v-else class="panel">
    <div class="bar" role="img" :aria-label="members.map((m) => `${m.memberId} ${m.percentage}%`).join('，')">
      <span
        v-for="m in members"
        :key="m.memberId"
        class="seg"
        :class="`tone--${memberTone(m.memberId)}`"
        :style="{ width: `${m.percentage}%` }"
      ></span>
    </div>

    <ul class="legend">
      <li v-for="m in members" :key="m.memberId" class="row">
        <span class="swatch" :class="`tone--${memberTone(m.memberId)}`" aria-hidden="true"></span>
        <MemberAvatars :members="[m.memberId]" :size="20" />
        <span class="name">{{ m.memberId }}</span>
        <span class="t-nums pct">{{ m.percentage }}%</span>
      </li>
    </ul>

    <p class="t-small t-soft">
      基于 {{ basedOnMilestones }} 条已验证里程碑；待确认与已拒绝的不计入。
    </p>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: var(--sp-4); }
.empty { display: grid; gap: var(--sp-2); max-width: 52ch; }

.bar {
  display: flex;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
}

.seg { display: block; height: 100%; }

.legend { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }

.row { display: flex; align-items: center; gap: var(--sp-2); }

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.name { flex: 1; font-size: var(--fs-small); }
.pct { font-weight: 640; font-size: var(--fs-lead); letter-spacing: -0.01em; }

.tone--1 { background: var(--c-member-1); }
.tone--2 { background: var(--c-member-2); }
.tone--3 { background: var(--c-member-3); }
.tone--4 { background: var(--c-member-4); }
</style>
