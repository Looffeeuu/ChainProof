/**
 * 无头浏览器的公共部件：静态服务器 + 找浏览器 + 极简 CDP 客户端。
 *
 * 两个检查用它：`check:browser`（横向溢出与运行时报错）与
 * `check:flows`（交互之后的状态）。抽出来是因为这一百来行里没有一行是
 * 「这个检查要查什么」——全是「怎么把页面放进浏览器」。抄两遍就会出现两种，
 * 而且其中一种迟早忘了收 `Runtime.exceptionThrown`。
 *
 * 依赖：Node 内置模块 + 本机任意一个 Chromium 内核浏览器。
 * 没有浏览器时 `findBrowser()` 返回 null，调用方 SKIP 掉整条检查，
 * 不在没装 Chrome 的机器上变成红灯。位置可以用环境变量 CHROME_PATH 指定。
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { tmpdir } from 'node:os'

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

/** 只读 dist/ 的静态服务器，找不到的路径回退到 index.html（SPA 路由） */
export function serve(distDir) {
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

/** 按优先级找一个 Chromium 内核浏览器。找不到返回 null */
export function findBrowser() {
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

  /** 当前页面上收到的运行时问题。调用方在每次导航前清空 */
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
 * 起服务器 + 起浏览器 + 连上 CDP，把一套现成的把手交给调用方。
 *
 * @param {string} distDir 要伺服的目录
 * @returns {Promise<{
 *   origin: string, send: Function, problems: string[],
 *   evaluate: (expr: string) => Promise<any>,
 *   go: (path: string, waitFor?: string) => Promise<void>,
 *   close: () => void
 * }>}
 */
export async function open(distDir) {
  const browser = findBrowser()
  if (!browser) throw new Error('本机没找到 Chromium 内核浏览器')

  const server = await serve(distDir)
  const origin = `http://127.0.0.1:${server.address().port}`
  const port = 9500 + Math.floor(Math.random() * 400)
  const profile = mkdtempSync(join(tmpdir(), 'chainproof-check-'))

  const child = spawn(browser, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: 'ignore' })

  const { ws, send, problems } = await connect(port)
  await send('Page.enable')
  await send('Runtime.enable')

  /**
   * 在页面里求值，直接拿到结果。
   *
   * `awaitPromise` 打开：交互脚本大多是 async 的（点一下、等一会儿、再读）。
   * 页面里抛了异常就把描述原样返回，让断言自己判——**不要静默变成 undefined**，
   * 那会让一条失败的检查看起来像通过了。
   */
  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    const details = res.result?.exceptionDetails
    if (details) return `EXC: ${details.exception?.description ?? details.text}`
    return res.result?.result?.value
  }

  /**
   * 导航到某一页，并**等到指定选择器出现**再返回。
   *
   * 不用固定的 sleep：假数据带 200–600ms 延时，机器忙的时候更久，
   * 赌输的那次会报成「元素不存在」，看起来像缺陷，其实是自己太急。
   */
  async function go(path, waitFor = '#main, .page, body > div') {
    problems.length = 0
    await send('Page.navigate', { url: origin + path })
    for (let i = 0; i < 60; i++) {
      const ok = await evaluate(`Boolean(document.querySelector(${JSON.stringify(waitFor)}))`)
      if (ok === true) return
      await sleep(100)
    }
    throw new Error(`打开 ${path} 之后 6 秒内没等到 ${waitFor}`)
  }

  function close() {
    try { ws.close() } catch { /* 已经断了 */ }
    child.kill()
    server.close()
    // 临时的浏览器配置目录，删不掉也不影响结果
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* 忽略 */ }
  }

  return { origin, send, problems, evaluate, go, close }
}
