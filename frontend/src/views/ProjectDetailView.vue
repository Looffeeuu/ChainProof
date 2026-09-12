<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import FlashNotice from '../components/base/FlashNotice.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import EmptyState from '../components/base/EmptyState.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import MemberAvatars from '../components/project/MemberAvatars.vue'
import ContributionPanel from '../components/project/ContributionPanel.vue'
import ContributionBreakdown from '../components/project/ContributionBreakdown.vue'
import MilestoneTimeline from '../components/milestone/MilestoneTimeline.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import { useAsync } from '../composables/useAsync.js'
import { getProject, getContributions } from '../api/projects.js'
import { listMilestones } from '../api/milestones.js'
import { listCertificates, createCertificate } from '../api/certificates.js'
import { formatDate } from '../utils/format-time.js'
import { session } from '../stores/session.js'
import { markVisited } from '../stores/recent.js'
import { confirmGate } from '../utils/confirm-gate.js'

/**
 * 项目详情：概览 + 累计贡献比例 + 存证概况 + 里程碑时间线。
 *
 * spec/01 §2.7 原本写的是「三个 tab」。这里改成一屏纵向排列，理由见笔记 §2.1。
 */
const route = useRoute()
const router = useRouter()

async function load(projectId) {
  // 四个接口互不依赖，并发发出。串行的话页面要多等三个来回
  const [project, milestones, contributions, certificates] = await Promise.all([
    getProject(projectId),
    listMilestones(projectId),
    getContributions(projectId),
    listCertificates({ projectId })
  ])
  return { project, milestones, contributions, certificates }
}

const { data, loading, error, run } = useAsync(load)

// 监听路由参数而不是只在 onMounted 取一次：
// 从项目 A 的详情页直接跳到项目 B 时，组件会被复用，onMounted 不会再触发
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

const project = computed(() => data.value?.project)

// 记一次访问，侧栏的「最近项目」按它排序（stores/recent.js）。
// 放在取数成功之后而不是路由变化时：链接里的 ID 可能是错的，
// 把一个 404 记进「最近访问」只会让侧栏多一条点不开的项
watch(project, (p) => p && markVisited(p.projectId))
const milestones = computed(() => data.value?.milestones ?? [])
const newMilestonePath = computed(() => `/projects/${route.params.id}/milestones/new`)

/* ——— 贡献证明（FE-16）———
 *
 * 签发条件由 C 线定死（spec/03 §8.2）：这个人得是项目成员，
 * 项目里得至少有一条已验证的里程碑。按钮什么时候能点，照这两条判断，
 * 而不是让人点了再被接口拒绝。
 *
 * 接口是**幂等**的（§8.3）：同一个人重复请求会拿回已有的那张，不会签出第二张。
 * 所以这里不需要「先查有没有再决定调不调」，已经有证书时直接给个查看入口就行。
 */
const me = computed(() => session.currentMemberId)

const myCertificate = computed(() =>
  (data.value?.certificates ?? []).find((c) => c.memberId === me.value)
)

const verifiedCount = computed(
  () => milestones.value.filter((m) => m.status === 'VERIFIED').length
)

const isMember = computed(() => project.value?.members.includes(me.value) ?? false)

/** 右列的存证概况。前四行都显示，包括为 0 的那些——
 *  「已拒绝 0」是有用的信息，把它藏起来只会让人怀疑是不是漏算了。
 *
 *  最后一行是视角化的：「有几条在等我」。它和上面四行不是一类
 *  （那四行是这个项目的客观状态，这一行是当前身份的待办），
 *  所以只在真有待办时出现，没有就不占一行。 */
const tally = computed(() => {
  const by = (status) => milestones.value.filter((m) => m.status === status).length
  const waitingOnMe = milestones.value.filter((m) => confirmGate(m, me.value).can).length

  return [
    { key: 'all', label: '里程碑总数', count: milestones.value.length, tone: 'rest' },
    { key: 'verified', label: '链上已验证', count: by('VERIFIED'), tone: 'verified' },
    { key: 'pending', label: '待确认', count: by('PENDING_CONFIRMATION'), tone: 'pending' },
    { key: 'rejected', label: '已拒绝', count: by('REJECTED'), tone: 'rejected' },
    ...(waitingOnMe > 0
      ? [{ key: 'mine', label: '等你确认', count: waitingOnMe, tone: 'mine' }]
      : [])
  ]
})

const canIssue = computed(() => isMember.value && verifiedCount.value > 0)

/** 不能签发时的原因。按钮不出现，就要说清为什么不出现 */
const issueBlockedReason = computed(() => {
  if (!isMember.value) return '你不是这个项目的成员，不能在这里签发贡献证明。'
  if (verifiedCount.value === 0) {
    return '这个项目还没有任何一条里程碑通过全员确认。至少有一条之后，才能签发贡献证明。'
  }
  return ''
})

const issuing = ref(false)
const issueError = ref(null)

async function issueCertificate() {
  issuing.value = true
  issueError.value = null
  try {
    const cert = await createCertificate(route.params.id, { memberId: me.value })
    router.push(`/certificates/${cert.certificateId}`)
  } catch (e) {
    issueError.value = e
  } finally {
    issuing.value = false
  }
}
</script>

