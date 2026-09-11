<script setup>
import BaseSpinner from './BaseSpinner.vue'

/**
 * 三级按钮（spec/01 §2.6）：primary 实心、secondary 描边、ghost 纯文字。
 * 主按钮每页最多一个——这条规则组件本身没法强制，写页面时自己守。
 *
 * loading 为真时按钮自动禁用：提交要等几秒，
 * 这期间必须挡住第二次点击，否则会重复提交。
 */
const props = defineProps({
  variant: {
    type: String,
    default: 'secondary',
    validator: (v) => ['primary', 'secondary', 'ghost'].includes(v)
  },
  type: { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  // 加载中要不要换文案。留空就保持原文案，只多一个 spinner
  loadingText: { type: String, default: '' }
})
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[`btn--${props.variant}`, { 'is-loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
  >
    <BaseSpinner v-if="loading" :size="16" />
    <span v-if="loading && loadingText">{{ loadingText }}</span>
    <span v-else><slot /></span>
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  height: 36px;              /* spec/01 §2.6 */
  padding: 0 var(--sp-4);
  border-radius: var(--r-sm);
  border: 1px solid transparent;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  transition: background var(--ease), border-color var(--ease), color var(--ease);
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn--primary {
  background: var(--c-primary);
  color: var(--c-surface);
}
.btn--primary:hover:not(:disabled) { background: var(--c-text); }

.btn--secondary {
  background: var(--c-surface);
  border-color: var(--c-border-strong);
  color: var(--c-text);
}
.btn--secondary:hover:not(:disabled) { background: var(--c-bg); }

.btn--ghost {
  background: transparent;
  color: var(--c-primary);
  padding: 0 var(--sp-2);
}
.btn--ghost:hover:not(:disabled) { background: var(--c-primary-weak); }

/* 加载中不再降透明度：spinner 已经说明了状态，
   再叠一层半透明会让「提交中…」几个字看不清 */
.btn.is-loading:disabled { opacity: 1; cursor: progress; }
</style>
