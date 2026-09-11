<script setup>
/**
 * 卡片：细边框 + 极淡阴影。spec/01 §2.4 规定边框与阴影不叠加使用，
 * 这里把「常态卡片长什么样」固定成一处，页面不再各写各的。
 *
 * padding 给两档：默认 --sp-5，紧凑场景（表格行、小统计块）用 tight。
 * 不开放任意 padding，否则档位规则马上就被绕过去了。
 */
defineProps({
  as: { type: String, default: 'section' },
  padding: {
    type: String,
    default: 'normal',
    validator: (v) => ['normal', 'tight', 'none'].includes(v)
  },
  // 真正浮在页面上的东西（弹层）才用大阴影且不要边框
  floating: { type: Boolean, default: false }
})
</script>

<template>
  <component :is="as" class="card" :class="[`pad--${padding}`, { 'is-floating': floating }]">
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
.pad--tight { padding: var(--sp-4); }
.pad--none { padding: 0; }

.is-floating {
  border-color: transparent;
  box-shadow: var(--shadow-lg);
}

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
