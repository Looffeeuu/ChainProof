/**
 * 公开验证页的结论。纯函数，不 import 本项目任何模块。
 *
 * **白名单判断。** 「不等于 NOT_FOUND 就算通过」会把任何没见过的取值都算成
 * 「与存证记录一致」，页面于是一边说一致、一边挂着别的徽章。
 *
 * **白名单里只有 `VALID`。** 证书的有效状态是 `VALID`，`VERIFIED` 是里程碑的状态
 * （docs/API.md §5、§6）。两个词同形不同义，**不要因为「后端可能沿用了那套词」
 * 就把 `VERIFIED` 也算成通过**——那等于把一个不符合契约的响应当成核验成功，
 * 而这一页是给项目外的人看的：它说「一致」就得真的有依据。
 *
 * @param {unknown} status 响应里的 verificationStatus
 * @returns {''|'missing'|'verified'|'other'}
 *   `''` 还没查 · `missing` 查无此证 · `verified` 有效 · `other` 查到了但不是有效状态
 */
export function verifyVerdict(status) {
  if (!status || typeof status !== 'string') return ''
  if (status === 'NOT_FOUND') return 'missing'
  if (status === 'VALID') return 'verified'
  return 'other'
}
