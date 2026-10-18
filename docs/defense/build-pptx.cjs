// 生成 docs/defense/ChainProof-答辩.pptx
//
// pptxgenjs 不是项目依赖，在临时目录装一次即可：
//   mkdir -p /tmp/pptgen && cd /tmp/pptgen && npm i pptxgenjs@3.12.0
//   NODE_PATH=/tmp/pptgen/node_modules node docs/defense/build-pptx.cjs \
//     docs/defense/screenshots docs/defense/ChainProof-答辩.pptx
//
// 截图由前端 Mock 模式（npm run dev）+ headless Chrome 1440×900、1.5 倍缩放截取。

const PptxGenJS = require('pptxgenjs')
const path = require('path')

const SHOTS = process.argv[2]
const OUT = process.argv[3]
const shot = (n) => path.join(SHOTS, `${n}.png`)

const C = {
  ink: '0F172A', soft: '475569', faint: '94A3B8', line: 'E2E8F0',
  bg: 'F4F6FB', card: 'FFFFFF', brand: '3438C8', brandSoft: 'E6E8FB',
  ok: '15803D', okSoft: 'DCFCE7', warn: 'B45309', warnSoft: 'FEF3C7',
  bad: 'B91C1C', badSoft: 'FEE2E2', teal: '0F766E',
}
const FONT = 'Microsoft YaHei'
const MONO = 'Consolas'

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE' // 13.333 x 7.5 in
pptx.title = 'ChainProof 答辩'
pptx.theme = { headFontFace: FONT, bodyFontFace: FONT }

const W = 13.333
const TOTAL = 13
let pageNo = 0

function base(title, kicker) {
  const s = pptx.addSlide()
  pageNo++
  s.background = { color: C.bg }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.brand }, line: { color: C.brand } })
  if (kicker) s.addText(kicker, { x: 0.6, y: 0.35, w: 8, h: 0.35, fontSize: 12, color: C.brand, bold: true, fontFace: FONT, charSpacing: 2 })
  s.addText(title, { x: 0.6, y: 0.68, w: 12, h: 0.75, fontSize: 30, bold: true, color: C.ink, fontFace: FONT })
  s.addText(`ChainProof · ${pageNo} / ${TOTAL}`, { x: 9.8, y: 7.0, w: 3.2, h: 0.3, fontSize: 10, color: C.faint, align: 'right', fontFace: FONT })
  return s
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: opts.fill || C.card }, line: { color: opts.line || C.line, width: 1 },
  })
}

function bullets(s, items, x, y, w, h, size = 16) {
  s.addText(items.map((t) => ({ text: t, options: { bullet: { code: '25CF' }, paraSpaceAfter: 8 } })), {
    x, y, w, h, fontSize: size, color: C.ink, fontFace: FONT, valign: 'top', lineSpacingMultiple: 1.15,
  })
}

function image(s, name, x, y, w) {
  s.addImage({ path: shot(name), x, y, w, h: w / 1.6 })
  s.addShape(pptx.ShapeType.rect, { x, y, w, h: w / 1.6, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: C.line, width: 1 } })
}

function pill(s, text, x, y, w, color, fill) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.42, rectRadius: 0.21, fill: { color: fill }, line: { color } })
  s.addText(text, { x, y, w, h: 0.42, fontSize: 13, bold: true, color, align: 'center', valign: 'middle', fontFace: FONT })
}

function arrow(s, x1, y1, x2, y2, color = C.faint) {
  // OOXML 不允许负宽高：向上的线用 flipV 表示
  const up = y2 < y1
  s.addShape(pptx.ShapeType.line, {
    x: x1, y: up ? y2 : y1, w: x2 - x1, h: Math.abs(y2 - y1), flipV: up,
    line: { color, width: 1.5, endArrowType: 'triangle' },
  })
}


// 讲稿备注：主讲人 + 建议时长 + 要点。7 分钟 = PPT 约 4:10 + 现场演示 2:45
function notes(s, who, time, text) {
  s.addNotes(`【主讲】${who}　【建议时长】${time}\n\n${text}`)
}

