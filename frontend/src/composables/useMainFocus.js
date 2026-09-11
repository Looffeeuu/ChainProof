import { ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 切页之后把焦点移到主内容区。
 *
 * 单页应用换页时浏览器不会像整页刷新那样重置焦点——它还停在你刚点的那个链接上。
 * 对用鼠标的人没影响，对用键盘和读屏的人影响很大：
 * 点了侧栏的「项目」，页面换了，但下一次按 Tab 是从侧栏第二项继续，
 * 而读屏软件不会念出「现在是项目列表页」，因为它不知道发生过跳转。
 *
 * 做法是给 <main> 一个 tabindex="-1"（可以被脚本聚焦，但不进 Tab 顺序），
 * 每次路由变化后聚焦它。读屏会从这里开始念新页面的内容。
 *
 * 首次加载不聚焦——那时用户还没做任何跳转动作，抢焦点反而突兀。
 *
 * @returns {import('vue').Ref<HTMLElement|null>} 绑到 <main> 上的 ref
 */
export function useMainFocus() {
  const main = ref(null)
  const route = useRoute()

  watch(
    () => route.fullPath,
    async () => {
      await nextTick()
      main.value?.focus()
    }
  )

  return main
}
