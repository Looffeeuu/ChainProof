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

// lazy：这一页要等用户输入编号才查，没有 id 时不该显示加载态
const { data: result, loading, error, run } = useAsync(verifyCertificate, { lazy: true })

// 带 ID 进来（证书上印的就是这种链接）就直接查，不用再点一次
watch(() => route.params.id, (id) => {
  input.value = String(id ?? '')
  if (id) run(String(id))
}, { immediate: true })

/**
 * 空输入的错误说明。
 *
 * 空输入不能静默 return。这一页的读者是**项目外的人**，是这个产品对外的
 * 第一印象——点了「验证」屏幕上什么都不发生的话，他的第一反应是
 * 「这个网站坏了」，而不是「我忘了填」。
 */
const inputError = ref('')

function submit() {
  const id = input.value.trim()
  if (!id) {
    // 第二句不是废话：这一页的用户不知道编号长什么样、去哪找
    inputError.value = '请填写证书编号。编号印在贡献证书的下半部分。'
    return
  }
  inputError.value = ''
  // 走路由而不是直接调接口：地址栏跟着变，这个结果就能被复制、被收藏
  if (id === route.params.id) run(id)
  else router.push(`/verify/${encodeURIComponent(id)}`)
}

/**
 * 用白名单判断，不用「不等于 NOT_FOUND 就算通过」——后者会把任何没见过的
 * 取值都算成「一致」，页面就会一边说一致一边挂个别的徽章。
 *
 * **证书的取值是 `VALID` 不是 `VERIFIED`**（后者是 Milestone.status 的）。
 * 两者同形不同义，这里把 `VERIFIED` 也一并接受，防后端某处沿用了那套词。
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
      description="输入证书编号，核对它是否与存证记录一致。这一页不需要登录，任何人都可以查。"
    />

    <BaseCard class="form-card">
      <form novalidate @submit.prevent="submit">
        <FormField v-slot="f" label="证书编号" :error="inputError">
          <div class="row">
            <input
              :id="f.id"
              v-model="input"
              type="search"
              class="t-mono"
              :aria-describedby="f.describedBy"
              :aria-invalid="f.invalid"
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
    <BaseCard v-else-if="verdict === 'missing'" accent="rest" class="result">
      <p class="verdict">没有找到编号为 <span class="t-mono">{{ result.certificateId }}</span> 的证书。</p>
      <p class="t-small t-soft">编号可能抄错了（注意 0 和 O），或者这份证书从未签发。</p>
    </BaseCard>

    <BaseCard v-else-if="verdict" :accent="verdict === 'verified' ? 'verified' : 'pending'" class="result">
      <p class="t-label">核对结果</p>
      <p class="verdict">
        <template v-if="verdict === 'verified'">这份证书与存证记录一致。</template>
        <!-- 说「有效」不说「已验证」：证书的状态取值是 VALID，界面别处叫「证书有效」；
             「已验证」是里程碑的 VERIFIED。两个词同形不同义，别写混 -->
        <template v-else>查到了这份证书，但它现在不是有效状态。</template>
        <StatusBadge :status="result.verificationStatus" />
      </p>
      <p v-if="verdict === 'other'" class="t-small t-soft">以下内容来自存证记录。</p>

      <!-- 每个字段各自兜底，不假设它一定在。
           这一块 verdict 为 'verified' 和 'other' 时共用，而 'other' 的意思就是
           「状态不在我们认识的清单里」——最可能返回这种状态的，恰恰是字段不全的响应。
           少一个 milestoneIds，`.length` 就抛 TypeError，渲染函数一抛错整个应用挂不上去，
           而这一页是给项目外的人看的。 -->
      <dl class="facts">
        <div>
          <dt class="t-label">证书编号</dt>
          <dd class="t-mono">{{ result.certificateId || '—' }}</dd>
        </div>
        <div>
          <dt class="t-label">成员</dt>
          <dd>{{ result.memberId || '—' }}</dd>
        </div>
        <div>
          <dt class="t-label">项目编号</dt>
          <dd class="t-mono">{{ result.projectId || '—' }}</dd>
        </div>
        <div>
          <dt class="t-label">累计贡献比例</dt>
          <dd class="t-nums big">
            {{ typeof result.contributionPercentage === 'number' ? `${result.contributionPercentage}%` : '—' }}
          </dd>
        </div>
        <div>
          <dt class="t-label">参与的里程碑</dt>
          <dd class="t-nums">
            {{ result.milestoneIds ? `${result.milestoneIds.length} 条` : '—' }}
          </dd>
        </div>
        <div>
          <dt class="t-label">签发时间</dt>
          <dd class="t-nums">{{ formatDate(result.issuedAt) || '—' }}</dd>
        </div>
        <!-- 这一页要回答的就是「凭什么信」。没有交易 ID，
             上面那句「与存证记录一致」就只是本站的一面之词（spec/03 §5） -->
        <div v-if="result.txId" class="wide">
          <dt class="t-label">链上交易</dt>
          <dd><HashText :value="result.txId" :keep="16" label="链上交易 ID" /></dd>
        </div>
      </dl>

      <BaseButton
        v-if="result.certificateId"
        variant="secondary"
        @click="router.push(`/certificates/${result.certificateId}`)"
      >
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

.verdict {
  font-size: var(--fs-heading);
  font-weight: 620;
  letter-spacing: -0.012em;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
}

/* 结论卡片顶端那条与结论同色的带子由 BaseCard 的 accent 属性画。
   这一页的读者是项目外的人，他打开只想知道一件事：一致，还是不一致。
   一条通栏的颜色比一个小徽章更早被看到，远远地就分得出是哪种结果。
   颜色不是唯一手段——同一张卡里始终有文字结论与状态徽章（WCAG SC 1.4.1）。

   带子由 border-top 画（见 BaseCard.accent），**不要**改回
   `position: absolute` 的伪元素 + `overflow: hidden`：那个 overflow 会把卡片里
   「查看证书原件」按钮和复制按钮的键盘焦点框一起裁掉。 */
.result { display: grid; gap: var(--sp-3); }

.facts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-4);
  margin: var(--sp-1) 0 var(--sp-2);
  padding: var(--sp-4);
  border-radius: var(--r-sm);
  /* 凹面而不是上下两条横线：这几项是从存证记录里读出来的原始事实，
     和卡片上「一致 / 不一致」那句判断不是一回事，给它一个自己的容器 */
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
}
.facts dt { margin-bottom: var(--sp-1); }
.facts dd { margin: 0; min-width: 0; word-break: break-all; }
.big { font-size: var(--fs-heading); font-weight: 640; letter-spacing: -0.012em; }
.wide { grid-column: 1 / -1; }

@media (max-width: 900px) {
  .facts { grid-template-columns: 1fr; }
  .row { flex-direction: column; align-items: stretch; }
}
</style>
