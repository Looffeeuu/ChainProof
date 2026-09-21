/**
 * 主按钮数量自检（spec/01 §3.2：「页面上主色按钮只有一个」）。
 *
 * **它数的是源码里写死的 `variant="primary"`，不能证明运行时同屏只有一个**——
 * 条件渲染的实际结果静态分析看不到。比如项目详情页两处写死的主按钮
 * 分别在两个互斥的空状态里，永远不同时出现。
 * 真正的同屏检查仍要在浏览器里过一遍。
 *
 * 它是回归守卫：下面记着每页当前几个、为什么。数字对不上就报错，
 * 逼改的人回来说明新按钮为什么该存在。
 * 动态写法 `:variant="条件 ? 'secondary' : 'primary'"` 不计入——那是解决方案。
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
  // 2 个但不同屏：证书读到了才有「打印 / 存为 PDF」，读不到才有空状态里的「回到概览」。
  // 这一条在把 check:buttons 接进 npm run check 之前一直是红的，只是没人跑过它
  'CertificateView.vue': [2, '「打印 / 存为 PDF」，以及证书不存在时空状态里的「回到概览」，两者互斥'],
  'VerifyView.vue': [1, '「验证」。结果卡片里的「查看证书原件」是次按钮'],
  'NotFoundView.vue': [1, '空状态里的「返回概览」。这一页只有这一个动作'],
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
