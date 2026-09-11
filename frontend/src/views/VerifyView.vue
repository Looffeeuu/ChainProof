<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import FormField from '../components/base/FormField.vue'
import BaseSpinner from '../components/base/BaseSpinner.vue'
import HashText from '../components/base/HashText.vue'
import { useAsync } from '../composables/useAsync.js'
import { verifyCertificate } from '../api/certificates.js'
import { formatDate } from '../utils/format-time.js'

/**
 * 公开验证页。spec/01 §2.7：极简页，输入 ID → 验证结果。不需要登录。
 *
 * 这一页是给项目外的人看的（招生老师、面试官），所以它只做一件事，
 * 页面上不出现任何需要先理解这个系统才能看懂的东西。
 */
const route = useRoute()
const router = useRouter()

const input = ref(String(route.params.id ?? ''))

const { data: result, loading, error, run } = useAsync(verifyCertificate)

// 带 ID 进来（证书上印的就是这种链接）就直接查，不用再点一次
watch(() => route.params.id, (id) => {
  input.value = String(id ?? '')
  if (id) run(String(id))
}, { immediate: true })

function submit() {
  const id = input.value.trim()
  if (!id) return
  // 走路由而不是直接调接口：地址栏跟着变，这个结果就能被复制、被收藏
  if (id === route.params.id) run(id)
  else router.push(`/verify/${encodeURIComponent(id)}`)
}

/**
 * 核对结果分三种，用白名单判断而不是「不等于 NOT_FOUND 就算通过」。
 *
 * 曾经写的是 `verificationStatus !== 'NOT_FOUND'`，那会把任何没见过的取值
 * 都算成「一致」——页面一边说「与存证记录一致」，一边挂一个别的徽章。
 * spec/02 §2.3 的规矩是「收到列表外的值不要静默吞掉」，这里照办。
 *
 * **取值是 `VALID` 不是 `VERIFIED`**（spec/03 §9，C 线定的）。
 * `VERIFIED` 是 Milestone.status 的取值，两者同形不同义，容易写混。
 * 这里把 `VERIFIED` 也一并接受：万一后端某处沿用了里程碑那套词，
 * 页面不至于把一张有效证书说成「状态不对」。
 */
const verdict = computed(() => {
  const status = result.value?.verificationStatus
  if (!status) return ''
  if (status === 'NOT_FOUND') return 'missing'
  if (status === 'VALID' || status === 'VERIFIED') return 'verified'
  return 'other'
})
</script>

<template>
  <div class="page">
    <PageHeader
      eyebrow="公开验证"
      title="验证一份贡献证明"
      description="输入证书编号，核对它是否与存证记录一致。不需要登录，任何人都可以查。"
    />

    <BaseCard class="form-card">
      <form novalidate @submit.prevent="submit">
        <FormField
          v-slot="f"
          label="证书编号"
          hint="证书页面底部印着完整编号，例如 CERT-P001-ALICE。"
        >
          <div class="row">
            <input
              :id="f.id"
              v-model="input"
              type="search"
              class="t-mono"
              :aria-describedby="f.describedBy"
              placeholder="CERT-P001-ALICE"
            />
            <BaseButton type="submit" variant="primary" :loading="loading" loading-text="核对中…">
              验证
            </BaseButton>
          </div>
        </FormField>
      </form>
    </BaseCard>

    <div v-if="loading" class="state" role="status">
      <BaseSpinner :size="20" />
      <span class="t-soft t-small">正在核对存证记录…</span>
    </div>

    <ErrorNotice
      v-else-if="error"
      :error="error"
      title="没能完成这次核对"
      retryable
      class="state"
      @retry="run(input.trim())"
    />

    <!-- 查无此证不是错误，是一个有效的验证结果，所以不走 ErrorNotice -->
    <BaseCard v-else-if="verdict === 'missing'" class="result miss">
      <p class="verdict">没有找到编号为 <span class="t-mono">{{ result.certificateId }}</span> 的证书。</p>
      <p class="t-small t-soft">
        可能是编号抄错了（注意区分数字 0 和字母 O），也可能这份证书从未签发过。
        向出示证书的人要一份完整链接是最快的办法。
      </p>
    </BaseCard>

    <BaseCard v-else-if="verdict" class="result" :class="verdict === 'verified' ? 'hit' : 'other'">
      <p class="t-label">核对结果</p>
      <p class="verdict">
        <template v-if="verdict === 'verified'">这份证书与存证记录一致。</template>
        <template v-else>查到了这份证书，但它的状态不是「已验证」。</template>
        <StatusBadge :status="result.verificationStatus" />
      </p>
      <p v-if="verdict === 'other'" class="t-small t-soft">
        下面的内容来自存证记录，但这份证书当前并不处于有效状态。
        以出具证书的一方的说明为准。
      </p>

      <dl class="facts">
        <div>
          <dt class="t-label">证书编号</dt>
          <dd class="t-mono">{{ result.certificateId }}</dd>
        </div>
        <div>
          <dt class="t-label">成员</dt>
          <dd>{{ result.memberId }}</dd>
        </div>
        <div>
          <dt class="t-label">项目编号</dt>
          <dd class="t-mono">{{ result.projectId }}</dd>
        </div>
        <div>
          <dt class="t-label">累计贡献比例</dt>
          <dd class="t-nums big">{{ result.contributionPercentage }}%</dd>
        </div>
        <div>
          <dt class="t-label">涵盖里程碑</dt>
          <dd class="t-nums">{{ result.milestoneIds.length }} 条</dd>
        </div>
        <div>
          <dt class="t-label">签发时间</dt>
          <dd class="t-nums">{{ formatDate(result.issuedAt) }}</dd>
        </div>
        <!-- 这一页要回答的就是「凭什么信」。没有交易 ID，
             上面那句「与存证记录一致」就只是本站的一面之词（spec/03 §5） -->
        <div v-if="result.txId" class="wide">
          <dt class="t-label">链上交易</dt>
          <dd><HashText :value="result.txId" :keep="16" label="链上交易 ID" /></dd>
        </div>
      </dl>

      <BaseButton variant="secondary" @click="router.push(`/certificates/${result.certificateId}`)">
        查看证书原件
      </BaseButton>
    </BaseCard>
  </div>
</template>

<style scoped>
.page { max-width: 640px; margin: 0 auto; }

.form-card { margin-bottom: var(--sp-4); }

.row { display: flex; gap: var(--sp-2); align-items: center; }
.row input { flex: 1; min-width: 0; }

.state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  padding: var(--sp-6) var(--sp-4);
}

.result { display: grid; gap: var(--sp-3); }
.verdict { font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }

.hit { border-color: var(--c-verified); }
.miss { border-color: var(--c-border-strong); }
.other { border-color: var(--c-pending); }

.facts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-4);
  margin: var(--sp-2) 0;
  padding: var(--sp-4) 0;
  border-top: 1px solid var(--c-border-subtle);
  border-bottom: 1px solid var(--c-border-subtle);
}
.facts dt { margin-bottom: var(--sp-1); }
.facts dd { margin: 0; min-width: 0; word-break: break-all; }
.big { font-size: 20px; font-weight: 600; }
.wide { grid-column: 1 / -1; }

@media (max-width: 900px) {
  .facts { grid-template-columns: 1fr; }
  .row { flex-direction: column; align-items: stretch; }
}
</style>
