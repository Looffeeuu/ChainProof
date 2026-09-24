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
import { loadProjectDetail } from '../api/queries.js'
import { createCertificate } from '../api/certificates.js'
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

/**
 * 取数分两等：**项目本身决定这一页成不成，其余三块各自独立**。
 * 编排在 `api/queries.js` 的 `loadProjectDetail` 里，那里写了为什么
 * （2026-09-21 联调撞的那个 bug）。
 */
const { data, loading, error, run } = useAsync(loadProjectDetail)

// 监听路由参数而不是只在 onMounted 取一次：
// 从项目 A 的详情页直接跳到项目 B 时，组件会被复用，onMounted 不会再触发
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

const project = computed(() => data.value?.project)

// 记一次访问，侧栏的「最近项目」按它排序（stores/recent.js）。
// 放在取数成功之后而不是路由变化时：链接里的 ID 可能是错的，
// 把一个 404 记进「最近访问」只会让侧栏多一条点不开的项
watch(project, (p) => p && markVisited(p.projectId))
/* 三块副数据，三种结果（`api/queries.js` 的 attach）：
 *
 *   { ok: true, value }           拿到了，这是事实
 *   { ok: false, notWired: true } 这个接口还没切到真后端，**不可知**
 *   { ok: false, error }          切了但这次失败了，把后端的说法显示出来
 *
 * **不可知时不要退回空数组，也不要显示假数据的错误原文。** 空数组是一句断言
 * （「这个项目没有里程碑」），假数据的「没有找到项目 P-SMOKE-…」更是一句
 * 会把人带沟里的话——那个项目在链上真实存在，只是假数据不认识它。 */
const milestonesBlock = computed(() => data.value?.milestones ?? { ok: false })
const contributionsBlock = computed(() => data.value?.contributions ?? { ok: false })
const certificatesBlock = computed(() => data.value?.certificates ?? { ok: false })

/** 只在真的拿到时才有值；别处一律先判 `.ok` 再用 */
const milestones = computed(() => milestonesBlock.value.value ?? [])
const newMilestonePath = computed(() => `/projects/${route.params.id}/milestones/new`)

/**
 * 累计比例的显示顺序：比例高的在前，同比例的保持接口给的 memberId 字节序。
 * 接口按 memberId 排是为了三方结果可比对，不是为了给人看；
 * 横条、清单、明细表共用这一份顺序，三处才对得上。
 */
const shares = computed(() =>
  [...(contributionsBlock.value.value?.members ?? [])].sort((a, b) => b.percentage - a.percentage)
)
const basedOn = computed(() => contributionsBlock.value.value?.basedOnMilestones ?? 0)

/* ——— 贡献证明 ———
 *
 * 签发条件照 docs/API.md §5（PR #9 定稿）：是项目成员，且**取整后**的本人累计比例大于 0
 * ——就是上面面板里显示的那个数。按钮能不能点照这个判断，不让人点了再被接口拒绝；
 * 不能点时按钮仍然在，灰掉并说明原因（组长任务单的要求）。
 *
 * 接口是**幂等**的，而且先判幂等：已有证书的人直接拿回原证书，不再检查资格。
 * 所以已有证书时只给查看入口，不看比例。
 */
const me = computed(() => session.currentMemberId)

const myCertificate = computed(() =>
  (certificatesBlock.value.value ?? []).find((c) => c.memberId === me.value)
)

const isMember = computed(() => project.value?.members.includes(me.value) ?? false)

/** 右列的存证概况。前四行都显示，包括为 0 的那些——
 *  「已拒绝 0」是有用的信息，把它藏起来只会让人怀疑是不是漏算了。
 *
 *  最后一行是视角化的：「有几条在等我」。它和上面四行不是一类
 *  （那四行是这个项目的客观状态，这一行是当前身份的待办），
 *  所以只在真有待办时出现，没有就不占一行。 */
