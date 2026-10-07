<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import FlashNotice from '../components/base/FlashNotice.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import HashText from '../components/base/HashText.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import FileHashCheck from '../components/base/FileHashCheck.vue'
import HelpTip from '../components/base/HelpTip.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import ClaimTable from '../components/milestone/ClaimTable.vue'
import ConfirmProgress from '../components/milestone/ConfirmProgress.vue'
import { useAsync } from '../composables/useAsync.js'
import { getMilestone, confirmMilestone, downloadMilestoneFile } from '../api/milestones.js'
import { getProject } from '../api/projects.js'
import { formatDateTime } from '../utils/format-time.js'
import { asObjectList } from '../utils/list.js'
import { session } from '../stores/session.js'
import { confirmGate, confirmersOf, submitterOf } from '../utils/confirm-gate.js'
import { saveBlob } from '../utils/save-blob.js'

/**
 * 贡献确认页。入口是项目详情 Timeline 每行的「查看声明」。
 *
 * 这一页要回答成员的三个问题：这是什么成果、我被声明了多少、我现在能做什么。
 * 前两个是展示，第三个是这一页唯一的交互——确认或拒绝。
 */
const route = useRoute()

/**
 * 面包屑上要显示项目名，而里程碑对象里只有 projectId。
 * 单独取一次项目，取不到就退回显示 ID——面包屑是次要信息，
 * 不该因为这个附带请求失败而让整页报错。
 */
const projectName = ref('')

/**
 * 项目成员名单，用来决定「下载原文件」给不给按钮。null 表示没取到——
 * 那时照样给按钮，能不能下由后端判断（它会回 403），不因为一个附带请求失败就把入口藏起来。
 */
const projectMembers = ref(null)

/**
 * 下载原文件的三个状态。**必须声明在 load 之前**：load 在 setup 阶段就被
 * immediate watch 同步调用，里面的 resetDownload 会读这几个 ref——
 * 声明在后面会踩 const 的暂时性死区，整页白屏（MilestoneCreateView 里同一个坑踩过两次）。
 */
const downloading = ref(false)
const downloadError = ref(null)
const downloadedName = ref('')

async function load(milestoneId) {
  resetDownload()
  const found = await getMilestone(milestoneId)
  try {
    const project = await getProject(found.projectId)
    projectName.value = project.name
    projectMembers.value = Array.isArray(project.members) ? project.members : null
  } catch {
    projectName.value = ''
    projectMembers.value = null
  }
  return found
}

const { data: milestone, loading, error, run } = useAsync(load)
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

const me = computed(() => session.currentMemberId)

/**
 * 能不能表态，以及不能的话是为什么。判断规则在 utils/confirm-gate.js，
 * 这里只把原因码翻译成给人看的句子——把「按钮不出现」和「为什么不出现」
 * 绑在一起，就不会出现按钮消失了却没有任何说明的情况。
 */
const gate = computed(() => confirmGate(milestone.value, me.value))

/** 提交者与确认人（PR #28）。确认人是创建时的快照，提交者不在其中 */
const submitter = computed(() => submitterOf(milestone.value))
const confirmers = computed(() => confirmersOf(milestone.value))

const gateReason = computed(() => {
  switch (gate.value.reason) {
    case 'CLOSED':
      return '这条里程碑已经有结果了，不再接受新的表态。'
    // 这两句逐字对应 #24 的要求：提交者与非确认人各有一句明确的话，而不是按钮悄悄消失
    case 'SUBMITTER':
      return '这条里程碑是你提交的，你不能确认自己的提交。它需要由项目里的其他成员独立确认。'
    case 'NOT_REVIEWER':
      return '你不是本里程碑确认人。确认人在提交时就已确定：提交者以外的全部项目成员。'
    case 'ALREADY_DECIDED':
      return `你已经在 ${formatDateTime(gate.value.decidedAt)} 表过态了，表态不能撤回。`
    default:
      return ''
  }
})

