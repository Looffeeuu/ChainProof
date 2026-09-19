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
      比例来自项目成员提交并经确认的贡献声明，按项目全部已确认的里程碑等权累计，为签发时的数值。下列是其中该成员参与的 {{ milestoneCount }} 条。
    </p>

    <section class="block">
      <h2 class="t-label">参与的里程碑</h2>
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
      <p class="t-small t-soft">核验地址（无需登录）：</p>
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
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-md);

  /* 顶端的一条彩带。全站只有三处允许出现渐变，这是其中之一（spec/01 §2.4）：
     从主色过渡到存证色，正好是这张纸讲的两件事——「这是本站签发的」
     与「它在链上有据可查」。

     它必须是**背景的第一层**，不能是绝对定位的元素：背景本来就被 border-radius
     裁，两端的圆角自动就对。换成 `position: absolute` + 容器 `overflow: hidden`
     的话，那个 `overflow: hidden` 会连带把纸上两个复制按钮的键盘焦点框裁掉。 */
  background:
    linear-gradient(90deg, var(--c-primary), var(--c-chain)) top / 100% 5px no-repeat,
    var(--c-surface);
}

.head { text-align: center; margin-bottom: var(--sp-7); }
.head h1 { margin-top: var(--sp-2); }
.seal { margin-top: var(--sp-3); }

.lead { text-align: center; max-width: 52ch; margin: 0 auto; }
.subject { color: var(--c-primary-text); }

.figure {
  text-align: center;
  /* 排版档位之外的登记例外（spec/01 §2.3）：证书是一张纸不是应用界面，
     这个数字是整张纸的主体，套界面的字号档会显得畏缩 */
  font-size: clamp(48px, 12vw, 88px);
  font-weight: 640;
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: var(--sp-4) 0 var(--sp-2);
  color: var(--c-primary-text);
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
  border-radius: var(--r-xs);
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
  color: var(--c-chain);
  font-size: var(--fs-small);
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
  .sheet {
    border: none;
    border-radius: 0;
    padding: 0;
    max-width: none;
    box-shadow: none;
    /* 彩带在纸上印不可靠（多数打印设置默认不打背景图形），
       而且纸张本身就是边界，不需要再画一条。
       这里把背景重置成单层，渐变那一层随之消失 */
    background: var(--c-surface);
  }
}
</style>
