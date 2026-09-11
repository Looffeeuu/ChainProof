<script setup>
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { session } from '../stores/session.js'
import { useAsync } from '../composables/useAsync.js'
import { useMainFocus } from '../composables/useMainFocus.js'
import { listProjects } from '../api/projects.js'
import { listCertificates } from '../api/certificates.js'

const route = useRoute()

// 切页后把焦点移到主内容区，否则键盘用户每次换页都要重新 Tab 穿过整条侧栏
const main = useMainFocus()

/**
 * 侧栏分三组，与 界面预览.html 的样张一致。
 * 详情页（项目详情、里程碑确认、证书）都要先有一个 id 才有意义，进不了侧栏——
 * 它们靠路由的 meta.nav 归到某一组底下，打开时那一项照样高亮。
 */
const { data: counts, run: loadCounts } = useAsync(async () => {
  const [projects, certificates] = await Promise.all([listProjects(), listCertificates()])
  return { projects: projects.length, certificates: certificates.length }
})
onMounted(loadCounts)

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
    // 没有「证书列表」这一页（spec/03 §3.3 里那个接口还没有），
    // 所以侧栏不放证书入口——证书从概览页那张列表进去。
    // 之前这里写死过一个 CERT-P001-ALICE，接真接口就会 404。
    items: [{ key: 'verify', to: '/verify', label: '公开验证' }]
  },
  {
    label: '开发',
    items: [{ key: 'dev-components', to: '/dev/components', label: '组件预览' }]
  }
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
        <span class="brand-mark" aria-hidden="true">◇</span>
        <span class="brand-name">ChainProof</span>
      </RouterLink>

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

      <div class="session">
        <p class="t-label">演示身份</p>
        <div class="session-btns">
          <button
            v-for="m in session.members"
            :key="m"
            type="button"
            class="session-btn t-small"
            :aria-pressed="session.currentMemberId === m"
            @click="session.switchTo(m)"
          >
            {{ m }}
          </button>
        </div>
        <p class="t-small hint">
          切换身份可以看到同一条记录在不同成员眼里的样子——待确认的里程碑只对声明里的人显示确认按钮。
        </p>
      </div>
    </aside>

    <main id="main" ref="main" tabindex="-1" class="content">
      <RouterView />
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

.session { display: grid; gap: var(--sp-2); }
.session-btns { display: flex; gap: var(--sp-1); flex-wrap: wrap; }

.session-btn {
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-sm);
  background: var(--c-surface);
  color: var(--c-text-soft);
}
.session-btn[aria-pressed='true'] {
  border-color: var(--c-primary);
  background: var(--c-primary-weak);
  color: var(--c-primary);
  font-weight: 600;
}

.hint { color: var(--c-text-soft); line-height: 1.4; }

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
  .session { grid-auto-flow: column; align-items: center; gap: var(--sp-2); }
  .hint { display: none; }

  .content { padding: var(--sp-5) var(--sp-4) var(--sp-7); }
}
</style>
