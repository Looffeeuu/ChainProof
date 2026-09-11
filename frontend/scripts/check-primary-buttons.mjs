/**
 * 主按钮数量自检。
 *
 *   npm run check:buttons
 *
 * spec/01 §3.2 第三条：「页面上主色按钮只有一个」。这条规则以前没有任何执行机制，
 * 结果三个页面同时违反了它，而且违反的位置全在空状态路径上——
 * 页头一个「创建项目」，空状态里又一个「创建项目」，两个一模一样的蓝按钮并排。
 *
 * **这个脚本能做什么、不能做什么，要说清楚：**
 *
 * 它数的是每个页面源码里写死的 `variant="primary"`。它**不能**证明
 * 「运行时同屏只有一个主按钮」——那要看条件渲染的实际结果，静态分析做不到。
 * 比如项目详情页有两处写死的主按钮，分别在「项目不存在」和「还没有里程碑」
 * 两个空状态里，它们互斥，永远不会同时出现。
 *
 * 它是一道**回归守卫**：下面记着每个页面当前有几个、为什么是这个数。
 * 数字对不上就报错，逼着改的人回来说明这个新按钮为什么该存在。
 * 真正的同屏检查仍然要靠浏览器里过一遍 spec/01 §3.2 的清单。
 *
 * 写成 `:variant="条件 ? 'secondary' : 'primary'"` 的动态按钮不计入——
 * 那正是「空状态出现时页头降级」的写法，是解决方案而不是问题。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const viewsDir = join(here, '..', 'src', 'views')

/** 每个页面允许几个写死的主按钮，以及为什么 */
const BASELINE = {
  'DashboardView.vue': [1, '空状态里的「创建项目」。页头那个是动态的，空状态出现时降为次按钮'],
  'ProjectListView.vue': [1, '同上'],
  'ProjectDetailView.vue': [2, '两个空状态各一个（项目不存在 / 还没有里程碑），互斥。页头那个是动态的'],
  'ProjectCreateView.vue': [1, '表单的提交按钮'],
  'MilestoneCreateView.vue': [1, '表单的提交按钮'],
  'MilestoneConfirmView.vue': [1, '「确认这份声明」。「拒绝」是次按钮——这一页的主操作是确认'],
  'CertificateView.vue': [1, '「打印 / 存为 PDF」'],
  'VerifyView.vue': [1, '「验证」。结果卡片里的「查看证书原件」是次按钮'],
  'NotFoundView.vue': [0, '只有一条返回链接'],
  'ComponentsPreviewView.vue': [-1, '组件预览页，本来就要把所有变体摆出来，不适用这条规则']
}

const files = readdirSync(viewsDir).filter((f) => f.endsWith('.vue'))
let failed = 0

for (const file of files) {
  const source = readFileSync(join(viewsDir, file), 'utf8')
  // 只数写死的。`:variant="..."` 是动态的，前面多一个冒号，这个正则不会匹配到
  const count = (source.match(/\bvariant="primary"/g) ?? []).length

  const entry = BASELINE[file]
  if (!entry) {
    failed++
    console.log(`FAIL  ${file}`)
    console.log(`        这是个新页面，BASELINE 里没有它。写死的主按钮有 ${count} 个，`)
    console.log('        请在 check-primary-buttons.mjs 的 BASELINE 里登记，并说明理由。')
    continue
  }

  const [expected, reason] = entry
  if (expected === -1) {
    console.log(`SKIP  ${file}  ${reason}`)
    continue
  }
  if (count !== expected) {
    failed++
    console.log(`FAIL  ${file}`)
    console.log(`        写死的主按钮有 ${count} 个，登记的是 ${expected} 个。`)
    console.log(`        登记理由：${reason}`)
    console.log('        如果这个新按钮确实该有，先确认它不会和别的主按钮同屏出现')
    console.log('        （spec/01 §3.2），再更新 BASELINE 与理由。')
    continue
  }
  console.log(`OK    ${file.padEnd(26)} ${count} 个 · ${reason}`)
}

console.log(`\n${files.length} 个页面，${failed} 个不通过。`)
process.exit(failed === 0 ? 0 : 1)
