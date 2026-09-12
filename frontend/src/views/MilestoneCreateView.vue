<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import FormField from '../components/base/FormField.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import ContributionAllocator from '../components/milestone/ContributionAllocator.vue'
import HashText from '../components/base/HashText.vue'
import HelpTip from '../components/base/HelpTip.vue'
import { useAsync } from '../composables/useAsync.js'
import { getProject } from '../api/projects.js'
import { createMilestone } from '../api/milestones.js'
import { sumPercentages } from '../utils/percentage.js'
import { hashFile } from '../utils/sha256.js'

const route = useRoute()
const router = useRouter()

const TITLE_MAX = 60
const DESC_MAX = 300

const form = reactive({ title: '', description: '', file: null })
const contributors = ref([])

const touched = reactive({ title: false, file: false })

/**
 * 选中文件后，**在浏览器里**算出这份文件的 SHA-256。
 *
 * 为什么前端也要算（后端本来就会算一遍，spec/03 §4.2）：
 * 存证的意思是「我承诺这份内容」，而如果哈希只由服务端算，
 * 用户承诺的是一串自己没算过、也没法验证的字符。两边各算一次并比对，
 * 这个承诺才成立。这也是 S3、Docker Registry、Git 的通行做法。
 *
 * 顺带解决一个具体问题：不算的话，提交页到确认页这一路上哈希都是空的，
 * 要等后端返回才有值。
 */
const fileHash = ref('')
const hashing = ref(false)
const hashProgress = ref(0)
const hashError = ref(null)

// 成员名单来自项目本身，不是演示身份那三个人——
// 贡献比例只能分给这个项目的成员（假接口对不在名单里的人会拒绝）
const { data: project, loading, error, run } = useAsync(getProject)
watch(() => route.params.id, (id) => id && run(id), { immediate: true })

watch(project, (p) => {
  if (!p) return
  contributors.value = p.members.map((memberId) => ({ memberId, percentage: 0 }))
})

const total = computed(() => sumPercentages(contributors.value))

const errors = computed(() => ({
  title: !form.title.trim()
    ? '请填写里程碑标题。'
    : form.title.trim().length > TITLE_MAX
      ? `标题最多 ${TITLE_MAX} 个字符，现在是 ${form.title.trim().length} 个。`
      : '',
  description:
    form.description.length > DESC_MAX
      ? `说明最多 ${DESC_MAX} 个字符，现在是 ${form.description.length} 个。`
      : '',
  file: !form.file
    ? '请选择要存证的成果文件。'
    : hashError.value
      ? '这个文件没能读取，换一个再试。'
      : hashing.value
        ? '正在计算文件哈希，算完就能提交。'
        : '',
  contributors: total.value === 100 ? '' : `贡献比例总和必须正好是 100%，现在是 ${total.value}%。`
}))

const valid = computed(() => Object.values(errors.value).every((e) => !e))

const submitting = ref(false)
const submitError = ref(null)

async function pickFile(event) {
  const picked = event.target.files?.[0] ?? null
  form.file = picked
  touched.file = true
  fileHash.value = ''
  hashError.value = null
  if (!picked) return

  hashing.value = true
  hashProgress.value = 0
  try {
    // hashFile 在 https / localhost 下走浏览器原生实现，
    // 在 http 下走自带的纯 JS 版本——三种情况结果一致（utils/sha256.js）
    fileHash.value = await hashFile(picked, { onProgress: (r) => { hashProgress.value = r } })
  } catch (e) {
    hashError.value = e
  } finally {
    hashing.value = false
  }
}

