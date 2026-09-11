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
export const session = reactive({
  /** 可选身份。真接口接上后这份名单由后端给，现在写死 */
  members: ['alice', 'bob', 'charlie'],
  currentMemberId: 'alice',

  switchTo(memberId) {
    if (this.members.includes(memberId)) this.currentMemberId = memberId
  }
})