const deciding = ref('')       // 'CONFIRMED' | 'REJECTED' | ''：哪个按钮在转圈
const decideError = ref(null)
/**
 * 刚刚表完态时记下结果，用来给一条明确的成功反馈。
 *
 * 在这之前，表态成功后页面上只有徽章悄悄换了个颜色、按钮消失，
 * 取而代之的是「你已经表过态了，表态不能撤回」——
 * 用户刚点完确认就看到这句话，读起来像是操作被驳回了。
 * 需求文档 §5 要求「关键区块链交易必须提供清楚的成功/失败反馈」，
 * 失败一直有 ErrorNotice，成功这边原本是空的。
 */
const justDecided = ref('')

/**
 * 还没表态的确认人。表完态后告诉用户「接下来等谁」，比只说「成功」有用。
 * 名单取自 requiredConfirmerIds 快照，不是 contributors——提交者不在等待之列，
 * 没分到比例的确认人却在（PR #28）。
 */
const waitingFor = computed(() => {
  const m = milestone.value
  if (!m) return []
  const decided = new Set(asObjectList(m.confirmations).map((c) => c.memberId))
  return confirmers.value.filter((id) => !decided.has(id))
})

const successText = computed(() => {
  if (!justDecided.value || !milestone.value) return ''
  const status = milestone.value.status
  if (justDecided.value === 'REJECTED') {
    return '已记录你的拒绝。这条声明作废，需要提交者修改后重新提交。'
  }
  if (status === 'VERIFIED') {
    return '已记录你的确认。所有确认人都已确认，这条记录已经写入存证。'
  }
  if (waitingFor.value.length) {
    return `已记录你的确认。还在等 ${waitingFor.value.join('、')} 表态。`
  }
  return '已记录你的确认。'
})

/**
 * 下载原文件（#25）。确认人在表态之前要能拿到原件，自己打开看过、
 * 再拖进下面的核对框比一次哈希——「下载 → 本地核对 → 一致 → 确认」是答辩里的一整步。
 *
 * 只有项目成员能下载。名单已知且当前身份不在里面时，不给按钮，直接说为什么；
 * 名单未知时给按钮，由后端判断。
 */
const canDownload = computed(() =>
  projectMembers.value === null || projectMembers.value.includes(me.value)
)

function resetDownload() {
  downloading.value = false
  downloadError.value = null
  downloadedName.value = ''
}

async function download() {
  const m = milestone.value
  if (!m) return
  downloading.value = true
  downloadError.value = null
  downloadedName.value = ''
  try {
    // memberId 只有假接口用得上——真接口靠请求头 X-Member-Id 认人
    const blob = await downloadMilestoneFile(m.milestoneId, { memberId: me.value })
    // 文件名与后端 Content-Disposition 的取法一致：链上的 fileName，没有就用 ID
    const name = m.fileName || `${m.milestoneId}.bin`
    saveBlob(blob, name)
    downloadedName.value = name
  } catch (e) {
    downloadError.value = e
  } finally {
    downloading.value = false
  }
}

/**
 * 表态。**拒绝先问一次。**
 *
 * 这一页自己写着「表态不能撤回」，而拒绝会让整条声明作废、要求提交者重来——
 * 全站后果最重、且唯一不可逆的动作。同一个仓库里「填了一半的表单误点侧栏」
 * 这种小得多的事都配了一次 window.confirm，这里不该反过来。
 * 确认不拦：它推进流程，不终止流程。
 */