const PART1 = '一 · 研发意义'
const PART2 = '二 · 技术与架构'
const PART3 = '三 · 功能演示'
const PART4 = '四 · 总结与思考'

// 1 封面 ---------------------------------------------------------------------
{
  const s = pptx.addSlide()
  pageNo++
  s.background = { color: C.brand }
  s.addText('区块链技术应用实践 · 课程大作业　|　ChainProof 组', { x: 0.9, y: 1.3, w: 11, h: 0.4, fontSize: 16, color: 'C7CAF5', fontFace: FONT })
  s.addText('ChainProof', { x: 0.9, y: 1.8, w: 11, h: 1.2, fontSize: 60, bold: true, color: 'FFFFFF', fontFace: FONT })
  s.addText('基于 Hyperledger Fabric 的团队成果与贡献可信存证平台', { x: 0.9, y: 3.0, w: 11.5, h: 0.7, fontSize: 26, color: 'FFFFFF', fontFace: FONT })
  s.addShape(pptx.ShapeType.line, { x: 0.9, y: 4.05, w: 2.2, h: 0, line: { color: 'FFFFFF', width: 2 } })
  s.addText([
    { text: '全书阅（组长）', options: { bold: true, color: 'FFFFFF' } }, { text: '　后端 / 集成\n', options: { color: 'C7CAF5' } },
    { text: '杨宇', options: { bold: true, color: 'FFFFFF' } }, { text: '　前端 / 产品\n', options: { color: 'C7CAF5' } },
    { text: '黄铭谦', options: { bold: true, color: 'FFFFFF' } }, { text: '　区块链 / 智能合约', options: { color: 'C7CAF5' } },
  ], { x: 0.9, y: 4.3, w: 8, h: 1.5, fontSize: 17, fontFace: FONT, lineSpacingMultiple: 1.35 })
  s.addText('2026 年 11 月', { x: 0.9, y: 6.3, w: 6, h: 0.4, fontSize: 14, color: 'C7CAF5', fontFace: FONT })
  notes(s, '杨宇', '0:10', '「大家好，我们是 ChainProof 组，作品是基于 Hyperledger Fabric 的团队成果与贡献可信存证平台。」介绍三位成员分工。')
}

// 2 研发意义 -------------------------------------------------------------------
{
  const s = base('团队项目里，最难说清的是「谁做了什么」', PART1)
  const pains = [
    ['谁做了什么', '贡献比例常在结束时凭回忆协商，缺少过程证据。'],
    ['什么时候完成', '文件反复修改，很难证明某版本何时已存在。'],
    ['会不会被改', '贡献表、聊天记录都可能被一方事后修改。'],
    ['外人怎么信', '老师、评委拿到说明，也无法独立核实。'],
  ]
  pains.forEach(([t, d], i) => {
    const x = 0.8 + i * 3.05
    card(s, x, 1.7, 2.8, 2.15)
    s.addText(`0${i + 1}`, { x: x + 0.25, y: 1.8, w: 1, h: 0.45, fontSize: 18, bold: true, color: C.brand, fontFace: FONT })
    s.addText(t, { x: x + 0.25, y: 2.25, w: 2.4, h: 0.5, fontSize: 19, bold: true, color: C.ink, fontFace: FONT })
    s.addText(d, { x: x + 0.25, y: 2.75, w: 2.35, h: 1.0, fontSize: 14, color: C.soft, valign: 'top', fontFace: FONT })
  })
  s.addText('现有工具都只解决了一部分', { x: 0.8, y: 4.05, w: 6, h: 0.4, fontSize: 15, bold: true, color: C.ink, fontFace: FONT })
  const tools = [
    ['Git 提交记录', '只覆盖代码，历史可改写，不表达他人是否认可'],
    ['共享文档 / 表格', '管理员单方可改，不与成果文件绑定'],
    ['纸面签字', '无法与具体文件绑定，外人难以核验'],
  ]
  tools.forEach(([t, d], i) => {
    const x = 0.8 + i * 4.05
    card(s, x, 4.5, 3.8, 0.95)
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 14, color: C.bad } }, { text: d, options: { fontSize: 12, color: C.soft } }],
      { x: x + 0.2, y: 4.5, w: 3.5, h: 0.95, valign: 'middle', fontFace: FONT })
  })
  card(s, 0.8, 5.7, 11.95, 1.05, { fill: C.brandSoft, line: C.brandSoft })
  s.addText([
    { text: '我们的目标：', options: { bold: true, color: C.brand } },
    { text: '把「成果文件 + 贡献比例 + 其他成员的确认」整体存证到联盟链，并生成任何人都能公开核验的贡献证明。', options: { color: C.ink } },
  ], { x: 1.1, y: 5.7, w: 11.4, h: 1.05, fontSize: 17, valign: 'middle', fontFace: FONT })
  notes(s, '杨宇', '0:30', '从大家都经历过的小组作业讲起：贡献争议的根源是缺乏「多方认可、不可单方修改、能和文件绑定」的过程记录。现有工具各缺一块，联盟链正好适合多方共同认可的记录。')
}

