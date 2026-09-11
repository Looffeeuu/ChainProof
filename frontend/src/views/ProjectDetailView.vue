<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import EmptyState from '../components/base/EmptyState.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import MemberAvatars from '../components/project/MemberAvatars.vue'
import ContributionPanel from '../components/project/ContributionPanel.vue'
import ContributionBreakdown from '../components/project/ContributionBreakdown.vue'
import MilestoneTimeline from '../components/milestone/MilestoneTimeline.vue'
import { useAsync } from '../composables/useAsync.js'
import { getProject, getContributions } from '../api/projects.js'
import { listMilestones } from '../api/milestones.js'
import { formatDate } from '../utils/format-time.js'

/**
 * 项目详情。版式照 界面预览.html 的「项目详情」屏：
 * 概览 + 累计贡献比例 + 里程碑 Timeline。
 *
 * spec/01 §2.7 原本写的是「三个 tab」。这里改成一屏纵向排列，理由见笔记 §2.1。
 */
const route = useRoute()

async function load(projectId) {
  // 三个接口互不依赖，并发发出。串行的话页面要多等两个来回
  const [project, milestones, contributions] = await Promise.all([
    getProject(projectId),
    listMilestones(projectId),
    getContributions(projectId)
  ])
  return { project, milestones, contributions }
}

const { data, loading, error, run } = useAsync(load)

// 监听路由参数而不是只在 onMounted 取一次：
// 从项目 A 的详情页直接跳到项目 B 时，组件会被复用，onMounted 不会再触发
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

const project = computed(() => data.value?.project)
const milestones = computed(() => data.value?.milestones ?? [])
const newMilestonePath = computed(() => `/projects/${route.params.id}/milestones/new`)
</script>

<template>
  <div>
    <nav class="crumbs t-small t-soft" aria-label="面包屑">
      <RouterLink to="/projects">项目</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ project?.name ?? route.params.id }}</span>
    </nav>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!data"
      loading-text="正在读取项目…"
      error-title="没能打开这个项目"
      @retry="run(route.params.id)"
    >
      <!-- data 为空且没报错，正常流程走不到；留着是为了不出现读 project.name 的白屏 -->
      <template #empty>
        <BaseCard>
          <EmptyState title="没有这个项目的数据" description="链接里的项目 ID 可能已经失效。回到项目列表看看。">
            <template #action>
              <BaseButton variant="primary" @click="$router.push('/projects')">
                回到项目列表
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>
      </template>

      <PageHeader :title="project.name">
        <template #actions>
          <!-- 没有里程碑时，下面的空状态里也有一个「提交里程碑」主按钮。
               这里降级，避免同屏两个蓝按钮（spec/01 §3.2） -->
          <BaseButton
            :variant="milestones.length === 0 ? 'secondary' : 'primary'"
            @click="$router.push(newMilestonePath)"
          >
            提交里程碑
          </BaseButton>
        </template>
      </PageHeader>

      <p class="t-small t-soft meta-line">
        创建于 {{ formatDate(project.createdAt) }} · 负责人 {{ project.ownerId }} ·
        {{ project.members.length }} 名成员
        <StatusBadge :status="project.status" class="meta-badge" />
      </p>

      <div class="columns">
        <BaseCard class="col">
          <template #title><h2>累计贡献比例</h2></template>
          <ContributionPanel
            :members="data.contributions.members"
            :based-on-milestones="data.contributions.basedOnMilestones"
          />

          <!-- <details> 是原生的折叠块：不用写任何 JavaScript，
               键盘和读屏都直接支持，展开状态还能被浏览器的页内查找唤起 -->
          <details v-if="data.contributions.members.length" class="detail">
            <summary class="t-small">这个比例是怎么算出来的</summary>
            <div class="table-wrap">
              <ContributionBreakdown
                :milestones="milestones"
                :members="data.contributions.members"
              />
            </div>
            <p class="t-small t-soft foot">
              「各条相加」是每人在各条里程碑上声明比例的直接和，不是百分比。
              上方的累计占比是把这几个数按比例缩放到总和 100 的结果。
            </p>
          </details>
        </BaseCard>

        <BaseCard class="col">
          <template #title><h2>项目描述</h2></template>
          <p v-if="project.description" class="desc">{{ project.description }}</p>
          <p v-else class="t-soft desc is-placeholder">这个项目还没有填写描述。</p>
          <div class="members">
            <MemberAvatars :members="project.members" />
            <span class="t-small t-soft">{{ project.members.join(' · ') }}</span>
          </div>
        </BaseCard>
      </div>

      <BaseCard padding="none" class="timeline-card">
        <template #title><h2>里程碑时间线</h2></template>
        <template #actions>
          <span class="t-small t-soft t-nums">{{ milestones.length }} 条记录</span>
        </template>

        <EmptyState
          v-if="milestones.length === 0"
          title="这个项目还没有里程碑"
          description="提交第一份成果后，它会出现在这条时间线上：文件哈希、贡献比例、以及每位成员的确认状态。"
        >
          <template #action>
            <BaseButton variant="primary" @click="$router.push(newMilestonePath)">
              提交里程碑
            </BaseButton>
          </template>
        </EmptyState>

        <MilestoneTimeline v-else :milestones="milestones" class="timeline" />
      </BaseCard>
    </AsyncSection>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }

.meta-line {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-top: calc(var(--sp-5) * -1);
  margin-bottom: var(--sp-5);
}
.meta-badge { margin-left: var(--sp-1); }

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
}

.col { display: flex; flex-direction: column; }

.detail { margin-top: var(--sp-4); border-top: 1px solid var(--c-border-subtle); padding-top: var(--sp-3); }
.detail summary { cursor: pointer; color: var(--c-primary); font-weight: 600; }
.table-wrap { overflow-x: auto; margin-top: var(--sp-3); }
.foot { margin-top: var(--sp-3); max-width: 60ch; }

.desc { max-width: 68ch; }
.is-placeholder { font-style: italic; }

.members {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: auto;
  padding-top: var(--sp-4);
}

.timeline { padding: 0 var(--sp-4) var(--sp-3); }

@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
  .meta-line { margin-top: calc(var(--sp-4) * -1); }
}
</style>
