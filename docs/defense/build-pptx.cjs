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
const TOTAL = 18
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

// 1 封面 ---------------------------------------------------------------------
{
  const s = pptx.addSlide()
  pageNo++
  s.background = { color: C.brand }
  s.addText('区块链技术应用实践 · 课程大作业', { x: 0.9, y: 1.4, w: 11, h: 0.4, fontSize: 16, color: 'C7CAF5', fontFace: FONT })
  s.addText('ChainProof', { x: 0.9, y: 1.9, w: 11, h: 1.2, fontSize: 60, bold: true, color: 'FFFFFF', fontFace: FONT })
  s.addText('基于 Hyperledger Fabric 的团队成果与贡献可信存证平台', { x: 0.9, y: 3.1, w: 11.5, h: 0.7, fontSize: 26, color: 'FFFFFF', fontFace: FONT })
  s.addShape(pptx.ShapeType.line, { x: 0.9, y: 4.2, w: 2.2, h: 0, line: { color: 'FFFFFF', width: 2 } })
  s.addText('A 前端 / 产品　（姓名）\nB 区块链 / 智能合约　（姓名）\nC 后端 / 集成　（姓名）', {
    x: 0.9, y: 4.5, w: 8, h: 1.4, fontSize: 16, color: 'E0E2FA', fontFace: FONT, lineSpacingMultiple: 1.3,
  })
  s.addText('2026 年 11 月', { x: 0.9, y: 6.3, w: 6, h: 0.4, fontSize: 14, color: 'C7CAF5', fontFace: FONT })
  s.addNotes('开场 15 秒：介绍项目名称和三位成员分工。')
}

// 2 目录 ---------------------------------------------------------------------
{
  const s = base('目录', 'CONTENTS')
  const items = [
    ['01', '项目动机', '团队协作中的贡献争议'],
    ['02', '系统架构', '链上 / 链下边界与技术栈'],
    ['03', '核心功能', '双算哈希 · 独立确认 · 贡献统计 · 证明'],
    ['04', '现场演示', '7 分钟完整闭环'],
    ['05', '工程与分工', '测试、CI 与 Issue / PR 协作'],
    ['06', '总结与思考', '收获、局限与改进'],
  ]
  items.forEach(([n, t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 0.8 + col * 6.1, y = 1.8 + row * 1.6
    card(s, x, y, 5.7, 1.3)
    s.addText(n, { x: x + 0.3, y, w: 1.1, h: 1.3, fontSize: 32, bold: true, color: C.brand, valign: 'middle', fontFace: FONT })
    s.addText([{ text: t + '\n', options: { fontSize: 20, bold: true, color: C.ink } }, { text: d, options: { fontSize: 13, color: C.soft } }],
      { x: x + 1.4, y, w: 4.1, h: 1.3, valign: 'middle', fontFace: FONT })
  })
}

// 3 动机 ---------------------------------------------------------------------
{
  const s = base('团队项目里，最难说清的是「谁做了什么」', '01 项目动机')
  const pains = [
    ['谁做了什么', '贡献比例常在结束时凭回忆协商，缺少过程证据。'],
    ['什么时候完成', '文件反复修改，很难证明某个版本在某个时间点已经存在。'],
    ['会不会被改', '贡献表、聊天记录、共享文档都可能被一方事后修改。'],
    ['外人怎么信', '老师、评委拿到一份贡献说明，无法独立核实。'],
  ]
  pains.forEach(([t, d], i) => {
    const x = 0.8 + i * 3.05
    card(s, x, 1.9, 2.8, 2.9)
    s.addText(`0${i + 1}`, { x: x + 0.25, y: 2.05, w: 1, h: 0.5, fontSize: 20, bold: true, color: C.brand, fontFace: FONT })
    s.addText(t, { x: x + 0.25, y: 2.6, w: 2.4, h: 0.5, fontSize: 19, bold: true, color: C.ink, fontFace: FONT })
    s.addText(d, { x: x + 0.25, y: 3.15, w: 2.35, h: 1.5, fontSize: 14, color: C.soft, valign: 'top', fontFace: FONT })
  })
  card(s, 0.8, 5.2, 11.95, 1.4, { fill: C.brandSoft, line: C.brandSoft })
  s.addText([
    { text: '我们的目标：', options: { bold: true, color: C.brand } },
    { text: '把「成果文件 + 贡献比例 + 其他成员的确认」作为一个整体存证到联盟链上，并生成任何人都能公开核验的贡献证明。', options: { color: C.ink } },
  ], { x: 1.1, y: 5.2, w: 11.4, h: 1.4, fontSize: 18, valign: 'middle', fontFace: FONT })
  s.addNotes('从大家都经历过的小组作业讲起：贡献争议的根源是缺乏「多方认可且不可改」的过程记录。')
}

// 4 现有方案 -------------------------------------------------------------------
{
  const s = base('为什么不用现成的工具？', '01 项目动机')
  const head = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.brand }, align: 'center' } })
  const cell = (t, good) => ({ text: t, options: { color: good === true ? C.ok : good === false ? C.bad : C.ink, align: 'center' } })
  const rows = [
    [head('需求'), head('Git 提交记录'), head('共享文档 / 表格'), head('纸面签字'), head('ChainProof')],
    [cell('覆盖所有成果类型'), cell('仅代码', false), cell('✓', true), cell('✓', true), cell('✓ 任意文件哈希', true)],
    [cell('记录不可单方篡改'), cell('可改写历史', false), cell('管理员可改', false), cell('✓', true), cell('✓ 多节点背书', true)],
    [cell('他人确认贡献'), cell('✗', false), cell('✗', false), cell('✓', true), cell('✓ 链码强制', true)],
    [cell('与成果文件绑定'), cell('✓', true), cell('✗', false), cell('✗', false), cell('✓ SHA-256', true)],
    [cell('外部可独立核验'), cell('需仓库权限', false), cell('✗', false), cell('难', false), cell('✓ 公开验证页', true)],
  ]
  s.addTable(rows, {
    x: 0.8, y: 1.8, w: 11.9, colW: [2.6, 2.3, 2.3, 2.2, 2.5], rowH: 0.7,
    fontSize: 15, fontFace: FONT, border: { type: 'solid', color: C.line, pt: 1 }, fill: { color: C.card }, valign: 'middle',
  })
  s.addNotes('对比现有方案：没有一种同时满足「不可单方篡改 + 他人确认 + 与文件绑定 + 外部可验」。联盟链恰好适合多方共同认可的记录。')
}

