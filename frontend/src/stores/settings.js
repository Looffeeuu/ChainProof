import { reactive, computed, watch } from 'vue'

/**
 * 界面设置。全部在前端，不经过任何接口。
 *
 * 两样：
 * - **视角** `mode`：`user` / `dev`。开发视角多出组件预览入口。
 * - **主题** `theme`：`system` / `light` / `dark`。
 *
 * 主题这里要分清两个概念，混用会导致「选了跟随系统，但切换器高亮在暗色上」：
 *
 * - `theme` 是**用户的显式选择**，可能就是 `'system'`。切换器 UI 绑这个。
 * - `resolvedTheme` 是**实际生效的是亮还是暗**。需要按主题分支的逻辑用这个。
 *
 * 存在 localStorage 里，刷新不丢。读写都包 try/catch——
 * 隐私窗口、禁用了站点数据的浏览器里，localStorage 的存取本身会抛错，
 * 那种情况下退回默认值继续用，不能让一个偏好设置把整个应用带崩。
 *
 * 首屏的主题不由这个文件负责：index.html 里有一段同步脚本，
 * 在绘制之前就把 data-theme 写好了，否则会闪一下。这里只负责之后的切换。
 */
const KEY = 'chainproof.settings'

const THEMES = ['system', 'light', 'dark']

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

const saved = load()

/** 系统当前偏向哪边。SSR 与不支持 matchMedia 的环境退回 light */
function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const settings = reactive({
  /** 'user' | 'dev' */
  mode: saved.mode === 'dev' ? 'dev' : 'user',

  /** 'system' | 'light' | 'dark'——用户的显式选择 */
  theme: THEMES.includes(saved.theme) ? saved.theme : 'system',

  /** 系统偏好的镜像。监听 change 时更新，用来算 resolvedTheme */
  systemDark: systemPrefersDark(),

  setMode(mode) {
    if (mode === 'user' || mode === 'dev') this.mode = mode
  },

  setTheme(theme) {
    if (THEMES.includes(theme)) this.theme = theme
  }
})

/** 开发视角下才显示的东西。模板里用它判断，不要到处比较字符串 */
export function isDev() {
  return settings.mode === 'dev'
}

/**
 * 实际生效的主题：'light' | 'dark'。
 * `theme === 'system'` 时由系统偏好决定，否则就是用户选的那个。
 */
export const resolvedTheme = computed(() =>
  settings.theme === 'system' ? (settings.systemDark ? 'dark' : 'light') : settings.theme
)

/** 把 theme 写到 <html data-theme> 上。'system' 时**移除**属性，交给媒体查询 */
function apply(theme) {
  if (typeof document === 'undefined') return
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

watch(() => settings.theme, apply)

watch(
  () => [settings.mode, settings.theme],
  ([mode, theme]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode, theme }))
    } catch {
      // 存不下就算了，这一次会话内仍然是对的
    }
  }
)

/**
 * 系统偏好变了要跟着变——但**只在 theme === 'system' 时**才有视觉效果，
 * 所以这里只更新镜像值，是否生效由 resolvedTheme 自己判断。
 */
if (typeof window !== 'undefined' && window.matchMedia) {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', (e) => {
    settings.systemDark = e.matches
  })
}
