<script setup>
import { ref, watch, onUnmounted } from 'vue'
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
const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: [Error, Object, String], default: null },
  empty: { type: Boolean, default: false },
  loadingText: { type: String, default: '加载中…' },
  errorTitle: { type: String, default: '没能读到数据' },
  retryable: { type: Boolean, default: true }
})

defineEmits(['retry'])

/**
 * 加载指示延迟出现，请求先回来就干脆不显示。
 *
 * 依据 NN/g 的进度指示研究（spec/01 §1 已经引过）：**1 秒以内的等待
 * 不需要指示**。假数据的延时是 200–600ms（mock/handlers.js），
 * 也就是说现在每一次导航都会闪一下 spinner——闪烁比完全不显示更糙，
 * 真接上后端之后，局域网里的快请求同样会闪。
 *
 * 两个阈值各治一个毛病：
 *
 * - **300ms 才出现**：比「感觉不到延迟」的上限略紧。再宽的话，
 *   用户已经开始怀疑是不是没点上。
 * - **出现后至少留 400ms**：只有前一个阈值的话，300ms 时刚显示出来、
 *   320ms 请求就回了，spinner 闪 20ms，比不显示更差。
 *
 * 服务端渲染时定时器不会跑，showSpinner 恒为假——首屏 HTML 里没有 spinner，
 * 这是对的：那一帧还没有任何请求发出去。
 */
const showSpinner = ref(false)
let appearTimer = null
let hideTimer = null
let shownAt = 0

watch(
  () => props.loading,
  (loading) => {
    clearTimeout(appearTimer)
    clearTimeout(hideTimer)
    if (loading) {
      appearTimer = setTimeout(() => {
        showSpinner.value = true
        shownAt = Date.now()
      }, 300)
    } else if (showSpinner.value) {
      hideTimer = setTimeout(() => { showSpinner.value = false }, Math.max(0, 400 - (Date.now() - shownAt)))
    } else {
      showSpinner.value = false
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  clearTimeout(appearTimer)
  clearTimeout(hideTimer)
})
</script>

<template>
  <div>
    <!-- 三态分支仍然判 loading，不能判 showSpinner——
         那 300 毫秒里 loading 为真而 showSpinner 为假，
         判 showSpinner 会直接掉进「有数据」分支，去读还不存在的数据 -->
    <div v-if="loading" class="loading-slot">
      <div v-if="showSpinner" class="loading" role="status">
        <BaseSpinner :size="20" />
        <span class="t-soft t-small">{{ loadingText }}</span>
      </div>
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
/* 那 300 毫秒里这一层是空的。给它和 spinner 同高，
   否则版面会先塌一下再撑开——为了消除闪烁反而制造了一次跳动 */
.loading-slot { min-height: calc(var(--sp-7) * 2 + 20px); }

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-7) var(--sp-4);
  color: var(--c-text-soft);
}
</style>
