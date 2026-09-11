<script setup>
import { computed } from 'vue'
import StatusBadge from '../base/StatusBadge.vue'
import HashText from '../base/HashText.vue'
import { formatDate } from '../../utils/format-time.js'

/**
 * 证书本体：一张可以直接打印交出去的纸。
 *
 * 它只认 props，自己不取数——这样它能被单独渲染成 HTML 做自检
 * （服务端渲染不会触发 onMounted，自己取数的组件在那边只会渲染出加载态）。
 * 取数留在 CertificateView 里。
 */
const props = defineProps({
  certificate: { type: Object, required: true },
  /** 证书对象里只有 projectId（spec/02 §2.4），项目名由调用方查好传进来 */
  projectName: { type: String, default: '' },
  /** 公开验证页的完整地址，印在证书末尾供人自行核验 */
  verifyUrl: { type: String, default: '' }
})

const milestoneCount = computed(() => props.certificate.milestoneIds?.length ?? 0)
</script>

<template>
  <article class="sheet avoid-break">
    <header class="head">
      <p class="t-label">ChainProof · 贡献证明</p>
      <h1>贡献证书</h1>
      <StatusBadge :status="certificate.verificationStatus" class="seal" />
    </header>

    <p class="lead">
      兹证明 <strong class="subject">{{ certificate.memberId }}</strong> 在项目
      <strong>{{ projectName || certificate.projectId }}</strong> 中的累计贡献比例为
    </p>

    <p class="figure t-nums">{{ certificate.contributionPercentage }}<span class="unit">%</span></p>

    <p class="t-small t-soft basis">
      该比例依据下列 {{ milestoneCount }} 条已通过全体成员确认的里程碑计算得出。
    </p>

    <section class="block">
      <h2 class="t-label">涵盖的里程碑</h2>
      <ul class="ids">
        <li v-for="id in certificate.milestoneIds" :key="id" class="t-mono">{{ id }}</li>
      </ul>
    </section>

    <dl class="meta">
      <div>
        <dt class="t-label">证书编号</dt>
        <dd><HashText :value="certificate.certificateId" :keep="12" label="证书编号" /></dd>
      </div>
      <div>
        <dt class="t-label">项目编号</dt>
        <dd class="t-mono">{{ certificate.projectId }}</dd>
      </div>
      <div>
        <dt class="t-label">签发时间</dt>
        <dd class="t-nums">{{ formatDate(certificate.issuedAt) }}</dd>
      </div>
    </dl>

    <!-- 链上交易 ID：这张纸声称的东西，凭据在这里。
         印在证书上，拿到纸质件的人也能自己去账本上核（spec/03 §5） -->
    <div v-if="certificate.txId" class="tx">
      <span class="t-label">链上交易</span>
      <HashText :value="certificate.txId" :keep="16" label="链上交易 ID" />
    </div>

    <footer class="foot">
      <p class="t-small t-soft">任何人都可以在下列地址核验这份证书的真伪，不需要登录：</p>
      <p class="t-small t-mono url">{{ verifyUrl }}</p>
    </footer>
  </article>
</template>

<style scoped>
/* 证书本体：一张纸。用较厚的边框和更大的内边距，
   让它在屏幕上就已经像一份可以交出去的文件 */
.sheet {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--sp-8) var(--sp-7);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--r-lg);
}

.head { text-align: center; margin-bottom: var(--sp-7); }
.head h1 { margin-top: var(--sp-2); }
.seal { margin-top: var(--sp-3); }

.lead { text-align: center; max-width: 52ch; margin: 0 auto; }
.subject { color: var(--c-primary); }

.figure {
  text-align: center;
  font-size: clamp(48px, 12vw, 88px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: var(--sp-4) 0 var(--sp-2);
}
.unit { font-size: 0.4em; margin-left: var(--sp-1); }

.basis { text-align: center; max-width: 52ch; margin: 0 auto var(--sp-7); }

.block { margin-bottom: var(--sp-6); }
.ids {
  list-style: none;
  padding: 0;
  margin-top: var(--sp-2);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.ids li {
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-sm);
  font-size: 13px;
}

.meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-4);
  margin: 0 0 var(--sp-6);
  padding-top: var(--sp-4);
  border-top: 1px solid var(--c-border-subtle);
}
.meta dt { margin-bottom: var(--sp-1); }
.meta dd { margin: 0; min-width: 0; }

.tx {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  margin-bottom: var(--sp-5);
}

.foot { padding-top: var(--sp-4); border-top: 1px solid var(--c-border-subtle); }
.url { word-break: break-all; margin-top: var(--sp-1); }

@media (max-width: 900px) {
  .sheet { padding: var(--sp-6) var(--sp-4); }
  .meta { grid-template-columns: 1fr; }
}

/* 打印时去掉圆角和边框：纸本身就是边界，再画一个框是多余的 */
@media print {
  .sheet { border: none; border-radius: 0; padding: 0; max-width: none; }
}
</style>
