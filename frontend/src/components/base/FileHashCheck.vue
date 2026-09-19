<script setup>
import { ref, computed } from 'vue'
import HashText from './HashText.vue'
import BaseSpinner from './BaseSpinner.vue'
import { hashFile } from '../../utils/sha256.js'
import { MAX_FILE_LABEL, formatBytes, isTooLarge } from '../../utils/file-limit.js'

/**
 * 「把文件拖进来，我算给你看对不对」——把「核对这串哈希」从一句话变成一个动作。
 *
 * **文件不会上传**，计算全在浏览器里（utils/sha256.js），没有任何网络请求。
 * 这一点必须在界面上说出来：要人把一份还没公开的成果拖进网页，
 * 他得先知道文件不会离开自己的电脑。
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
/** 超过上传上限的文件的大小；0 表示没超 */
const oversize = ref(0)
const dragging = ref(false)

const normalized = (v) => String(v || '').trim().toLowerCase()

/** null 表示还没比过 */
const matches = computed(() =>
  actual.value ? normalized(actual.value) === normalized(props.expected) : null
)

/**
 * 和提交页同一套票据 + 取消。理由见 MilestoneCreateView.pickFile 的注释：
 * 连着拖两个文件进来时，先发起的那次会把后发起的结果覆盖掉，
 * 于是「一致 / 不一致」这个结论对应的是**上一个**文件。
 * 这一页是给人核对证据用的，结论对错了比不给结论更糟。
 */
let checkSeq = 0
let checkAbort = null

async function check(file) {
  if (!file) return

  checkAbort?.abort()
  checkAbort = new AbortController()
  const mine = ++checkSeq
  const controller = checkAbort

  fileName.value = file.name
  actual.value = ''
  failed.value = false
  oversize.value = 0

  // 超过上传上限的文件不可能是这里存证的那一份（后端收不下它），不必算。
  // 算的话原生路径会把整个文件读进内存，几 GB 的文件能让标签页崩掉
  if (isTooLarge(file)) {
    busy.value = false
    oversize.value = file.size
    return
  }

  busy.value = true
  progress.value = 0
  try {
    const hash = await hashFile(file, {
      signal: controller.signal,
      onProgress: (r) => { if (mine === checkSeq) progress.value = r }
    })
    if (mine !== checkSeq) return
    actual.value = hash
  } catch (e) {
    if (e?.name === 'AbortError' || mine !== checkSeq) return
    failed.value = true
  } finally {
    if (mine === checkSeq) busy.value = false
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
      <span class="drop-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 15.5V4.2" />
          <path d="m7.6 8.6 4.4-4.4 4.4 4.4" />
          <path d="M4 15v3.4A1.6 1.6 0 0 0 5.6 20h12.8a1.6 1.6 0 0 0 1.6-1.6V15" />
        </svg>
      </span>
      <span class="drop-main">把{{ label }}拖到这里，或点击选择</span>
      <span class="t-small t-soft">核对不会上传文件，哈希在你的浏览器里算完就结束了</span>
    </label>

    <p v-if="busy" class="line t-small t-soft" role="status">
      <BaseSpinner :size="16" />
      正在计算 SHA-256… <span class="t-nums">{{ Math.round(progress * 100) }}%</span>
    </p>

    <p v-else-if="failed" class="line t-small verdict-miss" role="alert">
      这个文件没能读取，换一个再试。
    </p>

    <p v-else-if="oversize" class="line t-small t-soft" role="status">
      {{ fileName }} 有 {{ formatBytes(oversize) }}，超过了单个文件 {{ MAX_FILE_LABEL }} 的上传上限，不会是这里存证的那一份，所以没有计算。
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
/* :focus-within 是必须的。里面那个 file input 是 .sr-only（1px + clip），
   焦点框画在那 1px 上等于看不见——键盘用户 Tab 到这里，屏幕上没有任何反应。
   把焦点表现画在拖放区本身上 */
.drop:hover,
.drop.is-dragging { border-color: var(--c-primary); background: var(--c-primary-weak); }
.drop:focus-within {
  border-color: var(--c-primary);
  border-style: solid;
  outline: 2px solid var(--c-focus);
  outline-offset: 2px;
}
.drop-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-sm);
  background: var(--c-surface);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
  color: var(--c-text-soft);
}
.drop-icon svg { width: 19px; height: 19px; }
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
