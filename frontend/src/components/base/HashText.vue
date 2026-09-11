<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { truncateHash, groupHash } from '../../utils/format-hash.js'

/**
 * 哈希显示：中间省略 + 悬停出完整值 + 复制按钮（spec/01 §2.6）。
 * 这是本项目出现频率仅次于状态徽章的元素。
 *
 * full 模式给详情页用：完整值独占一行、每 8 位断开、可整行选中。
 */
const props = defineProps({
  value: { type: String, default: '' },
  keep: { type: Number, default: 8 },
  full: { type: Boolean, default: false },
  copyable: { type: Boolean, default: true },
  // 前面的说明文字，例如「文件哈希」——复制按钮的无障碍标签会用到
  label: { type: String, default: '哈希' }
})

const shown = computed(() =>
  props.full ? groupHash(props.value) : truncateHash(props.value, props.keep)
)

const copied = ref(false)
let timer = null

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    clearTimeout(timer)
    // 2 秒后复原（spec/01 §2.6）。太短来不及看见，太长会让人以为按钮坏了
    timer = setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // 剪贴板在非 HTTPS 或用户拒绝授权时会失败。
    // 这里不弹错误：完整值本来就在 title 里，手动选中复制仍然可行。
    copied.value = false
  }
}

// 组件卸载后定时器还会跑，回调里再改 ref 就是在改一个已经没人看的状态
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <span class="hash" :class="{ 'is-full': full }">
    <span class="t-mono value" :title="value">{{ shown }}</span>
    <button
      v-if="copyable && value"
      type="button"
      class="copy"
      :aria-label="`复制${label}`"
      @click="copy"
    >
      {{ copied ? '已复制' : '复制' }}
    </button>
  </span>
</template>

<style scoped>
.hash {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  max-width: 100%;
}

.value {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-full .value {
  white-space: normal;
  word-break: break-all;
  font-size: 15px;
  /* 完整值可以整行选中，所以给它自己的一行 */
  display: block;
}

.is-full { display: flex; align-items: flex-start; gap: var(--sp-3); }

.copy {
  flex-shrink: 0;
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-soft);
  font-size: 12px;
  transition: color var(--ease), border-color var(--ease);
}
.copy:hover { color: var(--c-primary); border-color: var(--c-border-strong); }
</style>
