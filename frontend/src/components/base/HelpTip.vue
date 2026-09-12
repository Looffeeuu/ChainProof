<script setup>
import { ref, onBeforeUnmount } from 'vue'

/**
 * 一个问号，点开才出解释。
 *
 * 存在的理由：有些东西确实需要一句说明（哈希是什么、比例为什么必须是 100），
 * 但把说明常驻在界面上，等于让每个用过一次的人每次都再读一遍。
 * 收进问号里，需要的人点一下，不需要的人看不见。
 *
 * 用法：
 *   <HelpTip title="文件哈希">
 *     文件内容的指纹。改动一个字节，这串数就完全不同。
 *   </HelpTip>
 *
 * 无障碍：问号本身是 button（可聚焦、可回车触发），
 * aria-expanded 告诉读屏它是展开还是收起。
 */
defineProps({
  /** 弹出层的小标题，可以不给 */
  title: { type: String, default: '' },
  /** 按钮的无障碍标签，默认「说明」 */
  label: { type: String, default: '说明' }
})

const open = ref(false)
const root = ref(null)

function toggle() {
  open.value = !open.value
  if (open.value) {
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
  } else {
    detach()
  }
}

function close() {
  open.value = false
  detach()
}

// 点别处就关。用 pointerdown 而不是 click：
// 点到页面上某个按钮时，希望先把弹层关掉，再让那个按钮响应
function onOutside(e) {
  if (!root.value?.contains(e.target)) close()
}

function onKey(e) {
  if (e.key === 'Escape') close()
}

function detach() {
  document.removeEventListener('pointerdown', onOutside, true)
  document.removeEventListener('keydown', onKey)
}

// 组件没了监听还挂在 document 上，就是一处泄漏
onBeforeUnmount(detach)
</script>

<template>
  <span ref="root" class="help">
    <button
      type="button"
      class="dot"
      :aria-label="label"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggle"
    >?</button>

    <span v-if="open" class="pop" role="tooltip">
      <strong v-if="title" class="pop-title">{{ title }}</strong>
      <span class="pop-body"><slot /></span>
    </span>
  </span>
</template>

<style scoped>
.help { position: relative; display: inline-flex; vertical-align: middle; }

.dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid var(--c-border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--c-text-soft);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.dot:hover { color: var(--c-primary-text); border-color: var(--c-primary); }

.pop {
  position: absolute;
  z-index: 20;
  top: calc(100% + var(--sp-2));
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: var(--sp-1);
  width: max-content;
  max-width: 260px;
  padding: var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--c-text);
  text-align: left;
  white-space: normal;
}

.pop-title { font-weight: 600; }
.pop-body { color: var(--c-text-soft); }

/* 靠近右边缘时往左让一让，否则会被内容区裁掉 */
@media (max-width: 560px) {
  .pop { left: auto; right: 0; transform: none; max-width: 70vw; }
}
</style>
