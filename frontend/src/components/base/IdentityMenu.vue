<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
import { settings, resolvedTheme } from '../../stores/settings.js'
import { session } from '../../stores/session.js'

/**
 * 身份与视角菜单。侧栏最底下那一行，点开是一个向上弹的面板。
 *
 * **这个组件原来叫 SettingsMenu，触发器是一枚齿轮。三处重做：**
 *
 * 1. **齿轮换成身份胶囊。** 齿轮的画法是「圆 + 八条放射线」，
 *    和主题开关里的太阳同构，两个图标按钮并排根本分不清。
 *    而且面板里装的本来就不是「设置」，是「我现在以谁的身份在看」——
 *    直接把当前身份的头像和名字做成触发器，形状是胶囊不是图标，
 *    内容自解释，也就不需要一个抽象图标来代表它了。
 *
 * 2. **面板改成向上弹。** 原先写的是 `top: calc(100% + 8px)`，
 *    而触发器在 `height: 100vh` 的侧栏底部——面板整个落到视口外面去了，
 *    用户点开什么也看不见。桌面上必须向上弹（`bottom: 100%`）；
 *    窄屏时侧栏收到页面顶部，那时才向下弹，靠媒体查询切换，不需要 JS 测量。
 *
 * 3. **面板要有边界。** 原先背景取 `--c-surface`，而侧栏也是 `--c-surface`——
 *    亮色下两块纯白、暗色下两块 #191919，弹层和它下面的东西完全糊在一起。
 *    现在用专门的 `--c-raised` 再加一圈边框和大投影。
 *    （`--c-raised` 这个令牌一直定义着，但在此之前全工程没有一处用过。）
 *
 * 另外补了焦点归还：Esc 关闭后把焦点送回触发器，
 * 否则键盘用户关掉面板就「掉」到页面开头去了。
 */
const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const panel = ref(null)

async function toggle() {
  open.value = !open.value
  if (!open.value) return detach()

  document.addEventListener('pointerdown', onOutside, true)
  document.addEventListener('keydown', onKey)
  // 面板刚渲染出来，焦点送进去，键盘用户下一次 Tab 才落在面板内部
  await nextTick()
  panel.value?.querySelector('button')?.focus()
}

function close({ restoreFocus = false } = {}) {
  open.value = false
  detach()
  if (restoreFocus) trigger.value?.focus()
}

function onOutside(e) {
  if (!root.value?.contains(e.target)) close()
}

function onKey(e) {
  if (e.key === 'Escape') close({ restoreFocus: true })
}

function detach() {
  document.removeEventListener('pointerdown', onOutside, true)
  document.removeEventListener('keydown', onKey)
}

onBeforeUnmount(detach)

const initialOf = (id) => String(id).slice(0, 1).toUpperCase()

/**
 * 主题三态收在这里，侧栏那枚按钮只管亮暗互切。
 *
 * 「跟随系统」是**偏好设置**，不是用户此刻要做的事。把它和「亮」「暗」
 * 并列摆进侧栏，等于让一个一年动一次的选项常年占着一格；
 * 而收进这个面板之后，常用操作（换个颜色）仍然是一次点击。
 */
const THEMES = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮色' },
  { value: 'dark', label: '暗色' }
]
</script>

<template>
  <div ref="root" class="identity" data-print="hide">
    <button
      ref="trigger"
      type="button"
      class="trigger"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span class="avatar" aria-hidden="true">{{ initialOf(session.currentMemberId) }}</span>
      <span class="who">
        <span class="name">{{ session.currentMemberId }}</span>
        <!-- 开发视角是个非常态，常态下不占位置；一旦开着就必须一直看得见，
             否则用户会忘了自己为什么多出一个「组件预览」入口 -->
        <span v-if="settings.mode === 'dev'" class="t-label mode">开发视角</span>
      </span>
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m7 14.5 5-5 5 5" />
      </svg>
    </button>

    <div v-if="open" ref="panel" class="panel" role="dialog" aria-label="身份与视角">
      <div class="group">
        <p class="t-label">当前身份</p>
        <!-- 一人一行，不再挤成一条分段控件：三个 ID 塞进 208px 宽的胶囊里，
             每格只剩 66px，名字长一点就被截断 -->
        <button
          v-for="m in session.members"
          :key="m"
          type="button"
          class="row"
          :aria-pressed="session.currentMemberId === m"
          @click="session.switchTo(m); close()"
        >
          <span class="avatar sm" aria-hidden="true">{{ initialOf(m) }}</span>
          <span class="row-name">{{ m }}</span>
          <svg v-if="session.currentMemberId === m" class="tick" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </button>
        <p class="t-small t-soft note">不同成员看到的项目与待办不同。</p>
      </div>

      <div class="group">
        <p class="t-label">主题</p>
        <button
          v-for="t in THEMES"
          :key="t.value"
          type="button"
          class="row"
          :aria-pressed="settings.theme === t.value"
          @click="settings.setTheme(t.value)"
        >
          <span class="row-name">{{ t.label }}</span>
          <span v-if="t.value === 'system'" class="t-small t-soft">
            当前{{ resolvedTheme === 'dark' ? '暗色' : '亮色' }}
          </span>
          <svg v-if="settings.theme === t.value" class="tick" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7" />
          </svg>
        </button>
      </div>

      <div class="group">
        <p class="t-label">视角</p>
        <div class="seg">
          <button type="button" :aria-pressed="settings.mode === 'user'" @click="settings.setMode('user')">用户</button>
          <button type="button" :aria-pressed="settings.mode === 'dev'" @click="settings.setMode('dev')">开发</button>
        </div>
        <p class="t-small t-soft note">开发视角会多出一个组件预览入口。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.identity { position: relative; }

