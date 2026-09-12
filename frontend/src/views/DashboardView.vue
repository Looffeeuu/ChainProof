<script setup>
import { computed, onMounted } from 'vue'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import HashText from '../components/base/HashText.vue'
import EmptyState from '../components/base/EmptyState.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import AwaitingYou from '../components/milestone/AwaitingYou.vue'
import { useAsync } from '../composables/useAsync.js'
import { overview } from '../api/queries.js'
import { formatRelative, formatDate } from '../utils/format-time.js'

/**
 * 概览页。spec/01 §2.7：项目数、已验证里程碑数、证书数、最近活动。
 *
 * 取数与汇总都在 api/queries.js 的 overview() 里，这一页只负责排版。
 * 原先那三十行「先取项目、再按项目取里程碑、然后 flat + sort + map」
 * 和项目列表页里的是同一段逻辑，抄了两遍；而且它绕过了 stores/projects.js
 * 的缓存，导致打开这一页会和侧栏各打一次 /api/projects。
 */
const { data, loading, error, run } = useAsync(overview)
onMounted(run)

/**
 * 三张统计卡。
 *
 * 每张除了数字还带**一句上下文**，这是原先没有的：光一个孤零零的 `3`
 * 说明不了任何事——3 个项目是多是少？3 条已验证是全部还是零头？
 * 一句「共 4 条里程碑」「占全部 4 条的 75%」让同一个数字变成可读的判断。
 *
 * 版式上它也解决了另一个问题：原来每张卡 150px 高、只放一个 40px 的数字
 * 和一个 13px 的词，右边三分之二是空的。加上图标块与上下文行之后，
 * 卡片的内容终于填满了它自己的面积。
 */
const stats = computed(() => {
  const d = data.value
  if (!d) return []

  const total = d.milestones.length
  const ratio = total === 0 ? 0 : Math.round((d.verifiedCount / total) * 100)
  const coveredProjects = new Set(d.certificates.map((c) => c.projectId)).size

  return [
    {
      key: 'projects',
      label: '项目',
      value: d.projects.length,
      note: `共 ${total} 条里程碑`,
      icon: 'layers',
      tone: 'primary',
      to: '/projects'
    },
    {
      key: 'verified',
      label: '已验证里程碑',
      value: d.verifiedCount,
      note: total === 0 ? '还没有里程碑' : `占全部 ${total} 条的 ${ratio}%`,
      icon: 'check',
      tone: 'verified',
      to: '/projects'
    },
    {
      key: 'certificates',
      label: '我的贡献证明',
      value: d.certificates.length,
      note: coveredProjects === 0 ? '尚未签发' : `覆盖 ${coveredProjects} 个项目`,
      icon: 'certificate',
      tone: 'chain',
      // 证书没有单独的列表页，点这个数字没地方可去。不给 to，就渲染成普通方块，
      // 不做成一个点了没反应的链接
      to: ''
    }
  ]
})

/**
 * 空状态出现时，页头的主按钮降成次按钮。
 * 否则屏幕上会同时有两个蓝色的「创建项目」——
 * spec/01 §3.2 要求每页只有一个主色按钮，而这两个按钮做的还是同一件事。
 */
const isEmpty = computed(() => data.value?.projects.length === 0)
</script>

