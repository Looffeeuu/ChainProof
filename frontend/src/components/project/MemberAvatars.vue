<script setup>
import { computed } from 'vue'
import { memberTone } from '../../utils/member-tone.js'

/**
 * 成员头像组。没有真实头像，用成员 ID 的首字母加一个稳定的底色。
 *
 * 底色由 ID 算出来（同一个人在任何页面都是同一个颜色），而不是按下标取——
 * 按下标的话，同一个人在不同列表里会变色，反而制造「这是两个人」的错觉。
 * 折算规则抽到了 utils/member-tone.js，贡献比例条用的是同一个函数，
 * 否则同一个人在头像里是紫的、在比例条里是青的。
 *
 * 归 components/project/ 而不是 base/：它认识「成员」这个概念，
 * 判据见 spec/02 的 Q&A。
 */
const props = defineProps({
  members: { type: Array, default: () => [] },
  max: { type: Number, default: 4 },
  size: { type: Number, default: 24 }
})

const shown = computed(() => props.members.slice(0, props.max))
const overflow = computed(() => Math.max(0, props.members.length - props.max))

const initialOf = (id) => String(id).slice(0, 1).toUpperCase()
</script>

<template>
  <span class="avatars" :title="members.join('、')">
    <span
      v-for="m in shown"
      :key="m"
      class="avatar"
      :class="`tone--${memberTone(m)}`"
      :style="{ width: `${size}px`, height: `${size}px` }"
      aria-hidden="true"
    >{{ initialOf(m) }}</span>
    <span v-if="overflow" class="avatar tone--rest" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
      +{{ overflow }}
    </span>
    <span class="sr-only">成员：{{ members.join('、') || '暂无' }}</span>
  </span>
</template>

<style scoped>
.avatars { display: inline-flex; align-items: center; }

.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid var(--c-surface);
  font-size: var(--fs-label);
  font-weight: 640;
  /* 头像互相叠压一点，一组人读起来像一个整体而不是几个独立的圆 */
  margin-right: calc(var(--sp-1) * -1);
}
.avatar:last-of-type { margin-right: 0; }

.tone--1 { background: var(--c-member-1-weak); color: var(--c-member-1); }
.tone--2 { background: var(--c-member-2-weak); color: var(--c-member-2); }
.tone--3 { background: var(--c-member-3-weak); color: var(--c-member-3); }
.tone--4 { background: var(--c-member-4-weak); color: var(--c-member-4); }
/* var(--fs-label) = 12px 是排版档位里的最小一档（spec/01 §2.3）。
   这里原来写的是 11px，属于没有理由的失误——11px 的中文在投影仪上读不出来 */
.tone--rest { background: var(--c-sunken); color: var(--c-text-soft); font-size: var(--fs-label); }
</style>
