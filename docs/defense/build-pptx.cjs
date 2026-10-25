// 生成 docs/defense/ChainProof-答辩.pptx
//
// pptxgenjs 不是项目依赖，在临时目录装一次即可：
//   mkdir -p /tmp/pptgen && cd /tmp/pptgen && npm i pptxgenjs@3.12.0
//   NODE_PATH=/tmp/pptgen/node_modules node docs/defense/build-pptx.cjs \
//     docs/defense/screenshots docs/defense/ChainProof-答辩.pptx
//
// 截图由前端 Mock 模式（npm run dev）+ headless Chrome 1440×900、1.5 倍缩放截取；
// crop-*.png 是用 ffmpeg 裁掉侧栏、只留主要内容的版本（PPT 用这一组）。

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
const TOTAL = 13 // 正文页数；附录页在致谢之后，单独编号
let pageNo = 0
let appendixNo = 0

function base(title, kicker) {
  const s = pptx.addSlide()
  pageNo++
  s.background = { color: C.bg }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: C.brand }, line: { color: C.brand } })
  if (kicker) s.addText(kicker, { x: 0.6, y: 0.35, w: 8, h: 0.35, fontSize: 12, color: C.brand, bold: true, fontFace: FONT, charSpacing: 2 })
  s.addText(title, { x: 0.6, y: 0.68, w: 12, h: 0.75, fontSize: 30, bold: true, color: C.ink, fontFace: FONT })
  const footer = pageNo > TOTAL ? `ChainProof · 附录 A${++appendixNo}` : `ChainProof · ${pageNo} / ${TOTAL}`
  s.addText(footer, { x: 9.8, y: 7.0, w: 3.2, h: 0.3, fontSize: 10, color: C.faint, align: 'right', fontFace: FONT })
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

// 按「contain」放进 w×h 的框里（默认居中，left = true 时靠左）；pw / ph 是图片像素尺寸
function fitImage(s, name, pw, ph, x, y, w, h, left = false) {
  const r = pw / ph
  const iw = Math.min(w, h * r), ih = iw / r
  const ix = left ? x : x + (w - iw) / 2, iy = y + (h - ih) / 2
  s.addImage({ path: shot(name), x: ix, y: iy, w: iw, h: ih })
  s.addShape(pptx.ShapeType.rect, { x: ix, y: iy, w: iw, h: ih, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: C.line, width: 1 } })
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
  s.addText('课程综合实践Ⅱ · 区块链技术应用实践大作业　|　ChainProof 组', { x: 0.9, y: 1.3, w: 11, h: 0.4, fontSize: 16, color: 'C7CAF5', fontFace: FONT })
  s.addText('ChainProof', { x: 0.9, y: 1.8, w: 11, h: 1.2, fontSize: 60, bold: true, color: 'FFFFFF', fontFace: FONT })
  s.addText('基于 Hyperledger Fabric 的团队成果与贡献可信存证平台', { x: 0.9, y: 3.0, w: 11.5, h: 0.7, fontSize: 26, color: 'FFFFFF', fontFace: FONT })
  s.addShape(pptx.ShapeType.line, { x: 0.9, y: 4.05, w: 2.2, h: 0, line: { color: 'FFFFFF', width: 2 } })
  s.addText([
    { text: '全书阅（组长）', options: { bold: true, color: 'FFFFFF' } }, { text: '　后端 / 集成\n', options: { color: 'C7CAF5' } },
    { text: '杨宇', options: { bold: true, color: 'FFFFFF' } }, { text: '　前端 / 产品\n', options: { color: 'C7CAF5' } },
    { text: '黄铭谦', options: { bold: true, color: 'FFFFFF' } }, { text: '　区块链 / 智能合约', options: { color: 'C7CAF5' } },
  ], { x: 0.9, y: 4.3, w: 8, h: 1.5, fontSize: 17, fontFace: FONT, lineSpacingMultiple: 1.35 })
  s.addText('Vue 3　·　Node.js / Express　·　Hyperledger Fabric 2.5　·　JavaScript 链码', { x: 0.9, y: 5.9, w: 11, h: 0.4, fontSize: 14, color: 'E0E2FA', fontFace: FONT })
  s.addText('2026 年 11 月', { x: 0.9, y: 6.4, w: 6, h: 0.4, fontSize: 14, color: 'C7CAF5', fontFace: FONT })
  notes(s, '杨宇', '0:10', '大家好，我们是 ChainProof 组，作品是一个基于 Hyperledger Fabric 的团队贡献存证平台。组长全书阅做后端和集成，黄铭谦做区块链和智能合约，我是杨宇，做前端和产品。')
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
      { x: x + 0.2, y: 4.58, w: 3.5, h: 0.85, valign: 'top', fontFace: FONT })
  })
  card(s, 0.8, 5.7, 11.95, 1.05, { fill: C.brandSoft, line: C.brandSoft })
  s.addText([
    { text: '我们的目标：', options: { bold: true, color: C.brand } },
    { text: '把「成果文件 + 贡献比例 + 其他成员的确认」整体存证到联盟链，并生成任何人都能公开核验的贡献证明。', options: { color: C.ink } },
  ], { x: 1.1, y: 5.7, w: 11.4, h: 1.05, fontSize: 17, valign: 'middle', fontFace: FONT })
  notes(s, '杨宇', '0:30', '做过小组作业的都知道，最难说清的是谁做了什么。比例常常在结束时凭回忆定，贡献表一方事后就能改，老师拿到一份说明也没法自己核实。现有的工具各缺一块：Git 只管代码，共享表格管理员一个人能改，纸面签字和文件对不上。所以我们把成果文件、贡献比例和其他成员的确认一起存到联盟链上，再生成任何人都能核验的贡献证明。')
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
      { x: x + 0.2, y: 5.25, w: 3.45, h: 1.35, valign: 'top', fontFace: FONT })
  })
  notes(s, '杨宇', '0:25', '凡是事后要说明贡献的合作都能用：课程作业、竞赛、科研合作，还有求职时附在简历上。用户分三类：负责人建项目、登记成员；成员提交成果，互相核验确认；外部的老师、评委、用人单位不用注册，凭证书编号就能核验（这一点决定了证明能拿出去用）。')
}