// 3 应用场景 -------------------------------------------------------------------
{
  const s = base('应用场景与用户', PART1)
  const scenes = [
    ['课程小组作业', '每个阶段提交一次里程碑，结课按链上确认结果给出贡献比例', '组内打分有依据'],
    ['竞赛 / 创新项目', '记录方案、代码、报告和分工，评奖时出示贡献证明', '评委快速核实'],
    ['科研课题合作', '数据集、实验结果、论文草稿按版本存证，提前确认贡献', '减少署名争议'],
    ['实习 / 求职', '把贡献证明附在简历里，对方点开即可核验', '用人单位可独立核验'],
  ]
  scenes.forEach(([t, d, g], i) => {
    const x = 0.8 + i * 3.05
    card(s, x, 1.7, 2.8, 2.75)
    s.addText(t, { x: x + 0.25, y: 1.85, w: 2.4, h: 0.5, fontSize: 18, bold: true, color: C.ink, fontFace: FONT })
    s.addText(d, { x: x + 0.25, y: 2.4, w: 2.35, h: 1.35, fontSize: 13, color: C.soft, valign: 'top', fontFace: FONT })
    s.addText('→ ' + g, { x: x + 0.25, y: 3.85, w: 2.4, h: 0.4, fontSize: 13, bold: true, color: C.ok, fontFace: FONT })
  })
  s.addText('三类用户', { x: 0.8, y: 4.65, w: 6, h: 0.4, fontSize: 15, bold: true, color: C.ink, fontFace: FONT })
  const roles = [
    ['项目负责人', '创建项目、登记成员'],
    ['团队成员', '提交成果与比例；核验原文件后确认或拒绝；签发自己的证明'],
    ['外部验证者', '老师、评委、用人单位：无需登录，凭编号核验证明'],
  ]
  roles.forEach(([t, d], i) => {
    const x = 0.8 + i * 4.05
    card(s, x, 5.1, 3.8, 1.55, { fill: C.brandSoft, line: C.brandSoft })
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 16, color: C.brand } }, { text: d, options: { fontSize: 13, color: C.ink } }],
      { x: x + 0.2, y: 5.1, w: 3.45, h: 1.55, valign: 'middle', fontFace: FONT })
  })
  notes(s, '杨宇', '0:25', '强调实用价值：凡是多人协作、需要事后说明贡献的场合都能用。外部验证者不需要账号，这是证明能「拿出去用」的关键。')
}