<template>
  <div>
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
          <EmptyState icon="search" title="没有这个项目的数据" description="链接里的项目 ID 可能已经失效。">
            <template #action>
              <BaseButton variant="primary" @click="$router.push('/projects')">
                回到项目列表
              </BaseButton>
            </template>
          </EmptyState>
        </BaseCard>
      </template>

      <PageHeader :title="project.name" :description="project.description || ''">
        <!-- 面包屑走 PageHeader 的插槽，占的是眉标的位置。
             原先它单独写在 AsyncSection 外面，于是加载中和出错时页面顶上
             也挂着一条「项目 / undefined」 -->
        <template #breadcrumb>
          <nav class="crumbs t-small t-soft" aria-label="面包屑">
            <RouterLink to="/projects">项目</RouterLink>
            <span aria-hidden="true">/</span>
            <span>{{ project.name }}</span>
          </nav>
        </template>

        <!-- 元信息原先是页头下面一个用负 margin 往上拽的独立段落。
             负 margin 的值和 PageHeader 内部的间距耦合，那边一改这里就错位 -->
        <template #meta>
          <StatusBadge :status="project.status" />
          <span class="t-nums">创建于 {{ formatDate(project.createdAt) }}</span>
          <span aria-hidden="true">·</span>
          <span>负责人 {{ project.ownerId }}</span>
          <span aria-hidden="true">·</span>
          <MemberAvatars :members="project.members" :size="20" />
          <span class="t-nums">{{ project.members.length }} 名成员</span>
        </template>

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

      <FlashNotice />

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
            <summary class="t-small">按里程碑查看</summary>
            <div class="table-wrap">
              <ContributionBreakdown
                :milestones="milestones"
                :members="data.contributions.members"
              />
            </div>

          </details>

          <!-- 贡献证明的入口。这是整条演示链路的最后一环：
               创建项目 → 提交里程碑 → 全员确认 → **签发证明** → 公开验证。
               入口放在累计比例这张卡片里，因为证书证明的就是这个数字。 -->
          <div class="issue">
            <ErrorNotice v-if="issueError" :error="issueError" title="没能签发这份贡献证明" />

            <template v-if="myCertificate">
              <p class="t-small t-soft">你在这个项目的贡献证明已签发。</p>
              <BaseButton @click="$router.push(`/certificates/${myCertificate.certificateId}`)">
                查看证书
              </BaseButton>
            </template>

            <template v-else-if="canIssue">
              <p class="t-small t-soft t-nums">已有 {{ verifiedCount }} 条里程碑通过全员确认。</p>
              <BaseButton :loading="issuing" loading-text="签发中…" @click="issueCertificate">
                签发我的贡献证明
              </BaseButton>
            </template>

            <p v-else class="t-small t-soft">{{ issueBlockedReason }}</p>
          </div>
        </BaseCard>

        <!-- 右列原先放的是「项目描述」。描述通常只有两三行，而左边那张卡很高，
             两列等高的网格把它拉成一个四百多像素的空盒子——整页最刺眼的一块空白。
             描述现在进了页头导语，这里换成按状态分组的里程碑计数：
             内容是随项目变化的，高度也和左列相称。 -->
        <BaseCard class="col side">
          <template #title><h2>存证概况</h2></template>

          <ul class="tally">
            <li v-for="row in tally" :key="row.key" class="tally-row">
              <span class="tally-dot" :class="`tone--${row.tone}`" aria-hidden="true" />
              <span class="tally-label">{{ row.label }}</span>
              <span class="tally-value t-nums">{{ row.count }}</span>
            </li>
          </ul>

        </BaseCard>
      </div>

      <BaseCard padding="none" class="timeline-card">
        <template #title><h2>里程碑时间线</h2></template>
        <template #actions>
          <span class="t-small t-soft t-nums">{{ milestones.length }} 条记录</span>
        </template>

        <EmptyState
          v-if="milestones.length === 0"
          icon="chain"
          title="这个项目还没有里程碑"
          description="提交成果后会出现在这条时间线上。"
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
.crumbs { display: flex; gap: var(--sp-2); }

.columns {
  display: grid;
  /* 不是 1fr 1fr。左列装着贡献比例、算法说明与签发入口，内容多；
     右列是一份短清单。等宽等高的话右列必然空一大半 */
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  /* start 而不是默认的 stretch：右列多高就多高，不跟着左列拉伸 */
  align-items: start;
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
}

.col { display: flex; flex-direction: column; }

/* —— 右列：存证概况 —— */
.tally { list-style: none; margin: 0; padding: 0; display: grid; }

.tally-row {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
  border-bottom: 1px solid var(--c-border-subtle);
}
.tally-row:last-child { border-bottom: none; }

.tally-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
.tally-dot.tone--verified { background: var(--c-verified); }
.tally-dot.tone--pending { background: var(--c-pending); }
.tally-dot.tone--rejected { background: var(--c-rejected); }
.tally-dot.tone--rest { background: var(--c-border-strong); }
.tally-dot.tone--mine { background: var(--c-primary); }
/* 待办那一行整行用主色，和上面四行的「客观状态」区分开 */
.tally-row:has(.tone--mine) { color: var(--c-primary-text); font-weight: 600; }

.tally-label { flex: 1; font-size: var(--fs-small); }
.tally-value { font-size: var(--fs-lead); font-weight: 640; letter-spacing: -0.01em; }

.tally-note { margin-top: var(--sp-3); line-height: 1.45; }

.detail { margin-top: var(--sp-4); border-top: 1px solid var(--c-border-subtle); padding-top: var(--sp-3); }
.detail summary { cursor: pointer; color: var(--c-primary-text); font-weight: 600; }
.table-wrap { overflow-x: auto; margin-top: var(--sp-3); }
.foot { margin-top: var(--sp-3); max-width: 60ch; }

.issue {
  display: grid;
  gap: var(--sp-3);
  justify-items: start;
  margin-top: var(--sp-4);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border-subtle);
}
.issue p { max-width: 60ch; }

.timeline { padding: 0 var(--sp-4) var(--sp-3); }

@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
}
</style>
