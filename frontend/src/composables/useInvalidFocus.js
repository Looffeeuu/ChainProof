import { nextTick } from 'vue'

/**
 * 校验没过时，把焦点送到第一个出错的控件上。
 *
 * **要解决的是什么。** 三个提交页的 submit() 原先都是这个形状：
 *
 * ```js
 * touched.title = true
 * if (!valid.value) return          // 就这么返回了
 * ```
 *
 * 如果出错的字段在视口外（里程碑提交页的比例分配器在整个表单的下半部分），
 * 用户点了「提交」，屏幕上不会有任何变化——按钮看起来像坏了。
 * 这是表单可用性里最常见也最容易修的一类缺陷。
 *
 * **为什么抽成一个函数。** 三处要用同一套行为：找哪个元素、
 * 聚焦与滚动的先后、减少动效时怎么退让。抄三遍就会出现三种。
 *
 * 找元素的依据是 `aria-invalid="true"`——`FormField` 已经在正确设置它，
 * 所以不需要额外的数据结构。兜底看 `data-invalid="true"`：
 * 自定义控件（比例分配器）里没有单一的「那个出错的输入框」，
 * 由它自己在容器上标一个可聚焦的落点。
 *
 * @param {HTMLElement|null} root 表单根元素
 * @returns {Promise<boolean>} 有没有找到并聚焦到某个元素
 */
export async function focusFirstInvalid(root) {
  // 等 DOM 把 aria-invalid 更新上去，再去找。
  // 不等的话找到的是上一次渲染的状态
  await nextTick()
  if (!root) return false

  const target =
    root.querySelector('[aria-invalid="true"]') ??
    root.querySelector('[data-invalid="true"]')
  if (!target) return false

  // preventScroll 让滚动完全交给下一行。不加的话浏览器会先跳一次、
  // 再平滑滚一次，看起来是抖了一下
  target.focus({ preventScroll: true })

  // 平滑滚动属于装饰性动效，系统开了「减少动态效果」时退回瞬移，
  // 与 styles/base.css 里那段 prefers-reduced-motion 的立场保持一致
  const smooth =
    typeof window !== 'undefined' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  target.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
  return true
}
