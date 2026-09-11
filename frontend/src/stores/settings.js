import { reactive, watch } from 'vue'

/**
 * 界面设置。全部在前端，不经过任何接口。
 *
 * 目前只有一样东西：**视角**。
 *
 * - `user`：产品本身的样子。链上交易 ID、组件预览入口这些开发期的东西一律不显示。
 * - `dev`：多显示那些东西，方便观察和测试。
 *
 * 为什么要分：txId 是一串 64 位十六进制，对真正的使用者没有意义，
 * 但演示和排查时又必须看得见。与其在两种需要之间折中，不如让它可切换。
 *
 * 存在 localStorage 里，刷新不丢。读写都包了 try/catch——
 * 隐私窗口、禁用了站点数据的浏览器里，localStorage 的存取本身会抛错，
 * 那种情况下退回默认值继续用，不能让一个偏好设置把整个应用带崩。
 */
const KEY = 'chainproof.settings'

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const saved = load()

export const settings = reactive({
  /** 'user' | 'dev' */
  mode: saved.mode === 'dev' ? 'dev' : 'user',

  setMode(mode) {
    if (mode === 'user' || mode === 'dev') this.mode = mode
  }
})

/** 开发视角下才显示的东西，模板里用它判断，不要到处比较字符串 */
export function isDev() {
  return settings.mode === 'dev'
}

watch(
  () => settings.mode,
  (mode) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode }))
    } catch {
      // 存不下就算了，这一次会话内仍然是对的
    }
  }
)
