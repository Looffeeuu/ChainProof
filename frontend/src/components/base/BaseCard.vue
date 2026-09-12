<script setup>
/**
 * 卡片：细边框 + 极淡阴影。spec/01 §2.4 规定边框与阴影不叠加使用，
 * 这里把「常态卡片长什么样」固定成一处，页面不再各写各的。
 *
 * padding 只有两档：默认 --sp-5，以及 none（表格、时间线这种自己控制内边距的）。
 * 曾经还有一档 tight（--sp-4），但除了组件预览页没有任何地方在用——
 * 16 和 24 的差别小到没人会为它专门选一次，留着只是多一个要解释的选项。
 */
defineProps({
  as: { type: String, default: 'section' },
  padding: {
    type: String,
    default: 'normal',
    validator: (v) => ['normal', 'none'].includes(v)
  },
  // 真正浮在页面上的东西（弹层）才用大阴影且不要边框
  floating: { type: Boolean, default: false },

  /**
   * 顶部强调边。给「这张卡片的结论是什么」一个远距离可辨的信号，
   * 目前只有公开验证页的结论卡在用。
   *
   * **为什么做成 BaseCard 的属性，而不是让调用方自己画一条。**
   * 调用方能想到的画法有两种，都有坑：
   *   - 绝对定位的 ::before + 容器 overflow: hidden ——
   *     裁掉的不只是那条色带，还有卡片里所有可聚焦元素的焦点框；
   *   - 在自己的 scoped 样式里覆盖 border-top ——
   *     和 BaseCard 自己的 border 简写抢层叠，谁赢取决于样式注入顺序。
   * 放在这里就都不存在：border-top 跟着 border-radius 走，不需要裁剪，
   * 也不跨组件抢层叠。
   */
  accent: {
    type: String,
    default: '',
    validator: (v) => ['', 'verified', 'pending', 'rejected', 'chain', 'rest'].includes(v)
  }
})
</script>

<template>
  <component
    :is="as"
    class="card"
    :class="[`pad--${padding}`, { 'is-floating': floating }, accent && `accent--${accent}`]"
  >
    <header v-if="$slots.title || $slots.actions" class="card-head">
      <div class="card-title"><slot name="title" /></div>
      <div v-if="$slots.actions" class="card-actions"><slot name="actions" /></div>
    </header>
    <slot />
  </component>
</template>

<style scoped>
.card {
  background: var(--c-surface);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}

.pad--normal { padding: var(--sp-5); }
.pad--none { padding: 0; }

.is-floating {
  border-color: transparent;
  box-shadow: var(--shadow-lg);
}

/* 顶部强调边。用 border-top 而不是伪元素：边框天然跟着圆角走，
   不需要 overflow: hidden，也就不会连带裁掉里面元素的焦点框 */
.card[class*='accent--'] { border-top-width: 4px; }
.accent--verified { border-top-color: var(--c-verified); }
.accent--pending { border-top-color: var(--c-pending); }
.accent--rejected { border-top-color: var(--c-rejected); }
.accent--chain { border-top-color: var(--c-chain); }
.accent--rest { border-top-color: var(--c-border-strong); }

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-4);
}

.pad--none .card-head { padding: var(--sp-4) var(--sp-4) 0; margin-bottom: var(--sp-3); }
.card-actions { display: flex; align-items: center; gap: var(--sp-2); flex-shrink: 0; }
</style>
