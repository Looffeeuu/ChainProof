/**
 * 交互之后的状态检查：**点了、填了、拖了之后，界面对不对**。
 *
 *   npm run check:flows
 *
 * —— 为什么要有这一条 ——
 *
 * 2026-09-12 的复审查出 19 条缺陷，**11 个自检脚本一条都没拦住**。
 * 原因不是脚本写得差，是它们全都只量「页面刚加载完」那一帧：
 * SSR 那几条渲染的是首屏字符串，`check:browser` 打开每一页量宽度。
 * 而那 19 条里的大多数只在**动过之后**才成立——
 *
 *   - 哈希算到一半点「取消」，提交按钮仍然可点，会发出一条没有哈希的存证；
 *   - 创建项目之后，侧栏的计数与「最近项目」整块消失；
 *   - 比例超过 100% 时，那条本该「装不下」的横条被 flex 压回了刚好满；
 *   - 空表单点提交，按钮是灰的，页面上没有任何一处说为什么。
 *
 * 这些都得真的去点一下才看得见。复审当时用的是一次性探针，跑完就删了——
 * **这一条就是把那些探针固定下来。**
 *
 * 每个场景之间互相隔离：每次 `page.go()` 都是一次整页加载，
 * `mock/handlers.js` 的可写副本随之重置，上一个场景建的项目不会漏到下一个。
 * 演示身份存在 localStorage 里，所以每个场景显式指定以谁的身份进入。
 *
 * 浏览器部件与 `check:browser` 共用，在 `lib/headless.mjs`。
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { open, findBrowser, sleep } from './lib/headless.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = join(here, '..', 'dist')

const results = []

/** 记一条断言。detail 里放**实际看到的值**，失败时不用再去猜 */
function assert(label, ok, detail = '') {
  results.push({ ok: Boolean(ok), label, detail })
}

/**
 * 以某个身份打开某一页。
 *
 * 身份现在落 localStorage（stores/session.js），所以要先写进去再重新加载——
 * 不这么做，上一个场景切过的身份会漏到下一个场景里。
 */
async function goAs(page, member, path, waitFor) {
  await page.go('/')
  await page.evaluate(`localStorage.setItem('chainproof.session', '${member}')`)
  await page.go(path, waitFor)
  await sleep(400)
}

/** 页面里常用的小工具，注入一次，各场景直接调。
 *  选身份菜单里的项用 `[role=dialog] .row`，不要用 `.panel .row`——
 *  贡献面板的容器也叫 `.panel`，会选到它的清单行上去 */
const HELPERS = `
  window.$$ = (sel) => [...document.querySelectorAll(sel)]
  window.$btn = (text) => window.$$('button').find((b) => b.textContent.includes(text))
  window.$text = (sel) => document.querySelector(sel)?.textContent.trim() ?? null
  window.$file = (name, bytes) => {
    const dt = new DataTransfer()
    dt.items.add(new File([new Uint8Array(bytes)], name))
    return dt.files
  }
  window.$wait = (ms) => new Promise((r) => setTimeout(r, ms))
`

// ——————————————————————————————————————————————————————————
// 场景
// ——————————————————————————————————————————————————————————

/**
 * 空表单点提交，必须有反应。
 *
 * 这一条钉的是 spec/01 的一条硬要求，也是最容易退化回去的一处：
 * 只要有人给提交按钮加回 `:disabled="!valid"`，点击就不会发生，
 * `focusFirstInvalid` 又会变成永远跑不到的死代码（它曾经就是）。
 */
