/**
 * 界面文案自检：模板里不许出现内部词汇。
 *
 *   npm run check:copy
 *
 * 依据 spec/01 §2.10 规则 3。这条规则要挡的不是错别字，是**读者搞错了**：
 * 界面文字的读者是用产品的人，而这些词只有改代码的人才需要知道。
 * 出现过的实例：
 *
 *   「演示用。身份会作为请求头 X-Member-Id 发出去。」
 *   「开发视角多一个组件预览入口，不出前端。」
 *
 * **这个脚本抓不到语气问题**——「向用户解释实现」是一种口吻，不是一组词，
 * 没有办法用字符串匹配判断。它只守住最容易复发的那一类：
 * 把注释里的说法直接搬进界面。语气仍然要靠人读一遍（spec/01 §2.10）。
 *
 * 扫的是 `<template>` 块，而且去掉了注释——注释里写着
 * 「原先这里是『请求头 X-Member-Id』，已删」是合理的，那正是我们想留下的记录。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')

/**
 * 禁用词与它为什么不该出现在界面上。
 *
 * 只收「一出现就几乎必错」的词。像「组件」这种——
 * 「组件预览」是开发视角里一个真实存在的页面名，用户看到它是对的——
 * 收进来只会制造噪音，久了就没人看这份输出了。
 */
const BANNED = [
  ['演示用', '把「这是个演示」告诉用户，等于告诉他这个功能是假的'],
  ['假数据', '同上，而且用户不需要知道数据从哪来'],
  ['假接口', '同上'],
  ['请求头', '传输细节'],
  ['X-Member-Id', '传输细节，而且是内部约定的头名'],
  ['接口', '用户不调接口，他用的是页面'],
  ['后端', '前后端是团队的分工，不是用户看到的东西'],
  ['服务端', '同上'],
  ['不出前端', '同上'],
  ['字段', '数据结构的说法'],
  ['落库', '存储实现'],
  ['mock', '内部术语'],
  ['Mock', '内部术语'],
  // 技术栈名字。用户买的是「存证」，不是「Fabric」；
  // 而且这类词往往紧跟在一个已经说清楚的标签后面，纯属重复
  ['Fabric', '技术栈名字。旁边的标签已经说了「链上交易」，再点名实现只是重复'],
  ['Hyperledger', '同上'],
  ['Vue', '同上'],

  // 构建与部署配置。曾经有一句给部署者的提示写在证书页上，
  // 理由是「打印时隐藏」——但屏幕上任何人都看得见，包括答辩的评委
  ['.env', '构建配置。需要它的人应当在开发视角下看到，不是所有人'],
  ['VITE_', '同上'],
  ['localStorage', '存储实现'],
  ['重新构建', '构建流程，不是用户能做的事']
]

/** 开发视角下才出现的**页面**，它的读者就是改代码的人，整页不适用 */
const EXEMPT = ['views/ComponentsPreviewView.vue']

/**
 * 登记在册的例外。键是 `文件:词`，值是理由。
 *
 * 和 check-spacing 用同一套机制：**不放宽词表，而是逐条登记并写明理由。**
 * 放宽词表会让这些词在任何地方都合法；登记只放行这一处，
 * 别的地方再出现照样报错。
 *
 * 写理由时要能回答「为什么这句话的读者确实不是最终用户」。
 * 回答不了就说明它该改，不该登记。
 */
const REGISTERED = {
  'views/CertificateView.vue:.env':
    '给部署者的提示。模板里带 v-if="originIsLocal"，而 originIsLocal 的第一个条件就是 isDev()——用户视角下根本不渲染。脚本看不出 v-if，所以登记',
  'views/CertificateView.vue:VITE_': '同上，同一句话',
  'views/CertificateView.vue:重新构建': '同上，同一句话'
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

/** 取出 <template> 块并去掉里面的注释 */
function templateOf(text) {
  const start = text.indexOf('<template>')
  if (start === -1) return ''
  const end = text.lastIndexOf('</template>')
  if (end === -1) return ''
  return text
    .slice(start, end)
    .replace(/<!--[\s\S]*?-->/g, '')
}

let failed = 0
let scanned = 0

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/')
  if (EXEMPT.includes(rel)) {
    console.log(`SKIP  ${rel.padEnd(46)} 开发视角页面，不适用`)
    continue
  }

  const tpl = templateOf(readFileSync(file, 'utf8'))
  if (!tpl) continue
  scanned++

  const hits = []
  tpl.split(/\r?\n/).forEach((line, i) => {
    for (const [word, why] of BANNED) {
      if (!line.includes(word)) continue
      // 登记过的例外：只放行这一个文件里的这一个词
      if (REGISTERED[`${rel}:${word}`]) continue
      hits.push({ line: i + 1, word, why, text: line.trim() })
    }
  })

  if (hits.length === 0) {
    console.log(`OK    ${rel}`)
    continue
  }

  failed += hits.length
  console.log(`FAIL  ${rel}`)
  for (const h of hits) {
    console.log(`        「${h.word}」——${h.why}`)
    console.log(`        ${h.text.slice(0, 90)}`)
  }
}

const registered = Object.keys(REGISTERED).length
console.log(
  failed === 0
    ? `\n扫了 ${scanned} 个模板，没有内部词汇（${registered} 处已登记的例外）。`
    : `\n${failed} 处内部词汇，见 spec/01 §2.10。`
)
process.exit(failed === 0 ? 0 : 1)
