/**
 * 成员 → 人物色编号（1..4）。
 *
 * 为什么要抽出来：同一个人在界面上必须永远是同一个颜色，否则颜色不但没帮上忙，
 * 还制造了「这是两个人」的错觉。而原先两个地方各算各的——
 * `MemberAvatars` 按 ID 折算，`ContributionPanel` 按数组下标取，
 * 于是 bob 的头像是绿的、贡献比例条里那一段却是黄的。
 *
 * 按 ID 折算而不是按下标：下标会随列表内容变化，同一个人换个列表就换个颜色。
 *
 * 颜色本身是 tokens.css 里的 --c-member-N / --c-member-N-weak，
 * 刻意避开了三个状态色的色相（spec/01 §2.1）。
 */
export const MEMBER_TONE_COUNT = 4

export function memberTone(id) {
  let sum = 0
  for (const ch of String(id)) sum = (sum + ch.codePointAt(0)) % 997
  return (sum % MEMBER_TONE_COUNT) + 1
}
