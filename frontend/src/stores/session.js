import { reactive } from 'vue'

/**
 * 演示身份。spec/02 §5.1 里「当前用户是谁怎么传」还没问 C 线，
 * 在有答复之前：前端自己维护一个身份，接口调用一律不带身份参数。
 *
 * 这不是登录。它的唯一用途是让演示时能切换视角——
 * 以 charlie 的身份打开待确认的里程碑，才能看到确认按钮。
 *
 * 为什么不用 Pinia：跨页面共享的状态目前只有这一个，
 * 一个 reactive 对象够用，多引一个依赖要多解释一层（spec/02 Q&A）。
 */
const MEMBERS = ['alice', 'bob', 'charlie']

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
  /** 可选身份。真接口接上后这份名单由后端给，现在写死 */
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
