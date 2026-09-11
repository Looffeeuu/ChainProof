import { ref, shallowRef } from 'vue'

/**
 * 把一次异步调用变成 { data, loading, error, run } 三态（spec/02 §3.1、§3.2）。
 *
 * 存在的理由是 spec/01 §2.6 要求每个数据页都有空状态、加载态、错误态。
 * 如果每个页面自己写三个 ref，十几个页面就有十几套写法，漏一个也没人发现。
 * 统一成一个 composable 后，「三态齐全」变成一句模板惯例，不再靠自觉。
 *
 * @param {Function} fn 真正发请求的函数，返回 Promise
 * @param {{ immediate?: boolean, initial?: any }} [options]
 */
export function useAsync(fn, options = {}) {
  const { immediate = false, initial = null, lazy = false } = options

  // data 用 shallowRef：接口返回的是纯数据，页面只读不改，
  // 深层响应式在这里只会带来无谓的开销（长列表尤其明显）
  const data = shallowRef(initial)

  /**
   * **loading 默认从 true 开始**，这一条是白屏事故修出来的，改之前先读完：
   *
   * 组件的首次渲染发生在 `onMounted` 之前。如果 loading 初始是 false，
   * 那一瞬间三个状态是「没在加载、没出错、没数据」——AsyncSection 会认为
   * 数据已经到了，直接渲染数据分支，然后模板里的 `data.recent` 读到 null 抛错。
   * Vue 的渲染函数一抛错，整个应用挂不上去，用户看到的就是**一片空白**，
   * 而且控制台之外没有任何提示。
   *
   * 用 `watch(..., { immediate: true })` 触发的页面碰巧没事——watch 的回调在
   * setup 里同步执行，渲染前就把 loading 置成了 true。所以同一个 bug 只在
   * `onMounted(run)` 的页面上发作，更难被发现。
   *
   * 默认 true 的含义是「数据还没到」，这对**将要取数**的页面永远成立。
   * 确实不自动取数的（等用户输入才查的页面），传 `lazy: true`。
   */
  const loading = ref(!lazy)
  const error = ref(null)

  /**
   * 竞态计数器。快速切换项目时会连发两次请求，
   * 而它们的返回顺序不保证——先发的后回，页面就会显示上一个项目的数据。
   * 每次调用记下自己的序号，回来时如果序号已经不是最新的，就把结果丢掉。
   */
  let ticket = 0

  async function run(...args) {
    const mine = ++ticket
    loading.value = true
    error.value = null
    try {
      const result = await fn(...args)
      if (mine !== ticket) return undefined
      data.value = result
      return result
    } catch (e) {
      if (mine !== ticket) return undefined
      // 原样保留错误对象：ErrorNotice 要读它的 message 和 code
      error.value = e
      return undefined
    } finally {
      if (mine === ticket) loading.value = false
    }
  }

  if (immediate) run()

  return { data, loading, error, run }
}
