<script setup>
import { computed } from 'vue'
import MemberAvatars from './MemberAvatars.vue'
import { formatDate } from '../../utils/format-time.js'

/**
 * 项目列表里的一张卡片：标题 + 一句进度摘要 + 描述 + 进度条 + 成员 + 时间。
 *
 * milestones 由列表页取好后传进来，卡片自己不发请求——
 * 组件一旦自己取数，列表页就没法把 N 张卡片的请求合并成一次。
 *
 * **进度条是这次加的。** 原先卡片底部写的是「4 个里程碑 · 2 个已验证」，
 * 一行灰字；同一屏三张卡片就是三行长得一样的灰字，扫一眼分不出哪个项目走得快。
 * 同样两个数字画成一条分段的条，三张卡片并排时进度差别一眼可见——
 * 而且这是整个列表页唯一携带颜色的元素，页面不再只有灰字白框。
 */
const props = defineProps({
  project: { type: Object, required: true },
  milestones: { type: Array, default: () => [] }
})

const verified = computed(() => props.milestones.filter((m) => m.status === 'VERIFIED').length)
const pending = computed(
  () => props.milestones.filter((m) => m.status === 'PENDING_CONFIRMATION').length
)
const rejected = computed(() => props.milestones.filter((m) => m.status === 'REJECTED').length)

/**
 * 一句话的进度摘要。三种情况各有各的说法，
 * 都比「3 个里程碑」这种纯计数更能说明这个项目现在处于什么阶段。
 */
const summary = computed(() => {
  if (props.milestones.length === 0) return { text: '尚无里程碑', tone: 'rest' }
  if (pending.value > 0) return { text: `${pending.value} 条待确认`, tone: 'pending' }
  if (verified.value === props.milestones.length) return { text: '全部已验证', tone: 'verified' }
  return { text: '有被拒绝的里程碑', tone: 'rejected' }
})

/** 进度条的三段。零长度的段不渲染，否则会留下几个 1px 的色点 */
const segments = computed(() =>
  [
    { key: 'verified', count: verified.value },
    { key: 'pending', count: pending.value },
    { key: 'rejected', count: rejected.value }
  ].filter((s) => s.count > 0)
)
</script>

<template>
  <RouterLink :to="`/projects/${project.projectId}`" class="card">
    <div class="head">
      <h3 class="name">{{ project.name }}</h3>
      <span class="summary" :class="`tone--${summary.tone}`">
        <span class="dot" aria-hidden="true" />{{ summary.text }}
      </span>
    </div>

    <p class="t-small desc" :class="{ 'is-placeholder': !project.description }">
      {{ project.description || '这个项目还没有填写描述。' }}
    </p>

    <div class="progress">
      <div
        class="bar"
        role="img"
        :aria-label="`共 ${milestones.length} 条里程碑，已验证 ${verified} 条`"
      >
        <!-- 一条都没有时画一条空槽，而不是什么都不画：
             空槽说明「这里本来会有进度」，什么都没有只会像是漏渲染了 -->
        <span
          v-for="s in segments"
          :key="s.key"
          class="seg"
          :class="`seg--${s.key}`"
          :style="{ flexGrow: s.count }"
        />
      </div>
      <p class="t-small t-soft t-nums count">
        {{ verified }} / {{ milestones.length }} 条已验证
      </p>
    </div>

    <div class="foot">
      <MemberAvatars :members="project.members" />
      <span class="t-small t-soft t-nums">
        {{ project.ownerId }} · {{ formatDate(project.createdAt) }}
      </span>
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-5);
  background: var(--c-surface);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  color: var(--c-text);
  text-decoration: none;
  transition: border-color var(--ease), box-shadow var(--ease), transform var(--ease);
}
.card:hover {
  border-color: var(--c-border-strong);
  box-shadow: var(--shadow-md);
  /* 抬起 1px。整数位移不会有半像素模糊，也不会把下面的卡片挤动 */
  transform: translateY(-1px);
  text-decoration: none;
}
.card:hover .name { color: var(--c-primary-text); }

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}

.name { font-size: var(--fs-heading); transition: color var(--ease); }

.summary {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  flex-shrink: 0;
  padding-top: 3px;
  font-size: var(--fs-label);
  font-weight: 600;
  white-space: nowrap;
}
.dot { width: 7px; height: 7px; border-radius: 999px; background: currentColor; }
.tone--verified { color: var(--c-verified); }
.tone--pending { color: var(--c-pending); }
.tone--rejected { color: var(--c-rejected); }
.tone--rest { color: var(--c-text-soft); }

.desc {
  color: var(--c-text-soft);
  /* 两行封顶。描述长短不一时，卡片高度会跟着长短乱跳，一排卡片的底边就参差不齐 */
  min-height: 2.9em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.is-placeholder { font-style: italic; }

/* —— 进度条 —— */
.progress { display: grid; gap: var(--sp-2); }

.bar {
  display: flex;
  gap: 2px;
  height: 6px;
  border-radius: 999px;
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
  overflow: hidden;
}
.seg { display: block; min-width: 4px; }
.seg--verified { background: var(--c-verified); }
.seg--pending { background: var(--c-pending); }
.seg--rejected { background: var(--c-rejected); }

.count { line-height: 1; }

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border-subtle);
}
</style>
