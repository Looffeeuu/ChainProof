<script setup>
/**
 * 品牌标记：两枚相扣的圆角方块，既是链环也是区块。纯几何形，
 * 缩到 16px 仍认得出，印成黑白也不丢信息。
 *
 * 单色、跟 currentColor 走，所以亮暗两套主题不用各准备一版。
 * **index.html 的 favicon 是同一个形，改这里记得改那边。**
 */
defineProps({
  size: { type: Number, default: 18 }
})
</script>

<template>
  <svg
    class="mark"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="3.2" y="3.2" width="11" height="11" rx="3" />
    <rect x="9.8" y="9.8" width="11" height="11" rx="3" />
  </svg>
</template>

<style scoped>
.mark { display: block; flex-shrink: 0; }
</style>
