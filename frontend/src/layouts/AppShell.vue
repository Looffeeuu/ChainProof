<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { session } from '../stores/session.js'
import { isDev } from '../stores/settings.js'
import { useAsync } from '../composables/useAsync.js'
import { useMainFocus } from '../composables/useMainFocus.js'
import { listProjects } from '../api/projects.js'
import BrandMark from '../components/base/BrandMark.vue'
import ThemeToggle from '../components/base/ThemeToggle.vue'
import SettingsMenu from '../components/base/SettingsMenu.vue'

const route = useRoute()

// 切页后把焦点移到主内容区，否则键盘用户每次换页都要重新 Tab 穿过整条侧栏
const main = useMainFocus()

const { data: counts, run: loadCounts } = useAsync(async () => {
  const projects = await listProjects()
  return { projects: projects.length }
})
onMounted(loadCounts)

// 侧栏在 RouterView 外面，换身份时不会跟着重新挂载，得自己重取一次。
// 否则项目数还停在上一个人看到的那个数字
watch(() => session.currentMemberId, loadCounts)

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
  { key: 'projects', to: '/projects', label: '项目', icon: 'layers', count: counts.value?.projects },
  { key: 'verify', to: '/verify', label: '公开验证', icon: 'check' },
  // 组件预览是开发页，用户视角下不出现在导航里
  ...(isDev() ? [{ key: 'dev-components', to: '/dev/components', label: '组件预览', icon: 'box' }] : [])
])

// 高亮的依据是 meta.nav，不是路径前缀。
// 用前缀判断会出错：/projects 是 /projects/new 的前缀，两项会同时亮。
const activeNav = computed(() => route.meta.nav ?? route.name ?? '')
</script>

<template>
  <div class="shell">
    <!-- 键盘用户的第一站：不按这个的话，要按十几次 Tab 才能穿过侧栏到正文。
         平时看不见，一按 Tab 就出现 -->
    <a class="skip-link" href="#main">跳到主要内容</a>

    <!-- 打印时侧栏不进纸：证书页要能直接 Ctrl+P（styles/base.css 的 @media print） -->
    <aside class="sidebar" data-print="hide">
      <RouterLink to="/" class="brand">
        <BrandMark :size="18" class="brand-mark" />
        <span class="brand-name">ChainProof</span>
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
          <span v-if="item.count !== undefined" class="count">{{ item.count }}</span>
        </RouterLink>
      </nav>

      <!-- 底部工具条：身份 + 主题 + 设置。
           这三样都是「关于怎么看」而不是「看什么」，和导航分开，压在最底下不抢注意力。 -->
      <div class="foot">
        <span class="who t-small" :title="`当前身份 ${session.currentMemberId}`">
          {{ session.currentMemberId }}
        </span>
        <ThemeToggle />
        <SettingsMenu />
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
  grid-template-columns: 232px 1fr;
  min-height: 100vh;
}

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

/* —— 品牌 —— */
.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-2) var(--sp-4);
  color: var(--c-text);
  text-decoration: none;
}
.brand:hover { text-decoration: none; }
.brand:hover .brand-mark { color: var(--c-primary-text); }

.brand-mark { color: var(--c-text); transition: color var(--ease); }

.brand-name { font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }

/* —— 导航 —— */
.nav { flex: 1; display: flex; flex-direction: column; gap: 2px; }

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
.nav-item:hover { background: var(--c-bg); color: var(--c-text); text-decoration: none; }

/* 选中态不用实心主色块：侧栏里一整块蓝色太重，
   而且主色该留给「当前页面唯一的主操作」。这里只换文字与图标的颜色，配一层极淡的底 */
.nav-item.is-active {
  background: var(--c-primary-weak);
  color: var(--c-primary-text);
  font-weight: 600;
}

.ico { width: 17px; height: 17px; flex-shrink: 0; }
.nav-label { flex: 1; font-size: 14px; }

.count {
  font-size: 12px;
  color: var(--c-text-soft);
  font-variant-numeric: tabular-nums;
}
.nav-item.is-active .count { color: var(--c-primary-text); }

/* —— 底部工具条 —— */
.foot {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border-subtle);
}

.who {
  flex: 1;
  min-width: 0;
  padding-left: var(--sp-2);
  color: var(--c-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--sp-7) var(--sp-5) var(--sp-8);
}

/* < 900px：侧栏收成顶部横向条。品牌在左、导航居中、工具条在右，
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
  .brand-name { display: none; }

  .nav { flex-direction: row; gap: var(--sp-1); overflow-x: auto; }
  .nav-item { height: 32px; white-space: nowrap; }
  /* 横排放不下四个标签，只留图标；当前页那一项保留文字，好知道自己在哪 */
  .nav-label { display: none; }
  .nav-item.is-active .nav-label { display: inline; }

  .foot { padding-top: 0; border-top: none; }
  .who { display: none; }

  .content { padding: var(--sp-5) var(--sp-4) var(--sp-7); }
}
</style>