async function decide(decision) {
  if (decision === 'REJECTED' && !window.confirm('拒绝后这条声明作废，提交者要改完重新提交。表态不能撤回，确定拒绝？')) {
    return
  }
  deciding.value = decision
  decideError.value = null
  try {
    // 接口返回更新后的完整 Milestone（C 线已确认按此实现，docs/API.md §3），
    // 直接写回本地状态，徽章、进度和 txId 立刻变化，不用再发一次请求。
    // memberId 只有假接口用得上——真接口靠请求头 X-Member-Id 认人
    milestone.value = await confirmMilestone(route.params.id, {
      memberId: me.value,
      decision
    })
    justDecided.value = decision
  } catch (e) {
    decideError.value = e
  } finally {
    deciding.value = ''
  }
}
</script>

<template>
  <div>
    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!milestone"
      loading-text="正在读取这份声明…"
      error-title="没能打开这份声明"
      @retry="run(route.params.id)"
    >
      <PageHeader :title="milestone.title" :description="milestone.description">
        <!-- 面包屑占眉标的位置，而且必须写在 AsyncSection **里面**：
             写在外面的话，加载中和出错时页面顶上也照挂一条 -->
        <template #breadcrumb>
          <nav class="crumbs t-small t-soft" aria-label="面包屑">
            <RouterLink to="/projects">项目</RouterLink>
            <span aria-hidden="true">/</span>
            <RouterLink :to="`/projects/${milestone.projectId}`">
              {{ projectName || milestone.projectId }}
            </RouterLink>
            <span aria-hidden="true">/</span>
            <span>贡献确认</span>
          </nav>
        </template>

        <template #meta>
          <StatusBadge :status="milestone.status" />
          <span class="t-nums">
            {{ submitter ? `${submitter} 提交于` : '提交于' }} {{ formatDateTime(milestone.createdAt) }}
          </span>
          <ConfirmProgress :milestone="milestone" />
        </template>
      </PageHeader>

      <FlashNotice />

      <!-- 徽章说「链上已验证」，这一行就是它的依据。
           txId 指向最近一次让这条记录进入当前状态的那笔 Fabric 交易，
           所以每次有人表态、状态发生变化，它都会换一个（docs/API.md §6）。 -->
      <p v-if="milestone.txId" class="t-small t-soft tx-line">
        <span class="t-label">链上交易</span>
        <HashText :value="milestone.txId" label="链上交易 ID" />
      </p>

      <BaseCard class="block">
        <template #title><h2>成果文件</h2></template>
        <dl class="file">
          <dt class="t-label">文件名</dt>
          <dd>{{ milestone.fileName || '（未记录文件名）' }}</dd>
          <dt class="t-label">SHA-256</dt>
          <dd><HashText :value="milestone.fileHash" full label="文件哈希" /></dd>
        </dl>

        <!-- 原文件入口。没有哈希就没有文件，也就不给入口 -->
        <div v-if="milestone.fileHash" class="download">
          <BaseButton
            v-if="canDownload"
            variant="secondary"
            :loading="downloading"
            loading-text="下载中…"
            @click="download"
          >
            下载原文件
          </BaseButton>
          <p v-else class="t-small t-soft">只有项目成员可以下载原文件。</p>
          <!-- 下载完顺手指一下下一步：把它拖进下面的核对框 -->
          <p v-if="downloadedName" class="t-small t-soft" role="status">
            已下载 {{ downloadedName }}。把它拖进下面的方框，就能核对是不是同一份。
          </p>
        </div>
        <ErrorNotice v-if="downloadError" :error="downloadError" title="原文件没能下载" class="block" />

        <p class="t-small t-soft check-intro">
          核对你手上的那份文件是不是同一份。
          <HelpTip title="为什么比哈希就够">
            改一个字节，哈希就完全不同。
          </HelpTip>
        </p>

        <!-- 上面那句「核对一下」要配一个能当场做的动作，否则读者要么信、
             要么自己去装命令行。核对全在浏览器里，文件不出本机。 -->
        <FileHashCheck
          v-if="milestone.fileHash"
          :expected="milestone.fileHash"
          label="你手上的那份成果文件"
        />
      </BaseCard>

      <BaseCard padding="none" class="block">
        <template #title><h2>贡献声明</h2></template>
        <template #actions>
          <span class="t-small t-soft t-nums">{{ confirmers.length }} 位确认人</span>
        </template>
        <div class="table-wrap">
          <ClaimTable :milestone="milestone" :highlight="me" />
        </div>
      </BaseCard>

      <BaseCard class="block">
        <template #title><h2>你的表态</h2></template>

        <ErrorNotice v-if="decideError" :error="decideError" title="这次表态没能提交" class="block" />

        <!-- 表态的结果要说出来，不能只靠徽章换色。
             aria-live 让读屏用户也听得到——这一页唯一的、不可撤回的操作，
             成功与否必须播报 -->
        <p
          v-if="successText"
          class="done"
          :class="justDecided === 'REJECTED' ? 'is-rejected' : 'is-confirmed'"
          role="status"
          aria-live="polite"
        >
          <span class="mark" aria-hidden="true">{{ justDecided === 'REJECTED' ? '✕' : '●' }}</span>
          {{ successText }}
        </p>

        <template v-if="gate.can">
          <!-- 确认人不一定分到了比例：0% 的成员同样要表态，他核对的是别人的贡献是否属实 -->
          <p class="ask">
            <template v-if="gate.share">
              这份声明把 <strong class="t-nums">{{ gate.share }}%</strong>
              记在你名下。
            </template>
            <template v-else>
              这份声明没有给你分配比例。你作为提交者以外的成员，需要核对其他人的贡献是否属实。
            </template>
          </p>
          <p class="t-small t-soft note">
            所有确认人都确认后写入存证，任何一人拒绝则整条作废。<strong>表态不能撤回。</strong>
          </p>
          <div class="actions">
            <BaseButton
              variant="secondary"
              :loading="deciding === 'REJECTED'"
              :disabled="deciding !== ''"
              loading-text="提交中…"
              @click="decide('REJECTED')"
            >
              拒绝
            </BaseButton>
            <BaseButton
              variant="primary"
              :loading="deciding === 'CONFIRMED'"
              :disabled="deciding !== ''"
              loading-text="提交中…"
              @click="decide('CONFIRMED')"
            >
              确认这份声明
            </BaseButton>
          </div>
        </template>

        <!-- 刚表完态时不再重复「你已经表过态了」——上面那条成功反馈已经说清楚了。
             这句留给之后重新打开这一页的情况 -->
        <p v-else-if="!justDecided" class="t-soft gate-reason">{{ gateReason }}</p>
      </BaseCard>
    </AsyncSection>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