// 5 架构 ---------------------------------------------------------------------
{
  const s = base('系统架构', '02 系统架构')
  const layer = (y, title, sub, fill, color) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 0.8, y, w: 7.2, h: 0.95, rectRadius: 0.08, fill: { color: fill }, line: { color } })
    s.addText([{ text: title + '\n', options: { bold: true, fontSize: 17, color } }, { text: sub, options: { fontSize: 12, color: C.soft } }],
      { x: 1.0, y, w: 6.9, h: 0.95, valign: 'middle', fontFace: FONT })
  }
  layer(1.7, '浏览器 · Vue 3 + Vite', '9 个页面 · 本地 SHA-256 · 演示身份切换（X-Member-Id）', C.card, C.brand)
  arrow(s, 4.4, 2.65, 4.4, 3.0)
  s.addText('REST / JSON + multipart', { x: 4.55, y: 2.65, w: 3, h: 0.35, fontSize: 11, color: C.faint, fontFace: FONT })
  layer(3.0, 'Express 后端 · Node.js', '参数校验 · 服务端 SHA-256 复算 · 成员鉴权 · 错误映射 · 链下文件托管', C.card, C.teal)
  arrow(s, 4.4, 3.95, 4.4, 4.3)
  s.addText('Fabric Gateway SDK（gRPC + TLS）', { x: 4.55, y: 3.95, w: 3.5, h: 0.35, fontSize: 11, color: C.faint, fontFace: FONT })
  layer(4.3, 'Hyperledger Fabric 2.5', 'test-network：Org1 + Org2 + Orderer · 通道 chainproof · LevelDB', C.card, C.warn)
  arrow(s, 4.4, 5.25, 4.4, 5.6)
  layer(5.6, 'ChainProofContract（JavaScript 链码）', '14 个事务函数：项目 · 里程碑 · 确认 · 统计 · 证书', C.brandSoft, C.brand)

  card(s, 8.5, 1.7, 4.2, 4.85)
  s.addText('技术栈', { x: 8.8, y: 1.85, w: 3.6, h: 0.45, fontSize: 18, bold: true, color: C.ink, fontFace: FONT })
  s.addText([
    { text: '前端　', options: { bold: true, color: C.brand } }, { text: 'Vue 3 · Vite · Vue Router\n', options: {} },
    { text: '后端　', options: { bold: true, color: C.teal } }, { text: 'Node.js 22 · Express 5 · multer\n', options: {} },
    { text: '链　　', options: { bold: true, color: C.warn } }, { text: 'Fabric 2.5.16\n　　　fabric-contract-api 2.5.8\n', options: {} },
    { text: '工程　', options: { bold: true, color: C.soft } }, { text: 'GitHub Issue / PR / Review\n　　　三条 GitHub Actions CI\n　　　WSL2 + Docker', options: {} },
  ], { x: 8.8, y: 2.35, w: 3.8, h: 3.9, fontSize: 14, color: C.ink, valign: 'top', fontFace: FONT, lineSpacingMultiple: 1.4 })
  s.addNotes('前端不直接接触 Fabric，所有链上操作都经后端的 Fabric Gateway 提交。课程环境用官方 test-network，真实场景中不同组织可代表团队、学院、评审机构。')
}