async function 空表单点提交(page) {
  await goAs(page, 'alice', '/projects/new', 'form')
  await page.evaluate(HELPERS)

  const before = await page.evaluate(`JSON.stringify({
    disabled: $btn('创建项目').disabled,
    why: $text('.why'),
    errors: $$('.err').length
  })`)
  const b = JSON.parse(before)

  assert('创建项目页：提交按钮不靠禁用来拦', b.disabled === false, `disabled=${b.disabled}`)
  assert('创建项目页：进页面就说明了缺什么', b.why === '请填写项目名称。', `.why=${b.why}`)
  assert('创建项目页：还没动过时不摆红字', b.errors === 0, `${b.errors} 条错误`)

  const after = JSON.parse(await page.evaluate(`(async () => {
    $btn('创建项目').click()
    await $wait(400)
    const el = document.activeElement
    return JSON.stringify({
      path: location.pathname,
      errors: $$('.err').map((e) => e.textContent.trim()),
      focusTag: el.tagName,
      focusInvalid: el.getAttribute('aria-invalid')
    })
  })()`))

  assert('创建项目页：点了之后没有跳走', after.path === '/projects/new', after.path)
  assert('创建项目页：点了之后把错误摆出来', after.errors.includes('请填写项目名称。'), after.errors.join(' / '))
  assert(
    '创建项目页：焦点送到出错的控件上',
    after.focusTag === 'INPUT' && after.focusInvalid === 'true',
    `${after.focusTag} aria-invalid=${after.focusInvalid}`
  )
}

/**
 * 建完项目，侧栏要立刻跟上。
 *
 * `invalidateProjects()` 只置空缓存、没人重取的那个版本，会让侧栏的计数与
 * 「最近项目」整块消失，而且要等用户自己走到某个会取数的页面才回来。
 */
async function 创建项目后侧栏跟上(page) {
  await goAs(page, 'alice', '/projects', '.grid')
  await page.evaluate(HELPERS)

  const before = Number(await page.evaluate(`Number($text('.nav-item .count'))`))
  assert('侧栏一开始有项目计数', before > 0, `计数 ${before}`)

  const after = JSON.parse(await page.evaluate(`(async () => {
    history.pushState({}, '', '/projects/new'); dispatchEvent(new PopStateEvent('popstate'))
    await $wait(800)
    const input = document.querySelector('input[type=text]')
    input.value = '自检建的项目'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await $wait(200)
    $btn('创建项目').click()
    await $wait(1800)
    return JSON.stringify({
      path: location.pathname,
      count: Number($text('.nav-item .count')),
      recent: $$('.recent-item').map((x) => x.textContent.trim())
    })
  })()`))

  assert('建完项目落到详情页', /^\/projects\/P\d+$/.test(after.path), after.path)
  assert('侧栏计数 +1', after.count === before + 1, `${before} → ${after.count}`)
  assert(
    '侧栏「最近项目」里出现刚建的那个',
    after.recent.includes('自检建的项目'),
    after.recent.join(' / ') || '（空）'
  )
}

/**
 * 取消哈希之后不许提交。
 *
 * 放行的那个版本会产出一条 `fileHash` 为空的里程碑——确认页的核对区绑
 * `v-if="milestone.fileHash"`，那条记录从此**无法被任何人核对**，
 * 而「可核对」是这个产品的全部主张。
 *
 * 文件要足够大，才来得及在算完之前点到「取消」。
 */
