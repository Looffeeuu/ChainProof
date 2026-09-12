<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import EmptyState from '../components/base/EmptyState.vue'
import CertificateSheet from '../components/certificate/CertificateSheet.vue'
import { useAsync } from '../composables/useAsync.js'
import { getCertificate } from '../api/certificates.js'
import { getProject } from '../api/projects.js'
import { isDev } from '../stores/settings.js'

/**
 * 贡献证书页。spec/01 §2.7：证书样式页，可打印。
 *
 * 这一页只负责取数与页面外围（面包屑、打印按钮），证书本体是
 * components/certificate/CertificateSheet.vue——那样它才能被单独渲染做自检。
 *
 * 「可打印」不是加一个打印按钮就完事：Ctrl+P 出来的那一页必须是干净的，
 * 没有侧栏、没有按钮、没有面包屑。做法是给这些元素标 data-print="hide"，
 * 规则写在 styles/base.css 的 @media print 里。
 */
const route = useRoute()

/**
 * 证书本体，外加一个只用来显示项目名的附带请求。
 *
 * **项目名取不到不算失败。** 原先是串行 await，任何一个失败都让整页显示
 * 「没能打开这份证书」——包括证书本身明明已经拿到、只是项目查不到的情况。
 * `CertificateSheet` 早就有 `projectName || certificate.projectId` 的兜底，
 * 那条兜底之前永远跑不到。确认页的面包屑用的是同一种处理。
 */
async function load(certificateId) {
  const certificate = await getCertificate(certificateId)
  // 证书上要显示项目名，而证书对象里只有 projectId（spec/02 §2.4）
  const projectName = await getProject(certificate.projectId)
    .then((p) => p.name)
    .catch(() => '')
  return { certificate, projectName }
}

const { data, loading, error, run } = useAsync(load)
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

/**
 * 公开验证页的完整地址，印在证书上供人自己核验。
 *
 * **优先取构建期配置的公开域名。** 原先只取 `window.location.origin`，
 * 于是本地或局域网演示时，证书上印出来的是
 * `http://localhost:4173/verify/...` 或 `http://192.168.x.x/verify/...`。
 * 这张纸是要交给项目外的人的——「公开验证」是这个产品的核心主张，
 * 而拿到纸的人打不开那个地址；打印成 PDF 之后它还会固化在文件里。
 *
 * `typeof window` 的判断是为了服务端渲染——那边没有 window，直接读会抛错。
 */
const publicOrigin = import.meta.env.VITE_PUBLIC_ORIGIN || ''

const verifyUrl = computed(() => {
  if (!data.value) return ''
  const origin = publicOrigin || (typeof window === 'undefined' ? '' : window.location.origin)
  return `${origin}/verify/${data.value.certificate.certificateId}`
})

/**
 * 没配公开域名时提示部署者。
 *
 * **只在开发视角出现。** 这句话里有 `.env.production` 和 `VITE_PUBLIC_ORIGIN`，
 * 是构建配置，按 spec/01 §2.10 规则 3 不该进界面。
 * 一开始的理由是「打印时隐藏，不进纸」——但那只挡住了纸，
 * 屏幕上任何打开证书页的人（包括答辩时的评委）照样看得见。
 *
 * 放在开发视角下，需要它的人（部署的人）看得到，不需要的人看不到。
 */
const originIsLocal = computed(
  () =>
    isDev() &&
    !publicOrigin &&
    typeof window !== 'undefined' &&
    /^(localhost|127\.|192\.168\.|10\.)/.test(window.location.hostname)
)

/**
 * 打印。写成方法而不是在模板里直接 `window.print()`——
 * Vue 模板只认一小批全局对象（Math、Date、JSON 这些），window 不在其中，
 * 模板里写 window 会被当成组件上一个不存在的属性，点了就报错。
 */
function print() {
  window.print()
}
</script>

<template>
  <div>
    <div class="topbar" data-print="hide">
      <nav class="crumbs t-small t-soft" aria-label="面包屑">
        <RouterLink to="/">概览</RouterLink>
        <span aria-hidden="true">/</span>
        <span>贡献证书</span>
      </nav>
      <p v-if="originIsLocal" class="t-small warn">
        证书上的核验地址指向本机（{{ verifyUrl }}）。对外分发前，
        在 <code class="t-mono">.env.production</code> 里配置
        <code class="t-mono">VITE_PUBLIC_ORIGIN</code> 再重新构建。
      </p>

      <div class="tools">
        <BaseButton variant="secondary" @click="$router.push(`/verify/${route.params.id}`)">
          去验证这份证书
        </BaseButton>
        <BaseButton variant="primary" @click="print">打印 / 存为 PDF</BaseButton>
      </div>
    </div>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!data"
      loading-text="正在读取证书…"
      error-title="没能打开这份证书"
      @retry="run(route.params.id)"
    >
      <template #empty>
        <BaseCard>
          <EmptyState
            title="没有这份证书"
            description="编号可能拼错，或这份证书不存在。"
          >
            <!-- 空状态里必须给一条出路。项目详情页同样的位置有「回到项目列表」，
                 这里原先只有一句说明，人读完就卡住了 -->
            <template #action>
              <BaseButton variant="primary" @click="$router.push('/')">回到概览</BaseButton>
            </template>
          </EmptyState>
        </BaseCard>
      </template>

      <CertificateSheet
        :certificate="data.certificate"
        :project-name="data.projectName"
        :verify-url="verifyUrl"
      />
    </AsyncSection>
  </div>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
  flex-wrap: wrap;
}

.crumbs { display: flex; gap: var(--sp-2); }

/* 给部署者的提示，不是给证书读者的。用 pending 那一组色：
   它不是错误，是一件还没配好的事 */
.warn {
  flex-basis: 100%;
  order: 1;
  padding: var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--c-pending);
  border-radius: var(--r-xs);
  background: var(--c-pending-bg);
  color: var(--c-text);
}
.warn code { font-size: var(--fs-small); }
.tools { display: flex; gap: var(--sp-2); }

@media (max-width: 900px) {
  .tools { width: 100%; }
}
</style>