// 6 链上链下 -------------------------------------------------------------------
{
  const s = base('只把「需要多方认可、不可篡改」的数据上链', '02 系统架构')
  card(s, 0.8, 1.8, 5.85, 4.2, { fill: C.brandSoft, line: C.brandSoft })
  s.addText('链上 · Fabric 账本', { x: 1.1, y: 1.95, w: 5, h: 0.5, fontSize: 20, bold: true, color: C.brand, fontFace: FONT })
  bullets(s, ['项目与成员列表', '里程碑与文件 SHA-256', '贡献比例声明', '每位成员的确认 / 拒绝', '里程碑状态与关键交易 txId', '贡献证明记录'], 1.1, 2.55, 5.3, 3.3)
  card(s, 6.95, 1.8, 5.85, 4.2)
  s.addText('链下 · 后端存储', { x: 7.25, y: 1.95, w: 5, h: 0.5, fontSize: 20, bold: true, color: C.soft, fontFace: FONT })
  bullets(s, ['原始成果文件', '界面偏好、演示身份', '前端缓存'], 7.25, 2.55, 5.3, 3.3)
  s.addText('原文件不上链：避免账本膨胀和内容外泄；链上哈希足以证明「这份文件就是当时被确认的那一份」。', {
    x: 0.8, y: 6.2, w: 12, h: 0.6, fontSize: 15, color: C.soft, fontFace: FONT,
  })
}

// 7 业务流程 -------------------------------------------------------------------
{
  const s = base('核心业务闭环', '03 核心功能')
  const steps = ['创建项目\n登记成员', '提交里程碑\n上传成果文件', '前后端双算\nSHA-256', '声明贡献比例\n（整数，和为 100）', '非提交者成员\n独立确认', '全员确认\n→ VERIFIED', '时间线与\n贡献统计', '签发证明\n公开验证']
  steps.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4)
    const x = 0.8 + col * 3.1, y = 1.9 + row * 2.3
    card(s, x, y, 2.6, 1.6, { fill: i === 4 || i === 7 ? C.brandSoft : C.card, line: i === 4 || i === 7 ? C.brand : C.line })
    s.addText(String(i + 1), { x: x + 0.15, y: y + 0.1, w: 0.5, h: 0.4, fontSize: 14, bold: true, color: C.brand, fontFace: FONT })
    s.addText(t, { x, y: y + 0.25, w: 2.6, h: 1.3, fontSize: 16, bold: true, color: C.ink, align: 'center', valign: 'middle', fontFace: FONT })
    if (col < 3) arrow(s, x + 2.65, y + 0.8, x + 3.05, y + 0.8, C.brand)
  })
  s.addShape(pptx.ShapeType.line, { x: 11.5, y: 3.55, w: 0, h: 0.3, line: { color: C.brand, width: 1.5 } })
  s.addShape(pptx.ShapeType.line, { x: 2.1, y: 3.85, w: 9.4, h: 0, line: { color: C.brand, width: 1.5 } })
  arrow(s, 2.1, 3.85, 2.1, 4.2, C.brand)
  s.addText('每一步状态变化都是一笔 Fabric 交易，前端展示对应的 txId。', { x: 0.8, y: 6.3, w: 12, h: 0.5, fontSize: 15, color: C.soft, fontFace: FONT })
}

