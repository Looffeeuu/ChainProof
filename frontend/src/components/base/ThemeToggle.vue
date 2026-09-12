<script setup>
import { computed } from 'vue'
import { settings, resolvedTheme } from '../../stores/settings.js'

/**
 * 主题开关。一个按钮，点一下往下轮：跟随系统 → 亮 → 暗 → 跟随系统。
 *
 * 为什么图标画的是**用户选的那个**（`settings.theme`）而不是实际生效的那个
 * （`resolvedTheme`）：选「跟随系统」时如果显示月亮，用户会以为自己选的是暗色，
 * 下次系统变亮他会觉得开关坏了。显示显示器图标才说得清「我把这件事交给系统了」。
 *
 * 三态轮转对只想换个颜色的人不够直白，所以 title 和读屏标签都写清了
 * 「现在是什么、点一下会变成什么」。
 */
const ORDER = ['system', 'light', 'dark']

const LABEL = {
  system: '跟随系统',
  light: '亮色',
  dark: '暗色'
}

const next = computed(() => ORDER[(ORDER.indexOf(settings.theme) + 1) % ORDER.length])

const title = computed(
  () =>
    `主题：${LABEL[settings.theme]}` +
    (settings.theme === 'system' ? `（当前为${LABEL[resolvedTheme.value]}）` : '') +
    ` · 点击切换为${LABEL[next.value]}`
)

function cycle() {
  settings.setTheme(next.value)
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    :title="title"
    :aria-label="title"
    data-print="hide"
    @click="cycle"
  >
    <!-- 跟随系统：一台显示器。不用「自动」这种字样，图标本身就说明了「交给设备」 -->
    <svg
      v-if="settings.theme === 'system'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>

    <!-- 亮色：太阳 -->
    <svg
      v-else-if="settings.theme === 'light'"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </svg>

    <!-- 暗色：月亮 -->
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.4A8.6 8.6 0 1 1 9.6 4a6.8 6.8 0 0 0 10.4 10.4Z" />
    </svg>
  </button>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-soft);
  transition: color var(--ease), background var(--ease);
}
.toggle:hover { color: var(--c-text); background: var(--c-bg); }
.toggle svg { width: 17px; height: 17px; }
</style>