// 4 产品方案 -------------------------------------------------------------------
{
  const s = base('产品方案：一个项目的使用过程', PART1)
  const steps = [
    ['负责人', '创建项目\n登记成员', 'CreateProject'],
    ['成员', '提交里程碑\n上传成果文件\n声明贡献比例', 'CreateMilestone'],
    ['其他成员', '下载原文件\n本地核对哈希\n确认或拒绝', 'ConfirmContribution'],
    ['系统', '全员确认后\n变为「已验证」\n计入统计', 'GetProject\nContributions'],
    ['成员 → 外部', '签发贡献证明\n凭编号公开验证', 'IssueCertificate\nVerifyCertificate'],
  ]
  steps.forEach(([who, what, tx], i) => {
    const x = 0.8 + i * 2.45
    pill(s, who, x + 0.35, 1.85, 1.5, C.brand, C.brandSoft)
    card(s, x, 2.45, 2.2, 2.4, { fill: i === 2 ? C.brandSoft : C.card, line: i === 2 ? C.brand : C.line })
    s.addText(String(i + 1), { x: x + 0.15, y: 2.5, w: 0.5, h: 0.4, fontSize: 14, bold: true, color: C.brand, fontFace: FONT })
    s.addText(what, { x: x + 0.1, y: 2.75, w: 2.0, h: 1.4, fontSize: 15, bold: true, color: C.ink, align: 'center', valign: 'middle', fontFace: FONT })
    s.addShape(pptx.ShapeType.line, { x: x + 0.3, y: 4.2, w: 1.6, h: 0, line: { color: C.line, width: 1 } })
    s.addText(tx, { x: x + 0.05, y: 4.22, w: 2.1, h: 0.58, fontSize: 10, color: C.teal, align: 'center', valign: 'middle', fontFace: MONO })
    if (i < 4) arrow(s, x + 2.22, 3.65, x + 2.43, 3.65, C.brand)
  })
  card(s, 0.8, 5.2, 11.95, 1.45)
  bullets(s, [
    '浏览器即可使用，无需安装；九个页面覆盖概览、项目、提交、确认、证书与公开验证',
    '提交、确认、签发都是 Fabric 交易，里程碑和证书上能看到对应的 txId',
  ], 1.1, 5.35, 11.4, 1.2, 15)
  notes(s, '杨宇', '0:25', '用起来是五步：负责人建项目；成员上传成果文件，声明贡献比例；其他成员下载原文件，在浏览器里核对哈希，再确认或拒绝；全员确认后记录变成已验证，计入统计；最后签发证明，公开验证。第三步是和普通存证系统最大的不同，下面请黄铭谦讲它是怎么做到的。')
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
  s.addText([
    { text: '键：', options: { bold: true, color: C.ink } }, { text: 'PROJECT_ · MILESTONE_ · CERT_ + 复合键索引\n', options: {} },
    { text: '部署：', options: { bold: true, color: C.ink } }, { text: 'Docker + WSL2，demo:reset 一键重建', options: {} },
  ], { x: 8.2, y: 6.05, w: 4.6, h: 0.75, fontSize: 11, color: C.soft, fontFace: FONT, valign: 'top' })
  notes(s, '黄铭谦', '0:25', '这是系统架构：前端 Vue 3，后端 Node.js 加 Express，区块链用 Hyperledger Fabric 2.5。关键设计是链上链下分离：链上只存需要防篡改的数据——项目、成员、文件哈希、贡献比例、确认结果和证书；原始成果文件留在链下。这样既避免账本膨胀，也不会把成果内容暴露给所有背书节点。')
}