/* —— 触发器 —— */
.trigger {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-1) var(--sp-2) var(--sp-1) var(--sp-1);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text);
  text-align: left;
  transition: background var(--ease), border-color var(--ease);
}
.trigger:hover { background: var(--c-sunken); }
.trigger[aria-expanded='true'] {
  background: var(--c-sunken);
  border-color: var(--c-border-subtle);
}

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-size: var(--fs-small);
  font-weight: 640;
}
.avatar.sm { width: 22px; height: 22px; font-size: var(--fs-label); }

.who { flex: 1; min-width: 0; display: grid; }
.name {
  font-size: var(--fs-small);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* --fs-label 是排版档位里最小的一档（spec/01 §2.3）。这里原先是 10px，
   比规范里点名说过「投影仪上读不出来」的 11px 还小，而且没有登记 */
.mode { font-size: var(--fs-label); color: var(--c-chain); letter-spacing: 0.06em; }

.chev {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--c-text-soft);
  transition: transform var(--ease);
}
.trigger[aria-expanded='true'] .chev { transform: rotate(180deg); }

/* —— 面板 ——
   桌面上向**上**弹：触发器贴在 100vh 侧栏的底边，向下没有空间。 */
.panel {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + var(--sp-2));
  left: 0;
  right: 0;
  display: grid;
  gap: var(--sp-4);
  /* 内容再长也不许顶穿视口。侧栏两端各留 96px 的余量 */
  max-height: calc(100vh - 96px);
  overflow-y: auto;
  padding: var(--sp-3);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-lg);
  background: var(--c-raised);
  box-shadow: var(--shadow-lg);
}

.group { display: grid; gap: var(--sp-1); }
.group > .t-label { margin-bottom: var(--sp-1); padding-left: var(--sp-1); }

.row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1);
  border: none;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--c-text);
  font-size: var(--fs-small);
  text-align: left;
}
.row:hover { background: var(--c-sunken); }
.row[aria-pressed='true'] { background: var(--c-primary-weak); color: var(--c-primary-text); font-weight: 600; }
.row-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tick { width: 14px; height: 14px; flex-shrink: 0; }

/* 分段控件：两个互斥选项挤在一条上，比一列单选按钮省地方。

   这里原先靠 `overflow: hidden` 让子按钮的直角被外框的圆角切掉，
   代价是**两个按钮的键盘焦点框整圈都被裁没了**——outline 同样受祖先裁剪。
   改成把圆角直接给首尾两个按钮，外框不再裁任何东西。 */
.seg {
  display: flex;
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-xs);
}
.seg button {
  flex: 1;
  padding: var(--sp-1) var(--sp-2);
  border: none;
  background: var(--c-raised);
  color: var(--c-text-soft);
  font-size: var(--fs-small);
}
.seg button:first-child { border-radius: calc(var(--r-xs) - 1px) 0 0 calc(var(--r-xs) - 1px); }
.seg button:last-child { border-radius: 0 calc(var(--r-xs) - 1px) calc(var(--r-xs) - 1px) 0; }
.seg button + button { border-left: 1px solid var(--c-border-subtle); }
.seg button:hover { background: var(--c-sunken); }
.seg button[aria-pressed='true'] {
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-weight: 600;
}

.note { padding: 0 var(--sp-1); line-height: 1.4; }

/* 窄屏：侧栏收到页面顶部，触发器上方没有空间，改成向下弹并右对齐。
   这时侧栏是横向的，面板不能再跟着它拉满宽度 */
@media (max-width: 900px) {
  .panel {
    top: calc(100% + var(--sp-2));
    bottom: auto;
    left: auto;
    right: 0;
    width: 240px;
    max-height: calc(100vh - 120px);
  }
  .who { display: none; }
  .chev { display: none; }
  .trigger { width: auto; padding: var(--sp-1); }
}
</style>
