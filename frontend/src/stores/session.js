import { reactive } from 'vue'

/**
 * 演示身份。真接口靠请求头 `X-Member-Id` 认人（docs/API.md §0），
 * 由 `api/client.js` 在每个请求上从这里读当前身份统一加上，资源函数不用管。
 *
 * 这不是登录。它的唯一用途是让演示时能切换视角——
 * 以 charlie 的身份打开待确认的里程碑，才能看到确认按钮。
 *
 * 为什么不用 Pinia：跨页面共享的状态目前只有这一个，
 * 一个 reactive 对象够用，多引一个依赖要多解释一层（spec/02 Q&A）。
 */
const DEFAULT_MEMBERS = ['alice', 'bob', 'charlie']

/**
 * 可切换的身份名单。默认就是假数据里的三个人（`mock/fixtures.js`）。
 *
 * 联调时真环境里的成员 ID 不是这三个，所以允许在 `frontend/.env.local` 里覆盖：
 *
 *   VITE_DEMO_MEMBERS=alice,bob,empty-test-20260921
 *
 * **空状态这一条必须靠它验**：要看「一个项目都没有」的那一屏，就得以一个
 * 不属于任何项目的成员身份发请求，而那个 ID 不在默认名单里——名单写死的话，
 * 菜单里选不到它，请求头也就带不出去。
 *
 * 名单为空或没配时退回默认三人，跑假数据的行为一个字都没变。
 */
const configured = String((import.meta.env ?? {}).VITE_DEMO_MEMBERS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const MEMBERS = configured.length > 0 ? configured : DEFAULT_MEMBERS

const KEY = 'chainproof.session'

/**
 * 身份要能扛住一次刷新。
 *
 * 不存的话，整页刷新、从地址栏直接打开某一页、把链接发给别人，
 * 身份都会悄悄回到 alice——而「同一条记录在不同成员眼里不一样」正是要演示的东西，
 * 演示中途刷一次页面就演砸了。主题这种低频偏好都存了，这个更该存。
 *
 * try/catch 与 globalThis：隐私窗口里读 localStorage 本身会抛错，
 * 服务端渲染时它根本不存在。
 */
function load() {
  try {
    const saved = globalThis.localStorage?.getItem(KEY)
    return MEMBERS.includes(saved) ? saved : MEMBERS[0]
  } catch {
    return MEMBERS[0]
  }
}

export const session = reactive({
  /** 可选身份。真接口接上后这份名单由后端给，现在来自默认值或 VITE_DEMO_MEMBERS */
  members: MEMBERS,
  currentMemberId: load(),

  switchTo(memberId) {
    if (!this.members.includes(memberId)) return
    this.currentMemberId = memberId
    try {
      globalThis.localStorage?.setItem(KEY, memberId)
    } catch {
      // 存不下就算了，这一次会话内仍然是对的
    }
  }
})
