<script setup>
import { computed, onMounted } from 'vue'
import PageHeader from '../components/base/PageHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseCard from '../components/base/BaseCard.vue'
import EmptyState from '../components/base/EmptyState.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import ProjectCard from '../components/project/ProjectCard.vue'
import { useAsync } from '../composables/useAsync.js'
import { projectsWithMilestones } from '../api/queries.js'

/**
 * 项目列表。
 *
 * 每张卡片要显示里程碑进度，而接口只有「按项目取里程碑」这一个（docs/API.md §2），
 * 所以在 api/queries.js 里一次性取好再分发给卡片，不让每张卡片自己去取——
 * 卡片自己取的话，请求会散在 N 个组件里，加载态也就变成 N 个各转各的圈。
 */
const { data, loading, error, run } = useAsync(projectsWithMilestones)
onMounted(run)

// 空状态里已经有一个「创建项目」主按钮，页头那个这时降级，
// 免得同屏出现两个做同一件事的蓝按钮（spec/01 §3.2）
const isEmpty = computed(() => data.value?.length === 0)
</script>

<template>
  <div>
    <!-- 不写 eyebrow：眉标的用处是交代上一层的位置，和标题重复时它没有信息。
         也不写 description，理由同概览页——卡片上已经有进度条、摘要与计数，
         再用一句话复述一遍流程，读者不会因此多知道任何事 -->
    <PageHeader title="项目">
      <template #actions>
        <BaseButton :variant="isEmpty ? 'secondary' : 'primary'" @click="$router.push('/projects/new')">创建项目</BaseButton>
      </template>
    </PageHeader>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!data || data.length === 0"
      loading-text="正在读取项目…"
      error-title="没能读到项目列表"
      @retry="run"
    >
      <template #empty>
        <BaseCard>
          <EmptyState
            icon="box"
            title="还没有任何项目"
          >
            <template #action>
              <BaseButton variant="primary" @click="$router.push('/projects/new')">
                创建项目
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>
      </template>

      <div class="grid">
        <ProjectCard
          v-for="row in data"
          :key="row.project.projectId"
          :project="row.project"
          :milestones="row.milestones"
        />
      </div>
    </AsyncSection>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  /* auto-fill + minmax：宽屏三列、中屏两列、窄屏一列，不用写三个断点 */
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--sp-4);
}

@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
