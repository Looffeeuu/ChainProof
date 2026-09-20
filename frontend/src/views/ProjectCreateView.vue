<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import FormField from '../components/base/FormField.vue'
import { createProject } from '../api/projects.js'
import { session } from '../stores/session.js'
import { invalidateProjects } from '../stores/projects.js'
import { setFlash } from '../stores/flash.js'
import { focusFirstInvalid } from '../composables/useInvalidFocus.js'

const router = useRouter()

const NAME_MAX = 60
const DESC_MAX = 200

const form = reactive({
  name: '',
  description: '',
  // 负责人默认参与，且不能被取消——一个没有负责人的项目没有意义
  members: [session.currentMemberId]
})

/**
 * 负责人跟着当前身份走。**必须是 watch 而不是初始化一次**：
 * `ownerId` 在提交那一刻才读 session，`members` 若只在 setup 取一次，
 * 中途切身份就会造出「负责人不在成员名单里」的项目，而且新身份那个复选框
 * 是 disabled 的，用户自己补不上。
 *
 * 换走的人不自动移除——他可能确实要参与，而且他的复选框已经可以取消了。
 */
watch(
  () => session.currentMemberId,
  (now) => {
    if (!form.members.includes(now)) form.members.push(now)
  },
  { immediate: true }
)

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

/** 按钮旁边那句「为什么现在不能创建」。写法与提交里程碑页一致 */
const blockedReason = computed(() => Object.values(errors.value).find((e) => e) || '')

const submitting = ref(false)
const submitError = ref(null)

function toggleMember(memberId) {
  touched.members = true
  const i = form.members.indexOf(memberId)
  if (i >= 0) form.members.splice(i, 1)
  else form.members.push(memberId)
}

const formEl = ref(null)

/** 提交成功后置为 true，让下面的离开守卫放行那一次跳转 */
const submitted = ref(false)

/**
 * 填了一半就离开的保护。
 *
 * 提交成功后的那次跳转不能被拦，所以要一个 submitted 标志：
 * 不加的话，用户提交成功、代码 router.push 的那一刻会被自己的守卫拦下来，
 * 弹一句「还没提交，确定离开吗」——恰恰是在他刚刚提交完之后。
 *
 * 用 window.confirm 而不是自定义弹窗：自定义模态要焦点陷阱、Esc 关闭、
 * aria-modal、返回值 Promise 化，工作量比这一条本身大得多。
 * 先用原生的把行为做对；之后真要做模态组件时统一替换，
 * 不为这一处专门造一个半成品。
 *
 * 不加 beforeunload。它拦的是关标签页与刷新，浏览器只允许显示自己的固定文案，
 * 而且开发时热更新会频繁触发。路由守卫已经覆盖了实际会发生的情况。
 */
const dirty = computed(() =>
  form.name.trim() !== '' ||
  form.description.trim() !== '' ||
  // 负责人默认就勾着，所以「动过」的判据是勾了别人，不是「有人被勾」
  form.members.some((m) => m !== session.currentMemberId)
)

onBeforeRouteLeave(() => {
  if (!dirty.value || submitted.value) return true
  return window.confirm('这一页填的内容还没有提交，离开就会丢失。确定离开吗？')
})

async function submit() {
  // 提交这个动作本身意味着「我填完了」，所以先把所有字段标成 touched，
  // 否则用户从没碰过的必填项不会显示错误
  touched.name = true
  touched.members = true
  if (!valid.value) {
    await focusFirstInvalid(formEl.value)
    return
  }

  submitting.value = true
  submitError.value = null
  try {
    const created = await createProject({
      name: form.name.trim(),
      description: form.description.trim(),
      ownerId: session.currentMemberId,
      members: [...form.members]
    })
    // 侧栏的计数与「最近项目」读的是共享缓存，不失效的话它们会当这个项目不存在，
    // 一直到切身份或刷新为止
    invalidateProjects()
    submitted.value = true
    setFlash(`项目「${created.name}」已创建，现在可以提交第一个里程碑。`)
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
    <PageHeader
      title="创建项目"
      description="成员名单决定谁需要参与这个项目里程碑的确认。"
    >
      <template #breadcrumb>
        <nav class="crumbs t-small t-soft" aria-label="面包屑">
          <RouterLink to="/projects">项目</RouterLink>
          <span aria-hidden="true">/</span>
          <span>新建</span>
        </nav>
      </template>
    </PageHeader>

    <BaseCard class="form-card">
      <form ref="formEl" novalidate @submit.prevent="submit">
        <FormField
          v-slot="f"
          label="项目名称"
          required
          :hint="`最多 ${NAME_MAX} 字`"
          :error="touched.name || form.name ? errors.name : ''"
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
          hint="可留空"
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
          hint="负责人默认参与"
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
          <p v-if="!valid" class="t-small t-soft why">{{ blockedReason }}</p>
          <BaseButton variant="ghost" :disabled="submitting" @click="router.push('/projects')">
            取消
          </BaseButton>
          <!-- 不写 :disabled="!valid"，理由与提交里程碑页相同：禁用的提交按钮
               既不能点也挡掉 Enter 的隐式提交，submit() 里的 focusFirstInvalid
               就永远跑不到，用户看到的是一个不说话的灰按钮 -->
          <BaseButton
            type="submit"
            variant="primary"
            :loading="submitting"
            loading-text="创建中…"
          >
            创建项目
          </BaseButton>
        </div>
      </form>
    </BaseCard>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

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
  align-items: center;
  justify-content: flex-end;
  gap: var(--sp-3);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-border-subtle);
}

/* 按钮为什么是灰的，就写在按钮旁边（与提交里程碑页同一处理） */
.why { flex: 1; text-align: right; }

@media (max-width: 900px) {
  .actions { flex-wrap: wrap; }
  .why { flex-basis: 100%; text-align: left; }
}
</style>