// 6 双算哈希 -------------------------------------------------------------------
{
  const s = base('核心机制一：双算 SHA-256 + 本地核验', PART2)
  const flow = [
    ['浏览器', '选中文件后本地计算 H₁ 并展示', C.brand],
    ['后端', '对原始字节独立计算 H₂；H₁ ≠ H₂ 返回 FILE_HASH_MISMATCH', C.teal],
    ['Fabric', '写入 H₂ 与贡献声明；原文件存链下', C.warn],
  ]
  flow.forEach(([who, what, color], i) => {
    const y = 1.75 + i * 1.12
    s.addShape(pptx.ShapeType.roundRect, { x: 0.8, y, w: 5.4, h: 0.82, rectRadius: 0.08, fill: { color: C.card }, line: { color } })
    s.addText(who, { x: 0.95, y, w: 1.05, h: 0.82, fontSize: 15, bold: true, color, valign: 'middle', fontFace: FONT })
    s.addText(what, { x: 2.0, y, w: 4.1, h: 0.82, fontSize: 13, color: C.ink, valign: 'middle', fontFace: FONT })
    if (i < 2) {
      arrow(s, 2.3, y + 0.84, 2.3, y + 1.1, C.faint)
      s.addText(i === 0 ? '上传原始字节 + H₁' : 'H₁ = H₂', { x: 2.45, y: y + 0.82, w: 3, h: 0.3, fontSize: 10, color: C.faint, fontFace: FONT })
    }
  })
  card(s, 0.8, 5.2, 5.4, 1.5, { fill: C.brandSoft, line: C.brandSoft })
  s.addText([
    { text: '确认人本地核验\n', options: { bold: true, fontSize: 15, color: C.brand } },
    { text: '下载原文件，拖入确认页核对框，浏览器重算后与链上 H₂ 比对，文件不再上传；改一个字节即不一致。', options: { fontSize: 13, color: C.ink } },
  ], { x: 1.05, y: 5.28, w: 5.0, h: 1.35, valign: 'top', fontFace: FONT })
  fitImage(s, 'crop-confirm', 1800, 1350, 6.4, 1.7, 6.35, 5.05)
  notes(s, '黄铭谦', '0:22', '第一个核心机制是前后端双算 SHA-256。浏览器先在本地算一次，上传后后端对原始字节再独立算一次，两次一致才写链，不一致直接拒绝。确认人下载原文件，拖进确认页的核对框，在浏览器里重算比对，文件不用再上传，改一个字节就对不上。')
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
    const y = 4.0 + i * 0.55
    s.addText(t, { x: 1.05, y, w: 1.6, h: 0.5, fontSize: 14, bold: true, color: C.brand, fontFace: FONT, valign: 'middle' })
    s.addText(d, { x: 2.65, y, w: 4.1, h: 0.5, fontSize: 14, color: C.ink, fontFace: FONT, valign: 'middle' })
  })

  s.addText('SUBMITTER_CANNOT_CONFIRM · MEMBER_NOT_REVIEWER · ALREADY_DECIDED · MILESTONE_CLOSED', { x: 1.05, y: 6.22, w: 5.7, h: 0.35, fontSize: 9, color: C.teal, fontFace: MONO })

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
  notes(s, '黄铭谦', '0:26', '第二个核心机制是独立确认。创建里程碑时，链码把除提交者外的全部成员锁定为确认人；提交者不能确认自己的里程碑，这条规则写在链码里，绕过网页也跳不过去。全员确认才是 VERIFIED，任何一人拒绝就作废。右边是贡献统计：全程整数运算加最大余数法，所有背书节点结果一致，总和严格 100%。')
}

