import { ref } from 'vue'

/**
 * 一次性提示。跨一次路由跳转传递「刚才那一步成功了」。
 *
 * **为什么需要它。** 提交里程碑成功之后，代码直接 `router.push` 到详情页，
 * 屏幕上没有任何东西说「成功了」。用户在做的是**存证**——把一份成果写上链，
 * 这类操作之后最需要的恰恰是明确的确认。只靠「页面跳走了」来暗示成功，
 * 在网络慢、或跳过去的那一页自己还在加载时，尤其说不清楚。
 *
 * **为什么不用浮层 toast。** 三个理由：它会自己消失，演示时错过就没了；
 * 它脱离文档流，读屏要靠 aria-live 额外补；它盖在内容上，
 * 而这一句话本身就是这一页内容的一部分。渲染在目标页顶部则跟着滚动、
 * 能被读到、不会消失。
 *
 * **为什么不放 query 参数。** 刷新页面时提示会重复出现，
 * 而「刚才成功了」这件事只成立一次。
 */
const message = ref(null)

/** 发起方在 router.push 之前调 */
export function setFlash(text) {
  message.value = text
}

/**
 * 读一次就清空。组件在 setup 里调用，拿到的是本次跳转带来的那条。
 *
 * 「读走」而不是「读」：同一条提示只能被消费一次，
 * 否则用户在两个页面之间来回走，同一句「已提交」会反复出现。
 */
export function takeFlash() {
  const text = message.value
  message.value = null
  return text
}

/**
 * 丢掉还没被读走的那条。
 *
 * 换身份时要调：`AppShell` 的 `RouterView` 绑了 `:key="currentMemberId"`，
 * 换人会整棵重挂载，这时候还留着上一个身份的「你已提交…」会很怪。
 */
export function clearFlash() {
  message.value = null
}