async function 取消哈希后不许提交(page) {
  await goAs(page, 'alice', '/projects/P001/milestones/new', 'form')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    const title = document.querySelector('input[type=text]')
    title.value = '自检里程碑'
    title.dispatchEvent(new Event('input', { bubbles: true }))

    const nums = $$('.rows input[type=number]')
    const vals = [34, 33, 33]
    for (let i = 0; i < nums.length; i++) {
      nums[i].value = vals[i]
      nums[i].dispatchEvent(new Event('input', { bubbles: true }))
      await $wait(80)
    }

    // 文件受 50 MB 上限约束，原生实现几十毫秒就算完，来不及点取消。
    // 藏起 crypto.subtle 逼它走纯 JS 分片路径——也就是用 http://局域网IP
    // 打开时的真实路径，取消按钮本来就主要是为它准备的
    Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true })
    const fi = document.querySelector('input[type=file]')
    fi.files = $file('big.bin', 40 * 1024 * 1024)
    fi.dispatchEvent(new Event('change', { bubbles: true }))
    await $wait(60)

    const cancel = $$('button').find((b) => b.className.includes('cancel'))
    if (!cancel) return JSON.stringify({ noCancel: true })
    cancel.click()
    await $wait(400)

    $btn('提交并存证').click()
    await $wait(1200)
    return JSON.stringify({
      path: location.pathname,
      why: $text('.why'),
      hashShown: Boolean(document.querySelector('.hash-line'))
    })
  })()`))

  assert('大文件计算中出现「取消」按钮', !r.noCancel, r.noCancel ? '没找到取消按钮' : '有')
  if (r.noCancel) return

  assert('取消之后界面上没有哈希', r.hashShown === false, `hash-line=${r.hashShown}`)
  assert('取消之后提交被拦住，没有跳走', r.path === '/projects/P001/milestones/new', r.path)
  assert(
    '取消之后说清了为什么不能提交',
    typeof r.why === 'string' && r.why.includes('SHA-256'),
    r.why
  )
}

/**
 * 超过 50 MB 的文件当场拦下，不去算哈希。
 *
 * 两处都要守：提交页（拦住提交、说清原因）与确认页的核对区
 * （不算、给出说法）。不拦的话，原生实现会把整个文件读进内存，
 * 选一个几 GB 的文件标签页直接崩。
 */
async function 超限文件当场拦下(page) {
  await goAs(page, 'alice', '/projects/P001/milestones/new', 'form')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    // 先填标题：按钮旁边只说第一条没满足的规则，标题空着的话说的是标题
    const title = document.querySelector('input[type=text]')
    title.value = '自检里程碑'
    title.dispatchEvent(new Event('input', { bubbles: true }))

    const fi = document.querySelector('input[type=file]')
    fi.files = $file('huge.bin', 50 * 1024 * 1024 + 1)
    fi.dispatchEvent(new Event('change', { bubbles: true }))
    await $wait(300)
    const invalid = fi.getAttribute('aria-invalid')
    $btn('提交并存证').click()
    await $wait(800)
    return JSON.stringify({
      hashing: Boolean(document.querySelector('.hashing')),
      hashShown: Boolean(document.querySelector('.hash-line')),
      invalid,
      why: $text('.why'),
      path: location.pathname
    })
  })()`))

  assert('超限文件不进入哈希计算', r.hashing === false && r.hashShown === false,
    `hashing=${r.hashing} hash-line=${r.hashShown}`)
  assert('文件框标成无效', r.invalid === 'true', `aria-invalid=${r.invalid}`)
  assert('说清了上限是多少', typeof r.why === 'string' && r.why.includes('50 MB'), r.why)
  assert('提交被拦住，没有跳走', r.path === '/projects/P001/milestones/new', r.path)

  await goAs(page, 'alice', '/milestones/M001', '.checker')
  await page.evaluate(HELPERS)
  const c = JSON.parse(await page.evaluate(`(async () => {
    const fi = document.querySelector('.checker input[type=file]')
    fi.files = $file('huge.bin', 50 * 1024 * 1024 + 1)
    fi.dispatchEvent(new Event('change', { bubbles: true }))
    await $wait(300)
    return JSON.stringify({
      text: document.querySelector('.checker').innerText,
      verdict: Boolean(document.querySelector('.checker .result'))
    })
  })()`))

  assert('核对区对超限文件给出说法', c.text.includes('上传上限'), c.text.split(String.fromCharCode(10)).pop())
  assert('核对区不下「一致 / 对不上」的结论', c.verdict === false, `result=${c.verdict}`)
}

/**
 * 从 /verify/某编号 回到 /verify，上一张证书的结论必须消失。
 *
 * 不清的话：输入框已经空了，页面上还挂着绿色的「与存证记录一致」——
 * 等于给一个访客没有查过的编号下了结论。这一页是给项目外的人看的。
 */