// 8 创新点 -------------------------------------------------------------------
{
  const s = base('创新点', PART2)
  const items = [
    ['「他人确认」才算数，并由链码强制', '提交者不能自证；确认人是除提交者外全部成员的快照。绕过 Web 界面直接调用 Fabric 也跳不过这条规则。'],
    ['确认的是「这一份文件」', '前后端双算 SHA-256；确认人下载原文件在浏览器本地核验，改一个字节即可发现。'],
    ['确定性的贡献统计', '整数运算 + 最大余数法 + 字节序排序，节点、后端、前端结果完全一致，总和严格 100%。'],
    ['无需登录的公开验证', '证明可直接交给老师、评委、用人单位，凭编号独立核验；伪造编号返回 NOT_FOUND'],
    ['链上只存证据，不存内容', '只上链哈希、比例与确认结果，原文件留在链下，兼顾可信与隐私。'],
  ]
  const impl = ['链码 ConfirmContribution\nrequiredConfirmerIds 快照', '前端 sha256.js\n后端独立复算', '链码 GetProjectContributions\n整数 div / mod', '链码 VerifyCertificate\n公开接口 /verify/:id', '链上摘要与确认结果\n原文件存后端 uploads/']
  s.addText('对应实现', { x: 10.05, y: 1.3, w: 2.7, h: 0.3, fontSize: 11, bold: true, color: C.soft, align: 'center', fontFace: FONT })
  items.forEach(([t, d], i) => {
    const y = 1.65 + i * 1.04
    s.addShape(pptx.ShapeType.ellipse, { x: 0.85, y: y + 0.17, w: 0.6, h: 0.6, fill: { color: C.brand }, line: { color: C.brand } })
    s.addText(String(i + 1), { x: 0.85, y: y + 0.17, w: 0.6, h: 0.6, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FONT })
    s.addText([{ text: t + '\n', options: { bold: true, fontSize: 18, color: C.ink } }, { text: d, options: { fontSize: 14, color: C.soft } }],
      { x: 1.7, y, w: 8.15, h: 0.95, valign: 'middle', fontFace: FONT })
    card(s, 10.05, y + 0.1, 2.7, 0.78, { fill: C.card, line: C.line })
    s.addText(impl[i], { x: 10.1, y: y + 0.1, w: 2.6, h: 0.78, fontSize: 10, color: C.teal, align: 'center', valign: 'middle', fontFace: MONO })
  })
  notes(s, '黄铭谦', '0:23', '基于这些机制，我们有五个创新点：第一，他人确认才算数，链码强制执行；第二，确认人下载原文件本地核验，确认的是这一份文件；第三，统计全程整数运算，所有节点结果一致；第四，证明无需登录即可公开验证；第五，链上只存证据不存内容，兼顾可信与隐私。讲完交给全书阅进入演示。')
}

