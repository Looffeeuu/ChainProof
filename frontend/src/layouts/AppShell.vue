<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { session } from '../stores/session.js'
import { useAsync } from '../composables/useAsync.js'
import { useMainFocus } from '../composables/useMainFocus.js'
import { listProjects } from '../api/projects.js'
import { isDev } from '../stores/settings.js'
import SettingsMenu from '../components/base/SettingsMenu.vue'

const route = useRoute()

// 切页后把焦点移到主内容区，否则键盘用户每次换页都要重新 Tab 穿过整条侧栏
const main = useMainFocus()

/**
 * 侧栏分三组，与 界面预览.html 的样张一致。
 * 详情页（项目详情、里程碑确认、证书）都要先有一个 id 才有意义，进不了侧栏——
 * 它们靠路由的 meta.nav 归到某一组底下，打开时那一项照样高亮。
 */
const { data: counts, run: loadCounts } = useAsync(async () => {
  const projects = await listProjects()
  return { projects: projects.length }
})
onMounted(loadCounts)

// 侧栏在 RouterView 外面，换身份时不会跟着重新挂载，得自己重取一次。
// 否则项目数还停在上一个人看到的那个数字
watch(() => session.currentMemberId, loadCounts)

const groups = computed(() => [
  {
    label: '工作区',
    items: [
      { key: 'dashboard', to: '/', label: '概览' },
      { key: 'projects', to: '/projects', label: '项目', count: counts.value?.projects }
    ]
  },
  {
    label: '存证',
    // 侧栏不放证书入口：证书是「某个人在某个项目里的」，不是一个全局列表，
    // 从概览页那张列表或项目详情页进去更顺。
    // 之前这里写死过一个 CERT-P001-ALICE，接真接口就会 404。
    items: [{ key: 'verify', to: '/verify', label: '公开验证' }]
  },
  // 组件预览是开发页，用户视角下不该出现在导航里。
  // 用 filter 而不是 v-if：空的分组连标题一起消失，不会留一个空的「开发」眉标
  ...(isDev()
    ? [{ label: '开发', items: [{ key: 'dev-components', to: '/dev/components', label: '组件预览' }] }]
    : [])
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
      <div class="head">
        <RouterLink to="/" class="brand">
          <span class="brand-mark" aria-hidden="true">◇</span>
          <span class="brand-name">ChainProof</span>
        </RouterLink>
        <SettingsMenu />
      </div>

      <nav class="nav" aria-label="主导航">
        <div v-for="group in groups" :key="group.label" class="group">
          <p class="t-label group-label">{{ group.label }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.key"
            :to="item.to"
            class="nav-item"
            :class="{ 'is-active': activeNav === item.key }"
            :aria-current="activeNav === item.key ? 'page' : undefined"
          >
            <span>{{ item.label }}</span>
            <span v-if="item.count !== undefined" class="count t-nums t-small">{{ item.count }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- 身份切换器搬进了齿轮。它原先常驻在这里，加上一段解释文字，
           占掉侧栏底部一大块，而它是个偶尔才用一次的开关 -->
      <p class="t-small t-soft who">当前身份 <strong>{{ session.currentMemberId }}</strong></p>
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

.sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
  padding: var(--sp-5) var(--sp-4);
  border-right: 1px solid var(--c-border-subtle);
  background: var(--c-surface);
  /* 侧栏跟着页面滚动会让长页面上的导航消失，钉在顶部 */
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  color: var(--c-text);
  text-decoration: none;
  font-weight: 600;
}
.brand:hover { text-decoration: none; }
.brand-mark { color: var(--c-primary); font-size: 20px; }
.brand-name { letter-spacing: -0.01em; }

.nav { flex: 1; display: flex; flex-direction: column; gap: var(--sp-4); }
.group { display: flex; flex-direction: column; gap: var(--sp-1); }
.group-label { margin-bottom: var(--sp-1); }

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--r-sm);
  color: var(--c-text);
  text-decoration: none;
  transition: background var(--ease);
}
.nav-item:hover { background: var(--c-bg); text-decoration: none; }
.nav-item.is-active { background: var(--c-primary-weak); color: var(--c-primary); font-weight: 600; }

.count { color: var(--c-text-soft); }
.nav-item.is-active .count { color: var(--c-primary); }

.head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }

.who strong { color: var(--c-text); font-weight: 600; }

.content {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--sp-7) var(--sp-5) var(--sp-8);
}

/* < 900px：侧栏收成顶部横向导航（spec/01 §2.7）。
   横向排列时分组标题与说明文字会挤爆一行，一并隐藏。 */
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }

  .sidebar {
    position: static;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border-right: none;
    border-bottom: 1px solid var(--c-border-subtle);
    overflow-x: auto;
  }

  .nav { flex-direction: row; gap: var(--sp-2); }
  .group { flex-direction: row; gap: var(--sp-1); }
  .group-label { display: none; }
  .nav-item { padding: var(--sp-2); white-space: nowrap; }
  .head { gap: var(--sp-3); }
  .who { white-space: nowrap; }

  .content { padding: var(--sp-5) var(--sp-4) var(--sp-7); }
}
</style>