async function 验证页换编号不留旧结果(page) {
  await goAs(page, 'alice', '/verify/CERT-P001-ALICE', '.facts')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    const before = $text('.verdict')

    // 应用内回到没有编号的 /verify，等同于点页头链接或浏览器后退
    history.pushState({}, '', '/verify')
    dispatchEvent(new PopStateEvent('popstate'))
    await $wait(600)
    const cleared = {
      verdict: $text('.verdict'),
      facts: $$('.facts').length,
      input: document.querySelector('input[type=search]')?.value ?? null
    }

    // 再查一个不存在的编号，结论要换成「没有找到」
    history.pushState({}, '', '/verify/CERT-NOPE')
    dispatchEvent(new PopStateEvent('popstate'))
    await $wait(1200)
    return JSON.stringify({ before, cleared, after: $text('.verdict') })
  })()`))

  assert('先查到的证书显示「与存证记录一致」', String(r.before).includes('与存证记录一致'), r.before)
  assert('回到 /verify 后旧结论消失', r.cleared.verdict === null, `还留着：${r.cleared.verdict}`)
  assert('旧的事实列表也一并消失', r.cleared.facts === 0, `还有 ${r.cleared.facts} 块`)
  assert('输入框跟着清空', r.cleared.input === '', `输入框里是 ${JSON.stringify(r.cleared.input)}`)
  assert('换一个不存在的编号，结论换成「没有找到」',
    String(r.after).includes('没有找到'), r.after)
}

/**
 * 0% 成员看得到签发按钮，但按钮是灰的，旁边逐字写着接口的那句提示。
 *
 * 组长任务单的验收项：「0% 成员显示正常但不能签发证书」。假数据里没有现成的 0% 成员，
 * 所以现场造一个：P003（alice、charlie）里提交一条只有 alice 的里程碑并确认，
 * 然后**不刷新页面**切到 charlie——一刷新，内存里的假数据就还原了。
 */
async function 零贡献成员不能签发(page) {
  // 先看 N = 0 的情况：一条已验证的都没有，按钮同样灰掉，但说的是另一个原因
  await goAs(page, 'charlie', '/projects/P003', '.issue')
  await page.evaluate(HELPERS)
  const empty = JSON.parse(await page.evaluate(`JSON.stringify({
    disabled: $btn('签发我的贡献证明')?.disabled ?? null,
    why: $text('#issue-blocked'),
    panel: $text('.empty'),
    rows: $$('.legend .row').map((row) => row.textContent.replace(/\s+/g, '')),
    bar: Boolean(document.querySelector('.bar'))
  })`))
  assert('没有已验证里程碑时按钮在、但灰掉', empty.disabled === true, `disabled=${empty.disabled}`)
  assert('没有已验证里程碑时说清原因', String(empty.why).includes('还没有任何一条里程碑'), empty.why)
  assert('说清为什么都是 0%', String(empty.panel).includes('还没有可统计的贡献比例'), empty.panel)
  // review 第 5 条：接口返回的是项目全体成员，一条都没验证时也要把人列出来，
  // 否则这一页看不出项目里有谁
  assert('全员 0% 时成员仍然逐个列出', empty.rows.length === 2, `列出了 ${empty.rows.length} 人`)
  assert('列出来的都是 0%', empty.rows.every((r) => r.endsWith('0%')), empty.rows.join(' / '))
  assert('没有已验证里程碑时不画横条', empty.bar === false, `bar=${empty.bar}`)

  await goAs(page, 'alice', '/projects/P003/milestones/new', 'form')
  await page.evaluate(HELPERS)
  const r = JSON.parse(await page.evaluate(`(async () => {
    const title = document.querySelector('input[type=text]')
    title.value = '只有 alice 的成果'
    title.dispatchEvent(new Event('input', { bubbles: true }))

    const fi = document.querySelector('input[type=file]')
    fi.files = $file('a.txt', 1024)
    fi.dispatchEvent(new Event('change', { bubbles: true }))

    // P003 的成员顺序是 alice、charlie：alice 100，charlie 0
    const nums = $$('.rows input[type=number]')
    nums[0].value = 100
    nums[0].dispatchEvent(new Event('input', { bubbles: true }))
    await $wait(600)

    $btn('提交并存证').click()
    await $wait(1500)
    const milestonePath = location.pathname

    $btn('确认这份声明').click()
    await $wait(1500)
    const badge = $text('.badge')

    // 应用内切身份，不刷新
    document.querySelector('.trigger').click()
    await $wait(200)
    $$('[role=dialog] .row').find((row) => row.textContent.includes('charlie')).click()
    await $wait(300)

    // 应用内跳转：vue-router 听 popstate，不会整页重载
    history.pushState({}, '', '/projects/P003')
    dispatchEvent(new PopStateEvent('popstate'))
    await $wait(1800)

    const btn = $btn('签发我的贡献证明')
    const rows = $$('.legend .row').map((row) => row.textContent.replace(/\\s+/g, ''))
    const charlie = {
      disabled: btn?.disabled ?? null,
      why: $text('#issue-blocked'),
      describedBy: btn?.getAttribute('aria-describedby') ?? null,
      rows
    }

    document.querySelector('.trigger').click()
    await $wait(200)
    $$('[role=dialog] .row').find((row) => row.textContent.includes('alice')).click()
    await $wait(1800)
    const alice = {
      disabled: $btn('签发我的贡献证明')?.disabled ?? null,
      note: $text('.issue p')
    }
    return JSON.stringify({ milestonePath, badge, charlie, alice })
  })()`))

  assert('里程碑提交并确认成已验证', String(r.badge).includes('链上已验证'), `${r.milestonePath} · ${r.badge}`)
  assert('0% 成员仍然出现在面板里', r.charlie.rows.some((x) => x.includes('charlie') && x.endsWith('0%')),
    r.charlie.rows.join(' / '))
  assert('0% 成员的签发按钮在、但灰掉', r.charlie.disabled === true, `disabled=${r.charlie.disabled}`)
  assert('提示逐字照接口的那句话', r.charlie.why === '累计贡献比例为 0%，不能签发证书。', r.charlie.why)
  assert('按钮用 aria-describedby 指向这句提示', r.charlie.describedBy === 'issue-blocked',
    `aria-describedby=${r.charlie.describedBy}`)
  assert('切回 alice（100%）按钮可以点', r.alice.disabled === false, `disabled=${r.alice.disabled}`)
  assert('alice 看得到自己的比例', String(r.alice.note).includes('100%'), r.alice.note)
}

/**
 * 比例超过 100% 时，横条真的装不下。
 *
 * `.seg` 少一个 `flex-shrink: 0`，flex 就会把超出的部分按比例压回容器宽度，
 * 三个人各 60% 画出来仍然是一条刚好填满的横条——注释里承诺的那个
 * 「装不下」的提示从来不会出现。
 */
async function 比例超出时横条溢出(page) {
  await goAs(page, 'alice', '/projects/P001/milestones/new', '.allocator')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    const nums = $$('.rows input[type=number]')
    for (const n of nums) {
      n.value = 60
      n.dispatchEvent(new Event('input', { bubbles: true }))
      await $wait(100)
    }
    const bar = document.querySelector('.bar')
    const segs = [...bar.querySelectorAll('.seg')]
    const barRight = Math.round(bar.getBoundingClientRect().right)
    const lastRight = Math.round(segs[segs.length - 1].getBoundingClientRect().right)
    return JSON.stringify({
      total: $text('.total'),
      chip: $text('.chip'),
      barRight,
      lastRight
    })
  })()`))

  assert('总和显示 180', r.total === '180', r.total)
  assert('文字提示说清超出多少', r.chip === '超出 80%', r.chip)
  assert(
    '横条最后一段真的越过了容器右边缘',
    r.lastRight > r.barRight,
    `段右缘 ${r.lastRight} vs 容器右缘 ${r.barRight}`
  )
}