<template>
  <div>
    <!-- 不写 description。原先那句「团队当前的存证进度、最近提交的里程碑，
         以及已经签发的贡献证明」是把这一页有什么再念一遍——
         下面三张统计卡和两个区块标题已经说了同样的事（spec/01 §2.10 规则 6）。 -->
    <PageHeader title="概览">
      <template #actions>
        <BaseButton :variant="isEmpty ? 'secondary' : 'primary'" @click="$router.push('/projects/new')">
          创建项目
        </BaseButton>
      </template>
    </PageHeader>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!data || data.projects.length === 0"
      loading-text="正在读取项目与里程碑…"
      error-title="没能读到概览数据"
      @retry="run"
    >
      <template #empty>
        <BaseCard>
          <EmptyState
            icon="box"
            title="还没有任何项目"
            description="创建第一个项目之后，这里会显示存证进度与最近活动。"
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
          :key="item.key"
          :to="item.to || undefined"
          class="stat"
          :class="{ 'is-link': item.to }"
        >
          <span class="stat-body">
            <span class="stat-value t-nums">{{ item.value }}</span>
            <span class="stat-label">{{ item.label }}</span>
            <span class="stat-note t-small t-soft t-nums">{{ item.note }}</span>
          </span>

          <span class="stat-icon" :class="`tone--${item.tone}`" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <template v-if="item.icon === 'layers'">
                <path d="M12 3.2 21 8l-9 4.8L3 8Z" />
                <path d="M3 13.2 12 18l9-4.8" />
              </template>
              <template v-else-if="item.icon === 'check'">
                <circle cx="12" cy="12" r="8.6" />
                <path d="m8.4 12.2 2.6 2.6 4.6-5.2" />
              </template>
              <template v-else>
                <path d="M6 3.5h9l3.5 3.5v8.5" />
                <path d="M6 3.5v17h6" />
                <circle cx="17" cy="18" r="3" />
              </template>
            </svg>
          </span>
        </component>
      </section>

      <BaseCard padding="none" class="block">
        <template #title><h2>最近活动</h2></template>
        <template #actions>
          <BaseButton variant="ghost" @click="$router.push('/projects')">全部项目</BaseButton>
        </template>

        <!-- 有项目但一条里程碑都没有，是个正常状态（刚建完项目就是这样）。
             不给空状态的话，这张卡只剩一个标题，下面一片空白，看起来像坏了 -->
        <EmptyState
          v-if="data.recent.length === 0"
          icon="chain"
          title="还没有里程碑"
          description="提交成果后会出现在这里。"
        />

        <ul v-else class="feed">
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
            <AwaitingYou :milestone="m" />
            <StatusBadge :status="m.status" />
          </li>
        </ul>
      </BaseCard>

      <!-- 证书的唯一入口。以前这个入口写死在侧栏里指向一条假数据，
           接真接口就会 404；改成按列表渲染，有几张显示几张。
           spec/01 §2.6 把「证书列表为空」列为必做的空状态之一，就是这里。 -->
      <BaseCard padding="none" class="block">
        <template #title><h2>我的贡献证明</h2></template>
        <template #actions>
          <BaseButton variant="ghost" @click="$router.push('/verify')">公开验证</BaseButton>
        </template>

        <EmptyState
          v-if="data.certificates.length === 0"
          icon="certificate"
          title="你还没有签发过贡献证明"
          description="项目里有里程碑通过全员确认后，在项目详情页签发。"
        />

        <ul v-else class="feed">
          <li v-for="c in data.certificates" :key="c.certificateId" class="feed-item">
            <div class="feed-main">
              <RouterLink :to="`/certificates/${c.certificateId}`" class="feed-title">
                {{ c.projectName }} · <span class="t-nums">{{ c.contributionPercentage }}%</span>
              </RouterLink>
              <p class="t-small t-soft t-nums">
                涵盖 {{ c.milestoneIds.length }} 条里程碑 · 签发于 {{ formatDate(c.issuedAt) }}
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
  display: flex;
  align-items: flex-start;
  /* 图标推到右边缘：卡片有 340px 宽，文字只占 180px，
     图标贴在左边的话右边三分之二仍然是空的。分列两端，卡片的宽度才有理由 */
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-5);
  background: var(--c-surface);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  color: var(--c-text);
  text-decoration: none;
  transition: border-color var(--ease), box-shadow var(--ease);
}
.stat.is-link:hover {
  border-color: var(--c-border-strong);
  box-shadow: var(--shadow-md);
  text-decoration: none;
}

/* 图标块。三张卡各用一个颜色，而且颜色是**有意义的**：
   项目走主色（可操作的对象）、已验证走状态绿、证书走存证色。
   这是内容区第一次出现颜色——在此之前整页只有灰字和一个蓝按钮。 */
.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
}
.stat-icon svg { width: 18px; height: 18px; }
.tone--primary { background: var(--c-primary-weak); color: var(--c-primary-text); }
.tone--verified { background: var(--c-verified-bg); color: var(--c-verified); }
.tone--chain { background: var(--c-chain-weak); color: var(--c-chain); }

.stat-body { display: grid; gap: 1px; min-width: 0; }

.stat-value {
  font-size: var(--fs-stat);
  font-weight: 640;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.stat-label { font-size: var(--fs-small); font-weight: 600; }
.stat-note { line-height: 1.4; }

.block { margin-bottom: var(--sp-4); }

.feed { list-style: none; margin: 0; padding: 0; }

.feed-item {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--c-border-subtle);
  transition: background var(--ease);
}
.feed-item:hover { background: var(--c-sunken); }

.feed-main { flex: 1; min-width: 0; }
.feed-title { font-weight: 600; color: var(--c-text); }
.feed-title:hover { color: var(--c-primary-text); }
.feed-hash { flex-shrink: 0; }

@media (max-width: 900px) {
  .stats { grid-template-columns: 1fr; }
  .feed-item { flex-wrap: wrap; gap: var(--sp-2); }
  .feed-main { flex-basis: 100%; }
}
</style>
