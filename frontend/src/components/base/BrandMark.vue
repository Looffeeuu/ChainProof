<script setup>
/**
 * 品牌标记：两枚相扣的圆角方块。
 *
 * 为什么是这个形：ChainProof 要表达的是「一条前后相扣、动不了的记录链」。
 * 两枚方块交叠，既是链环也是区块，而且是纯几何形——
 * 缩到 16px 仍然认得出，放到证书上印成黑白也不丢信息。
 *
 * 单色，跟着 currentColor 走，所以亮暗两套主题下不需要各准备一版。
 * 不用渐变、不用多色：那是品牌页的做法，界面里的标记越安静越好。
 *
 * 与 index.html 里那个 favicon 是同一个形，改这里记得改那边。
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
