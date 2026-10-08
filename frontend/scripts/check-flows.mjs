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
 *  贡献面板的容器也叫 `.panel`，会选到它的清单行上去
 *
 *  `$wait(固定毫秒)` 与 `$until(条件)` 的区别，是这份脚本稳不稳的关键，
 *  见下面「为什么不用固定等待」一段。新写的场景一律用 `$until`。 */
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

  /**
   * 等到 fn() 返回真值为止，返回那个值；等不到就抛一句说得出是在等什么的错。
   *
   * what 是给失败信息用的：超时抛的是「等不到：确认按钮」，
   * 而不是一句在 JSON.parse 里炸开的 SyntaxError。
   */
  window.$until = async (fn, what, ms = 15000) => {
    const deadline = Date.now() + ms
    for (;;) {
      let v = null
      try { v = fn() } catch { v = null }
      if (v) return v
      if (Date.now() > deadline) throw new Error('等不到：' + what)
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  /**
   * 等这一页的取数都结束。
   *
   * AsyncSection 加载中渲染的是 .loading-slot（components/base/AsyncSection.vue），
   * 它不在了就说明四个并发请求都回来、数据已经画出来了。
   * 这是个与断言本身无关的信号——用它等，不会把「值最后自己变对了」
   * 也算成通过。
   */
  window.$settled = () => window.$until(
    () => !document.querySelector('.loading-slot'), '页面取数结束'
  )

  /** 应用内切身份：等菜单真的弹出来、等身份真的换了、等换完之后的取数结束。
   *  AppShell 的 RouterView 绑了 :key="currentMemberId"，切身份会整个重挂，
   *  所以这里必须等 $settled()，否则读到的是上一个身份的那一帧 */
  window.$pick = async (who) => {
    (await window.$until(() => document.querySelector('.trigger'), '身份菜单的触发器')).click()
    ;(await window.$until(
      () => window.$$('[role=dialog] .row').find((row) => row.textContent.includes(who)),
      '身份菜单里的 ' + who
    )).click()
    await window.$until(() => window.$text('.trigger .name') === who, '身份切到 ' + who)
    await window.$settled()
  }

  /** 应用内跳转：vue-router 听 popstate，不会整页重载。
   *  ready 是这一页画出来了的标志，等到它、再等取数结束 */
  window.$goto = async (path, ready, what) => {
    history.pushState({}, '', path)
    dispatchEvent(new PopStateEvent('popstate'))
    await window.$until(() => location.pathname === path && ready(), what || ('打开 ' + path))
    await window.$settled()
  }
`

/**
 * 在页面里跑一段返回 JSON 的代码，并把页面里抛的错**原样抛出来**。
 *
 * `page.evaluate` 在页面抛错时返回的是 `"EXC: …"` 字符串。直接 JSON.parse 它，
 * 得到的是一句 `SyntaxError: Unexpected token E`——真正的原因（哪一步没等到）
 * 全丢了，排查只能靠重跑。这一层把它还原成一句能读的失败信息。
 */
async function evalJSON(page, expression) {
  const raw = await page.evaluate(expression)
  if (typeof raw === 'string' && raw.startsWith('EXC:')) {
    // 页面里抛的是 Error，描述自带一个 "Error: " 前缀；外层打印时还会再加一个
    // 类名，留着就成了「Error: Error: 等不到：确认按钮」
    throw new Error(raw.slice(4).trim().split('\n')[0].replace(/^Error:\s*/, ''))
  }
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`页面返回的不是 JSON：${String(raw).slice(0, 200)}`)
  }
}

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
 * 所以现场造一个：P003（alice、charlie）里由 alice 提交一条只有她自己的里程碑，
 * 然后**不刷新页面**切身份——一刷新，内存里的假数据就还原了。
 *
 * 顺路把 PR #28 的三种视角走一遍，它们正好都在这条链上：
 * alice 是提交者，没有确认入口；bob 不在 P003，不是确认人；
 * charlie 分到 0%，却是唯一的确认人，由他确认之后这条才变成已验证。
 *
 * —— 为什么不用固定等待 ——
 *
 * 这个场景是全部十三个里链最长的一条：填表 → 算哈希 → 提交 → 落到详情页 → 确认
 * → 切身份 → 跳项目页 → 再切回去，中间跨了五次取数。原来每一步都是
 * `$wait(1500)` / `$wait(1800)` 这样的固定睡眠，而假数据每次调用要 200–600ms
 * 随机延时（mock/handlers.js），项目详情页一次并发四个请求，切身份还会因为
 * `RouterView :key="currentMemberId"` 整个重挂再取一轮。
 *
 * 机器空闲时这些固定值够用，CI 上跑满核时就不一定——**2026-09-20 组长在 PR #14
 * 的首次运行里撞到的就是这个**：同一个提交重跑一次就过了。赌赢与赌输之间没有
 * 任何代码差异，这种检查失败一次就不再有人信它。
 *
 * 所以这条场景里不再有固定睡眠：每一步都 `$until(...)` 等一个**说得出名字的**
 * 标志出现——哈希算完了、路由到了、确认反馈出来了、取数结束了。
 * 等到就立刻往下走（比原来快），等不到就抛「等不到：确认按钮」，
 * 而不是在下一行悄悄读到 null。
 */
async function 零贡献成员不能签发(page) {
  // 先看 N = 0 的情况：一条已验证的都没有，按钮同样灰掉，但说的是另一个原因
  await goAs(page, 'charlie', '/projects/P003', '.issue')
  await page.evaluate(HELPERS)
  const empty = await evalJSON(page, `(async () => {
    await $settled()
    return JSON.stringify({
      disabled: $btn('签发我的贡献证明')?.disabled ?? null,
      why: $text('#issue-blocked'),
      panel: $text('.empty'),
      rows: $$('.legend .row').map((row) => row.textContent.replace(/\\s+/g, '')),
      bar: Boolean(document.querySelector('.bar'))
    })
  })()`)
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
  const r = await evalJSON(page, `(async () => {
    const title = document.querySelector('input[type=text]')
    title.value = '只有 alice 的成果'
    title.dispatchEvent(new Event('input', { bubbles: true }))

    const fi = document.querySelector('input[type=file]')
    fi.files = $file('a.txt', 1024)
    fi.dispatchEvent(new Event('change', { bubbles: true }))
    // 哈希没算完，提交按钮本来就会拦下来——等它真的出来，不要赌
    await $until(() => document.querySelector('.hash-line'), '文件哈希算完')

    // P003 的成员顺序是 alice、charlie：alice 100，charlie 0
    const nums = $$('.rows input[type=number]')
    nums[0].value = 100
    nums[0].dispatchEvent(new Event('input', { bubbles: true }))
    await $until(() => $text('.total') === '100', '比例合计变成 100')

    ;(await $until(() => $btn('提交并存证'), '提交按钮')).click()
    await $until(() => location.pathname.startsWith('/milestones/M'), '提交后落到里程碑详情页')
    const milestonePath = location.pathname
    await $settled()

    // 提交者自己没有确认入口，只有一句说明（PR #28）
    await $until(() => ($text('.gate-reason') ?? '').includes('不能确认自己的提交'), '提交者看到的说明')
    const asSubmitter = { button: Boolean($btn('确认这份声明')), why: $text('.gate-reason') }

    // bob 不是 P003 的成员，也就不在确认人名单里
    await $pick('bob')
    await $until(() => ($text('.gate-reason') ?? '').includes('不是本里程碑确认人'), '非确认人看到的说明')
    const asOutsider = { button: Boolean($btn('确认这份声明')), why: $text('.gate-reason') }

    // charlie 在这条里分到 0%，但他是唯一的确认人
    await $pick('charlie')
    const confirmBtn = await $until(() => $btn('确认这份声明'), 'charlie 的确认按钮')
    const zeroAsk = $text('.ask')
    confirmBtn.click()
    // .done 是确认成功后的那句反馈；它出来了，这一步才算真的走完
    await $until(() => document.querySelector('.done'), '确认成功的反馈')
    await $settled()
    const badge = $text('.badge')

    await $goto('/projects/P003', () => $btn('签发我的贡献证明'), '以 charlie 打开 P003')

    const btn = $btn('签发我的贡献证明')
    const rows = $$('.legend .row').map((row) => row.textContent.replace(/\\s+/g, ''))
    const charlie = {
      disabled: btn?.disabled ?? null,
      why: $text('#issue-blocked'),
      describedBy: btn?.getAttribute('aria-describedby') ?? null,
      rows
    }

    // 切回 alice：页面还是这一页，但 RouterView 会重挂并重取一轮
    await $pick('alice')
    await $until(() => $btn('签发我的贡献证明'), '切回 alice 之后的签发按钮')
    const alice = {
      disabled: $btn('签发我的贡献证明')?.disabled ?? null,
      note: $text('.issue p')
    }
    return JSON.stringify({ milestonePath, badge, charlie, alice, asSubmitter, asOutsider, zeroAsk })
  })()`)

  assert('提交者没有确认按钮', r.asSubmitter.button === false, `button=${r.asSubmitter.button}`)
  assert('提交者看到「不能确认自己的提交」', String(r.asSubmitter.why).includes('不能确认自己的提交'), r.asSubmitter.why)
  assert('非确认人没有确认按钮', r.asOutsider.button === false, `button=${r.asOutsider.button}`)
  assert('非确认人看到「不是本里程碑确认人」', String(r.asOutsider.why).includes('不是本里程碑确认人'), r.asOutsider.why)
  assert('0% 的确认人看到的是「没有给你分配比例」，不是「0% 记在你名下」',
    String(r.zeroAsk).includes('没有给你分配比例'), r.zeroAsk)

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
 * 提交页提前说清「提交之后谁来确认」，不是成员的人打开时直接拦下（PR #28）。
 *
 * 确认人是项目里除提交者外的全部成员，与比例怎么分无关——不在提交前说出来，
 * 用户会以为「没分比例的人不用管」。不是成员的人提交，后端会回 400，
 * 但表单填完才知道就晚了，所以在表单最上面先说。
 */
async function 提交页说清谁来确认(page) {
  await goAs(page, 'alice', '/projects/P001/milestones/new', '.allocator')
  await page.evaluate(HELPERS)
  const member = await evalJSON(page, `(async () => {
    await $until(() => $text('.confirmers'), '确认人提示')
    return JSON.stringify({ confirmers: $text('.confirmers'), blocked: $text('.blocked') })
  })()`)
  assert('列出了提交后由谁确认', String(member.confirmers).includes('bob、charlie'), member.confirmers)
  assert('说明提交者自己不参与确认', String(member.confirmers).includes('不参与确认'), member.confirmers)
  assert('项目成员不会被拦', member.blocked === null, `blocked=${member.blocked}`)

  // bob 不在 P003（成员只有 alice、charlie）
  await goAs(page, 'bob', '/projects/P003/milestones/new', 'form')
  await page.evaluate(HELPERS)
  const outsider = await evalJSON(page, `(async () => {
    await $until(() => $text('.blocked'), '非成员的拦截提示')
    ;(await $until(() => $btn('提交并存证'), '提交按钮')).click()
    await $wait(300)
    return JSON.stringify({
      blocked: $text('.blocked'),
      why: $text('.why'),
      path: location.pathname,
      confirmers: $text('.confirmers')
    })
  })()`)
  assert('非成员打开时表单上方说清为什么', String(outsider.blocked).includes('不是这个项目的成员'), outsider.blocked)
  assert('按钮旁边说的是同一个原因', String(outsider.why).includes('不是这个项目的成员'), outsider.why)
  assert('点提交不会离开这一页', outsider.path === '/projects/P003/milestones/new', outsider.path)
  assert('被拦时不显示确认人提示', outsider.confirmers === null, `confirmers=${outsider.confirmers}`)
}

/**
 * 下载原文件 → 拖回核对框 → 一致（#25 的答辩演示链），以及两种拿不到的情况。
 *
 * 浏览器真的去保存文件的话，无头模式下拿不到结果，所以拦下「交给浏览器保存」那一步：
 * 记下 Blob 与文件名，不真的触发下载。拦的是 URL.createObjectURL 与 <a download> 的点击，
 * 正是 utils/save-blob.js 用到的两处——页面自己的取数、哈希、渲染一律照常走。
 */
async function 下载原文件后核对一致(page) {
  await goAs(page, 'alice', '/projects/P003/milestones/new', 'form')
  await page.evaluate(HELPERS)
  const r = await evalJSON(page, `(async () => {
    window.__saved = null
    const create = URL.createObjectURL
    URL.createObjectURL = (b) => { window.__saved = { blob: b, name: null }; return create.call(URL, b) }
    const click = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && window.__saved) { window.__saved.name = this.download; return }
      return click.call(this)
    }
    const hex = async (blob) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
      .map((b) => b.toString(16).padStart(2, '0')).join('')

    // alice 在 P003 提交一份 3000 字节的文件
    const title = document.querySelector('input[type=text]')
    title.value = '下载演示'
    title.dispatchEvent(new Event('input', { bubbles: true }))
    const fi = document.querySelector('input[type=file]')
    fi.files = $file('原件.bin', 3000)
    fi.dispatchEvent(new Event('change', { bubbles: true }))
    await $until(() => document.querySelector('.hash-line'), '文件哈希算完')
    const nums = $$('.rows input[type=number]')
    nums[0].value = 100
    nums[0].dispatchEvent(new Event('input', { bubbles: true }))
    await $until(() => $text('.total') === '100', '比例合计变成 100')
    ;(await $until(() => $btn('提交并存证'), '提交按钮')).click()
    await $until(() => location.pathname.startsWith('/milestones/M'), '提交后落到里程碑详情页')
    await $settled()

    const stored = document.querySelector('.file .hash .value')?.getAttribute('title') ?? ''
    ;(await $until(() => $btn('下载原文件'), '下载按钮')).click()
    await $until(() => window.__saved?.name, '保存那一步被触发')
    const status = await $until(() => $$('.download p').map((p) => p.textContent.trim()).find((t) => t.startsWith('已下载')), '下载完成的提示')
    const downloaded = await hex(window.__saved.blob)
    const original = await hex(new Blob([new Uint8Array(3000)]))

    // 把下载回来的那一份原样拖进核对框
    const ci = document.querySelector('.checker input[type=file]')
    const dt = new DataTransfer()
    dt.items.add(new File([window.__saved.blob], window.__saved.name))
    ci.files = dt.files
    ci.dispatchEvent(new Event('change', { bubbles: true }))
    const verdict = await $until(() => $text('.checker .verdict'), '核对结论')

    // 项目详情时间线上的「下载文件」走同一条路：拿到的是同一份字节、同一个文件名。
    // 应用内跳转，不整页刷新——Mock 的原始字节只存在本次会话里
    window.__saved = null
    const milestonePath = location.pathname
    await $goto('/projects/P003', () => document.querySelector('.timeline'), '回到项目详情的时间线')
    const row = await $until(() => $$('.timeline .item').find((li) => li.querySelector('.title')?.textContent.includes('下载演示')), '时间线上刚提交的那一条')
    ;[...row.querySelectorAll('button')].find((b) => b.textContent.includes('下载文件')).click()
    await $until(() => window.__saved?.name, '时间线下载触发了保存')
    const fromTimeline = {
      name: window.__saved.name,
      hash: await hex(window.__saved.blob),
      notice: Boolean(row.querySelector('.notice'))
    }
    await $goto(milestonePath, () => document.querySelector('.download'), '回到里程碑详情页')

    // bob 不在 P003：不给按钮，说明原因
    await $pick('bob')
    await $until(() => document.querySelector('.download'), '换成 bob 之后的文件区')
    const outsider = {
      button: Boolean($btn('下载原文件')),
      text: $$('.download p').map((p) => p.textContent.trim()).join(' / ')
    }

    return JSON.stringify({
      name: window.__saved.name, size: window.__saved.blob.size, status,
      stored, downloaded, original, verdict, outsider, fromTimeline
    })
  })()`)

  assert('下载保留了原文件名', r.name === '原件.bin', r.name)
  assert('下载回来的字节数不变', r.size === 3000, `${r.size} 字节`)
  assert('下载回来的就是上传的那一份', r.downloaded === r.original, `${r.downloaded.slice(0, 16)}… vs ${r.original.slice(0, 16)}…`)
  assert('下载回来的哈希与页面上的存证一致', r.stored === r.downloaded, `存证 ${r.stored.slice(0, 16)}…`)
  assert('下载完指向下一步：拖进核对框', String(r.status).includes('拖进下面的方框'), r.status)
  assert('拖回核对框得出「一致」', String(r.verdict).includes('一致，是同一份文件'), r.verdict)
  assert('时间线下载保留了原文件名', r.fromTimeline.name === '原件.bin', r.fromTimeline.name)
  assert('时间线下载回来的就是上传的那一份', r.fromTimeline.hash === r.original, `${r.fromTimeline.hash.slice(0, 16)}…`)
  assert('时间线下载成功时不出错误提示', r.fromTimeline.notice === false, `notice=${r.fromTimeline.notice}`)
  assert('非项目成员没有下载按钮', r.outsider.button === false, `button=${r.outsider.button}`)
  assert('非项目成员看到原因', r.outsider.text.includes('只有项目成员可以下载原文件'), r.outsider.text)

  // 夹具只有哈希没有字节：如实报「文件不存在」，按钮旁边出错误提示，不是静默失败
  await goAs(page, 'charlie', '/milestones/M004', '.download')
  await page.evaluate(HELPERS)
  const missing = await evalJSON(page, `(async () => {
    ;(await $until(() => $btn('下载原文件'), '下载按钮')).click()
    await $until(() => $text('.notice'), '下载失败的提示')
    return JSON.stringify({ notice: $text('.notice'), stillButton: Boolean($btn('下载原文件')) })
  })()`)
  assert('文件缺失时说清是哪一步失败', String(missing.notice).includes('原文件没能下载'), missing.notice)
  assert('文件缺失时原样显示原因', String(missing.notice).includes('链下原始文件不存在'), missing.notice)
  assert('失败之后按钮还在，可以再试', missing.stillButton === true, `button=${missing.stillButton}`)
}

/**
 * 时间线上的「下载文件」失败时要说话（PR #29 review）。
 *
 * 默认夹具只有哈希没有原始字节，每条都会回 FILE_NOT_FOUND。
 * 只打 console 的话点了没反应，像按钮坏了；这里要求错误出现在出错的那一条下面，
 * 原样带着后端的 message，其他条目不受影响，按钮还在可以再试。
 */
async function 时间线下载失败要说话(page) {
  await goAs(page, 'alice', '/projects/P001', '.timeline')
  await page.evaluate(HELPERS)
  const r = await evalJSON(page, `(async () => {
    await $settled()
    const items = $$('.timeline .item')
    const row = items[0]
    const btn = () => [...row.querySelectorAll('button')].find((b) => b.textContent.includes('下载文件'))
    ;(await $until(btn, '时间线上的下载按钮')).click()
    const notice = await $until(() => row.querySelector('.notice'), '这一条下面的错误提示')
    return JSON.stringify({
      text: notice.textContent.trim(),
      role: notice.getAttribute('role'),
      others: items.slice(1).filter((li) => li.querySelector('.notice')).length,
      total: items.length,
      stillButton: Boolean(btn())
    })
  })()`)
  assert('时间线下载失败时说清是哪一步失败', r.text.includes('原文件没能下载'), r.text)
  assert('时间线下载失败时原样显示原因', r.text.includes('链下原始文件不存在'), r.text)
  assert('错误提示会被读屏念出来', r.role === 'alert', `role=${r.role}`)
  assert('错误只出现在出错的那一条下面', r.total > 1 && r.others === 0, `共 ${r.total} 条，其他条目出错误 ${r.others} 处`)
  assert('失败之后按钮还在，可以再试', r.stillButton === true, `button=${r.stillButton}`)
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
  ['提交页说清谁来确认', 提交页说清谁来确认],
  ['下载原文件后核对一致', 下载原文件后核对一致],
  ['时间线下载失败要说话', 时间线下载失败要说话],
  ['验证页换编号不留旧结果', 验证页换编号不留旧结果],
  ['比例超出时横条溢出', 比例超出时横条溢出],
  ['拒绝要二次确认', 拒绝要二次确认],
  ['确认之后有明确反馈', 确认之后有明确反馈],
  ['换身份与刷新', 换身份与刷新],
  ['复制失败要说话', 复制失败要说话],
  ['文件核对对不上', 文件核对对不上],
  ['验证页摆得出事实', 验证页摆得出事实]
]

/**
 * 两个只在排查时用的开关，默认都不开，CI 跑的还是完整的一整套：
 *
 *   FLOWS_ONLY=零贡献   只跑名字里含这几个字的场景
 *   FLOWS_SLOW=4        把页面 JS 的执行速度降到 1/4（CDP 的 CPU 节流）
 *
 * 后一个是用来**证明一条场景稳不稳**的：时序问题在空闲的本机上复现不出来，
 * 把 CPU 压到 1/4 就接近 CI 跑满核时的样子。改过等待逻辑之后，
 * 用 `FLOWS_ONLY=… FLOWS_SLOW=4` 连跑几遍，比在 CI 上碰运气快得多。
 */
const only = process.env.FLOWS_ONLY ?? ''
const slowdown = Number(process.env.FLOWS_SLOW ?? 1)

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

  const scenarios = only ? SCENARIOS.filter(([name]) => name.includes(only)) : SCENARIOS
  if (scenarios.length === 0) {
    console.log(`FLOWS_ONLY=${only} 没有匹配到任何场景。`)
    process.exit(1)
  }

  const page = await open(distDir)
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false
  })
  if (slowdown > 1) {
    await page.send('Emulation.setCPUThrottlingRate', { rate: slowdown })
    console.log(`（CPU 节流 ${slowdown}×）\n`)
  }

  try {
    for (const [name, run] of scenarios) {
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
      ? `${scenarios.length} 个交互场景、${results.length} 项断言，全部通过。`
      : `${results.length} 项断言里 ${failed} 项不通过。`
  )
  process.exit(failed === 0 ? 0 : 1)
}

await main()
