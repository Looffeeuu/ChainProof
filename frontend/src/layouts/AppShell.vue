<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { session } from '../stores/session.js'
import { isDev } from '../stores/settings.js'
import { useAsync } from '../composables/useAsync.js'
import { useMainFocus } from '../composables/useMainFocus.js'
import { ensureProjects, invalidateProjects, projects } from '../stores/projects.js'
import { sortByRecent } from '../stores/recent.js'
import { clearFlash } from '../stores/flash.js'
import BrandMark from '../components/base/BrandMark.vue'
import ThemeToggle from '../components/base/ThemeToggle.vue'
import IdentityMenu from '../components/base/IdentityMenu.vue'

const route = useRoute()

// 切页后把焦点移到主内容区，否则键盘用户每次换页都要重新 Tab 穿过整条侧栏
const main = useMainFocus()

// 走 stores/projects.js 的共享缓存，不再自己 listProjects()。
// 这里和概览页几乎同时挂载，各取各的会打两次请求，两次返回时间不同，
// 侧栏计数与正文统计先后跳变；创建完项目之后侧栏也不会更新
const { error: projectsError, run: loadProjects } = useAsync(ensureProjects)
onMounted(loadProjects)

// 侧栏在 RouterView 外面，换身份时不会跟着重新挂载，得自己重来一次。
// 必须先失效再取——listProjects 是按 X-Member-Id 过滤的，
// 缓存里那份是上一个人的
watch(() => session.currentMemberId, () => {
  invalidateProjects()
  loadProjects()
  // 换人之后还留着上一个身份的「你已提交…」会很怪
  clearFlash()
})

/**
 * 导航是一条平铺的列表，没有分组标题。
 *
 * 原先分成「工作区 / 存证 / 开发」三组，每组一两项，标题比内容还多——
 * 四个条目撑不起三个眉标。条目少的时候不分组，等多到一屏放不下再说。
 *
 * 图标用内联 SVG 而不是字符：字符在不同系统上字形差别很大，
 * 也没法跟着 stroke-width 统一粗细。
 */
const items = computed(() => [
  { key: 'dashboard', to: '/', label: '概览', icon: 'grid' },
  // 取不到时不显示计数，而不是显示 0——「读失败」和「一个项目都没有」不是一回事
  { key: 'projects', to: '/projects', label: '项目', icon: 'layers',
    count: projectsError.value ? undefined : projects.value?.length },
  { key: 'verify', to: '/verify', label: '公开验证', icon: 'check' },
  // 组件预览是开发页：生产构建里根本没有这条路由（router/index.js），
  // 开发构建里也只在「开发视角」下才出现在导航里
  ...(import.meta.env.DEV && isDev()
    ? [{ key: 'dev-components', to: '/dev/components', label: '组件预览', icon: 'box' }]
    : [])
])

/**
 * 侧栏中段的「最近项目」。
 *
 * 加它的直接原因是版面：三条导航加一个底栏，240×1000px 的侧栏空着八成，
 * 大片留白在这里不是呼吸，是没做完。但填进来的必须是真有用的东西，
 * 不能是装饰——最近开的项目是这个应用里点击最频繁的入口，
 * 放这里正好省掉「概览 → 项目 → 找一遍」这三步。
 *
 * **排序按「最近访问」，不是「最新创建」。** 一开始写的是按 createdAt 倒序，
 * 那其实是「新建的项目」——名字承诺的是访问，行为给的是创建顺序，
 * 而按创建时间排根本达不到上面那个「省掉三步」的目的。
 * 访问记录在 stores/recent.js，只落本机 localStorage；
 * 一次都没点过时，排序结果和改造之前完全一样。
 *
 * 只取三条：再多就和「项目」页重复了，侧栏也会重新变成一堵字墙。
 */
const recentProjects = computed(() => sortByRecent(projects.value ?? []).slice(0, 3))

// 高亮的依据是 meta.nav，不是路径前缀。
// 用前缀判断会出错：/projects 是 /projects/new 的前缀，两项会同时亮。
const activeNav = computed(() => route.meta.nav ?? route.name ?? '')
const currentProjectId = computed(() => route.params.id)
</script>