// 9 界面 ---------------------------------------------------------------------
{
  const s = base('界面一览', PART3)
  const shots = [
    ['crop-dashboard', 1588, 610, '概览：项目、已验证里程碑、最近活动'],
    ['crop-project', 1588, 594, '项目详情：累计贡献与存证概况'],
    ['crop-certificate', 1077, 767, '贡献证书'],
    ['crop-verify', 958, 691, '公开验证：无需登录'],
  ]
  shots.forEach(([n, pw, ph, label], i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 0.8 + col * 6.05, y = 1.6 + row * 2.5
    s.addText(label, { x, y, w: 5.9, h: 0.35, fontSize: 13, bold: true, color: C.brand, fontFace: FONT })
    fitImage(s, n, pw, ph, x, y + 0.4, 5.9, 2.0, true)
  })
  s.addText('统一设计令牌与组件库 · 亮 / 暗两套主题 · 窄到 375 px 手机宽也不出横向滚动 · 错误逐块降级 · 15 组前端自检', {
    x: 0.8, y: 6.55, w: 12, h: 0.4, fontSize: 13, color: C.soft, fontFace: FONT,
  })
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
    s.addText(`${i + 1}. ${what}`, { x: 2.45, y, w: 6.3, h: 0.62, fontSize: 15, color: C.ink, valign: 'middle', fontFace: FONT })
  })
  card(s, 9.0, 1.75, 3.75, 4.4)
  s.addText('演示环境', { x: 9.25, y: 1.85, w: 3.3, h: 0.45, fontSize: 15, bold: true, color: C.ink, fontFace: FONT })
  bullets(s, [
    'demo:reset 一键重建账本',
    '3 个项目 · 6 个里程碑 · 2 张证书',
    '已验证、待确认、已拒绝都有',
    'dave 为非成员身份',
    '故障时改放讲解视频',
  ], 9.25, 2.35, 3.35, 3.7, 12)
  s.addText('全程真实 Fabric 网络，不手工修改账本。完整流程与异常场景见讲解视频。', { x: 0.8, y: 6.4, w: 12, h: 0.45, fontSize: 14, color: C.soft, fontFace: FONT })
  notes(s, '全书阅', '2:45（现场演示）', '切到浏览器，按 docs/DEMO_SCRIPT.md 第 2 节执行。现场故障时改放讲解视频第 3 部分。演示结束切回第 11 页。')
}

