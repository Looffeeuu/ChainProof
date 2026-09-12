/**
 * 「把它当成一个列表看」。纯函数，不 import 本项目任何模块（spec/02 §1.2 规则 4）。
 *
 * **为什么值得为这一行单开一个文件。** 接口回来的数组字段是白屏的主要来源：
 * `contributors`、`confirmations`、`members`、`milestoneIds` 只要不是数组，
 * 组件里那句 `.map` / `.find` / `.filter` 就抛 TypeError，
 * 而 Vue 的渲染函数一抛错，整个应用挂不上去——不是少一行，是整页白。
 *
 * 三种情况都会走到这里，而且都不是假想：
 *
 *   - **缺字段**：后端这一版还没实现这个字段；
 *   - **null**：数据库里是 NULL，序列化出来就是 null——
 *     `default: () => []` 挡不住它，Vue 的默认值只在 `undefined` 时生效；
 *   - **类型不对**：数组回成了对象，跨语言序列化的经典分歧。
 *
 * `?? []` 只挡得住前两种。第三种要靠 `Array.isArray`，所以统一走这个函数，
 * 而不是每处各写各的空值合并。
 *
 * 判据由 `scripts/check-malformed.mjs` 守着：它拿一份好数据逐字段做手脚，
 * 每种变体渲染一次，只判「没抛错」。
 *
 * @param {unknown} value
 * @returns {Array} 原数组，或一个空数组
 */
export function asList(value) {
  return Array.isArray(value) ? value : []
}

/**
 * 同上，另外把不是对象的元素滤掉。
 *
 * 列表里混进一个 `null`，`v-for` 里那句 `item.status` 照样抛。
 * 用于「元素本身是对象」的列表：里程碑、贡献者、表态记录。
 *
 * @param {unknown} value
 * @returns {object[]}
 */
export function asObjectList(value) {
  return asList(value).filter((item) => item && typeof item === 'object')
}
