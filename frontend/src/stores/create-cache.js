import { shallowRef } from 'vue'

/**
 * 一份「取一次、共享给所有人」的缓存。
 *
 * 三件事一起做，缺一件都会出问题：
 *
 * 1. **合并同时发起的请求**（single flight）。侧栏与页面几乎同时挂载，
 *    只判断 `data` 为空的话，第一次还没回来第二次就进来了，照样发两次。
 * 2. **失效之后立刻重取**。只置空缓存，侧栏的计数与「最近项目」会整块消失，
 *    一直到用户自己走到某个会取数的页面为止。
 * 3. **旧请求不许写新缓存**（下面这个 `version`）。
 *
 * 第 3 条是 PR #13 review 指出的缺陷。没有它时：以 alice 打开页面，
 * 首次请求还在飞就切到 bob，`invalidate()` 发起 bob 的请求；如果 alice 的响应
 * **后**到达，它会把 bob 的结果覆盖成 alice 的项目列表，而界面上显示的身份是 bob。
 * 接口按 `X-Member-Id` 过滤，这等于把别人的项目列表摆在当前用户眼前。
 *
 * 每次 `invalidate()` 把 `version` 加一；每个请求记下发起时的 `version`，
 * 回来时对不上就**整个作废**：不写 `data`，也不碰 `inflight`
 * （不检查身份而直接清 `inflight`，会把正在飞的新请求的记录清掉，
 * 后来者于是又发一次，白跑一趟）。
 *
 * @param {() => Promise<any>} fetcher 真正发请求的函数
 */
export function createCache(fetcher) {
  const data = shallowRef(null)
  let inflight = null
  let version = 0

  function start() {
    const mine = version
    const promise = fetcher()
      .then((rows) => {
        // 作废的那次只把结果还给它自己的调用方，不写进共享缓存
        if (mine === version) data.value = rows
        return rows
      })
      .finally(() => {
        // 只清掉自己那一条记录。身份对不上时 inflight 指向的是新请求
        if (inflight === promise) inflight = null
      })
    return promise
  }

  /** 已经有了就直接给，正在取就等同一个请求 */
  function ensure() {
    if (data.value) return Promise.resolve(data.value)
    if (!inflight) inflight = start()
    return inflight
  }

  /**
   * 让缓存失效并**立刻重取**。
   * 失败时吞掉异常：调用方大多不 await 它，不吞会变成一次未处理的 Promise 拒绝。
   * 真正需要显示错误的地方自己也调了 `ensure()`，那一次会共用同一个请求。
   */
  function invalidate() {
    version += 1
    data.value = null
    inflight = null
    return ensure().catch(() => {})
  }

  return { data, ensure, invalidate }
}