<template>
  <div class="shell">
    <!-- 键盘用户的第一站：不按这个的话，要按十几次 Tab 才能穿过侧栏到正文。
         平时看不见，一按 Tab 就出现 -->
    <a class="skip-link" href="#main">跳到主要内容</a>

    <!-- 打印时侧栏不进纸：证书页要能直接 Ctrl+P（styles/base.css 的 @media print） -->
    <aside class="sidebar" data-print="hide">
      <RouterLink to="/" class="brand">
        <span class="brand-tile"><BrandMark :size="17" /></span>
        <span class="brand-text">
          <span class="brand-name">ChainProof</span>
          <span class="brand-tag">团队贡献存证</span>
        </span>
      </RouterLink>

      <nav class="nav" aria-label="主导航">
        <RouterLink
          v-for="item in items"
          :key="item.key"
          :to="item.to"
          class="nav-item"
          :class="{ 'is-active': activeNav === item.key }"
          :aria-current="activeNav === item.key ? 'page' : undefined"
        >
          <svg
            class="ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <template v-if="item.icon === 'grid'">
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
              <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
            </template>
            <template v-else-if="item.icon === 'layers'">
              <path d="M12 3.2 21 8l-9 4.8L3 8Z" />
              <path d="M3 13.2 12 18l9-4.8" />
            </template>
            <template v-else-if="item.icon === 'check'">
              <circle cx="12" cy="12" r="8.6" />
              <path d="m8.4 12.2 2.6 2.6 4.6-5.2" />
            </template>
            <template v-else>
              <path d="M3.6 7.6 12 3.4l8.4 4.2v8.8L12 20.6l-8.4-4.2Z" />
              <path d="M3.6 7.6 12 11.8l8.4-4.2M12 11.8v8.8" />
            </template>
          </svg>

          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.count !== undefined" class="count t-nums">{{ item.count }}</span>
        </RouterLink>
      </nav>

      <!-- 最近项目。窄屏时侧栏是一条横向的窄条，塞不下，整块隐藏 -->
      <div v-if="recentProjects.length" class="recent">
        <p class="t-label recent-head">最近项目</p>
        <RouterLink
          v-for="p in recentProjects"
          :key="p.projectId"
          :to="`/projects/${p.projectId}`"
          class="recent-item"
          :class="{ 'is-active': currentProjectId === p.projectId }"
        >
          <!-- 存证色的小方块。它标的是「一条链上的记录」，不是可点的控件，
               所以用存证色而不是主色（spec/01 §2.1） -->
          <span class="dot" aria-hidden="true" />
          <span class="recent-name">{{ p.name }}</span>
        </RouterLink>
      </div>

      <span class="spacer" />

      <!-- 底部：主题 + 身份。这两样都是「关于怎么看」而不是「看什么」，
           和导航之间画一条线分开，压在最底下不抢注意力。

           原先这里是「用户名 + 主题图标 + 齿轮」挤在一行，
           两个图标按钮同尺寸同样式还同轮廓（太阳与齿轮都是圆加放射线），
           根本分不清。现在拆成两行：一行是形状明确的三格开关，
           一行是带头像和名字的身份胶囊，形状与内容都不会再撞。 -->
      <div class="foot">
        <IdentityMenu class="foot-identity" />
        <ThemeToggle />
      </div>
    </aside>

    <main id="main" ref="main" tabindex="-1" class="content">
      <!-- key 绑当前身份：换人时整棵页面重新挂载，onMounted 重新跑，数据重新取。
           不这么做的话，切到 bob 之后页面上还留着 alice 那一份数据——
           连他没参与的项目都还在列表里。
           副作用是切身份会清空填了一半的表单，这是对的：
           以 alice 的身份填到一半、以 bob 的身份提交，本来就不该发生。 -->
      <RouterView :key="session.currentMemberId" />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

/* 网格子项的 min-width 默认是 auto，意思是「不许压到比自己的 min-content 还窄」。
   于是窄屏下顶栏里那条横向导航（167px 的 min-content）会把 1fr 轨道顶开，
   整个 shell 被撑到 385px，375px 的屏幕上出现横向滚动——
   这是 CSS Grid 的经典塌陷（blowout），布局本身没写错，是这条默认值在作怪。
   显式写 0 才解得开；写在子项上，不是写在里面那层 flex 上。
   这一处是 check:responsive 抓出来的，而它抓到的正是我们自己刚加的东西。 */
.shell > * { min-width: 0; }

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-3);
  border-right: 1px solid var(--c-border-subtle);
  background: var(--c-surface);
  /* 侧栏跟着页面滚动会让长页面上的导航消失，钉在顶部 */
  position: sticky;
  top: 0;
  height: 100vh;
}

.spacer { flex: 1; }

/* —— 品牌 ——
   标记装进一枚实心色块。原先它只是一个和导航图标同粗同色的线框，
   在一列同样的线框图标里毫无分量，页面左上角等于没有落点。 */
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-1) var(--sp-2) var(--sp-4);
  color: var(--c-text);
  text-decoration: none;
}
.brand:hover { text-decoration: none; }