/**
 * 「拒绝」这一步不可撤回，必须先问一次；用户反悔时什么都不能发生。
 */
async function 拒绝要二次确认(page) {
  await goAs(page, 'charlie', '/milestones/M004', '.ask')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    let asked = null
    const original = window.confirm
    window.confirm = (msg) => { asked = msg; return false }
    $btn('拒绝').click()
    await $wait(600)
    window.confirm = original
    return JSON.stringify({
      asked,
      badge: $text('.badge'),
      stillAsking: Boolean(document.querySelector('.ask'))
    })
  })()`))

  assert('点「拒绝」会先问一次', typeof r.asked === 'string' && r.asked.length > 0, r.asked ?? '没问')
  assert('问的那句话说清了后果', String(r.asked).includes('不能撤回'), String(r.asked).slice(0, 40))
  assert('用户反悔时状态不变', String(r.badge).includes('待确认'), r.badge)
  assert('用户反悔时按钮还在', r.stillAsking === true, `.ask=${r.stillAsking}`)
}

/**
 * 确认之后要有一句明确的成功反馈，而不是徽章悄悄换个颜色。
 *
 * charlie 是 M004 声明里最后一个没表态的人，他一确认，这条就该变成已验证。
 */
async function 确认之后有明确反馈(page) {
  await goAs(page, 'charlie', '/milestones/M004', '.ask')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    $btn('确认这份声明').click()
    await $wait(1200)
    return JSON.stringify({
      done: $text('.done'),
      badge: $text('.badge'),
      live: document.querySelector('.done')?.getAttribute('aria-live') ?? null
    })
  })()`))

  assert('确认之后出现成功反馈', typeof r.done === 'string' && r.done.includes('已记录你的确认'), r.done)
  assert('反馈说清了这条已经写入存证', String(r.done).includes('写入存证'), String(r.done).slice(0, 40))
  assert('徽章跟着变成已验证', String(r.badge).includes('链上已验证'), r.badge)
  assert('成功反馈对读屏可播报', r.live === 'polite', `aria-live=${r.live}`)
}