// 8 双算哈希 -------------------------------------------------------------------
{
  const s = base('机制一：前后端双算 SHA-256 + 本地核验', '03 核心功能')
  bullets(s, [
    '浏览器选中文件后，先在本地计算 SHA-256 并展示',
    '上传原始字节 + clientFileHash；后端独立复算',
    '两端一致才写链，否则返回 FILE_HASH_MISMATCH',
    '链上哈希以服务端结果为准，原文件留在链下',
    '确认人「下载原文件 → 拖入核对框」，在浏览器本地重算比对，文件不再上传',
    '只改一个字节，哈希就完全不同',
  ], 0.8, 1.8, 5.4, 4.8, 16)
  image(s, 'confirm', 6.5, 1.8, 6.3)
  s.addNotes('强调哈希只针对原始字节流，文件名、修改时间、multipart 编码都不参与。演示时会现场拖入一个被改过一个字节的文件。')
}

// 9 独立确认 -------------------------------------------------------------------
{
  const s = base('机制二：独立成员确认（链码强制）', '03 核心功能')
  pill(s, 'PENDING_CONFIRMATION', 0.9, 2.4, 3.3, C.warn, C.warnSoft)
  pill(s, 'VERIFIED', 5.6, 1.7, 2.3, C.ok, C.okSoft)
  pill(s, 'REJECTED', 5.6, 3.1, 2.3, C.bad, C.badSoft)
  arrow(s, 4.25, 2.5, 5.55, 1.95, C.ok)
  arrow(s, 4.25, 2.7, 5.55, 3.3, C.bad)
  s.addText('全部确认人 CONFIRMED', { x: 3.6, y: 1.45, w: 2.5, h: 0.3, fontSize: 11, color: C.ok, fontFace: FONT })
  s.addText('任意一人 REJECTED', { x: 3.6, y: 3.35, w: 2.5, h: 0.3, fontSize: 11, color: C.bad, fontFace: FONT })
  s.addText('关闭状态，不再接受表态', { x: 8.1, y: 2.3, w: 3, h: 0.5, fontSize: 13, color: C.soft, fontFace: FONT })

  const rules = [
    ['确认人快照', '创建时保存「除提交者外的全部成员」为 requiredConfirmerIds，按字节序排序'],
    ['禁止自证', '提交者不能确认自己的里程碑 → SUBMITTER_CANNOT_CONFIRM'],
    ['一人一票', '表态后不能撤回或改票 → ALREADY_DECIDED'],
    ['与比例无关', '0% 的成员同样是确认人：他核对的是别人的贡献是否属实'],
  ]
  rules.forEach(([t, d], i) => {
    const y = 4.15 + i * 0.68
    s.addText(t, { x: 0.9, y, w: 2.1, h: 0.55, fontSize: 15, bold: true, color: C.brand, fontFace: FONT, valign: 'middle' })
    s.addText(d, { x: 3.0, y, w: 9.8, h: 0.55, fontSize: 15, color: C.ink, fontFace: FONT, valign: 'middle' })
  })
  s.addNotes('这里讲开发中修复的漏洞：最初规则是「全部 contributor 确认即 VERIFIED」，一个人能写自己 100% 并自己确认。第 4 周改为非提交者独立确认，并写进链码——绕过前端和后端直接调 Fabric 也跳不过去。')
}