// 11 质量与协作 ----------------------------------------------------------------
{
  const s = base('质量保障与团队协作', PART4)
  const stats = [
    ['128', '链码单元测试', '证书 41 · 项目里程碑 32\n确认 28 · 模拟桩一致性 27'],
    ['34', '后端单元测试', '7 个文件：错误映射、鉴权、\n参数校验、文件存储等'],
    ['15', '组前端自检', '对比度、文案、契约、降级、\n异常数据、浏览器流程等'],
    ['3', '条 CI 流水线', 'Backend · Frontend · Chaincode\nPR 通过检查才能合并'],
  ]
  stats.forEach(([n, t, d], i) => {
    const x = 0.8 + i * 3.05
    card(s, x, 1.6, 2.8, 1.85)
    s.addText(n, { x: x + 0.25, y: 1.62, w: 1.4, h: 0.8, fontSize: 36, bold: true, color: C.brand, fontFace: FONT, valign: 'middle' })
    s.addText(t, { x: x + 0.25, y: 2.38, w: 2.4, h: 0.4, fontSize: 14, bold: true, color: C.ink, fontFace: FONT })
    s.addText(d, { x: x + 0.25, y: 2.78, w: 2.5, h: 0.6, fontSize: 10, color: C.soft, fontFace: FONT, valign: 'top' })
  })
  s.addText('真实 Fabric 冒烟、前后端契约检查、Demo 一键重置全部通过；仓库无私钥、证书和 .env 入库。', { x: 0.8, y: 3.5, w: 12, h: 0.4, fontSize: 13, color: C.soft, fontFace: FONT })
  const team = [
    ['全书阅（组长）', '后端 / 集成', 'Express API 与 Gateway 集成、双 SHA-256 与鉴权、联调与 CI、任务拆分与 Review'],
    ['杨宇', '前端 / 产品', '9 个页面与组件库、主题与响应式、15 组自检、原文件下载与本地核验'],
    ['黄铭谦', '区块链 / 智能合约', 'Fabric 网络部署、核心链码与状态机、128 项合约测试、Demo 种子脚本'],
  ]
  team.forEach(([name, role, d], i) => {
    const x = 0.8 + i * 4.05
    card(s, x, 4.0, 3.8, 2.05)
    s.addText([{ text: name + '\n', options: { bold: true, fontSize: 16, color: C.ink } }, { text: role, options: { fontSize: 12, color: C.brand } }],
      { x: x + 0.25, y: 4.07, w: 3.4, h: 0.72, fontFace: FONT, valign: 'middle' })
    s.addText(d, { x: x + 0.25, y: 4.82, w: 3.35, h: 1.15, fontSize: 12, color: C.soft, fontFace: FONT, valign: 'top' })
  })
  s.addText('4 周开发，36 个 Issue / PR：契约先行 → Mock 并行开发 → 测试驱动 → 联调对齐；每个 PR 交叉 Review 并通过 CI 才合并，贡献可在 GitHub 逐条追溯。', {
    x: 0.8, y: 6.15, w: 12, h: 0.65, fontSize: 12, color: C.soft, fontFace: FONT,
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
  s.addText('其余方向：里程碑权重上链 · 确认期限与仲裁 · 多主机联盟部署', { x: 7.3, y: 6.3, w: 5.3, h: 0.35, fontSize: 11, color: C.soft, fontFace: FONT })
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
  notes(s, '全书阅', '0:05', '进入 3 分钟提问，常见问题见 Issue #36。')
}


// ---------------------------------------------------------------------------
// 附录：备用页，放在致谢之后，提问时调出，不计入 7 分钟讲述
// ---------------------------------------------------------------------------

const APPX = '附录 · 备用页'
const backupNote = (s, use) => s.addNotes(`【备用页】不在 7 分钟讲述内，提问时调出。\n\n适用问题：${use}`)
const TH = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: C.brand } } })
const tableOpts = (x, y, w, colW, rowH, fontSize = 11) => ({
  x, y, w, colW, rowH, fontSize, fontFace: FONT, color: C.ink, valign: 'middle',
  border: { type: 'solid', color: C.line, pt: 1 }, fill: { color: C.card },
})

// A1 链上数据模型与事务函数
{
  const s = base('链上数据模型与链码事务函数', APPX)
  s.addTable([
    [TH('记录'), TH('键'), TH('主要字段')],
    ['Project', 'PROJECT_<id>', 'projectId、name、description、ownerId、members、createdAt、status'],
    ['Milestone', 'MILESTONE_<id>', 'milestoneId、projectId、title、fileName、fileHash、submitterId、requiredConfirmerIds、contributors、confirmations、status、txId'],
    ['Certificate', 'CERT_<id>', 'certificateId、projectId、memberId、contributionPercentage、milestoneIds、issuedAt、txId'],
    ['索引', '复合键', 'PROJECT_MILESTONE(projectId, milestoneId)；CERT_INDEX(projectId, memberId, certificateId)'],
  ], tableOpts(0.8, 1.65, 7.3, [1.25, 1.75, 4.3], 0.78, 11))
  s.addTable([
    [TH('类别'), TH('事务函数（14 个）')],
    ['项目', 'CreateProject · GetProject\nGetAllProjects · ProjectExists\nGetProjectHistory'],
    ['里程碑', 'CreateMilestone · GetMilestone\nGetProjectMilestones\nConfirmContribution'],
    ['统计', 'GetProjectContributions'],
    ['证书', 'IssueCertificate · GetCertificate\nGetCertificates · VerifyCertificate'],
  ], tableOpts(8.35, 1.65, 4.4, [1.0, 3.4], 0.78, 11))
  s.addText('只使用 getState / putState / getStateByRange / getStateByPartialCompositeKey / getHistoryForKey，LevelDB 即可运行，不依赖 CouchDB。', {
    x: 0.8, y: 6.0, w: 12, h: 0.6, fontSize: 12, color: C.soft, fontFace: FONT,
  })
  backupNote(s, '链上存了哪些数据、怎么查询、链码有哪些函数')
}

