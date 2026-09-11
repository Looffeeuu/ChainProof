<script setup>
import { computed, onMounted } from 'vue'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import HashText from '../components/base/HashText.vue'
import EmptyState from '../components/base/EmptyState.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import { useAsync } from '../composables/useAsync.js'
import { listProjects } from '../api/projects.js'
import { listMilestones } from '../api/milestones.js'
import { listCertificates } from '../api/certificates.js'
import { formatRelative, formatDate } from '../utils/format-time.js'

/**
 * 概览页。spec/01 §2.7：项目数、已验证里程碑数、证书数、最近活动。
 *
 * 里程碑没有「取全部」的接口（spec/02 §5.1 只有按项目取），
 * 所以这里先取项目再并发取各自的里程碑，在前端汇总。
 * 三个项目发四次请求，规模上完全可以接受；等真接口有了聚合端点再换。
 */
async function loadOverview() {
  const [projects, certificates] = await Promise.all([listProjects(), listCertificates()])
  const lists = await Promise.all(projects.map((p) => listMilestones(p.projectId)))

  const milestones = lists.flat()
  const nameOf = new Map(projects.map((p) => [p.projectId, p.name]))

  return {
    projects,
    certificates,
    milestones,
    verifiedCount: milestones.filter((m) => m.status === 'VERIFIED').length,
    recent: [...milestones]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((m) => ({ ...m, projectName: nameOf.get(m.projectId) ?? m.projectId }))
  }
}

const { data, loading, error, run } = useAsync(loadOverview)
onMounted(run)

const stats = computed(() => [
  { label: '项目', value: data.value?.projects.length ?? 0, to: '/projects' },
  { label: '已验证里程碑', value: data.value?.verifiedCount ?? 0, to: '/projects' },
  // 证书没有单独的列表页，点这个数字没地方可去。不给 to，就渲染成普通方块，
  // 不做成一个点了没反应的链接
  { label: '贡献证书', value: data.value?.certificates.length ?? 0, to: '' }
])

/**
 * 空状态出现时，页头的主按钮降成次按钮。
 * 否则屏幕上会同时有两个蓝色的「创建项目」——
 * spec/01 §3.2 要求每页只有一个主色按钮，而这两个按钮做的还是同一件事。
 */
const isEmpty = computed(() => data.value?.projects.length === 0)
</script>

<template>
  <div>
    <PageHeader
      eyebrow="概览"
      title="ChainProof"
      description="让团队里的每一份贡献可追溯、可验证。"
    >
      <template #actions>
        <BaseButton :variant="isEmpty ? 'secondary' : 'primary'" @click="$router.push('/projects/new')">
          创建项目
        </BaseButton>
      </template>
    </PageHeader>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="data?.projects.length === 0"
      loading-text="正在读取项目与里程碑…"
      error-title="没能读到概览数据"
      @retry="run"
    >
      <template #empty>
        <BaseCard>
          <EmptyState
            title="还没有任何项目"
            description="创建第一个项目后，这里会显示项目数、已验证的里程碑数，以及最近的存证活动。"
          >
            <template #action>
              <BaseButton variant="primary" @click="$router.push('/projects/new')">
                创建项目
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>
      </template>

      <section class="stats" aria-label="整体数据">
        <component
          :is="item.to ? 'RouterLink' : 'div'"
          v-for="item in stats"
          :key="item.label"
          :to="item.to || undefined"
          class="stat"
          :class="{ 'is-link': item.to }"
        >
          <strong class="t-nums">{{ item.value }}</strong>
          <span class="t-soft t-small">{{ item.label }}</span>
        </component>
      </section>

      <BaseCard padding="none" class="recent">
        <template #title><h2>最近活动</h2></template>
        <template #actions>
          <BaseButton variant="ghost" @click="$router.push('/projects')">全部项目</BaseButton>
        </template>

        <ul class="feed">
          <li v-for="m in data.recent" :key="m.milestoneId" class="feed-item">
            <div class="feed-main">
              <RouterLink :to="`/milestones/${m.milestoneId}`" class="feed-title">
                {{ m.title }}
              </RouterLink>
              <p class="t-small t-soft">
                {{ m.projectName }} · {{ formatRelative(m.createdAt) }}
              </p>
            </div>
            <HashText :value="m.fileHash" :copyable="false" class="feed-hash" />
            <StatusBadge :status="m.status" />
          </li>
        </ul>
      </BaseCard>

      <!-- 证书的唯一入口。以前这个入口写死在侧栏里指向一条假数据，
           接真接口就会 404；改成按列表渲染，有几张显示几张。
           spec/01 §2.6 把「证书列表为空」列为必做的空状态之一，就是这里。 -->
      <BaseCard padding="none" class="recent">
        <template #title><h2>贡献证明</h2></template>
        <template #actions>
          <BaseButton variant="ghost" @click="$router.push('/verify')">公开验证</BaseButton>
        </template>

        <EmptyState
          v-if="data.certificates.length === 0"
          title="还没有签发过贡献证明"
          description="当一个项目里有里程碑通过全员确认后，就可以为成员签发贡献证明。它是一张可以打印、也可以让任何人公开核验的凭证。"
        />

        <ul v-else class="feed">
          <li v-for="c in data.certificates" :key="c.certificateId" class="feed-item">
            <div class="feed-main">
              <RouterLink :to="`/certificates/${c.certificateId}`" class="feed-title">
                {{ c.memberId }} · {{ c.contributionPercentage }}%
              </RouterLink>
              <p class="t-small t-soft">
                {{ c.projectId }} · 涵盖 {{ c.milestoneIds.length }} 条里程碑 ·
                签发于 {{ formatDate(c.issuedAt) }}
              </p>
            </div>
            <StatusBadge :status="c.verificationStatus" />
          </li>
        </ul>
      </BaseCard>
    </AsyncSection>
  </div>
</template>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
}

.stat {
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  background: var(--c-surface);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  color: var(--c-text);
  text-decoration: none;
  transition: border-color var(--ease);
}
.stat.is-link:hover { border-color: var(--c-border-strong); text-decoration: none; }
.stat strong { font-size: clamp(28px, 4vw, 40px); font-weight: 600; letter-spacing: -0.02em; }

.recent { margin-bottom: var(--sp-4); }

.feed { list-style: none; margin: 0; padding: 0; }

.feed-item {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--c-border-subtle);
}

.feed-main { flex: 1; min-width: 0; }
.feed-title { font-weight: 600; color: var(--c-text); }
.feed-title:hover { color: var(--c-primary); }
.feed-hash { flex-shrink: 0; }

@media (max-width: 900px) {
  .stats { grid-template-columns: 1fr; }
  .feed-item { flex-wrap: wrap; gap: var(--sp-2); }
  .feed-main { flex-basis: 100%; }
}
</style>