/**
 * 换身份之后列表要重新取数，而且刷新之后身份还在。
 *
 * alice 参与三个项目，bob 只参与两个（mock/fixtures.js）。
 */
async function 换身份与刷新(page) {
  await goAs(page, 'alice', '/projects', '.grid')
  await page.evaluate(HELPERS)

  const before = Number(await page.evaluate(`$$('.card').length`))
  assert('alice 看到三个项目', before === 3, `${before} 个`)

  const after = JSON.parse(await page.evaluate(`(async () => {
    document.querySelector('.trigger').click()
    await $wait(200)
    $$('[role=dialog] .row').find((r) => r.textContent.includes('bob')).click()
    await $wait(1500)
    return JSON.stringify({
      who: $text('.trigger .name'),
      cards: $$('.card').length,
      count: Number($text('.nav-item .count'))
    })
  })()`))

  assert('切到 bob 之后列表重新取了数', after.cards === 2, `${before} → ${after.cards} 个`)
  assert('侧栏计数跟着变', after.count === 2, `计数 ${after.count}`)

  // 整页重新加载，身份必须还在——演示中途刷一次页面就变回 alice 的话，
  // 「同一条记录在不同成员眼里不一样」这件事当场演不下去
  await page.go('/projects', '.grid')
  await sleep(600)
  const who = await page.evaluate(`document.querySelector('.trigger .name').textContent.trim()`)
  assert('整页刷新之后身份还是 bob', who === 'bob', who)
}

/**
 * 复制失败不许无声。
 *
 * `navigator.clipboard` 在非安全上下文里根本不存在（局域网 http 演示就是
 * 这种情况），调用直接抛 TypeError。这里把它拿掉来复现那个环境。
 */