// 4 产品方案 -------------------------------------------------------------------
{
  const s = base('产品方案：一个项目的使用过程', PART1)
  const steps = [
    ['负责人', '创建项目\n登记成员'],
    ['成员', '提交里程碑\n上传成果文件\n声明贡献比例'],
    ['其他成员', '下载原文件\n本地核对哈希\n确认或拒绝'],
    ['系统', '全员确认后\n变为「已验证」\n计入统计'],
    ['成员 → 外部', '签发贡献证明\n凭编号公开验证'],
  ]
  steps.forEach(([who, what], i) => {
    const x = 0.8 + i * 2.45
    pill(s, who, x + 0.35, 1.85, 1.5, C.brand, C.brandSoft)
    card(s, x, 2.45, 2.2, 2.4, { fill: i === 2 ? C.brandSoft : C.card, line: i === 2 ? C.brand : C.line })
    s.addText(String(i + 1), { x: x + 0.15, y: 2.5, w: 0.5, h: 0.4, fontSize: 14, bold: true, color: C.brand, fontFace: FONT })
    s.addText(what, { x: x + 0.1, y: 2.75, w: 2.0, h: 2.0, fontSize: 15, bold: true, color: C.ink, align: 'center', valign: 'middle', fontFace: FONT })
    if (i < 4) arrow(s, x + 2.22, 3.65, x + 2.43, 3.65, C.brand)
  })
  card(s, 0.8, 5.2, 11.95, 1.45)
  bullets(s, [
    '浏览器即可使用，无需安装；九个页面覆盖概览、项目、提交、确认、证书与公开验证',
    '每一步状态变化都是一笔 Fabric 交易，页面上直接展示对应的 txId',
  ], 1.1, 5.35, 11.4, 1.2, 15)
  notes(s, '杨宇', '0:25', '用五步讲清产品怎么用，第 3 步「其他成员核验并确认」是和普通存证系统最大的不同，后面技术部分会展开。讲完交给黄铭谦。')
}

// 5 架构 ---------------------------------------------------------------------
{
  const s = base('系统架构与链上 / 链下边界', PART2)
  const layer = (y, title, sub, fill, color) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 0.8, y, w: 7.0, h: 0.95, rectRadius: 0.08, fill: { color: fill }, line: { color } })
    s.addText([{ text: title + '\n', options: { bold: true, fontSize: 17, color } }, { text: sub, options: { fontSize: 12, color: C.soft } }],
      { x: 1.0, y, w: 6.7, h: 0.95, valign: 'middle', fontFace: FONT })
  }
  layer(1.7, '前端 · Vue 3 + Vite', '9 个页面 · 浏览器本地 SHA-256 · 演示身份切换', C.card, C.brand)
  arrow(s, 4.3, 2.65, 4.3, 3.0)
  s.addText('REST / JSON + multipart', { x: 4.45, y: 2.65, w: 3, h: 0.35, fontSize: 11, color: C.faint, fontFace: FONT })
  layer(3.0, '后端 · Node.js 22 + Express 5', '参数校验 · 服务端 SHA-256 复算 · 成员鉴权 · 链下文件托管', C.card, C.teal)
  arrow(s, 4.3, 3.95, 4.3, 4.3)
  s.addText('Fabric Gateway SDK（gRPC + TLS）', { x: 4.45, y: 3.95, w: 3.5, h: 0.35, fontSize: 11, color: C.faint, fontFace: FONT })
  layer(4.3, '区块链 · Hyperledger Fabric 2.5.16', 'Org1 + Org2 + Orderer · 通道 chainproof · LevelDB', C.card, C.warn)
  arrow(s, 4.3, 5.25, 4.3, 5.6)
  layer(5.6, '智能合约 · ChainProofContract（JavaScript）', '14 个事务函数：项目 · 里程碑 · 确认 · 统计 · 证书', C.brandSoft, C.brand)

  card(s, 8.2, 1.7, 4.55, 2.55, { fill: C.brandSoft, line: C.brandSoft })
  s.addText('链上：需要多方认可、不可篡改', { x: 8.45, y: 1.8, w: 4.2, h: 0.45, fontSize: 15, bold: true, color: C.brand, fontFace: FONT })
  bullets(s, ['项目与成员', '文件 SHA-256 与贡献比例', '每位成员的确认结果', '状态、证书与交易 txId'], 8.45, 2.3, 4.1, 1.9, 14)
  card(s, 8.2, 4.45, 4.55, 1.55)
  s.addText('链下：可替换的应用数据', { x: 8.45, y: 4.55, w: 4.2, h: 0.45, fontSize: 15, bold: true, color: C.soft, fontFace: FONT })
  bullets(s, ['原始成果文件', '界面偏好、演示身份'], 8.45, 5.0, 4.1, 0.95, 14)
  s.addText('原文件不上链：避免账本膨胀和内容外泄，哈希足以证明文件身份。', { x: 8.2, y: 6.1, w: 4.6, h: 0.65, fontSize: 12, color: C.soft, fontFace: FONT })
  notes(s, '黄铭谦', '0:30', '前端不直接接触 Fabric，所有链上操作经后端 Fabric Gateway 提交。设计思路的核心是右侧的边界：只把需要多方认可的证据上链。课程环境用官方 test-network，真实场景中不同组织可代表团队、学院、评审机构。')
}

