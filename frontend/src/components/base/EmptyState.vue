<script setup>
/**
 * 空状态。规格取自 Polaris（spec/01 §1、§2.6）：
 * 一个图标 + 一句「这里将会出现什么」+ 一个明确的行动。
 *
 * 注意 description 写的是「将会出现什么」，不是「现在没有东西」。
 * 「暂无数据」这类文案对用户没有任何用处——他看得见没有数据，
 * 他不知道的是这里本该出现什么、以及怎么让它出现。
 */
defineProps({
  icon: { type: String, default: '◇' },
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>

<template>
  <div class="empty">
    <span class="icon" aria-hidden="true">{{ icon }}</span>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="t-soft t-small desc">{{ description }}</p>
    <div v-if="$slots.action" class="action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--sp-2);
  padding: var(--sp-7) var(--sp-5);
}

.icon {
  font-size: 32px;
  line-height: 1;
  color: var(--c-text-soft);
  margin-bottom: var(--sp-1);
}

.empty-title { font-weight: 600; }
.desc { max-width: 44ch; }
.action { margin-top: var(--sp-3); }
</style>
