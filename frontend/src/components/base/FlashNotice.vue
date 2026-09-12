<script setup>
import { ref } from 'vue'
import { takeFlash } from '../../stores/flash.js'

/**
 * 上一步操作的成功提示。摆在 `PageHeader` 下面。
 *
 * 在 setup 里**读走**（而不是读）那条消息：同一条只消费一次，
 * 用户在页面之间来回走不会反复看到同一句「已提交」。
 * 也因此刷新页面之后它不会再出现——「刚才成功了」这件事只成立一次。
 *
 * 形状与 `ErrorNotice` 成对：同样是左缘一条竖线加一段说明，
 * 只是换成 verified 那一组色。两者是同一类东西（一次性的结果说明），
 * 长得像一对，用户才不用分别学两遍。
 *
 * `role="status"` 对应 `aria-live="polite"`，
 * 读屏会在不打断当前朗读的前提下播报出来。
 */
const text = ref(takeFlash())
</script>

<template>
  <p v-if="text" class="flash" role="status">
    <svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
    <span>{{ text }}</span>
  </p>
</template>

<style scoped>
.flash {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  margin-bottom: var(--sp-5);
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--r-sm);
  /* 左缘一条竖线而不是整圈边框：它是一句话，不是一张卡片 */
  border-left: 3px solid var(--c-verified);
  background: var(--c-verified-bg);
  color: var(--c-text);
  font-size: var(--fs-small);
}

.mark {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--c-verified);
}
</style>