// 6 双算哈希 -------------------------------------------------------------------
{
  const s = base('核心机制一：双算 SHA-256 + 本地核验', PART2)
  bullets(s, [
    '浏览器选中文件后先在本地算 SHA-256 并展示',
    '上传原始字节，后端独立复算；不一致返回 FILE_HASH_MISMATCH',
    '链上哈希以服务端结果为准，原文件留在链下',
    '确认人「下载原文件 → 拖入核对框」，在浏览器本地重算比对，文件不再上传',
    '只改一个字节，哈希就完全不同',
  ], 0.8, 1.8, 5.4, 4.8, 16)
  image(s, 'confirm', 6.5, 1.8, 6.3)
  notes(s, '黄铭谦', '0:25', '哈希只针对原始字节流，文件名、修改时间、multipart 编码都不参与。现场演示会拖入一个改过一个字节的文件。')
}

// 7 独立确认 + 统计 -------------------------------------------------------------
{
  const s = base('核心机制二：独立确认 + 确定性统计', PART2)
  card(s, 0.8, 1.7, 6.1, 5.0)
  s.addText('独立成员确认（链码强制）', { x: 1.05, y: 1.8, w: 5.6, h: 0.45, fontSize: 16, bold: true, color: C.ink, fontFace: FONT })
  pill(s, 'PENDING', 1.1, 2.75, 1.6, C.warn, C.warnSoft)
  pill(s, 'VERIFIED', 4.4, 2.3, 1.9, C.ok, C.okSoft)
  pill(s, 'REJECTED', 4.4, 3.25, 1.9, C.bad, C.badSoft)
  arrow(s, 2.75, 2.85, 4.35, 2.55, C.ok)
  arrow(s, 2.75, 3.05, 4.35, 3.45, C.bad)
  s.addText('全员确认', { x: 3.0, y: 2.3, w: 1.4, h: 0.3, fontSize: 11, color: C.ok, fontFace: FONT })
  s.addText('任一拒绝', { x: 3.0, y: 3.5, w: 1.4, h: 0.3, fontSize: 11, color: C.bad, fontFace: FONT })
  const rules = [
    ['禁止自证', '提交者不能确认自己的里程碑'],
    ['确认人快照', '创建时锁定「除提交者外的全部成员」'],
    ['一人一票', '表态后不能撤回或改票'],
    ['与比例无关', '0% 的成员同样要核对别人的贡献'],
  ]
  rules.forEach(([t, d], i) => {
    const y = 4.0 + i * 0.62
    s.addText(t, { x: 1.05, y, w: 1.6, h: 0.5, fontSize: 14, bold: true, color: C.brand, fontFace: FONT, valign: 'middle' })
    s.addText(d, { x: 2.65, y, w: 4.1, h: 0.5, fontSize: 14, color: C.ink, fontFace: FONT, valign: 'middle' })
  })

  card(s, 7.15, 1.7, 5.6, 5.0)
  s.addText('确定性的贡献统计', { x: 7.4, y: 1.8, w: 5.1, h: 0.45, fontSize: 16, bold: true, color: C.ink, fontFace: FONT })
  s.addText('只统计已验证里程碑、每条等权；全程整数 div / mod + 最大余数法，余数相同按 memberId 字节序。所有背书节点结果一致，总和严格 100%。', {
    x: 7.4, y: 2.25, w: 5.1, h: 1.15, fontSize: 13, color: C.soft, fontFace: FONT, valign: 'top',
  })
  const H = (t) => ({ text: t, options: { bold: true, color: C.soft } })
  s.addTable([
    [H('成员'), H('比例和'), H('÷ 3'), H('余数'), H('结果')],
    ['alice', '130', '43', '1', { text: '44', options: { bold: true, color: C.brand } }],
    ['bob', '100', '33', '1', { text: '33', options: { bold: true, color: C.brand } }],
    ['charlie', '70', '23', '1', { text: '23', options: { bold: true, color: C.brand } }],
  ], { x: 7.4, y: 3.5, w: 5.1, colW: [1.3, 1.0, 0.9, 0.9, 1.0], rowH: 0.45, fontSize: 14, fontFace: MONO, border: { type: 'solid', color: C.line, pt: 1 }, align: 'center' })
  s.addText('43 + 33 + 23 = 99，剩 1 个百分点；余数相同，按字节序给 alice。', { x: 7.4, y: 5.45, w: 5.1, h: 0.9, fontSize: 13, color: C.soft, fontFace: FONT, valign: 'top' })
  notes(s, '黄铭谦', '0:25', '左边：开发中发现过「提交者给自己写 100% 再自己确认」的漏洞，第 4 周改为非提交者独立确认，并写进链码——绕过网页直接调 Fabric 也跳不过去。右边：背书节点必须得到相同读写集，所以不用浮点数和本地化排序。')
}