// A2 REST 接口与错误码
{
  const s = base('REST 接口与错误码', APPX)
  const api = [
    ['GET', '/health', '健康检查'],
    ['GET / POST', '/projects', '我的项目列表 / 创建项目'],
    ['GET', '/projects/:id', '项目详情'],
    ['GET', '/projects/:id/history', '项目链上历史'],
    ['GET / POST', '/projects/:id/milestones', '里程碑列表 / 提交里程碑（multipart）'],
    ['GET', '/milestones/:id', '里程碑详情'],
    ['GET', '/milestones/:id/file', '下载原文件（仅项目成员）'],
    ['POST', '/milestones/:id/confirmations', '确认或拒绝'],
    ['GET', '/projects/:id/contributions', '累计贡献统计'],
    ['GET', '/certificates', '按项目 / 成员查询证书'],
    ['POST', '/projects/:id/certificates', '签发贡献证明'],
    ['GET', '/certificates/:id', '证书详情'],
    ['GET', '/verify/:id', '公开验证（VALID / NOT_FOUND）'],
  ]
  s.addTable([[TH('方法'), TH('路径'), TH('说明')], ...api.map(([m, p, d]) => [
    { text: m, options: { fontFace: MONO, color: C.teal } }, { text: p, options: { fontFace: MONO } }, d,
  ])], tableOpts(0.8, 1.6, 7.6, [1.25, 3.3, 3.05], 0.36, 10))
  s.addText('共 15 个接口（GET / POST 同路径计为 2 个）；请求头 X-Member-Id 标识当前成员。', { x: 0.8, y: 6.75, w: 7.6, h: 0.3, fontSize: 10, color: C.soft, fontFace: FONT })
  const codes = [
    ['400', 'VALIDATION_ERROR、CONTRIBUTION_TOTAL_INVALID、FILE_HASH_MISMATCH'],
    ['403', 'MEMBER_NOT_IN_CLAIM、SUBMITTER_CANNOT_CONFIRM、MEMBER_NOT_REVIEWER'],
    ['404', 'PROJECT_NOT_FOUND、MILESTONE_NOT_FOUND、CERTIFICATE_NOT_FOUND'],
    ['409', 'ALREADY_DECIDED、MILESTONE_CLOSED、NO_VERIFIED_CONTRIBUTION'],
    ['500', 'INTERNAL_ERROR'],
  ]
  s.addTable([[TH('HTTP'), TH('错误码')], ...codes.map(([h, c]) => [
    { text: h, options: { bold: true, color: C.bad, align: 'center' } }, { text: c, options: { fontFace: MONO, fontSize: 9 } },
  ])], tableOpts(8.65, 1.6, 4.1, [0.7, 3.4], 0.72, 10))
  s.addText('错误码为英文供前端判断，message 为中文直接展示；业务失败一律返回 4xx。', { x: 8.65, y: 6.0, w: 4.1, h: 0.6, fontSize: 10, color: C.soft, fontFace: FONT })
  backupNote(s, '接口怎么设计、出错时怎么处理')
}

