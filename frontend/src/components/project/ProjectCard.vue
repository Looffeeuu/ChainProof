<script setup>
import { computed } from 'vue'
import MemberAvatars from './MemberAvatars.vue'
import { formatDate } from '../../utils/format-time.js'

/**
 * 项目列表里的一张卡片。版式照 界面预览.html 的「项目」屏：
 * 标题 + 一句进度摘要 + 描述 + 成员头像 + 里程碑计数。
 *
 * milestones 由列表页取好后传进来，卡片自己不发请求——
 * 组件一旦自己取数，列表页就没法把 N 张卡片的请求合并成一次。
 */
const props = defineProps({
  project: { type: Object, required: true },
  milestones: { type: Array, default: () => [] }
})

const verified = computed(() => props.milestones.filter((m) => m.status === 'VERIFIED').length)
const pending = computed(
  () => props.milestones.filter((m) => m.status === 'PENDING_CONFIRMATION').length
)

/**
 * 一句话的进度摘要。三种情况各有各的说法，
 * 都比「3 个里程碑」这种纯计数更能说明这个项目现在处于什么阶段。
 */
const summary = computed(() => {
  if (props.milestones.length === 0) return { mark: '○', text: '尚无里程碑', tone: 'rest' }
  if (pending.value > 0) {
    return { mark: '◐', text: `${pending.value} 条待确认`, tone: 'pending' }
  }
  if (verified.value === props.milestones.length) {
    return { mark: '●', text: '全部已验证', tone: 'verified' }
  }
  return { mark: '✕', text: '有被拒绝的里程碑', tone: 'rejected' }
})
</script>

<template>
  <RouterLink :to="`/projects/${project.projectId}`" class="card">
    <div class="head">
      <h3 class="name">{{ project.name }}</h3>
      <span class="summary" :class="`tone--${summary.tone}`">
        <span aria-hidden="true">{{ summary.mark }}</span>{{ summary.text }}
      </span>
    </div>

    <p class="t-small desc" :class="{ 'is-placeholder': !project.description }">
      {{ project.description || '这个项目还没有填写描述。' }}
    </p>

    <div class="foot">
      <MemberAvatars :members="project.members" />
      <span class="t-small t-soft t-nums">
        {{ milestones.length }} 个里程碑 · {{ verified }} 个已验证
      </span>
    </div>

    <p class="t-small t-soft">负责人 {{ project.ownerId }} · 创建于 {{ formatDate(project.createdAt) }}</p>
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
  transition: border-color var(--ease);
}
.card:hover { border-color: var(--c-border-strong); text-decoration: none; }
.card:hover .name { color: var(--c-primary-text); }

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-3);
}

.name { font-size: 20px; }

.summary {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.tone--verified { color: var(--c-verified); }
.tone--pending { color: var(--c-pending); }
.tone--rejected { color: var(--c-rejected); }
.tone--rest { color: var(--c-text-soft); }

.desc { color: var(--c-text-soft); min-height: 2.6em; }
.is-placeholder { font-style: italic; }

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border-subtle);
}
</style>