// 8 创新点 -------------------------------------------------------------------
{
  const s = base('创新点', PART2)
  const items = [
    ['「他人确认」才算数，并由链码强制', '提交者不能自证；确认人是除提交者外全部成员的快照。绕过 Web 界面直接调用 Fabric 也跳不过这条规则。'],
    ['确认的是「这一份文件」', '前后端双算 SHA-256；确认人下载原文件在浏览器本地核验，改一个字节即可发现。'],
    ['确定性的贡献统计', '整数运算 + 最大余数法 + 字节序排序，节点、后端、前端结果完全一致，总和严格 100%。'],
    ['无需登录的公开验证', '贡献证明可直接交给老师、评委、用人单位，凭编号独立核验；伪造编号返回 NOT_FOUND。'],
    ['链上只存证据，不存内容', '只上链哈希、比例与确认结果，原文件留在链下，兼顾可信与隐私。'],
  ]
  items.forEach(([t, d], i) => {
    const y = 1.65 + i * 1.04
    s.addShape(pptx.ShapeType.ellipse, { x: 0.85, y: y + 0.17, w: 0.6, h: 0.6, fill: { color: C.brand }, line: { color: C.brand } })
    s.addText(String(i + 1), { x: 0.85, y: y + 0.17, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FONT })
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 18, color: C.ink } }, { text: d, options: { fontSize: 14, color: C.soft } }],
      { x: 1.7, y, w: 11.0, h: 0.95, valign: 'middle', fontFace: FONT })
  })
  notes(s, '黄铭谦', '0:25', '对应评分「创新性」。第 1 点是全项目最核心的设计，可以多停一秒。讲完交给全书阅进入演示。')
}

// 9 界面 ---------------------------------------------------------------------
{
  const s = base('界面一览', PART3)
  const shots = [['dashboard', '概览'], ['project', '项目详情'], ['certificate', '贡献证书'], ['verify', '公开验证']]
  shots.forEach(([n, label], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 0.8 + col * 4.15, y = 1.65 + row * 2.65
    image(s, n, x, y, 3.95)
    pill(s, label, x + 0.12, y + 3.95 / 1.6 - 0.54, 1.3, C.brand, 'FFFFFF')
  })
  card(s, 9.25, 1.65, 3.5, 5.1)
  bullets(s, [
    '统一的设计令牌与组件库',
    '亮 / 暗两套主题',
    '1280 以下响应式布局',
    '错误逐块降级，不整页白屏',
    '15 组前端自检保证对比度、文案与交互',
  ], 9.45, 1.85, 3.15, 4.7, 14)
  notes(s, '全书阅', '0:10', '对应评分「美观性」，一句带过即可，马上切到浏览器现场演示。截图来自 Mock 模式，现场与视频均为真实 Fabric 环境。')
}

