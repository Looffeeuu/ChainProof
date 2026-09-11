<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import FormField from '../components/base/FormField.vue'
import { createProject } from '../api/projects.js'
import { session } from '../stores/session.js'

const router = useRouter()

const NAME_MAX = 60
const DESC_MAX = 200

const form = reactive({
  name: '',
  description: '',
  // 负责人默认参与，且不能被取消——一个没有负责人的项目没有意义
  members: [session.currentMemberId]
})

// 哪些字段已经被碰过。没碰过的字段不显示校验信息：
// 一进页面就满屏红字，等于在指责用户还没开始填
const touched = reactive({ name: false, members: false })

const errors = computed(() => ({
  name: !form.name.trim()
    ? '请填写项目名称。'
    : form.name.trim().length > NAME_MAX
      ? `名称最多 ${NAME_MAX} 个字符，现在是 ${form.name.trim().length} 个。`
      : '',
  description:
    form.description.length > DESC_MAX
      ? `描述最多 ${DESC_MAX} 个字符，现在是 ${form.description.length} 个。`
      : '',
  members: form.members.length === 0 ? '至少要有一名成员。' : ''
}))

const valid = computed(() => Object.values(errors.value).every((e) => !e))

const submitting = ref(false)
const submitError = ref(null)

function toggleMember(memberId) {
  touched.members = true
  const i = form.members.indexOf(memberId)
  if (i >= 0) form.members.splice(i, 1)
  else form.members.push(memberId)
}

async function submit() {
  touched.name = true
  touched.members = true
  if (!valid.value) return

  submitting.value = true
  submitError.value = null
  try {
    const created = await createProject({
      name: form.name.trim(),
      description: form.description.trim(),
      ownerId: session.currentMemberId,
      members: [...form.members]
    })
    // 创建成功直接进详情页：用户接下来要做的就是提交第一个里程碑
    router.push(`/projects/${created.projectId}`)
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
      <span>新建</span>
    </nav>

    <PageHeader
      eyebrow="项目"
      title="创建项目"
      description="项目建好之后，成员就可以往里面提交里程碑，并为彼此的贡献比例投票确认。"
    />

    <BaseCard class="form-card">
      <form novalidate @submit.prevent="submit">
        <FormField
          v-slot="f"
          label="项目名称"
          required
          :hint="`一眼能认出是哪个项目，最多 ${NAME_MAX} 个字符。`"
          :error="touched.name ? errors.name : ''"
        >
          <input
            :id="f.id"
            v-model="form.name"
            type="text"
            :aria-describedby="f.describedBy"
            :aria-invalid="f.invalid"
            placeholder="例如：VLA 安全性基准测试"
            @blur="touched.name = true"
          />
        </FormField>

        <FormField
          v-slot="f"
          label="项目描述"
          hint="这个项目要做什么、成果是什么。可以留空，之后再补。"
          :error="errors.description"
        >
          <textarea
            :id="f.id"
            v-model="form.description"
            :aria-describedby="f.describedBy"
            :aria-invalid="f.invalid"
            placeholder="一两句话说明项目内容与最终交付物。"
          />
          <p class="t-small t-soft t-nums count">{{ form.description.length }} / {{ DESC_MAX }}</p>
        </FormField>

        <FormField
          label="成员"
          required
          hint="勾选参与这个项目的人。负责人（当前演示身份）默认参与。"
          :error="touched.members ? errors.members : ''"
        >
          <div class="members">
            <label v-for="m in session.members" :key="m" class="member">
              <input
                type="checkbox"
                :checked="form.members.includes(m)"
                :disabled="m === session.currentMemberId"
                @change="toggleMember(m)"
              />
              <span>{{ m }}</span>
              <span v-if="m === session.currentMemberId" class="t-small t-soft">负责人</span>
            </label>
          </div>
        </FormField>

        <ErrorNotice v-if="submitError" :error="submitError" title="项目没能创建" />

        <div class="actions">
          <BaseButton variant="ghost" :disabled="submitting" @click="router.push('/projects')">
            取消
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            :loading="submitting"
            loading-text="创建中…"
            :disabled="!valid"
          >
            创建项目
          </BaseButton>
        </div>
      </form>
    </BaseCard>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }

.form-card { max-width: 640px; }

form { display: grid; gap: var(--sp-5); }

.count { text-align: right; }

.members { display: grid; gap: var(--sp-2); }

.member {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border: 1px solid var(--c-border-subtle);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.member:hover { border-color: var(--c-border-strong); }
.member input { width: auto; }
.member input:disabled { cursor: not-allowed; }

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border-subtle);
}
</style>
