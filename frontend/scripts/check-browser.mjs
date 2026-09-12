/**
 * 浏览器冒烟检查：**运行时报错 + 窄屏横向溢出**。
 *
 *   npm run check:browser
 *
 * 这是唯一一个把页面放进**真浏览器**里跑的检查，所以它顺带承担了
 * 其余检查覆盖不到的那一层。
 *
 * spec/01 §3.2 的第 7 条——「缩到 375px 宽不出现横向滚动」——原先写着
 * 「只能目视，浏览器里拖窗口」。目视的问题不是做不到，是**没人会每次都做**：
 * 十个页面 × 两个宽度 = 二十次拖拽，改完一个组件谁也不会重走一遍。
 * 于是这条规则实际上从来没被执行过。
 *
 * 做法：起一个只服务 dist/ 的静态服务器，用无头浏览器把每个页面在
 * 375px（最窄的常见手机）与 900px（侧栏收成顶栏的断点边界）各开一次，
 * 比较 documentElement.scrollWidth 与 innerWidth。溢出时把**具体是哪个元素**
 * 撑出去的一并报出来——只说「这一页横向溢出了」，排查还得从头来。
 *
 * —— 为什么要收运行时报错 ——
 *
 * 其余十个检查里，凡是渲染组件的都走 `vite build --ssr` + `renderToString`。
 * 那条路径**跑不到带 `:id` 参数的真实路由**，也不执行浏览器专有的代码。
 * 结果是「提交里程碑」那一页连着两次出现 setup 阶段就抛的 `ReferenceError`
 * （`const` 的暂时性死区：immediate watch 在声明之前用到了变量），
 * 整页白屏，而全部自检**照样全绿**。
 *
 * 这里既然已经把每一页在真浏览器里打开了，把 `Runtime.exceptionThrown`
 * 和 `console.error` 收下来几乎不要成本，却能堵住整整一类「一打开就白屏」。
 *
 * 依赖：Node 内置模块 + 本机任意一个 Chromium 内核浏览器。
 * 找不到浏览器时整条检查 SKIP 并说明原因，不让它在没装 Chrome 的机器上变成红灯。
 * 浏览器位置可以用环境变量 CHROME_PATH 指定。
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, normalize } from 'node:path'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = join(here, '..', 'dist')

/** 要检查的页面。带参数的路由用假数据里真实存在的 ID（mock/fixtures.js） */
const PAGES = [
  ['概览', '/'],
  ['项目列表', '/projects'],
  ['创建项目', '/projects/new'],
  ['项目详情', '/projects/P001'],
  ['提交里程碑', '/projects/P001/milestones/new'],
  ['贡献确认', '/milestones/M001'],
  ['贡献证书', '/certificates/CERT-P001-ALICE'],
  ['公开验证', '/verify/CERT-P001-ALICE'],
  // 这条路由只在开发构建里注册（router/index.js），这里量的是生产产物，
  // 所以它落到 404 页——一并量一下那一页，正好覆盖到兜底路由
  ['组件预览（生产构建落到 404）', '/dev/components'],
  ['404', '/no-such-page']
]

/** 375 是最窄的常见手机；900 是侧栏收成顶栏的断点，边界最容易出事 */
const WIDTHS = [375, 900]

// ——— 静态服务器：只读 dist/，找不到的路径回退到 index.html（SPA 路由） ———

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    // normalize + 前缀校验：防止 ../ 穿出 dist
    let file = normalize(join(distDir, decodeURIComponent(url.pathname)))
    if (!file.startsWith(distDir)) file = join(distDir, 'index.html')
    if (!existsSync(file) || extname(file) === '') file = join(distDir, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

// ——— 浏览器 ———

/** 按优先级找一个 Chromium 内核浏览器。找不到返回 null */
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    // Windows
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean)
  return candidates.find((p) => existsSync(p)) ?? null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 极简 CDP 客户端。Node 22 自带全局 WebSocket，不需要任何依赖 */