// 10 现场演示 -----------------------------------------------------------------
{
  const s = base('现场演示 · 核心闭环', PART3)
  const flow = [
    ['alice', '提交里程碑：浏览器本地算出 SHA-256，后端复算后写链'],
    ['alice', '提交者本人没有确认按钮'],
    ['bob', '下载原文件 → 本地核验一致；改过的文件不一致 → 确认'],
    ['charlie', '确认 → 链上已验证，出现新的 txId'],
    ['alice', '签发贡献证明 → 公开验证「证书有效」'],
    ['任意', '伪造编号 → NOT_FOUND'],
  ]
  flow.forEach(([who, what], i) => {
    const y = 1.75 + i * 0.75
    pill(s, who, 0.9, y + 0.1, 1.3, C.brand, C.brandSoft)
    s.addText(`${i + 1}. ${what}`, { x: 2.45, y, w: 10.3, h: 0.62, fontSize: 18, color: C.ink, valign: 'middle', fontFace: FONT })
  })
  s.addText('全程真实 Fabric 网络，不手工修改账本。完整流程与异常场景见讲解视频。', { x: 0.8, y: 6.4, w: 12, h: 0.45, fontSize: 14, color: C.soft, fontFace: FONT })
  notes(s, '全书阅', '2:45（现场演示）', '切到浏览器，按 docs/DEMO_SCRIPT.md 第 2 节执行。现场故障时改放讲解视频第 3 部分。演示结束切回第 11 页。')
}

// 11 质量与协作 ----------------------------------------------------------------
{
  const s = base('质量保障与团队协作', PART4)
  const stats = [
    ['128', '链码单元测试'],
    ['34', '后端单元测试'],
    ['15', '组前端自检'],
    ['3', '条 CI 流水线'],
  ]
  stats.forEach(([n, t], i) => {
    const x = 0.8 + i * 3.05
    card(s, x, 1.65, 2.8, 1.45)
    s.addText(n, { x: x + 0.25, y: 1.7, w: 1.4, h: 0.9, fontSize: 38, bold: true, color: C.brand, fontFace: FONT, valign: 'middle' })
    s.addText(t, { x: x + 0.25, y: 2.55, w: 2.4, h: 0.45, fontSize: 14, bold: true, color: C.ink, fontFace: FONT })
  })
  s.addText('真实 Fabric 冒烟、前后端契约检查、Demo 一键重置全部通过；仓库无私钥、证书和 .env 入库。', { x: 0.8, y: 3.2, w: 12, h: 0.45, fontSize: 14, color: C.soft, fontFace: FONT })
  const team = [
    ['全书阅（组长）', '后端 / 集成', 'Express API 与 Gateway 集成、双 SHA-256 与鉴权、联调与 CI、任务拆分与 Review'],
    ['杨宇', '前端 / 产品', '9 个页面与组件库、主题与响应式、15 组自检、原文件下载与本地核验'],
    ['黄铭谦', '区块链 / 智能合约', 'Fabric 网络部署、核心链码与状态机、128 项合约测试、Demo 种子脚本'],
  ]
  team.forEach(([name, role, d], i) => {
    const x = 0.8 + i * 4.05
    card(s, x, 3.85, 3.8, 2.2)
    s.addText([{ text: name + '\n', options: { bold: true, fontSize: 17, color: C.ink } }, { text: role, options: { fontSize: 13, color: C.brand } }],
      { x: x + 0.25, y: 3.95, w: 3.4, h: 0.8, fontFace: FONT, valign: 'middle' })
    s.addText(d, { x: x + 0.25, y: 4.8, w: 3.35, h: 1.15, fontSize: 13, color: C.soft, fontFace: FONT, valign: 'top' })
  })
  s.addText('契约先行 → Mock 并行开发 → 测试驱动 → 联调对齐；每个 PR 交叉 Review 并通过 CI 才合并，贡献可在 GitHub 逐条追溯。', {
    x: 0.8, y: 6.2, w: 12, h: 0.6, fontSize: 13, color: C.soft, fontFace: FONT,
  })
  notes(s, '全书阅', '0:15', '对应评分「完整性」：用数字说明不是只做了界面。分工一句带过。')
}