// A3 开发历程
{
  const s = base('开发历程：4 周、36 个 Issue / PR', APPX)
  const weeks = [
    ['第 1 周', '基础搭建', ['Fabric 测试网络与一键部署', '核心链码与确认状态机', '后端基础与 Gateway 集成', '前端 9 个页面与 Mock'], '#1–#4 · PR #8 #10 #12 #13'],
    ['第 2 周', '核心闭环', ['里程碑上传与双算 SHA-256', '贡献确认 API', '真实网络脚本修复', '前端接入真实接口'], '#5 · PR #18 #21 #22'],
    ['第 3 周', '展示层', ['项目时间线', '贡献统计面板', '证明签发与公开验证'], '#6 · PR #23'],
    ['第 4 周', '完善与交付', ['独立成员确认（修复自证漏洞）', '原文件下载与成员鉴权', 'Demo 一键重置', '交付材料与答辩准备'], '#24–#27 #7 · PR #28–#33'],
  ]
  s.addShape(pptx.ShapeType.line, { x: 0.8, y: 2.05, w: 11.95, h: 0, line: { color: C.brand, width: 2 } })
  weeks.forEach(([w, t, items, refs], i) => {
    const x = 0.8 + i * 3.05
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.05, y: 1.9, w: 0.3, h: 0.3, fill: { color: C.brand }, line: { color: C.brand } })
    s.addText([{ text: w + '　', options: { bold: true, color: C.brand } }, { text: t, options: { bold: true, color: C.ink } }], { x, y: 1.45, w: 2.8, h: 0.4, fontSize: 15, fontFace: FONT })
    card(s, x, 2.4, 2.8, 2.75, { fill: i === 3 ? C.brandSoft : C.card, line: i === 3 ? C.brand : C.line })
    bullets(s, items, x + 0.15, 2.5, 2.55, 2.0, 12)
    s.addText(refs, { x: x + 0.15, y: 4.6, w: 2.55, h: 0.45, fontSize: 9, color: C.teal, fontFace: MONO })
  })
  card(s, 0.8, 5.4, 11.95, 1.3, { fill: C.badSoft, line: C.badSoft })
  s.addText([
    { text: '关键修复：', options: { bold: true, color: C.bad } },
    { text: '最初规则是「全部 contributor 确认即 VERIFIED」，一个人可以提交只写自己 100% 的里程碑并自己确认。第 4 周改为除提交者外的全部成员独立确认，规则写入链码，并补充链码、后端、网络冒烟测试（Issue #24 / PR #28）。', options: { color: C.ink } },
  ], { x: 1.05, y: 5.45, w: 11.5, h: 1.2, fontSize: 13, valign: 'middle', fontFace: FONT })
  backupNote(s, '开发过程、分工如何协作、遇到过什么问题')
}

// A4 测试、验收与部署
{
  const s = base('测试、验收与部署', APPX)
  s.addTable([
    [TH('层次'), TH('内容'), TH('结果')],
    ['链码单元测试', 'Jest，4 个套件：证书 41、项目与里程碑 32、贡献确认 28、模拟桩一致性 27', '128 / 128'],
    ['后端单元测试', 'node:test，7 个文件：错误映射、成员鉴权、参数校验、文件存储、路由与返回结构', '34 / 34'],
    ['前端自检', 'npm run check：对比度、文案、间距、路由、数据、组件、SSR、契约、降级、异常数据、浏览器流程等', '15 组通过'],
    ['真实链路冒烟', 'smoke:projects · smoke:milestones · smoke:week3（真实 Fabric）', '通过'],
    ['前后端契约', 'check:contract 对真实后端逐字段校验', '通过'],
  ], tableOpts(0.8, 1.6, 7.6, [1.5, 4.9, 1.2], 0.7, 10))
  card(s, 8.65, 1.6, 4.1, 5.1)
  s.addText('部署与运行', { x: 8.9, y: 1.7, w: 3.6, h: 0.45, fontSize: 15, bold: true, color: C.ink, fontFace: FONT })
  bullets(s, [
    'WSL2 + Docker，Fabric 2.5.16 版本固定',
    'Org1、Org2 两个组织，1 个排序节点，通道 chainproof，LevelDB',
    'npm run demo:reset：重建账本 → 部署链码 → 启动后端 → 写入演示数据',
    '前端 .env.local 设 VITE_REAL_APIS=* 接入真实后端',
    '仓库不含私钥、证书、.env 与上传文件；打包前自动检查',
  ], 8.9, 2.2, 3.7, 4.4, 11)
  backupNote(s, '怎么测试的、怎么部署运行、能否复现')
}

if (pageNo !== TOTAL + 4) throw new Error(`页数 ${pageNo} 与正文 ${TOTAL} + 附录 4 不一致`)
pptx.writeFile({ fileName: OUT }).then((f) => console.log('wrote', f))
