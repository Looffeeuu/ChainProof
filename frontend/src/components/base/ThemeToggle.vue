<script setup>
import { computed } from 'vue'
import { settings, resolvedTheme } from '../../stores/settings.js'

/**
 * 主题开关：一枚按钮，在亮与暗之间切换。
 *
 * 只做亮暗互切。「跟随系统」是**偏好设置**不是**即时操作**，
 * 它在身份菜单（IdentityMenu）里；用户点这枚按钮时想的是「太亮了，换暗色」，
 * 不是「我要重新决定主题由谁决定」。首次打开仍然跟随系统偏好。
 *
 * **图标画的是「点了会变成什么」**，不是「现在是什么」——单按钮没有别的办法
 * 表达目标态，所以 title 与 aria-label 都把两头写全，不让人靠猜。
 */
const isDark = computed(() => resolvedTheme.value === 'dark')

const label = computed(() =>
  isDark.value ? '切换到亮色主题' : '切换到暗色主题'
)

const title = computed(() => {
  const now = isDark.value ? '暗色' : '亮色'
  const following = settings.theme === 'system' ? '（跟随系统）' : ''
  // 整句直接拼。靠下标截另一句文案来复用（label.slice(3)）改一次就断一次
  return `当前${now}${following} · ${label.value}`
})

function toggle() {
  // 点过之后就是显式选择，不再跟随系统。要回到跟随系统，走身份菜单里的主题分组
  settings.setTheme(isDark.value ? 'light' : 'dark')
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    :title="title"
    :aria-label="label"
    data-print="hide"
    @click="toggle"
  >
    <!-- 暗色时画太阳（点它去亮色） -->
    <svg
      v-if="isDark"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </svg>

    <!-- 亮色时画月亮（点它去暗色） -->
    <svg
      v-else
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
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
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-soft);
  transition: color var(--ease-in), background var(--ease-in);
}
.toggle:hover {
  color: var(--c-text);
  background: var(--c-sunken);
  border-color: var(--c-border-subtle);
}
.toggle svg { width: 17px; height: 17px; }
</style>
