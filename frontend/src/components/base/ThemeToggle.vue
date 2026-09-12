<script setup>
import { computed } from 'vue'
import { settings, resolvedTheme } from '../../stores/settings.js'

/**
 * 主题开关：一枚按钮，在亮与暗之间切换。
 *
 * **这个组件被改过两次，两次的理由都记在这里，免得第三次又改回去。**
 *
 * 第一版是「点一下往下轮」的单按钮（跟随系统 → 亮 → 暗 → 跟随系统）。
 * 它有一个具体的毛病：选中亮色时画的太阳（圆 + 八条放射线）和旁边设置齿轮
 * （圆 + 八条放射线）在 17px 下轮廓完全一致，两个图标按钮并排分不清。
 *
 * 第二版据此改成了三格分段控件（跟随系统 / 亮 / 暗，带滑块）——形状和图标按钮
 * 不会混，顺带也解决了「不点开不知道现在是哪一态」。
 *
 * 现在是第三版，改回单按钮。理由是：**「必须是分段控件」这个结论搭在一个
 * 已经消失的前提上**。撞脸问题的另一半（把齿轮换成带头像和名字的身份胶囊）
 * 已经把它解决了，齿轮根本不存在了。而三格分段把「跟随系统」这个
 * **偏好设置**摆进了**即时操作**的位置——用户此刻想做的是「太亮了，换暗色」，
 * 不是「我要重新决定主题由谁决定」。
 *
 * 「跟随系统」没有被删掉，它移进了身份菜单（IdentityMenu）。
 * 首次打开仍然跟随系统偏好，只是这个低频选项不再占据侧栏的一格。
 *
 * **图标画的是「点了会变成什么」**，不是「现在是什么」——单按钮没有别的办法
 * 表达目标态。这和分段控件的规则正好相反（那边三个都摆着，画的是当前态），
 * 所以 title 与 aria-label 都把两头写全，不让人靠猜。
 */
const isDark = computed(() => resolvedTheme.value === 'dark')

const label = computed(() =>
  isDark.value ? '切换到亮色主题' : '切换到暗色主题'
)

const title = computed(() => {
  const now = isDark.value ? '暗色' : '亮色'
  const following = settings.theme === 'system' ? '（跟随系统）' : ''
  // 直接拼整句。原先写的是 label.slice(3)，想去掉「切换到」三个字，
  // 结果拼出来是「当前暗色 · 点击亮色主题」——句子不通。
  // 靠下标截字符串来复用文案，改一次文案就断一次
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
