import { ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'

/**
 * 切页后把焦点移到主内容区。
 *
 * 单页应用换页不重置焦点，它还停在刚点过的链接上——键盘用户下一次按 Tab
 * 从侧栏继续，读屏也不知道发生过跳转。首次加载不聚焦：那时还没有跳转动作。
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
