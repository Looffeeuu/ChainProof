<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { truncateHash, groupHash } from '../../utils/format-hash.js'

/**
 * 哈希显示：中间省略 + 悬停出完整值 + 复制按钮（spec/01 §2.6）。
 * 这是本项目出现频率仅次于状态徽章的元素。
 *
 * **视觉上它承担的比「显示一串字符」更多。** 哈希与交易 ID 是这个产品在讲的
 * 那件事的直接证据，整个界面里只有它们是「链上的东西」。所以它用两个专属的
 * 视觉信号把自己和普通文本分开：
 *
 *   - 一层凹面底（--c-sunken），像嵌在卡片里的一个槽，
 *     而不是又一段和标题、时间、说明混在一起的灰字；
 *   - 存证色（--c-chain）。界面上除主色之外唯一的第二个颜色，
 *     它标的是内容不是控件，所以和「可以点的蓝」不会混（spec/01 §2.1）。
 *
 * 原先它就是一段 13px 的灰色等宽字，混在同一行的项目名和时间戳里，
 * 谁也不比谁显眼——这个产品最有辨识度的元素，在界面上是隐形的。
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

/** '' | 'done' | 'failed'，2 秒后复原 */
const state = ref('')
const copied = computed(() => state.value === 'done')
const failed = computed(() => state.value === 'failed')

let timer = null

/**
 * 复制到剪贴板。
 *
 * **失败要说出来。** `navigator.clipboard` 在非安全上下文里根本不存在
 * （`http://192.168.x.x` 演示时就是这种情况，而那正是本项目特意要支持的场景），
 * 调用直接抛 TypeError。原先 catch 里什么都不做，用户点了没反应、没提示、
 * 剪贴板是空的——一个看着能按、按了不动的按钮。完整值确实在 title 里，
 * 但那要人先知道有这回事，不能顶替反馈。
 */
async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    state.value = 'done'
  } catch {
    state.value = 'failed'
  }
  clearTimeout(timer)
  // 2 秒后复原（spec/01 §2.6）。太短来不及看见，太长会让人以为按钮坏了
  timer = setTimeout(() => { state.value = '' }, 2000)
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
      :class="{ 'is-failed': failed }"
      :aria-label="`复制${label}`"
      :title="failed ? '复制不了，请手动选中这串字符' : copied ? '已复制' : `复制${label}`"
      @click="copy"
    >
      <!-- 图标而不是「复制」两个字：这个按钮在时间线上一屏出现七八次，
           每次都写两个字，视线会被一列重复的文字带着走。
           无障碍名称仍然完整，靠 aria-label -->
      <svg v-if="!copied" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="11.5" height="11.5" rx="2.4" />
        <path d="M5.5 15H4.8A1.3 1.3 0 0 1 3.5 13.7V4.8A1.3 1.3 0 0 1 4.8 3.5h8.9A1.3 1.3 0 0 1 15 4.8v.7" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7" />
      </svg>
      <span class="sr-only">{{ failed ? '复制失败' : copied ? '已复制' : '复制' }}</span>
    </button>

    <!-- 图标按钮自己没有位置说这句话，所以摆在它旁边。
         只在失败时出现，2 秒后消失 -->
    <span v-if="failed" class="t-small fail" role="status">复制不了，请手动选中</span>
  </span>
</template>

<style scoped>
.hash {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  max-width: 100%;
  padding: 2px var(--sp-1) 2px var(--sp-2);
  border-radius: var(--r-xs);
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
}

.value {
  font-size: var(--fs-small);
  color: var(--c-chain);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 完整值：详情页里独占一行，可以整行选中复制 */
.is-full {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-2) var(--sp-2) var(--sp-3);
}
.is-full .value {
  display: block;
  white-space: normal;
  word-break: break-all;
  font-size: var(--fs-body);
  line-height: 1.6;
}

.copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--c-text-soft);
  transition: color var(--ease), background var(--ease);
}
.copy:hover { color: var(--c-chain); background: var(--c-chain-weak); }
.copy.is-failed { color: var(--c-rejected); }

.fail { color: var(--c-rejected); white-space: nowrap; }
.copy svg { width: 13px; height: 13px; }
</style>
