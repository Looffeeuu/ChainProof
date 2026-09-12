<script setup>
/**
 * 页面头部：眉标 + 主标题 + 一句导语 + 一行元信息 + 右侧操作区。
 * 九个页面都有这一块，抄九遍就会出现九种上下间距，所以抽成组件。
 * 它不认识任何业务字段，数据全部由 props 进、插槽出，因此归 components/base/。
 *
 * description 走 `.t-lead`（17px）而不是 `.t-small`（13px）。
 * 原先标题 40px、说明 13px，中间隔着三档，页面从一个巨大的标题
 * 直接掉进最小号的灰字里——读者的视线没有落脚点。导语这一档就是为了接住它
 * （spec/01 §2.3 新增的 lead 级）。
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
      <!-- 面包屑之类的东西从这里进来，压在眉标的位置上 -->
      <slot name="breadcrumb">
        <p v-if="eyebrow" class="t-label">{{ eyebrow }}</p>
      </slot>

      <h1>{{ title }}</h1>

      <p v-if="description" class="t-lead desc">{{ description }}</p>

      <!-- 状态徽章、创建时间、负责人这类东西。和导语分行，
           一行是「这是什么」，一行是「它现在怎么样」 -->
      <div v-if="$slots.meta" class="meta"><slot name="meta" /></div>
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
  gap: var(--sp-5);
  margin-bottom: var(--sp-6);
}

.text { display: grid; gap: var(--sp-2); min-width: 0; }
.desc { max-width: 62ch; }

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-1);
  font-size: var(--fs-small);
  color: var(--c-text-soft);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-shrink: 0;
  /* 主操作和 h1 的基线对齐。标题有 clamp，按钮固定 36px，
     不给一点上边距的话按钮会贴着眉标 */
  padding-top: var(--sp-2);
}

@media (max-width: 900px) {
  .page-header { flex-direction: column; gap: var(--sp-4); }
  .actions { padding-top: 0; }
}
</style>