async function 复制失败要说话(page) {
  await goAs(page, 'alice', '/milestones/M001', '.file')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    // 复现非安全上下文：clipboard 整个不存在
    Object.defineProperty(navigator, 'clipboard', { get: () => undefined, configurable: true })
    const btn = document.querySelector('.copy')
    btn.click()
    await $wait(300)
    return JSON.stringify({
      hint: $text('.hash .fail'),
      title: btn.getAttribute('title'),
      marked: btn.className.includes('is-failed')
    })
  })()`))

  assert('复制失败时旁边出一行字', typeof r.hint === 'string' && r.hint.length > 0, r.hint ?? '（没有）')
  assert('失败的提示说清了该怎么办', String(r.hint).includes('手动选中'), String(r.hint))
  assert('按钮自己也标成失败', r.marked === true, `class 含 is-failed=${r.marked}`)
  assert('title 跟着改，不再说「复制」', String(r.title).includes('复制不了'), r.title)
}

/**
 * 文件核对：对不上的时候要把两个哈希都摆出来。
 *
 * 拖进去的是自检临时造的字节，几乎不可能与存证记录里的哈希相同，
 * 所以这里量的是**不一致**那条路径——它恰恰是最要紧的那条。
 */
async function 文件核对对不上(page) {
  await goAs(page, 'alice', '/milestones/M001', '.checker')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`(async () => {
    const fi = document.querySelector('.checker input[type=file]')
    fi.files = $file('别的文件.bin', 4096)
    fi.dispatchEvent(new Event('change', { bubbles: true }))
    await $wait(1200)
    return JSON.stringify({
      verdict: $text('.checker .verdict'),
      miss: Boolean(document.querySelector('.checker .is-miss')),
      hashes: $$('.checker .compare .value').length
    })
  })()`))

  assert('核对给出明确结论', typeof r.verdict === 'string' && r.verdict.includes('对不上'), r.verdict)
  assert('结论用的是拒绝那一组色', r.miss === true, `is-miss=${r.miss}`)
  assert('两个哈希都摆出来供人自己看', r.hashes === 2, `${r.hashes} 个`)
}

/**
 * 公开验证页把六项事实都摆出来了，不是一排「—」。
 *
 * **这条守的是拆信封那一步。** `docs/API.md §5` 规定命中时返回
 * `{ certificateId, verificationStatus, certificate: {…} }`，
 * 而视图读的是扁平的字段。`api/certificates.js` 少拆一层的话，
 * 页面**不会报错也不会白屏**——它会挂着绿色的「证书有效」徽章、
 * 说「这份证书与存证记录一致」，而下面六项里五项显示「—」。
 * 对一个给项目外的人看的页面，这比白屏更糟：它在说一句自己拿不出依据的话。
 */
async function 验证页摆得出事实(page) {
  await goAs(page, 'alice', '/verify/CERT-P001-ALICE', '.facts')
  await page.evaluate(HELPERS)

  const r = JSON.parse(await page.evaluate(`JSON.stringify({
    verdict: $text('.verdict'),
    facts: $$('.facts > div').map((d) => d.innerText.split(String.fromCharCode(10)).join('=')),
    hasTx: Boolean(document.querySelector('.facts .wide'))
  })`))

  const empty = r.facts.filter((f) => f.endsWith('=—'))

  assert(
    '结论是「与存证记录一致」',
    String(r.verdict).includes('与存证记录一致'),
    String(r.verdict).split(String.fromCharCode(10))[0]
  )
  assert('六项事实一项都不缺', empty.length === 0, empty.length ? `空的：${empty.join(' / ')}` : r.facts.join(' / '))
  assert('链上交易那一行在', r.hasTx === true, `wide=${r.hasTx}`)
}

// ——————————————————————————————————————————————————————————

const SCENARIOS = [
  ['空表单点提交', 空表单点提交],
  ['建完项目侧栏跟上', 创建项目后侧栏跟上],
  ['取消哈希后不许提交', 取消哈希后不许提交],
  ['超限文件当场拦下', 超限文件当场拦下],
  ['零贡献成员不能签发', 零贡献成员不能签发],
  ['验证页换编号不留旧结果', 验证页换编号不留旧结果],
  ['比例超出时横条溢出', 比例超出时横条溢出],
  ['拒绝要二次确认', 拒绝要二次确认],
  ['确认之后有明确反馈', 确认之后有明确反馈],
  ['换身份与刷新', 换身份与刷新],
  ['复制失败要说话', 复制失败要说话],
  ['文件核对对不上', 文件核对对不上],
  ['验证页摆得出事实', 验证页摆得出事实]
]

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
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
  })

  try {
    for (const [name, run] of SCENARIOS) {
      console.log(`—— ${name} ——`)
      const from = results.length
      try {
        await run(page)
      } catch (e) {
        assert(`${name}：场景本身跑挂了`, false, `${e.constructor.name}: ${e.message}`)
      }
      // 场景跑完再看有没有运行时报错。一次未捕获的异常就足以让页面停在半路，
      // 而上面那些断言可能碰巧还是绿的
      if (page.problems.length) {
        assert(
          `${name}：过程中没有运行时报错`,
          false,
          page.problems.map((p) => String(p).replace(/\s+/g, ' ').slice(0, 120)).join(' | ')
        )
      }
      for (const r of results.slice(from)) {
        console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label.padEnd(32)} ${r.detail}`)
      }
      console.log('')
    }
  } finally {
    page.close()
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(
    failed === 0
      ? `${SCENARIOS.length} 个交互场景、${results.length} 项断言，全部通过。`
      : `${results.length} 项断言里 ${failed} 项不通过。`
  )
  process.exit(failed === 0 ? 0 : 1)
}

await main()
