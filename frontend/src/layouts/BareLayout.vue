<script setup>
import { useMainFocus } from '../composables/useMainFocus.js'

/**
 * 无侧栏的外壳，给公开验证页用（路由 meta.layout = 'bare'）。
 *
 * 为什么验证页要脱掉侧栏：这一页的读者是**项目外的人**——招生老师、面试官、
 * 拿到证书想核一下真假的人。他们没有账号，也不该看到「概览」「项目」
 * 这些进去只会碰壁的入口，更不该看到那个演示身份切换器。
 *
 * 但还是要有一点身份标识，否则一个只有输入框的白页面看起来不像个正经地方，
 * 所以留一条最简单的顶栏。
 */
const main = useMainFocus()
</script>

<template>
  <div class="bare">
    <a class="skip-link" href="#main">跳到主要内容</a>

    <header class="topbar" data-print="hide">
      <!-- 品牌链接必须指向应用首页，不能指向 /verify。
           指向自己的话这一页就成了死胡同：从证书页点「去验证这份证书」进来的人，
           点哪儿都回不去，只能按浏览器后退。 -->
      <RouterLink to="/" class="brand">
        <span class="brand-mark" aria-hidden="true">◇</span>
        <span class="brand-name">ChainProof</span>
      </RouterLink>
      <span class="t-small t-soft tagline">贡献存证的公开验证</span>
      <RouterLink to="/" class="t-small back">返回 ChainProof</RouterLink>
    </header>

    <main id="main" ref="main" tabindex="-1" class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.bare { min-height: 100vh; display: flex; flex-direction: column; }

.topbar {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  border-bottom: 1px solid var(--c-border-subtle);
  background: var(--c-surface);
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

.tagline { flex: 1; }
.back { flex-shrink: 0; }

@media (max-width: 560px) {
  /* 窄屏上三样挤不下。标语是装饰，出口不是——先舍标语 */
  .tagline { display: none; }
}

.content {
  flex: 1;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--sp-7) var(--sp-5) var(--sp-8);
}

@media (max-width: 900px) {
  .content { padding: var(--sp-5) var(--sp-4) var(--sp-7); }
}
</style>
