<script setup>
import BaseSpinner from './BaseSpinner.vue'
import ErrorNotice from './ErrorNotice.vue'

/**
 * 三态外壳：加载 / 出错 / 空 / 有数据，四选一渲染。
 *
 * spec/01 §3.2 要求每个数据页三态齐全。useAsync 负责产生这三个状态
 * （spec/02 §3.2），这个组件负责把它们画出来——页面只需要写一次
 * <AsyncSection :loading :error :empty>，漏掉哪一态在写的时候就会发现。
 *
 * 顺序不能换：出错优先于空。请求失败时 data 也是空的，
 * 先判 empty 的话，用户看到的会是「这里还没有东西」——把一次失败说成了一次正常的空。
 */
defineProps({
  loading: { type: Boolean, default: false },
  error: { type: [Error, Object, String], default: null },
  empty: { type: Boolean, default: false },
  loadingText: { type: String, default: '加载中…' },
  errorTitle: { type: String, default: '没能读到数据' },
  retryable: { type: Boolean, default: true }
})

defineEmits(['retry'])
</script>

<template>
  <div>
    <div v-if="loading" class="loading" role="status">
      <BaseSpinner :size="20" />
      <span class="t-soft t-small">{{ loadingText }}</span>
    </div>

    <ErrorNotice
      v-else-if="error"
      :error="error"
      :title="errorTitle"
      :retryable="retryable"
      @retry="$emit('retry')"
    />

    <slot v-else-if="empty" name="empty" />

    <slot v-else />
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-7) var(--sp-4);
  color: var(--c-text-soft);
}
</style>