// 10 统计 --------------------------------------------------------------------
{
  const s = base('机制三：确定性的贡献统计', '03 核心功能')
  bullets(s, [
    '只统计 VERIFIED 里程碑，每条等权',
    '全程整数 div / mod，不用浮点数',
    '最大余数法分配剩余百分点，总和严格 100%',
    '余数相同按 memberId 的 UTF-8 字节序，不用本地化排序',
    '原因：多个背书节点必须得到完全相同的读写集，否则交易无法通过背书',
  ], 0.8, 1.8, 5.6, 4.6, 16)
  card(s, 6.8, 1.8, 6.0, 3.6)
  s.addText('示例：3 条已验证里程碑', { x: 7.1, y: 1.95, w: 5.5, h: 0.45, fontSize: 16, bold: true, color: C.ink, fontFace: FONT })
  const H = (t) => ({ text: t, options: { bold: true, color: C.soft } })
  s.addTable([
    [H('成员'), H('比例之和'), H('÷ 3'), H('余数'), H('结果')],
    ['alice', '130', '43', '1', { text: '44', options: { bold: true, color: C.brand } }],
    ['bob', '100', '33', '1', { text: '33', options: { bold: true, color: C.brand } }],
    ['charlie', '70', '23', '1', { text: '23', options: { bold: true, color: C.brand } }],
  ], { x: 7.1, y: 2.55, w: 5.4, colW: [1.3, 1.1, 1.0, 1.0, 1.0], rowH: 0.5, fontSize: 15, fontFace: MONO, border: { type: 'solid', color: C.line, pt: 1 }, align: 'center' })
  s.addText('43 + 33 + 23 = 99，剩 1 个百分点；三人余数相同，按字节序给 alice → 44 / 33 / 23，总和 100。', {
    x: 7.1, y: 4.55, w: 5.5, h: 0.75, fontSize: 14, color: C.soft, fontFace: FONT, valign: 'top',
  })
}

// 11 证书 --------------------------------------------------------------------
{
  const s = base('机制四：贡献证明与公开验证', '03 核心功能')
  image(s, 'certificate', 0.8, 1.75, 5.9)
  image(s, 'verify', 6.95, 1.75, 5.9)
  s.addText('累计比例 > 0 才能签发 · 同一成员同一项目只签发一次 · 证书引用参与的里程碑和链上 txId', { x: 0.8, y: 5.6, w: 12, h: 0.45, fontSize: 15, color: C.ink, fontFace: FONT })
  s.addText('公开验证页无需登录：存在的证书返回 VALID，伪造编号返回 NOT_FOUND；非成员下载原文件返回 403。', { x: 0.8, y: 6.05, w: 12, h: 0.45, fontSize: 15, color: C.soft, fontFace: FONT })
}

// 12 界面 --------------------------------------------------------------------
{
  const s = base('界面一览', '03 核心功能')
  image(s, 'dashboard', 0.8, 1.75, 5.9)
  image(s, 'project', 6.95, 1.75, 5.9)
  s.addText('概览：项目、已验证里程碑、我的证明', { x: 0.8, y: 5.5, w: 5.9, h: 0.4, fontSize: 14, color: C.soft, align: 'center', fontFace: FONT })
  s.addText('项目详情：累计贡献、存证概况、里程碑时间线', { x: 6.95, y: 5.5, w: 5.9, h: 0.4, fontSize: 14, color: C.soft, align: 'center', fontFace: FONT })
  s.addText('支持亮 / 暗两套主题与 1280 以下的响应式布局。截图来自 Mock 模式，现场使用真实 Fabric 演示。', { x: 0.8, y: 6.2, w: 12, h: 0.4, fontSize: 12, color: C.faint, fontFace: FONT })
}

