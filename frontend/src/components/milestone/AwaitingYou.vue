<script setup>
import { computed } from 'vue'
import { confirmGate } from '../../utils/confirm-gate.js'
import { session } from '../../stores/session.js'

/**
 * 「待你确认」标记。只在当前身份**现在就能对这条表态**时出现。
 *
 * **为什么不是改状态徽章。** `StatusBadge` 的 `PENDING_CONFIRMATION`
 * 一律显示「待确认」，不认「你是谁」。但同一个「待确认」，
 * 对当事人是**一件待办**，对旁观者只是**一条状态**——
 * 用户扫一眼时间线最想知道的是「哪几条在等我」，没有这个标记就只能
 * 逐条点进去看确认名单里有没有自己。
 *
 * 徽章保持中性是对的：它同时用在里程碑、项目、证书三种对象上，
 * 塞进「当前身份」会让一个纯展示组件依赖 session，而证书的 VALID
 * 根本没有视角可言。**视角是位置的属性，不是徽章的属性**，
 * 所以视角信息单独做一个标记，摆在需要它的位置旁边。
 *
 * 判据直接复用 `utils/confirm-gate.js`——确认按钮出不出现用的是同一个函数，
 * 两处不会说不一致的话。
 */
const props = defineProps({
  milestone: { type: Object, required: true }
})

const show = computed(() => confirmGate(props.milestone, session.currentMemberId).can)
</script>

<template>
  <span v-if="show" class="chip">
    <span class="dot" aria-hidden="true" />待你确认
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  flex-shrink: 0;
  padding: 3px var(--sp-2);
  border-radius: var(--r-xs);
  /* 用主色而不是 pending 的琥珀：这不是「一条记录的状态」，
     是「一件你可以做的事」，和界面上其他可操作的东西同色 */
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-size: var(--fs-label);
  font-weight: 600;
  white-space: nowrap;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
</style>
