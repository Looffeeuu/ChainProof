<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import HashText from '../components/base/HashText.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import FileHashCheck from '../components/base/FileHashCheck.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import ClaimTable from '../components/milestone/ClaimTable.vue'
import ConfirmProgress from '../components/milestone/ConfirmProgress.vue'
import { useAsync } from '../composables/useAsync.js'
import { getMilestone, confirmMilestone } from '../api/milestones.js'
import { formatDateTime } from '../utils/format-time.js'
import { session } from '../stores/session.js'
import { confirmGate } from '../utils/confirm-gate.js'

/**
 * 贡献确认页。入口是项目详情 Timeline 每行的「查看声明」。
 *
 * 这一页要回答成员的三个问题：这是什么成果、我被声明了多少、我现在能做什么。
 * 前两个是展示，第三个是这一页唯一的交互——确认或拒绝。
 */
const route = useRoute()

const { data: milestone, loading, error, run } = useAsync(getMilestone)
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

const me = computed(() => session.currentMemberId)

/**
 * 能不能表态，以及不能的话是为什么。判断规则在 utils/confirm-gate.js，
 * 这里只把原因码翻译成给人看的句子——把「按钮不出现」和「为什么不出现」
 * 绑在一起，就不会出现按钮消失了却没有任何说明的情况。
 */
const gate = computed(() => confirmGate(milestone.value, me.value))

const gateReason = computed(() => {
  switch (gate.value.reason) {
    case 'CLOSED':
      return '这条里程碑已经有结果了，不再接受新的表态。'
    case 'NOT_IN_CLAIM':
      return `这份声明里没有 ${me.value}，只有被声明了比例的成员才需要表态。`
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

/** 还没表态的人。表完态后告诉用户「接下来等谁」，比只说「成功」有用 */
const waitingFor = computed(() => {
  const m = milestone.value
  if (!m) return []
  const decided = new Set((m.confirmations ?? []).map((c) => c.memberId))
  return (m.contributors ?? []).map((c) => c.memberId).filter((id) => !decided.has(id))
})

const successText = computed(() => {
  if (!justDecided.value || !milestone.value) return ''
  const status = milestone.value.status
  if (justDecided.value === 'REJECTED') {
    return '已记录你的拒绝。这条声明就此作废，需要提交者重新分配比例后再提交一次。'
  }
  if (status === 'VERIFIED') {
    return '已记录你的确认。声明里的成员全部确认完毕，这条记录已经写入存证。'
  }
  if (waitingFor.value.length) {
    return `已记录你的确认。还在等 ${waitingFor.value.join('、')} 表态，全部确认后才会写入存证。`
  }
  return '已记录你的确认。'
})

async function decide(decision) {
  deciding.value = decision
  decideError.value = null
  try {
    // 接口返回更新后的完整 Milestone（C 线已确认按此实现，spec/03 §4.4），
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
    <nav class="crumbs t-small t-soft" aria-label="面包屑">
      <RouterLink to="/projects">项目</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink v-if="milestone" :to="`/projects/${milestone.projectId}`">
        {{ milestone.projectId }}
      </RouterLink>
      <span aria-hidden="true">/</span>
      <span>贡献确认</span>
    </nav>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!milestone"
      loading-text="正在读取这份声明…"
      error-title="没能打开这份声明"
      @retry="run(route.params.id)"
    >
      <PageHeader eyebrow="贡献确认" :title="milestone.title" :description="milestone.description" />

      <p class="t-small t-soft meta-line">
        提交于 {{ formatDateTime(milestone.createdAt) }}
        <StatusBadge :status="milestone.status" />
        <ConfirmProgress :milestone="milestone" />
      </p>

      <!-- 徽章说「链上已验证」，这一行就是它的依据。
           txId 指向最近一次让这条记录进入当前状态的那笔 Fabric 交易，
           所以每次有人表态、状态发生变化，它都会换一个（spec/03 §5）。 -->
      <p v-if="milestone.txId" class="t-small t-soft tx-line">
        <span class="t-label">链上交易</span>
        <HashText :value="milestone.txId" label="链上交易 ID" />
        <span class="t-soft">这条记录当前状态对应的 Fabric 交易</span>
      </p>

      <BaseCard class="block">
        <template #title><h2>成果文件</h2></template>
        <dl class="file">
          <dt class="t-label">文件名</dt>
          <dd>{{ milestone.fileName || '（未记录文件名）' }}</dd>
          <dt class="t-label">SHA-256</dt>
          <dd><HashText :value="milestone.fileHash" full label="文件哈希" /></dd>
        </dl>
        <p class="t-small t-soft check-intro">
          核对这串哈希，就能确认对方存证的文件和你手上的是同一份——
          文件差一个字节，哈希就完全不同。用下面这个直接核，不用自己去算。
        </p>

        <!-- 这句话以前只是一句话，没有配套的工具，读者要么信要么自己装命令行。
             现在它是一个可以当场做的动作，而且文件不出浏览器。 -->
        <FileHashCheck
          v-if="milestone.fileHash"
          :expected="milestone.fileHash"
          label="你手上的那份成果文件"
        />
      </BaseCard>

      <BaseCard padding="none" class="block">
        <template #title><h2>贡献声明</h2></template>
        <template #actions>
          <span class="t-small t-soft">共 {{ milestone.contributors.length }} 人</span>
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
          <p class="ask">
            这份声明把 <strong class="t-nums">{{ gate.share }}%</strong>
            记在 {{ me }} 名下。与实际情况相符吗？
          </p>
          <p class="t-small t-soft note">
            全体成员都确认后，这条记录会写入存证；任何一人拒绝，整条声明作废，需要重新提交。
            表态之后不能撤回。
          </p>
          <div class="actions">
            <BaseButton
              variant="secondary"
              :loading="deciding === 'REJECTED'"
              :disabled="deciding !== ''"
              loading-text="提交中…"
              @click="decide('REJECTED')"
            >
              比例不对，拒绝
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
        <p v-else-if="!justDecided" class="t-soft">{{ gateReason }}</p>
      </BaseCard>
    </AsyncSection>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }

.meta-line {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  margin-top: calc(var(--sp-5) * -1);
  margin-bottom: var(--sp-5);
}

.tx-line {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-5);
}

.block { margin-bottom: var(--sp-4); }

.check-intro { margin-bottom: var(--sp-3); max-width: 68ch; }

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
  .meta-line { margin-top: calc(var(--sp-4) * -1); }
  .actions { flex-direction: column-reverse; align-items: stretch; }
}
</style>