async function connect(port) {
  let wsUrl
  for (let i = 0; i < 80; i++) {
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = tabs.find((t) => t.type === 'page')
      if (page) { wsUrl = page.webSocketDebuggerUrl; break }
    } catch { /* 浏览器还没起来，继续等 */ }
    await sleep(150)
  }
  if (!wsUrl) throw new Error('浏览器没能在 12 秒内就绪')

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('CDP 连接失败'))
  })

  let id = 0
  const waiting = new Map()

  /** 当前页面上收到的运行时问题。每次导航前清空 */
  const problems = []

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id) }

    // 未捕获的异常。setup 阶段抛的就落在这里，页面通常是白的
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails
      problems.push(d.exception?.description ?? d.text ?? '未知异常')
    }
    // console.error。Vue 的告警（缺 key、属性类型不对）走的是这条
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      problems.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id
      waiting.set(n, resolve)
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  return { ws, send, problems }
}

/**
 * 在页面里跑的那段。返回是否溢出，以及溢出时最靠右的那几个元素。
 *
 * 判据放宽 1px：小数宽度四舍五入后常会多出零点几个像素，
 * 那不是真的能滚动，卡在这种误差上只会让人去关掉这条检查。
 */
const PROBE = `(() => {
  const limit = window.innerWidth
  const over = []
  // 放在横向滚动容器里的东西不算溢出——宽表格、代码块、图表本来就允许比屏幕宽，
  // 前提是它自己能滚（spec/01 §3.2）。不排除的话，项目详情里那张
  // 明细表会每次都被报出来，久了就没人看这份输出了
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX
      if (ox === 'auto' || ox === 'scroll') return true
    }
    return false
  }
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.right > limit + 1 && !inScroller(el)) {
      over.push(el.tagName.toLowerCase()
        + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '')
        + ' 右边缘 ' + Math.round(r.right) + 'px')
    }
  }
  return JSON.stringify({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: limit,
    over: over.slice(0, 3)
  })
})()`

