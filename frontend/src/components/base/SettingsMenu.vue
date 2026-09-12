<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { settings } from '../../stores/settings.js'
import { session } from '../../stores/session.js'

/**
 * 齿轮。把两个只跟「怎么看」有关的开关收到一处，不让它们占界面。
 *
 * 里面只有两样：**视角**（用户 / 开发，开发视角多出组件预览入口）
 * 和**当前身份**（演示用）。
 *
 * 身份会作为请求头 X-Member-Id 发出去，视角完全不出前端。
 */
const open = ref(false)
const root = ref(null)

function toggle() {
  open.value = !open.value
  if (open.value) {
    document.addEventListener('pointerdown', onOutside, true)
    document.addEventListener('keydown', onKey)
  } else detach()
}

function close() {
  open.value = false
  detach()
}

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

onBeforeUnmount(detach)
</script>

<template>
  <div ref="root" class="settings" data-print="hide">
    <button
      type="button"
      class="gear"
      aria-label="设置"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggle"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6" />
        <path
          d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <div v-if="open" class="panel">
      <div class="group">
        <p class="t-label">视角</p>
        <div class="seg">
          <button
            type="button"
            :aria-pressed="settings.mode === 'user'"
            @click="settings.setMode('user')"
          >用户</button>
          <button
            type="button"
            :aria-pressed="settings.mode === 'dev'"
            @click="settings.setMode('dev')"
          >开发</button>
        </div>
        <p class="t-small t-soft note">开发视角会多出组件预览入口。</p>
      </div>

      <div class="group">
        <p class="t-label">当前身份</p>
        <div class="seg">
          <button
            v-for="m in session.members"
            :key="m"
            type="button"
            :aria-pressed="session.currentMemberId === m"
            @click="session.switchTo(m)"
          >{{ m }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings { position: relative; }

.gear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-soft);
  transition: color var(--ease), background var(--ease);
}
.gear:hover { color: var(--c-text); background: var(--c-bg); }
.gear[aria-expanded='true'] { color: var(--c-primary-text); background: var(--c-primary-weak); }

.panel {
  position: absolute;
  z-index: 30;
  top: calc(100% + var(--sp-2));
  right: 0;
  display: grid;
  gap: var(--sp-4);
  width: 240px;
  padding: var(--sp-4);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: var(--shadow-lg);
}

.group { display: grid; gap: var(--sp-2); }

/* 分段控件：两三个互斥选项挤在一条上，比一列单选按钮省地方 */
.seg {
  display: flex;
  gap: 0;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-sm);
  overflow: hidden;
}
.seg button {
  flex: 1;
  padding: var(--sp-2);
  border: none;
  background: var(--c-surface);
  color: var(--c-text-soft);
  font-size: 13px;
}
.seg button + button { border-left: 1px solid var(--c-border-subtle); }
.seg button:hover { background: var(--c-bg); }
.seg button[aria-pressed='true'] {
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-weight: 600;
}

.note { line-height: 1.4; }
</style>