// 13 演示 --------------------------------------------------------------------
{
  const s = base('现场演示 · 7 分钟', '04 现场演示')
  const flow = [
    ['alice', '浏览概览与 P001 的时间线、贡献面板'],
    ['alice', '创建项目 → 提交里程碑，展示本地 SHA-256'],
    ['alice', '提交者本人没有确认按钮'],
    ['bob', '下载原文件 → 本地核验一致；改过的文件不一致 → 确认'],
    ['charlie', '确认 → 链上已验证，出现新 txId'],
    ['alice', '签发贡献证明 → 公开验证 VALID'],
    ['任意', '伪造编号 NOT_FOUND；非成员无法下载；0% 无法签发'],
  ]
  flow.forEach(([who, what], i) => {
    const y = 1.75 + i * 0.68
    pill(s, who, 0.9, y + 0.08, 1.3, C.brand, C.brandSoft)
    s.addText(`${i + 1}. ${what}`, { x: 2.45, y, w: 10.3, h: 0.58, fontSize: 17, color: C.ink, valign: 'middle', fontFace: FONT })
  })
  s.addText('全部操作走真实 Fabric 网络，不手工修改账本；演示前用 npm run demo:reset 一键重建账本并写入演示数据。', { x: 0.8, y: 6.55, w: 12, h: 0.4, fontSize: 13, color: C.soft, fontFace: FONT })
  s.addNotes('切到浏览器，按 docs/DEMO_SCRIPT.md 第 2 节执行。现场故障时改放演示视频。')
}

// 14 质量 --------------------------------------------------------------------
{
  const s = base('质量保障', '05 工程与分工')
  const stats = [
    ['128', '链码单元测试', 'Jest · 4 个套件全部通过'],
    ['34', '后端单元测试', 'node:test 全部通过'],
    ['15', '组前端自检', '对比度、契约、降级、浏览器流程…'],
    ['3', '条 CI 流水线', 'Backend / Frontend / Chaincode'],
  ]
  stats.forEach(([n, t, d], i) => {
    const x = 0.8 + i * 3.05
    card(s, x, 1.8, 2.8, 2.3)
    s.addText(n, { x: x + 0.25, y: 1.9, w: 2.4, h: 1.0, fontSize: 44, bold: true, color: C.brand, fontFace: FONT })
    s.addText(t, { x: x + 0.25, y: 2.85, w: 2.4, h: 0.45, fontSize: 16, bold: true, color: C.ink, fontFace: FONT })
    s.addText(d, { x: x + 0.25, y: 3.3, w: 2.4, h: 0.7, fontSize: 12, color: C.soft, fontFace: FONT, valign: 'top' })
  })
  bullets(s, [
    '真实链路冒烟：smoke:projects / smoke:milestones / smoke:week3 在真实 Fabric 上通过',
    '前后端契约：check:contract 对真实后端逐字段校验通过',
    '一键重置：demo:reset 从全新账本重放 3 个项目、6 个里程碑、2 张证书',
    '仓库安全：无私钥、Fabric 证书、.env、上传文件入库',
  ], 0.8, 4.45, 12, 2.3, 15)
}

// 15 分工 --------------------------------------------------------------------
{
  const s = base('团队分工与协作', '05 工程与分工')
  const team = [
    ['A', '前端 / 产品', '@Darioyy', ['9 个页面与组件库、Mock 数据', '亮 / 暗主题与响应式', '15 组前端自检脚本', '原文件下载与本地核验'], 'PR #13 #16 #20 #29 #30'],
    ['B', '区块链 / 智能合约', '@Hmq901', ['Fabric 网络一键部署', '核心链码与确认状态机', '128 项合约测试', 'Demo 种子脚本'], 'PR #10 #12 #17 · #26'],
    ['C', '后端 / 集成 · 统筹', '@Looffeeuu', ['Express API 与 Gateway 集成', '双 SHA-256、成员鉴权', '前后端联调与 CI', 'Issue 拆分与 Review'], 'PR #8 #9 #21–#23 #28 #31'],
  ]
  team.forEach(([k, role, gh, items, prs], i) => {
    const x = 0.8 + i * 4.05
    card(s, x, 1.75, 3.8, 4.1)
    s.addText(k, { x: x + 0.25, y: 1.9, w: 0.6, h: 0.6, fontSize: 28, bold: true, color: C.brand, fontFace: FONT })
    s.addText([{ text: role + '\n', options: { bold: true, fontSize: 17, color: C.ink } }, { text: gh, options: { fontSize: 12, color: C.soft } }],
      { x: x + 0.85, y: 1.9, w: 2.9, h: 0.75, fontFace: FONT, valign: 'middle' })
    bullets(s, items, x + 0.25, 2.8, 3.4, 2.2, 14)
    s.addText(prs, { x: x + 0.25, y: 5.2, w: 3.4, h: 0.4, fontSize: 12, color: C.teal, fontFace: MONO })
  })
  s.addText('先冻结 API 契约 → 前端在 Mock 上并行开发 → 链码测试驱动 → 后端打通 → 契约检查与冒烟对齐。共 32 个 Issue / PR，每个 PR 交叉 Review 并通过 CI 才合并。', {
    x: 0.8, y: 6.05, w: 12, h: 0.7, fontSize: 14, color: C.soft, fontFace: FONT,
  })
}