// 12 总结与改进 ----------------------------------------------------------------
{
  const s = base('总结与思考', PART4)
  card(s, 0.8, 1.65, 6.0, 5.1)
  s.addText('收获', { x: 1.05, y: 1.75, w: 5.5, h: 0.45, fontSize: 17, bold: true, color: C.brand, fontFace: FONT })
  const pts = [
    ['区块链的价值是「多方共同认可的记录」', '只把证据上链，不把它当存储。'],
    ['规则必须落在链码里', '前端隐藏按钮、后端校验都不够，信任边界在背书节点。'],
    ['确定性是联盟链合约的硬约束', '整数运算与字节序，让所有节点读写集一致。'],
    ['工程化让三个人并行', '契约先行、Mock 并行，每一步都有 Issue、PR、CI 留痕。'],
  ]
  pts.forEach(([t, d], i) => {
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 14, color: C.ink } }, { text: d, options: { fontSize: 12, color: C.soft } }],
      { x: 1.05, y: 2.25 + i * 1.1, w: 5.5, h: 1.0, fontFace: FONT, valign: 'top' })
  })
  card(s, 7.05, 1.65, 5.7, 5.1)
  s.addText('局限与后期改进', { x: 7.3, y: 1.75, w: 5.2, h: 0.45, fontSize: 17, bold: true, color: C.brand, fontFace: FONT })
  const imp = [
    ['演示身份无真实登录', 'Fabric CA 为每人签发身份，链码识别调用者'],
    ['交易都由后端同一用户提交', '成员 / 学院 / 评审各为独立组织，多组织背书'],
    ['原文件只存后端本地', '对象存储或 IPFS，链上保留内容寻址'],
    ['拒绝后无法修改重提', '基于原里程碑提交新版本，保留版本链'],
  ]
  imp.forEach(([t, d], i) => {
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 14, color: C.bad } }, { text: '→ ' + d, options: { fontSize: 12, color: C.ink } }],
      { x: 7.3, y: 2.25 + i * 1.1, w: 5.25, h: 1.0, fontFace: FONT, valign: 'top' })
  })
  notes(s, '全书阅', '0:25', '左边讲收获，右边主动讲局限：「后端能否冒充成员」是最可能被问到的问题，先在这里给出答案和改进方案。')
}

// 13 结束 --------------------------------------------------------------------
{
  const s = pptx.addSlide()
  pageNo++
  s.background = { color: C.brand }
  s.addText('谢谢！欢迎提问', { x: 0.9, y: 2.4, w: 11.5, h: 1.2, fontSize: 48, bold: true, color: 'FFFFFF', fontFace: FONT })
  s.addText('ChainProof — 让每一份贡献都能被独立核验', { x: 0.9, y: 3.7, w: 11.5, h: 0.6, fontSize: 22, color: 'E0E2FA', fontFace: FONT })
  s.addText('ChainProof 组：全书阅　杨宇　黄铭谦', { x: 0.9, y: 5.2, w: 8, h: 0.4, fontSize: 15, color: 'C7CAF5', fontFace: FONT })
  s.addText('github.com/Looffeeuu/ChainProof', { x: 0.9, y: 5.65, w: 8, h: 0.4, fontSize: 14, color: 'C7CAF5', fontFace: MONO })
  notes(s, '全书阅', '0:05', '进入 3 分钟提问，常见问题见 Issue #36。')
}

if (pageNo !== TOTAL) throw new Error(`页数 ${pageNo} 与 TOTAL ${TOTAL} 不一致`)
pptx.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f))
