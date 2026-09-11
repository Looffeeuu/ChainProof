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

async function load(certificateId) {
  const certificate = await getCertificate(certificateId)
  // 证书上要显示项目名，而证书对象里只有 projectId（spec/02 §2.4）
  const project = await getProject(certificate.projectId)
  return { certificate, project }
}

const { data, loading, error, run } = useAsync(load)
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

/**
 * 公开验证页的完整地址，印在证书上供人自己核验。
 * `typeof window` 的判断是为了服务端渲染——那边没有 window，
 * 直接读会在渲染时就抛错。
 */
const verifyUrl = computed(() => {
  if (!data.value) return ''
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/verify/${data.value.certificate.certificateId}`
})

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
            description="链接里的证书编号可能拼错了，或者这份证书已经不存在。"
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
        :project-name="data.project.name"
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
.tools { display: flex; gap: var(--sp-2); }

@media (max-width: 900px) {
  .tools { width: 100%; }
}
</style>