// 16 总结 --------------------------------------------------------------------
{
  const s = base('总结与思考', '06 总结与思考')
  const pts = [
    ['区块链的价值是「多方共同认可的记录」', '只把哈希、比例和确认结果上链，原文件留在链下。'],
    ['规则必须落在链码里', '自我确认漏洞说明：前端隐藏按钮、后端校验都不够，信任边界在背书节点执行的合约中。'],
    ['确定性是联盟链合约的硬约束', '整数运算 + 字节序排序，让所有背书节点得到相同读写集。'],
    ['工程化让三个人并行', '契约先行、Mock 并行、测试驱动，每一步都有 Issue、PR、Review 和 CI 留痕。'],
  ]
  pts.forEach(([t, d], i) => {
    const y = 1.75 + i * 1.22
    s.addShape(pptx.ShapeType.rect, { x: 0.8, y, w: 0.08, h: 1.0, fill: { color: C.brand }, line: { color: C.brand } })
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 19, color: C.ink } }, { text: d, options: { fontSize: 15, color: C.soft } }],
      { x: 1.1, y, w: 11.6, h: 1.0, valign: 'middle', fontFace: FONT })
  })
}

// 17 改进 --------------------------------------------------------------------
{
  const s = base('局限与后期改进', '06 总结与思考')
  const H = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.brand } } })
  s.addTable([
    [H('当前局限'), H('改进思路')],
    ['演示身份用 X-Member-Id 切换，没有真实登录', '接入 Fabric CA 为每位成员签发身份，链码用 clientIdentity 识别调用者'],
    ['所有交易由后端以同一 Org1 用户提交', '成员 / 学院 / 评审机构作为独立组织，多组织背书'],
    ['原文件只保存在后端本地', '对象存储或 IPFS，链上只保留内容寻址 CID'],
    ['一旦拒绝即终止，无法修改重提', '基于原里程碑提交新版本，保留版本链'],
    ['每条里程碑等权统计', '项目创建时约定里程碑权重并上链'],
    ['单机 test-network', '多主机联盟网络部署，加入监控与备份'],
  ], {
    x: 0.8, y: 1.75, w: 11.9, colW: [5.2, 6.7], rowH: 0.62, fontSize: 15, fontFace: FONT,
    border: { type: 'solid', color: C.line, pt: 1 }, fill: { color: C.card }, color: C.ink, valign: 'middle',
  })
}

// 18 结束 --------------------------------------------------------------------
{
  const s = pptx.addSlide()
  pageNo++
  s.background = { color: C.brand }
  s.addText('谢谢！欢迎提问', { x: 0.9, y: 2.4, w: 11.5, h: 1.2, fontSize: 48, bold: true, color: 'FFFFFF', fontFace: FONT })
  s.addText('ChainProof — 让每一份贡献都能被独立核验', { x: 0.9, y: 3.7, w: 11.5, h: 0.6, fontSize: 22, color: 'E0E2FA', fontFace: FONT })
  s.addText('github.com/Looffeeuu/ChainProof', { x: 0.9, y: 5.6, w: 8, h: 0.4, fontSize: 14, color: 'C7CAF5', fontFace: MONO })
}

if (pageNo !== TOTAL) throw new Error(`页数 ${pageNo} 与 TOTAL ${TOTAL} 不一致`)
pptx.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f))