async function main() {
  if (!existsSync(join(distDir, 'index.html'))) {
    console.log('SKIP  dist/ 里没有 index.html，先跑 npm run build')
    process.exit(0)
  }

  const browser = findBrowser()
  if (!browser) {
    console.log('SKIP  本机没找到 Chrome / Edge / Chromium。')
    console.log('      装一个，或用 CHROME_PATH=/path/to/chrome 指定位置后重跑。')
    process.exit(0)
  }

  const server = await serve()
  const origin = `http://127.0.0.1:${server.address().port}`
  const port = 9500 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(join(tmpdir(), 'chainproof-check-'))

  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' })

  let failed = 0
  try {
    const { ws, send, problems } = await connect(port)
    await send('Page.enable')
    await send('Runtime.enable')

    for (const width of WIDTHS) {
      console.log(`—— ${width}px ——`)
      // mobile 必须是 false。开着的时候 Chrome 会在内容比视口宽时**自动缩放
      // 布局视口去迁就内容**（375 的窗口报出 406 的 innerWidth），
      // 于是真正的溢出被浏览器悄悄吸收掉，这条检查就永远是绿的。
      // 这里要量的是布局宽度，不是触摸行为，关掉它
      await send('Emulation.setDeviceMetricsOverride', {
        width, height: 800, deviceScaleFactor: 1, mobile: false
      })

      for (const [label, path] of PAGES) {
        problems.length = 0
        await send('Page.navigate', { url: origin + path })
        // 页面里的数据来自假接口，有几十毫秒延时；等它把内容画完再量
        await sleep(900)
        const res = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })
        const raw = res.result?.result?.value
      const r = typeof raw === 'string' ? JSON.parse(raw) : { broken: res.result?.exceptionDetails?.exception?.description ?? '取值失败' }

        const fits = r.scrollWidth <= r.innerWidth + 1
        const clean = problems.length === 0
        const ok = fits && clean
        if (!ok) failed++

        console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(12)} scrollWidth ${r.scrollWidth} / 视口 ${r.innerWidth}`)
        if (!fits) for (const item of r.over) console.log(`        撑出去的：${item}`)
        // 同一条报错在两个宽度下都会出现，两次都报出来是对的——
        // 它说明的是「这一页坏了」，不是「这个宽度下坏了」
        for (const p of problems) console.log(`        运行时报错：${String(p).replace(/\s+/g, ' ').slice(0, 140)}`)
      }
      console.log('')
    }

    // —— 打印态 ——
    //
    // 证书页是九个页面里唯一一个「产物是纸」的。而主题是靠 color-scheme 驱动
    // light-dark() 实现的，暗色下正文是接近白的 #e7eaf0——浏览器默认不打印背景色，
    // 于是切到暗色再 Ctrl+P，印出来是一张几乎空白的纸。
    // 这条曾经真的成立过，量的是「打印时正文必须是深色」。
    console.log('—— 打印态（证书页）——')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
    })
    for (const theme of ['light', 'dark', 'system']) {
      problems.length = 0
      await send('Page.navigate', { url: origin + '/certificates/CERT-P001-ALICE' })
      // 等证书真的渲染出来再量，不要用固定的 sleep 赌它加载完了——
      // 赌输的时候这条检查会报「没找到证书正文」，看起来像缺陷，其实是自己太急
      for (let i = 0; i < 40; i++) {
        const probe = await send('Runtime.evaluate', {
          expression: "Boolean(document.querySelector('.sheet .lead'))",
          returnByValue: true
        })
        if (probe.result?.result?.value) break
        await sleep(100)
      }
      await send('Runtime.evaluate', {
        expression:
          theme === 'system'
            ? "delete document.documentElement.dataset.theme"
            : `document.documentElement.dataset.theme = '${theme}'`
      })
      await send('Emulation.setEmulatedMedia', { media: 'print' })
      await sleep(200)

      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const el = document.querySelector('.sheet .lead') || document.querySelector('.sheet')
          if (!el) return JSON.stringify({ missing: true })
          const c = getComputedStyle(el).color
          const [r, g, b] = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map(Number)
          // 感知亮度（ITU-R BT.601）。纸是白的，正文必须够深才印得出来
          return JSON.stringify({ luma: Math.round(0.299 * r + 0.587 * g + 0.114 * b) })
        })()`,
        returnByValue: true
      })
      await send('Emulation.setEmulatedMedia', { media: '' })

      const raw = res.result?.result?.value
      const r = typeof raw === 'string' ? JSON.parse(raw) : { broken: res.result?.exceptionDetails?.exception?.description ?? '取值失败' }
      const ok = !r.missing && !r.broken && r.luma < 128 && problems.length === 0
      if (!ok) failed++
      console.log(
        `${ok ? 'OK  ' : 'FAIL'}  主题 ${theme.padEnd(8)} 打印时正文亮度 ${r.broken ?? (r.missing ? '（没找到证书正文）' : r.luma)}${ok || r.broken || r.missing ? '' : '  —— 太浅，印在白纸上看不见'}`
      )
      for (const p of problems) console.log(`        运行时报错：${String(p).replace(/\s+/g, ' ').slice(0, 140)}`)
    }
    console.log('')

    ws.close()
  } finally {
    child.kill()
    server.close()
    // 临时的浏览器配置目录，删不掉也不影响结果，所以吞掉异常
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* 忽略 */ }
  }

  console.log(
    failed === 0
      ? '两个宽度下都没有横向溢出、没有运行时报错，证书页在三种主题下都打得出来。'
      : `${failed} 处不通过（横向溢出、运行时报错，或打印态的正文太浅）。`
  )
  process.exit(failed === 0 ? 0 : 1)
}

await main()