.brand-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--r-xs);
  background: var(--c-primary);
  color: var(--c-on-primary);
  box-shadow: var(--shadow-sm);
}

.brand-text { display: grid; min-width: 0; }
.brand-name { font-size: var(--fs-body); font-weight: 640; letter-spacing: -0.015em; }
.brand-tag { font-size: 11px; color: var(--c-text-soft); letter-spacing: 0.02em; }

/* —— 导航 —— */
.nav { display: flex; flex-direction: column; gap: 2px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  height: 34px;
  padding: 0 var(--sp-2);
  border-radius: var(--r-sm);
  color: var(--c-text-soft);
  text-decoration: none;
  transition: background var(--ease), color var(--ease);
}
.nav-item:hover { background: var(--c-sunken); color: var(--c-text); text-decoration: none; }

/* 选中态不用实心主色块：侧栏里一整块蓝色太重，
   而且主色该留给「当前页面唯一的主操作」。这里只换文字与图标的颜色，配一层极淡的底，
   再在左缘加一条主色竖条——纯换颜色在暗色下不够明显 */
.nav-item.is-active {
  position: relative;
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-weight: 600;
}
.nav-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  border-radius: 0 3px 3px 0;
  background: var(--c-primary);
}

.ico { width: 17px; height: 17px; flex-shrink: 0; }
/* 14px 不在六档里，也没登记过（spec/01 §2.3）。改成 --fs-small，
   与下面「最近项目」那一列同档 */
.nav-label { flex: 1; font-size: var(--fs-small); }

.count {
  font-size: var(--fs-label);
  font-weight: 600;
  color: var(--c-text-soft);
}
.nav-item.is-active .count { color: var(--c-primary-text); }

/* —— 最近项目 —— */
.recent { display: flex; flex-direction: column; gap: 1px; padding-top: var(--sp-4); }
.recent-head { padding: 0 var(--sp-2) var(--sp-2); }

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  min-height: 28px;
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-xs);
  color: var(--c-text-soft);
  font-size: var(--fs-small);
  text-decoration: none;
  transition: background var(--ease), color var(--ease);
}
.recent-item:hover { background: var(--c-sunken); color: var(--c-text); text-decoration: none; }
.recent-item.is-active { color: var(--c-text); font-weight: 600; }

.dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 2px;
  background: var(--c-chain);
}

.recent-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* —— 底部 ——
   身份胶囊占满剩下的宽度，主题按钮贴右。两者一个是带头像和名字的胶囊、
   一个是 32px 的图标方块，形状差得够远，排一行不会再出现
   「两个一模一样的图标按钮」那种分不清的情况（那正是上一版把它们
   拆成两行的原因，而那个原因随着齿轮被换掉已经不存在了）。 */
.foot {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border-subtle);
}
.foot-identity { flex: 1; min-width: 0; }

.content {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--sp-7) var(--sp-6) var(--sp-8);
}

/* < 900px：侧栏收成顶部横向条。品牌在左、导航居中、身份在右，
   与桌面上的纵向顺序一致 */
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }

  .sidebar {
    z-index: 10;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    border-right: none;
    border-bottom: 1px solid var(--c-border-subtle);
  }

  .brand { padding: 0; }
  .brand-text { display: none; }

  /* min-width: 0 是必须的。flex 子项的 min-width 默认是 auto，也就是
     「不许压到比内容还窄」，于是三个导航项的宽度会顶着整条顶栏往外撑，
     顶栏再把整个 shell 撑到 385px，375px 的屏幕上就出现横向滚动。
     写了 overflow-x: auto 也不够——真正解开这条约束的是 min-width: 0。
     这一处是 check:responsive 抓出来的 */
  .nav { flex: 1; min-width: 0; flex-direction: row; gap: var(--sp-1); overflow-x: auto; }
  .nav-item { height: 32px; white-space: nowrap; }
  .nav-item.is-active::before { display: none; }
  /* 横排放不下四个标签，只留图标；当前页那一项保留文字，好知道自己在哪 */
  .nav-label { display: none; }
  .nav-item.is-active .nav-label { display: inline; }

  /* 最近项目在横条上没有位置，整块收起——它是版面填充加快捷方式，
     不是唯一入口，收掉不丢功能 */
  .recent, .spacer { display: none; }

  .foot {
    padding-top: 0;
    border-top: none;
  }
  .foot-identity { flex: 0 0 auto; }

  .content { padding: var(--sp-5) var(--sp-4) var(--sp-7); }
}
</style>
