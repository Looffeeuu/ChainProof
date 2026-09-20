<script setup>
/**
 * 错误提示。spec/01 §2.6 的硬要求：把接口给的 message 原样显示，
 * 不要吞掉换成「操作失败」——「比例总和是 97%，还差 3%」这种信息
 * 正是用户需要看到的，替换成通用文案等于把它删了。
 *
 * error 直接收 Error 对象（api/client.js 抛出的那种，带 code），
 * 页面不用先解构一遍。
 */
defineProps({
  error: { type: [Error, Object, String], default: null },
  title: { type: String, default: '这一步没能完成' },
  // 有重试入口时传 true，由调用方监听 retry
  retryable: { type: Boolean, default: false }
})

defineEmits(['retry'])

function messageOf(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  return error.message || String(error)
}

function codeOf(error) {
  return error && typeof error === 'object' ? error.code : ''
}
</script>

<template>
  <div v-if="error" class="notice" role="alert">
    <span class="mark" aria-hidden="true">✕</span>
    <div class="body">
      <p class="notice-title">{{ title }}</p>
      <p class="msg">{{ messageOf(error) }}</p>
      <p v-if="codeOf(error)" class="t-small code t-mono">{{ codeOf(error) }}</p>
    </div>
    <button v-if="retryable" type="button" class="retry" @click="$emit('retry')">重试</button>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border: 1px solid var(--c-rejected);
  border-radius: var(--r-sm);
  background: var(--c-rejected-bg);
  color: var(--c-rejected);
}

.mark { line-height: 1.5; }
.body { flex: 1; display: grid; gap: var(--sp-1); }
.notice-title { font-weight: 600; }
.msg { color: var(--c-text); }
.code { opacity: 0.8; }

.retry {
  flex-shrink: 0;
  padding: var(--sp-1) var(--sp-3);
  border: 1px solid currentColor;
  border-radius: var(--r-sm);
  background: transparent;
  color: inherit;
  font-size: var(--fs-small);
  font-weight: 600;
}
</style>
