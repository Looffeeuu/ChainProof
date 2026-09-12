<script setup>
import StatusBadge from '../base/StatusBadge.vue'
import HashText from '../base/HashText.vue'
import ConfirmProgress from './ConfirmProgress.vue'
import AwaitingYou from './AwaitingYou.vue'
import { formatDateTime } from '../../utils/format-time.js'

/**
 * 里程碑时间线。spec/01 §2.7 把它列为重点页面：
 * 每一项一行，左侧竖线 + 状态圆点，右侧是标题、HashText、时间、StatusBadge、确认进度。
 *
 * 排序在这里做（倒序，最新的在上），而不是让调用方排好再传进来：
 * 「时间线怎么排」是这个组件的职责，换成正序也只改这一处。
 * 接口给的是正序（spec/02 §5.1），所以这里要翻过来。
 */
defineProps({
  milestones: { type: Array, default: () => [] }
})

/** 圆点的颜色跟着状态走，和徽章用同一套语义色 */
const TONE = {
  VERIFIED: 'verified',
  PENDING_CONFIRMATION: 'pending',
  REJECTED: 'rejected'
}
</script>

<template>
  <ol class="timeline">
    <li
      v-for="m in [...milestones].reverse()"
      :key="m.milestoneId"
      class="item"
      :class="`tone--${TONE[m.status] ?? 'unknown'}`"
    >
      <span class="dot" aria-hidden="true"></span>

      <div class="body">
        <div class="head">
          <RouterLink :to="`/milestones/${m.milestoneId}`" class="title">{{ m.title }}</RouterLink>
          <StatusBadge :status="m.status" />
          <AwaitingYou :milestone="m" />
        </div>

        <p v-if="m.description" class="t-small t-soft desc">{{ m.description }}</p>

        <div class="meta">
          <HashText :value="m.fileHash" :label="`${m.title} 的文件哈希`" />
          <span class="t-small t-soft t-nums">{{ formatDateTime(m.createdAt) }}</span>
          <ConfirmProgress :milestone="m" />
          <RouterLink :to="`/milestones/${m.milestoneId}`" class="t-small more">查看声明</RouterLink>
        </div>

        <!-- 链上交易 ID。没有它的话，「链上已验证」那个徽章在界面上没有任何依据可指，
             整个产品最核心的主张就只是一句需要被相信的话（spec/03 §5） -->
        <p v-if="m.txId" class="t-small t-soft tx">
          <span class="t-label">链上交易</span>
          <HashText :value="m.txId" :label="`${m.title} 的链上交易 ID`" />
        </p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item {
  position: relative;
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-4) var(--sp-4) 0;
}

/* 竖线：用伪元素画在圆点的中轴上，最后一项不画，
   否则线会从最后一个点继续往下拖出一截。

   颜色从中性边框色换成存证色。这条线是整个界面里唯一一个「链」的直接图形，
   spec/01 §2.7 也把时间线列为最能体现产品主张的一屏；
   画成和卡片分隔线同一个灰，等于把它降级成了普通的排版装饰。 */
.item::before {
  content: '';
  position: absolute;
  left: 5px;
  top: var(--sp-5);
  bottom: 0;
  width: 2px;
  border-radius: 2px;
  background: var(--c-chain);
  opacity: 0.35;
}
.item:last-child::before { display: none; }

.dot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-top: var(--sp-2);
  border-radius: 999px;
  /* 描边取卡片底色，让圆点在竖线上「开一个口」，看起来是串在线上而不是压在线上 */
  border: 2px solid var(--c-surface);
  background: var(--c-text-soft);
  /* 外面再套一圈同色的淡光晕，圆点才有分量。
     用 box-shadow 而不是加大直径：直径变了竖线的对齐位置也要跟着改 */
  box-shadow: 0 0 0 3px var(--c-sunken);
}
.tone--verified .dot { background: var(--c-verified); }
.tone--pending .dot { background: var(--c-pending); }
.tone--rejected .dot { background: var(--c-rejected); }

.body { flex: 1; min-width: 0; display: grid; gap: var(--sp-2); }

.head {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}

.title { font-size: var(--fs-lead); font-weight: 600; color: var(--c-text); }
.title:hover { color: var(--c-primary-text); }

.desc { max-width: 72ch; }

.meta {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}

.more { color: var(--c-primary-text); font-weight: 600; }

/* 链上交易独占一条：它和上面那行的文件哈希是两个不同的东西
   （一个是内容的指纹，一个是这次上链的凭据），并排放会被当成同一类 */
.tx {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.tx .t-label { margin: 0; }
</style>
