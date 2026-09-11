<script setup>
import { ref, computed } from 'vue'
import HashText from './HashText.vue'
import BaseSpinner from './BaseSpinner.vue'
import { hashFile } from '../../utils/sha256.js'

/**
 * 「把文件拖进来，我算给你看对不对」。
 *
 * 存在的理由：页面上一直写着「核对这串哈希，就能确认对方存证的文件和你手上的是同一份」，
 * 但没有提供任何核对的工具——读者要么信，要么自己去装一个命令行工具。
 * 这个组件把那句话变成一个可以当场做的动作。
 *
 * **文件不会上传。** 计算全部在浏览器里完成（utils/sha256.js），
 * 没有任何网络请求。这一点要在界面上说出来：让人把一份还没公开的成果
 * 拖进一个网页，他需要先知道这份文件不会离开他的电脑。
 *
 * 它只认一个 props：期望的哈希。不认识项目、里程碑、证书，
 * 所以归 components/base/（判据见 spec/02 的 Q&A）。
 */
const props = defineProps({
  /** 要比对的目标哈希，64 位十六进制 */
  expected: { type: String, required: true },
  /** 给复制按钮和提示语用的称呼 */
  label: { type: String, default: '文件' }
})

const fileName = ref('')
const actual = ref('')
const busy = ref(false)
const progress = ref(0)
const failed = ref(false)
const dragging = ref(false)

const normalized = (v) => String(v || '').trim().toLowerCase()

/** null 表示还没比过 */
const matches = computed(() =>
  actual.value ? normalized(actual.value) === normalized(props.expected) : null
)

async function check(file) {
  if (!file) return
  fileName.value = file.name
  actual.value = ''
  failed.value = false
  busy.value = true
  progress.value = 0
  try {
    actual.value = await hashFile(file, { onProgress: (r) => { progress.value = r } })
  } catch {
    failed.value = true
  } finally {
    busy.value = false
  }
}

function onPick(event) {
  check(event.target.files?.[0] ?? null)
}

function onDrop(event) {
  dragging.value = false
  check(event.dataTransfer?.files?.[0] ?? null)
}
</script>

<template>
  <div class="checker">
    <!-- 拖放区同时也是一个 <label>：点它会打开文件选择框。
         只做拖放的话，用触屏和用键盘的人就没法用了 -->
    <label
      class="drop"
      :class="{ 'is-dragging': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" class="sr-only" @change="onPick" />
      <span class="drop-icon" aria-hidden="true">◇</span>
      <span class="drop-main">把{{ label }}拖到这里，或点击选择</span>
      <span class="t-small t-soft">文件不会上传，哈希在你的浏览器里算完就结束了</span>
    </label>

    <p v-if="busy" class="line t-small t-soft" role="status">
      <BaseSpinner :size="16" />
      正在计算 SHA-256… <span class="t-nums">{{ Math.round(progress * 100) }}%</span>
    </p>

    <p v-else-if="failed" class="line t-small verdict-miss" role="alert">
      这个文件没能读取。换一个文件再试。
    </p>

    <div v-else-if="matches !== null" class="result" :class="matches ? 'is-hit' : 'is-miss'" role="status" aria-live="polite">
      <p class="verdict">
        <span class="mark" aria-hidden="true">{{ matches ? '●' : '✕' }}</span>
        <template v-if="matches">一致。你手上的这份就是存证记录里的那一份。</template>
        <template v-else>对不上。这份文件与存证记录里的不是同一份。</template>
      </p>
      <p class="t-small t-soft name">{{ fileName }}</p>
      <div v-if="!matches" class="compare">
        <div>
          <span class="t-label">存证记录</span>
          <HashText :value="expected" :copyable="false" />
        </div>
        <div>
          <span class="t-label">这个文件</span>
          <HashText :value="actual" :copyable="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.checker { display: grid; gap: var(--sp-3); }

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-5) var(--sp-4);
  border: 1px dashed var(--c-border-strong);
  border-radius: var(--r-sm);
  background: var(--c-bg);
  text-align: center;
  cursor: pointer;
  transition: border-color var(--ease), background var(--ease);
}
.drop:hover, .drop.is-dragging { border-color: var(--c-primary); background: var(--c-primary-weak); }
.drop-icon { font-size: 20px; color: var(--c-text-soft); }
.drop-main { font-weight: 600; }

.line { display: flex; align-items: center; gap: var(--sp-2); }

.result {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid currentColor;
  border-radius: var(--r-sm);
}
.is-hit { color: var(--c-verified); background: var(--c-verified-bg); }
.is-miss { color: var(--c-rejected); background: var(--c-rejected-bg); }
.verdict-miss { color: var(--c-rejected); }

.verdict { display: flex; align-items: flex-start; gap: var(--sp-2); font-weight: 600; }
.mark { line-height: 1.5; }
.name { word-break: break-all; }

.compare { display: grid; gap: var(--sp-2); color: var(--c-text); }
</style>
