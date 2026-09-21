<script setup>
/**
 * 空状态。规格取自 Polaris（spec/01 §1、§2.6）：
 * 一个图形 + 一句「这里将会出现什么」+ 一个明确的行动。
 *
 * 注意 description 写的是「将会出现什么」，不是「现在没有东西」。
 * 「暂无数据」这类文案对用户没有任何用处——他看得见没有数据，
 * 他不知道的是这里本该出现什么、以及怎么让它出现。
 *
 * **图形从「一个 32px 的灰色 ◇ 字符」换成了装在色块里的线描图标。**
 * 空状态是用户第一次打开这个应用时看到的东西，一个孤零零的几何字符
 * 传达的是「这里没写完」；而且 ◇ 在不同系统上字形差别很大，
 * 和界面里其余全部用 SVG 画的图标不是一套东西（spec/01 §2.3 登记的
 * 那条 32px 字号例外，也就随之取消了）。
 */
defineProps({
  /** 画哪个图形。都是这个产品里真实存在的东西，不是通用装饰 */
  icon: {
    type: String,
    default: 'box',
    validator: (v) => ['box', 'chain', 'certificate', 'search'].includes(v)
  },
  title: { type: String, required: true },
  description: { type: String, default: '' }
})
</script>

<template>
  <div class="empty">
    <span class="tile" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <!-- 空盒子：还没有任何东西被放进来 -->
        <template v-if="icon === 'box'">
          <path d="M3.6 7.6 12 3.4l8.4 4.2v8.8L12 20.6l-8.4-4.2Z" />
          <path d="M3.6 7.6 12 11.8l8.4-4.2M12 11.8v8.8" />
        </template>
        <!-- 断开的链环：还没有存证记录 -->
        <template v-else-if="icon === 'chain'">
          <path d="M10 13.8a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10.2a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1-1" />
        </template>
        <!-- 一张带印章的纸：还没有签发证书 -->
        <template v-else-if="icon === 'certificate'">
          <path d="M6 3.5h9l3.5 3.5v8.5" />
          <path d="M6 3.5v17h6" />
          <circle cx="17" cy="18" r="3" />
          <path d="M9.5 8.5h4M9.5 12h6" />
        </template>
        <!-- 放大镜：查了但没查到 -->
        <template v-else>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </template>
      </svg>
    </span>

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

.tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: var(--sp-2);
  border-radius: var(--r-sm);
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
  color: var(--c-text-soft);
}
.tile svg { width: 21px; height: 21px; }

.empty-title { font-weight: 600; }
.desc { max-width: 44ch; }
.action { margin-top: var(--sp-3); }
</style>
