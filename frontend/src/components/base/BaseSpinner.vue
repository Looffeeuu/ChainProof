<script setup>
/**
 * 循环加载动画。依据 NN/g（spec/01 §1）：1–10 秒的等待用循环动画，
 * 不用百分比进度条——因为并不知道真实进度，假进度比没有进度更糟。
 *
 * 用 SVG 而不是 CSS 边框转圈：边框方案在描边颜色与背景色接近时几乎看不见，
 * 而 SVG 可以画一整圈淡的轨道 + 一段深的弧，对比关系是自带的。
 * 两段都用 currentColor，所以放在哪个颜色的按钮里都跟着变。
 */
defineProps({
  size: { type: Number, default: 16 },
  label: { type: String, default: '加载中' }
})
</script>

<template>
  <svg
    class="spinner"
    data-motion="essential"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    role="status"
    :aria-label="label"
  >
    <circle class="track" cx="12" cy="12" r="9" fill="none" stroke-width="3" />
    <path class="arc" d="M12 3a9 9 0 0 1 9 9" fill="none" stroke-width="3" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.spinner { animation: spin 900ms linear infinite; }
.track { stroke: currentColor; opacity: 0.2; }
.arc { stroke: currentColor; }

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