.tx-line {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-5);
}

.block { margin-bottom: var(--sp-4); }

.check-intro { margin-bottom: var(--sp-3); max-width: 68ch; }

.download {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  margin-bottom: var(--sp-4);
}

.file { display: grid; grid-template-columns: 120px 1fr; gap: var(--sp-2) var(--sp-4); margin: 0 0 var(--sp-4); }
.file dt { padding-top: var(--sp-1); }
.file dd { margin: 0; min-width: 0; }

/* 表格在窄屏可能撑出宽度，让它在自己这一块里横向滚，不推给 body */
.table-wrap { overflow-x: auto; padding: 0 var(--sp-4) var(--sp-3); }

.done {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid currentColor;
  border-radius: var(--r-sm);
  max-width: 68ch;
}
.done.is-confirmed { color: var(--c-verified); background: var(--c-verified-bg); }
.done.is-rejected { color: var(--c-rejected); background: var(--c-rejected-bg); }
.done .mark { line-height: 1.5; }

.ask { margin-bottom: var(--sp-2); }
.note { max-width: 68ch; margin-bottom: var(--sp-4); }

.actions { display: flex; gap: var(--sp-2); }

@media (max-width: 900px) {
  .file { grid-template-columns: 1fr; gap: var(--sp-1); }
  .actions { flex-direction: column-reverse; align-items: stretch; }
}
</style>