/** 1234567 → 1.2 MB。只用于显示，不参与任何计算 */
function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function submit() {
  touched.title = true
  touched.file = true
  if (!valid.value) return

  submitting.value = true
  submitError.value = null
  try {
    const created = await createMilestone(route.params.id, {
      title: form.title.trim(),
      description: form.description.trim(),
      fileName: form.file?.name ?? '',
      file: form.file,
      // 浏览器这边算出来的那份。真接口会把它作为 clientFileHash 发出去，
      // 由后端与自己算的比对（spec/03 §4.2）
      fileHash: fileHash.value,
      // 比例为 0 的成员不进声明：他没有参与这次成果，
      // 让他去确认一份「你贡献了 0%」的声明没有意义
      contributors: contributors.value.filter((c) => c.percentage > 0)
    })
    router.push(`/milestones/${created.milestoneId}`)
  } catch (e) {
    submitError.value = e
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <nav class="crumbs t-small t-soft" aria-label="面包屑">
      <RouterLink to="/projects">项目</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink :to="`/projects/${route.params.id}`">{{ project?.name ?? route.params.id }}</RouterLink>
      <span aria-hidden="true">/</span>
      <span>新里程碑</span>
    </nav>

    <PageHeader
      eyebrow="里程碑"
      title="提交里程碑"
    />

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!project"
      loading-text="正在读取项目成员…"
      error-title="没能读到这个项目"
      @retry="run(route.params.id)"
    >
      <form class="layout" novalidate @submit.prevent="submit">
        <BaseCard>
          <template #title><h2>成果</h2></template>

          <div class="fields">
            <FormField
              v-slot="f"
              label="标题"
              required
              hint="会出现在时间线上"
              :error="touched.title ? errors.title : ''"
            >
              <input
                :id="f.id"
                v-model="form.title"
                type="text"
                :aria-describedby="f.describedBy"
                :aria-invalid="f.invalid"
                placeholder="例如：基准测试集 v0.3 与评测脚本"
                @blur="touched.title = true"
              />
            </FormField>

            <FormField
              v-slot="f"
              label="说明"
              hint="改了什么、和上一版的差别"
              :error="errors.description"
            >
              <textarea
                :id="f.id"
                v-model="form.description"
                :aria-describedby="f.describedBy"
                :aria-invalid="f.invalid"
                placeholder="例如：新增 60 条对抗样本；评测脚本改为按场景分组输出。"
              />
              <p class="t-small t-soft t-nums count">{{ form.description.length }} / {{ DESC_MAX }}</p>
            </FormField>

            <FormField
              v-slot="f"
              label="成果文件"
              required
              hint="会上传保存，供成员取用"
              :error="touched.file ? errors.file : ''"
            >
              <input :id="f.id" type="file" :aria-describedby="f.describedBy" @change="pickFile" />

              <div v-if="form.file" class="picked">
                <p class="t-small">
                  已选择 <strong>{{ form.file.name }}</strong>
                  <span class="t-soft t-nums"> · {{ fileSize(form.file.size) }}</span>
                </p>

                <!-- 算哈希这件事对用户是可见的：他要承诺的就是这串字符，
                     不该等提交之后才第一次见到它 -->
                <p v-if="hashing" class="t-small t-soft" role="status">
                  正在计算 SHA-256… <span class="t-nums">{{ Math.round(hashProgress * 100) }}%</span>
                </p>
                <p v-else-if="hashError" class="t-small err">这个文件没能读取，换一个再试。</p>
                <div v-else-if="fileHash" class="hash-line">
                  <span class="t-label">SHA-256</span>
                  <HashText :value="fileHash" label="文件哈希" />
                </div>
              </div>
            </FormField>
          </div>
        </BaseCard>

        <BaseCard>
          <template #title><h2>贡献比例</h2></template>
          <p class="t-small t-soft intro">
            总和必须正好是 100%。
            <HelpTip title="比例为 0 的成员">
              不会进入这份声明，也不需要他确认。
            </HelpTip>
          </p>

          <ContributionAllocator v-model="contributors" />
        </BaseCard>

        <ErrorNotice v-if="submitError" :error="submitError" title="里程碑没能提交" />

        <div class="actions">
          <p v-if="!valid" class="t-small t-soft why">{{ Object.values(errors).find((e) => e) }}</p>
          <BaseButton variant="ghost" :disabled="submitting" @click="router.push(`/projects/${route.params.id}`)">
            取消
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            :loading="submitting"
            loading-text="提交中…"
            :disabled="!valid"
          >
            提交并存证
          </BaseButton>
        </div>
      </form>
    </AsyncSection>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }

.layout { display: grid; gap: var(--sp-4); max-width: 720px; }

.fields { display: grid; gap: var(--sp-5); }
.count { text-align: right; }
.intro { margin-bottom: var(--sp-4); max-width: 60ch; }

.picked {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: var(--c-bg);
  border-radius: var(--r-sm);
}

.hash-line { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.err { color: var(--c-rejected); }

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
}

/* 按钮为什么是灰的，就写在按钮旁边——
   让人去别处找原因，是这类表单最常见的卡点 */
.why { flex: 1; text-align: right; }

@media (max-width: 900px) {
  .actions { flex-wrap: wrap; }
  .why { flex-basis: 100%; text-align: left; }
}
</style>
