// 把交付用的 Markdown 文档转成 Word（.docx），输出到 docs/defense/
//
// 依赖（都不是项目依赖）：
//   - marked：在临时目录装一次 `mkdir -p /tmp/pptgen && cd /tmp/pptgen && npm i marked@12.0.2`
//   - Windows 上的 Microsoft Word：通过 powershell.exe 调用 COM 另存为 .docx（需在 WSL 中运行）
//
// 用法（仓库根目录）：
//   NODE_PATH=/tmp/pptgen/node_modules node docs/defense/build-docx.cjs
//
// 改了 PROJECT_REPORT.md 或 TEAM_SCORES.md 之后重跑一次即可。

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { marked } = require('marked')

const REPO = path.resolve(__dirname, '../..')
const DOCS = path.join(REPO, 'docs')
const OUT = path.join(DOCS, 'defense')
const BLOB = 'https://github.com/Looffeeuu/ChainProof/blob/main/docs/'

// Word 只能读 Windows 路径，HTML 和图片先放到 C:\Temp 下中转
const STAGE_WIN = 'C:\\Temp\\chainproof-docx'
const STAGE = '/mnt/c/Temp/chainproof-docx'

const JOBS = [
  { md: 'PROJECT_REPORT.md', docx: 'ChainProof-项目介绍.docx', title: 'ChainProof 项目介绍' },
  { md: 'TEAM_SCORES.md', docx: 'ChainProof-成员分工与贡献打分.docx', title: 'ChainProof 成员分工与贡献打分' },
]

const CSS = `
  body { font-family: "Microsoft YaHei", sans-serif; font-size: 10.5pt; line-height: 1.6; color: #0F172A; }
  h1 { font-size: 20pt; color: #3438C8; }
  h2 { font-size: 15pt; color: #3438C8; border-bottom: 1px solid #E2E8F0; padding-bottom: 2pt; margin-top: 16pt; }
  h3 { font-size: 12pt; margin-top: 10pt; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0; }
  th, td { border: 1px solid #CBD5E1; padding: 4pt 6pt; vertical-align: top; font-size: 9.5pt; }
  th { background: #E6E8FB; }
  blockquote { color: #475569; border-left: 3px solid #3438C8; margin: 6pt 0; padding-left: 8pt; }
  pre, code { font-family: Consolas, "Microsoft YaHei", monospace; font-size: 9pt; }
  pre { background: #F4F6FB; padding: 6pt; }
  img { width: 7.2cm; }
`

fs.rmSync(STAGE, { recursive: true, force: true })
fs.mkdirSync(path.join(STAGE, 'img'), { recursive: true })

for (const job of JOBS) {
  let md = fs.readFileSync(path.join(DOCS, job.md), 'utf8')
  // 图片：复制到中转目录，改为相对路径
  md = md.replace(/!\[([^\]]*)\]\(([^)]+\.png)\)/g, (_, alt, src) => {
    const name = path.basename(src)
    fs.copyFileSync(path.join(DOCS, src), path.join(STAGE, 'img', name))
    return `![${alt}](img/${name})`
  })
  // 仓库内的相对链接：改为 GitHub 地址，Word 里点得开
  md = md.replace(/\]\(((?!https?:)[^)#]+\.md)\)/g, (_, href) => `](${BLOB}${href})`)
  let body = marked.parse(md, { breaks: false })
  // Word 不认 CSS 里的图片宽度：直接写像素尺寸（截图均为 16:10）
  body = body.replace(/<img /g, '<img width="520" height="325" ')
  // 插图与「表 n / 图 n」标题居中
  body = body.replace(/<p><img /g, '<p style="text-align:center"><img ')
  body = body.replace(/<p><strong>([表图] \d+)/g, '<p style="text-align:center"><strong>$1')
  // 短单元格（姓名、分数等）不换行，避免 Word 自动列宽把它挤成竖排
  body = body.replace(/<(td|th)>([^<]{1,7})<\/\1>/g, '<$1 nowrap>$2</$1>')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${job.title}</title><style>${CSS}</style></head><body>${body}</body></html>`
  fs.writeFileSync(path.join(STAGE, job.md.replace(/\.md$/, '.html')), html)
}

// Word COM：打开 HTML → 把链接图片嵌入文档 → 另存为 .docx（wdFormatDocumentDefault = 16）
const ps = JOBS.map((job) => {
  const html = `${STAGE_WIN}\\${job.md.replace(/\.md$/, '.html')}`
  const docx = `${STAGE_WIN}\\${job.docx}`
  return `
  $d = $w.Documents.Open("${html}")
  foreach ($s in $d.InlineShapes) { if ($s.LinkFormat) { $s.LinkFormat.SavePictureWithDocument = $true; $s.LinkFormat.BreakLink() } }
  $d.SaveAs2("${docx}", 16)
  $d.Close()
  "saved ${job.docx}"`
}).join('\n')

execFileSync('powershell.exe', ['-NoProfile', '-Command', `$w = New-Object -ComObject Word.Application; $w.Visible = $false; try { ${ps} } finally { $w.Quit() }`], { stdio: 'inherit' })

for (const job of JOBS) {
  fs.copyFileSync(path.join(STAGE, job.docx), path.join(OUT, job.docx))
  console.log('wrote', path.relative(REPO, path.join(OUT, job.docx)))
}
