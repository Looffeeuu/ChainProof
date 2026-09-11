<script setup>
/**
 * 页面头部：眉标 + 主标题 + 一句说明 + 右侧操作区。
 * 九个页面都有这一块，抄九遍就会出现九种上下间距，所以抽成组件。
 * 它不认识任何业务字段，数据全部由 props 进、插槽出，因此归 components/base/。
 */
defineProps({
  eyebrow: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>

<template>
  <header class="page-header">
    <div class="text">
      <p v-if="eyebrow" class="t-label">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="t-soft desc">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-6);
}

.text { display: grid; gap: var(--sp-2); }
.desc { max-width: 68ch; }

.actions {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .page-header { flex-direction: column; }
}
</style>