const tally = computed(() => {
  // 读不到里程碑时返回 null——一排「0」是在陈述一件我们并不知道的事
  if (!milestonesBlock.value.ok) return null

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

const myShare = computed(() => shares.value.find((m) => m.memberId === me.value)?.percentage ?? 0)

/** 不能签发的原因；空串表示能签发 */
const issueBlockedReason = computed(() => {
  if (!isMember.value) return '你不是这个项目的成员，不能在这里签发贡献证明。'
  // 比例或已有证书没读到时，「0%」和「还没签发过」都只是缺省值，不是事实。
  // 照它们下判断，会把「不知道」说成「不够格」
  if (contributionsBlock.value.notWired || certificatesBlock.value.notWired) {
    return '贡献比例还没接通，暂时不能在这里签发。'
  }
  if (!contributionsBlock.value.ok || !certificatesBlock.value.ok) {
    return '这个项目的累计贡献比例暂时读不到，刷新页面再试。'
  }
  if (basedOn.value === 0) {
    return '这个项目还没有任何一条里程碑通过全员确认。至少有一条之后，才能签发贡献证明。'
  }
  // 逐字照接口的 NO_VERIFIED_CONTRIBUTION 提示，页面与接口说同一句话
  if (myShare.value === 0) return '累计贡献比例为 0%，不能签发证书。'
  return ''
})

const canIssue = computed(() => issueBlockedReason.value === '')

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
        <!-- 面包屑走 PageHeader 的插槽，占的是眉标的位置。必须写在
             AsyncSection **里面**，否则加载中和出错时顶上会挂一条「项目 / undefined」 -->
        <template #breadcrumb>
          <nav class="crumbs t-small t-soft" aria-label="面包屑">
            <RouterLink to="/projects">项目</RouterLink>
            <span aria-hidden="true">/</span>
            <span>{{ project.name }}</span>
          </nav>
        </template>

        <!-- 元信息走插槽，不要在页头下面另写一段用负 margin 往上拽：
             那个值和 PageHeader 内部的间距耦合，那边一改这里就错位 -->
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

          <!-- 这一块读不到时**不能**落到 ContributionPanel 的空状态：
               那句「还没有可统计的贡献比例」是一句结论，而这里的真相是没读到 -->
          <!-- 未接入与真失败要分开说：前者不是错误，也不该把假数据的原话摆出来 -->
          <p v-if="contributionsBlock.notWired" class="t-small t-soft not-wired">
            贡献比例还没接通，暂时看不到。
          </p>
          <ErrorNotice
            v-else-if="!contributionsBlock.ok"
            :error="contributionsBlock.error"
            title="这个项目的贡献比例暂时读不到"
            @retry="run(route.params.id)"
          />
          <ContributionPanel v-else :members="shares" :based-on-milestones="basedOn" />

          <!-- <details> 是原生的折叠块：不用写任何 JavaScript，
               键盘和读屏都直接支持，展开状态还能被浏览器的页内查找唤起 -->
          <details v-if="contributionsBlock.ok && milestonesBlock.ok && basedOn > 0" class="detail">
            <summary class="t-small">按里程碑查看</summary>
            <div class="table-wrap">
              <ContributionBreakdown :milestones="milestones" :members="shares" />
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

            <template v-else>
              <p v-if="canIssue" class="t-small t-soft t-nums">
                签发后以当前的 {{ myShare }}% 为准。
              </p>
              <p v-else id="issue-blocked" class="t-small t-soft">{{ issueBlockedReason }}</p>
              <BaseButton
                :disabled="!canIssue"
                :loading="issuing"
                loading-text="签发中…"
                :aria-describedby="canIssue ? undefined : 'issue-blocked'"
                @click="issueCertificate"
              >
                签发我的贡献证明
              </BaseButton>
            </template>
          </div>
        </BaseCard>

        <!-- 右列放按状态分组的里程碑计数：内容随项目变化，高度和左列相称。
             不要在这里放项目描述——描述只有两三行，会被两列网格拉成
             一个四百多像素的空盒子，描述本身在页头导语里。 -->
        <BaseCard class="col side">
          <template #title><h2>存证概况</h2></template>

          <p v-if="milestonesBlock.notWired" class="t-small t-soft not-wired">
            里程碑还没接通，暂时看不到。
          </p>
          <ErrorNotice
            v-else-if="!tally"
            :error="milestonesBlock.error"
            title="里程碑暂时读不到"
            @retry="run(route.params.id)"
          />

          <ul v-else class="tally">
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
          <!-- 读不到时不报条数。「0 条记录」和「暂时读不到」是两件事 -->
          <span v-if="milestonesBlock.ok" class="t-small t-soft t-nums">
            {{ milestones.length }} 条记录
          </span>
        </template>

        <p v-if="milestonesBlock.notWired" class="t-small t-soft not-wired timeline-error">
          里程碑还没接通，这里暂时看不到。这个项目可能已经有里程碑。
        </p>
        <ErrorNotice
          v-else-if="!milestonesBlock.ok"
          :error="milestonesBlock.error"
          title="里程碑暂时读不到"
          class="timeline-error"
          @retry="run(route.params.id)"
        />

        <EmptyState
          v-else-if="milestones.length === 0"
          icon="chain"
          title="这个项目还没有里程碑"
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

/* 时间线那张卡是 padding="none"（为了让时间线自己贴边），
   里面的错误提示得自己补回内边距，否则贴着卡片边框 */
.timeline-error { padding: 0 var(--sp-4) var(--sp-4); }

/* 「未接入」不是错误，用普通说明的样子，不借错误态的红 */
.not-wired { margin: var(--sp-3) 0 0; }

@media (max-width: 900px) {
  .columns { grid-template-columns: 1fr; }
}
</style>
