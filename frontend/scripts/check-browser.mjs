/**
 * 浏览器冒烟检查：**运行时报错 + 窄屏横向溢出 + 打印态**。
 *
 *   npm run check:browser
 *
 * 它和 `check:flows` 是一对：这一条只**打开**每一页，量的是「静止时对不对」；
 * 那一条会去点、去填、去拖，量的是「动过之后对不对」。
 * 共用的浏览器部件在 `lib/headless.mjs`。
 *
 * spec/01 §3.2 的第 7 条——「缩到 375px 宽不出现横向滚动」——原先写着
 * 「只能目视，浏览器里拖窗口」。目视的问题不是做不到，是**没人会每次都做**：
 * 十个页面 × 两个宽度 = 二十次拖拽，改完一个组件谁也不会重走一遍。
 * 溢出时把**具体是哪个元素**撑出去的一并报出来——只说「这一页横向溢出了」，
 * 排查还得从头来。
 *
 * —— 为什么要收运行时报错 ——
 *
 * 其余检查里凡是渲染组件的都走 `vite build --ssr` + `renderToString`。
 * 那条路径**跑不到带 `:id` 参数的真实路由**，也不执行浏览器专有的代码。
 * 结果是「提交里程碑」那一页连着两次出现 setup 阶段就抛的 `ReferenceError`
 * （`const` 的暂时性死区：immediate watch 在声明之前用到了变量），
 * 整页白屏，而全部自检**照样全绿**。既然页面已经在真浏览器里打开了，
 * 把 `Runtime.exceptionThrown` 和 `console.error` 收下来几乎不要成本。
 *
 * —— 为什么要量打印态 ——
 *
 * 证书页是九个页面里唯一一个「产物是纸」的。而主题靠 `color-scheme` 驱动
 * `light-dark()`，暗色下正文是接近白的 #e7eaf0——浏览器默认不打印背景色，
 * 于是切到暗色再 Ctrl+P，印出来是一张几乎空白的纸。**这条真的成立过**
 * （2026-09-12 复审实测），修完之后加了这组断言，并反向验证过它会红。
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { open, findBrowser, sleep } from './lib/headless.mjs'

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
  if (!findBrowser()) {
    console.log('SKIP  本机没找到 Chrome / Edge / Chromium。')
    console.log('      装一个，或用 CHROME_PATH=/path/to/chrome 指定位置后重跑。')
    process.exit(0)
  }

  const page = await open(distDir)
  let failed = 0

  try {
    for (const width of WIDTHS) {
      console.log(`—— ${width}px ——`)
      // mobile 必须是 false。开着的时候 Chrome 会在内容比视口宽时**自动缩放
      // 布局视口去迁就内容**（375 的窗口报出 406 的 innerWidth），
      // 于是真正的溢出被浏览器悄悄吸收掉，这条检查就永远是绿的。
      // 这里要量的是布局宽度，不是触摸行为，关掉它
      await page.send('Emulation.setDeviceMetricsOverride', {
        width, height: 800, deviceScaleFactor: 1, mobile: false
      })

      for (const [label, path] of PAGES) {
        await page.go(path)
        // 数据来自假接口，有几十毫秒延时；等它把内容画完再量
        await sleep(700)
        const r = JSON.parse(await page.evaluate(PROBE))

        const fits = r.scrollWidth <= r.innerWidth + 1
        const clean = page.problems.length === 0
        const ok = fits && clean
        if (!ok) failed++

        console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(12)} scrollWidth ${r.scrollWidth} / 视口 ${r.innerWidth}`)
        if (!fits) for (const item of r.over) console.log(`        撑出去的：${item}`)
        // 同一条报错在两个宽度下都会出现，两次都报出来是对的——
        // 它说明的是「这一页坏了」，不是「这个宽度下坏了」
        for (const p of page.problems) console.log(`        运行时报错：${String(p).replace(/\s+/g, ' ').slice(0, 140)}`)
      }
      console.log('')
    }

    // —— 打印态 ——
    console.log('—— 打印态（证书页）——')
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
    })

    for (const theme of ['light', 'dark', 'system']) {
      await page.go('/certificates/CERT-P001-ALICE', '.sheet .lead')
      await page.evaluate(
        theme === 'system'
          ? "delete document.documentElement.dataset.theme"
          : `document.documentElement.dataset.theme = '${theme}'`
      )
      await page.send('Emulation.setEmulatedMedia', { media: 'print' })
      await sleep(150)

      // 不在注入的代码里用正则：反斜杠要穿过模板字面量再进浏览器，
      // 少一层转义就变成另一个正则，而且失败时表现为「匹配到 null」，很难看出来
      const raw = await page.evaluate(`(() => {
        const el = document.querySelector('.sheet .lead')
        if (!el) return JSON.stringify({ missing: true })
        const c = getComputedStyle(el).color
        const [r, g, b] = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map(Number)
        // 感知亮度（ITU-R BT.601）。纸是白的，正文必须够深才印得出来
        return JSON.stringify({ luma: Math.round(0.299 * r + 0.587 * g + 0.114 * b) })
      })()`)
      await page.send('Emulation.setEmulatedMedia', { media: '' })

      const r = typeof raw === 'string' ? JSON.parse(raw) : { broken: String(raw) }
      const ok = !r.missing && !r.broken && r.luma < 128 && page.problems.length === 0
      if (!ok) failed++
      const detail = r.broken ?? (r.missing ? '（没找到证书正文）' : r.luma)
      console.log(
        `${ok ? 'OK  ' : 'FAIL'}  主题 ${theme.padEnd(8)} 打印时正文亮度 ${detail}${ok || r.broken || r.missing ? '' : '  —— 太浅，印在白纸上看不见'}`
      )
    }
    console.log('')
  } finally {
    page.close()
  }

  console.log(
    failed === 0
      ? '两个宽度下都没有横向溢出、没有运行时报错，证书页在三种主题下都打得出来。'
      : `${failed} 处不通过（横向溢出、运行时报错，或打印态的正文太浅）。`
  )
  process.exit(failed === 0 ? 0 : 1)
}

await main()
