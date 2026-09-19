<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
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
import { MAX_FILE_LABEL, formatBytes, isTooLarge } from '../utils/file-limit.js'
import { focusFirstInvalid } from '../composables/useInvalidFocus.js'
import { setFlash } from '../stores/flash.js'

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
/**
 * 表单级的两个 ref。
 *
 * **声明位置必须在下面那个 immediate watch 之前。** 那个 watch 在 setup 阶段
 * 就会执行一次，里面用到 submitted；声明写在它后面会踩 `const` 的暂时性死区，
 * 直接 ReferenceError，整页白屏。
 *
 * 这个坑在这一个文件里连着踩了两次（先是 hashAbort，再是 submitted），
 * 而且**两次都没被自检抓到**——服务端渲染那套走不到这条带 :id 的路径。
 * 现在 check:responsive 会在真浏览器里收集控制台报错，同类问题下次会红。
 */
const formEl = ref(null)

/** 提交成功后置为 true，让离开守卫放行那一次跳转 */
const submitted = ref(false)

/**
 * 选文件时的竞态票据与取消句柄。
 *
 * **少了这两样会算错哈希，不是「体验不好」而已。** 先选一个大文件、
 * 没算完又换一个小文件时：
 *
 *   1. 小文件先算完，fileHash = hash(小)，hashing 被清成 false；
 *   2. 大文件后算完，**把 fileHash 覆盖成 hash(大)**；
 *   3. 此时 form.file 是小文件，fileHash 是大文件的哈希。
 *
 * 提交出去就是一条文件与哈希不匹配的存证记录。后端会按 spec/03 §4.2
 * 做交叉校验，但一个存证系统不该指望下游帮自己兜住这种错。
 *
 * 票据与取消各管一半：取消让已经没用的计算尽早停下（纯 JS 路径每块检查一次），
 * 票据保证**无论它停没停下，都写不进界面**（原生路径中途没有检查点，
 * 取消之后仍会跑完）。少哪一个都不够。
 *
 * 声明位置必须在下面换项目那个 watch 之前：那个 watch 是 immediate 的，
 * setup 阶段就会执行到 hashAbort?.abort()，声明在它后面会踩 TDZ
 * （`let` 的暂时性死区里连 `?.` 也救不了，直接 ReferenceError）。
 */
let hashSeq = 0
let hashAbort = null

/**
 * 换项目时，取数与**清表单**必须一起做，而且要清全
 * （title / description / file / fileHash，不只是 contributors）。
 *
 * 从 A 项目的「新里程碑」页跳到 B 项目的同一页是走得到的——浏览器前进后退，
 * 或从侧栏「最近项目」点进去再点提交。少清一个字段，A 的标题和文件就会跟着
 * 进 B 的表单，提交下去是「B 项目里一条写着 A 内容的里程碑」。
 */
watch(() => route.params.id, (id) => {
  if (!id) return
  form.title = ''
  form.description = ''
  form.file = null
  fileHash.value = ''
  hashError.value = null
  hashing.value = false
  hashAbort?.abort()
  touched.title = false
  touched.file = false
  submitted.value = false
  run(id)
}, { immediate: true })

watch(project, (p) => {
  if (!p) return
  contributors.value = p.members.map((memberId) => ({ memberId, percentage: 0 }))
})

const total = computed(() => sumPercentages(contributors.value))

/** 读取失败的说法只写一处，模板里复用它 */
const FILE_UNREADABLE = '这个文件没能读取，换一个再试。'

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
  // 最后一个分支挡的是「选了文件、哈希却没有」——用户在计算途中点了取消。
  // 少了它，这一页会放行一条 fileHash 为空的里程碑：
  // 确认页的核对区绑 v-if="milestone.fileHash"，那条记录从此无法被任何人核对，
  // 而「可核对」正是这个产品的全部主张
  file: !form.file
    ? '请选择要存证的成果文件。'
    : isTooLarge(form.file)
      ? `这个文件有 ${formatBytes(form.file.size)}，超过了单个文件 ${MAX_FILE_LABEL} 的上限。`
      : hashError.value
      ? FILE_UNREADABLE
      : !hashing.value && !fileHash.value
        ? '这个文件的 SHA-256 还没算完。重新选一次文件，等它算完再提交。'
        : '',
  contributors: total.value === 100 ? '' : `贡献比例总和必须正好是 100%，现在是 ${total.value}%。`
}))

/**
 * 「正在计算哈希」同样不能提交，但它**不是错误**，所以不走 errors——
 * 走 errors 会让输入框变红并带上 aria-invalid，读屏听到的是「这个字段填错了」。
 * 它只并进 valid，理由由下面的 blockedReason 说出来。
 */
const valid = computed(() => !hashing.value && Object.values(errors.value).every((e) => !e))

/** 按钮旁边那句「为什么现在不能提交」。第一条没满足的规则就是原因 */
const blockedReason = computed(
  () =>
    Object.values(errors.value).find((e) => e) ||
    (hashing.value ? '正在计算文件哈希，算完就能提交。' : '')
)

const submitting = ref(false)
const submitError = ref(null)


async function pickFile(event) {
  // 换文件先把上一次叫停，否则两次计算会抢同一个 fileHash
  hashAbort?.abort()
  hashAbort = new AbortController()
  const mine = ++hashSeq
  const controller = hashAbort

  const picked = event.target.files?.[0] ?? null
  form.file = picked
  touched.file = true
  fileHash.value = ''
  hashError.value = null
  // 超限的文件不算哈希：反正提交不了，而原生路径会把整个文件读进内存，
  // 几 GB 的文件能让标签页直接崩掉。拦下的理由由 errors.file 说
  if (!picked || isTooLarge(picked)) {
    hashing.value = false
    return
  }

  hashing.value = true
  hashProgress.value = 0
  try {
    // hashFile 在 https / localhost 下走浏览器原生实现，
    // 在 http 下走自带的纯 JS 版本——三种情况结果一致（utils/sha256.js）
    const hash = await hashFile(picked, {
      signal: controller.signal,
      onProgress: (r) => { if (mine === hashSeq) hashProgress.value = r }
    })
    if (mine !== hashSeq) return          // 已经有更新的一次了，这次的结果作废
    fileHash.value = hash
  } catch (e) {
    // 主动取消不是错误，不要显示成错误
    if (e?.name === 'AbortError' || mine !== hashSeq) return
    hashError.value = e
  } finally {
    if (mine === hashSeq) hashing.value = false
  }
}

/**
 * 用户主动放弃这次计算。文件留在输入框里，但没有哈希——
 * `errors.file` 会因此拦住提交（那一条分支就是为这里写的）。
 */
function cancelHashing() {
  hashAbort?.abort()
  hashSeq++            // 让正在跑的那次即使算完也写不进来
  hashing.value = false
  hashProgress.value = 0
}

/**
 * 填了一半就离开的保护。这一页的填写代价是全站最高的：
 * 标题、说明、选文件、等哈希算完、再给每个成员分配比例——
 * 误点一下侧栏「概览」全部消失，而且没有任何提示。
 *
 * 提交成功后的那次跳转不能被拦，所以要 submitted 标志；
 * 不加的话用户会在刚提交完的那一刻被自己的守卫拦一次。
 *
 * 用 window.confirm 而不是自定义弹窗：自定义模态要焦点陷阱、Esc 关闭、
 * aria-modal、返回值 Promise 化，工作量比这一条本身大得多。
 * 先用原生的把行为做对，之后真要做模态组件时统一替换。
 *
 * 换项目（同一个路由、不同的 :id）也会走这个守卫，这是对的——
 * 那同样是「这一页填的东西要没了」。用户点了确定之后，
 * 下面那个 watch 才会把表单清干净。
 */
const dirty = computed(() =>
  form.title.trim() !== '' ||
  form.description.trim() !== '' ||
  form.file !== null ||
  contributors.value.some((c) => c.percentage > 0)
)

onBeforeRouteLeave(() => {
  if (!dirty.value || submitted.value) return true
  return window.confirm('这一页填的内容还没有提交，离开就会丢失。确定离开吗？')
})

async function submit() {
  // 提交这个动作本身意味着「我填完了」，所以先把所有字段标成 touched，
  // 否则用户从没碰过的必填项不会显示错误
  touched.title = true
  touched.file = true
  if (!valid.value) {
    await focusFirstInvalid(formEl.value)
    return
  }

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
    submitted.value = true
    setFlash(`「${created.title}」已提交存证，正在等待成员确认。`)
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
    <!-- 面包屑走 PageHeader 的插槽，占眉标的位置。不要在它上面再写一行眉标，
         那是同一个位置上下两行说同一件事 -->
    <PageHeader
      title="提交里程碑"
      description="文件本身不会写进链上，写进去的是它的 SHA-256 与这份贡献声明。"
    >
      <template #breadcrumb>
        <nav class="crumbs t-small t-soft" aria-label="面包屑">
          <RouterLink to="/projects">项目</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink :to="`/projects/${route.params.id}`">{{ project?.name ?? route.params.id }}</RouterLink>
          <span aria-hidden="true">/</span>
          <span>新里程碑</span>
        </nav>
      </template>
    </PageHeader>

    <AsyncSection
      :loading="loading"
      :error="error"
      :empty="!project"
      loading-text="正在读取项目成员…"
      error-title="没能读到这个项目"
      @retry="run(route.params.id)"
    >
      <form ref="formEl" class="layout" novalidate @submit.prevent="submit">
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
              :hint="`单个文件不超过 ${MAX_FILE_LABEL}。文件会上传保存，写进链上的只有它的 SHA-256。`"
              :error="touched.file ? errors.file : ''"
            >
              <!-- aria-invalid 不能漏。focusFirstInvalid 找的就是它，
                   不写的话「文件没选」时焦点会掉到下面的比例分配器上——
                   说的是一回事，指的是另一处 -->
              <input
                :id="f.id"
                type="file"
                :aria-describedby="f.describedBy"
                :aria-invalid="f.invalid"
                @change="pickFile"
              />

              <div v-if="form.file" class="picked">
                <p class="t-small">
                  已选择 <strong>{{ form.file.name }}</strong>
                  <span class="t-soft t-nums"> · {{ formatBytes(form.file.size) }}</span>
                </p>

                <!-- 算哈希这件事对用户是可见的：他要承诺的就是这串字符，
                     不该等提交之后才第一次见到它 -->
                <p v-if="hashing" class="t-small t-soft hashing" role="status">
                  <span>正在计算 SHA-256… <span class="t-nums">{{ Math.round(hashProgress * 100) }}%</span></span>
                  <button type="button" class="cancel" @click="cancelHashing">取消</button>
                </p>
                <p v-else-if="hashError" class="t-small err">{{ FILE_UNREADABLE }}</p>
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

          <!-- invalid 让分配器在总和不等于 100 时标出一个可聚焦的落点，
               否则「只有比例不对」这一种情况下，上面那个按 aria-invalid 找元素的
               逻辑什么也找不到，表现仍然是「点了没反应」 -->
          <ContributionAllocator v-model="contributors" :invalid="Boolean(errors.contributors)" />
        </BaseCard>

        <ErrorNotice v-if="submitError" :error="submitError" title="里程碑没能提交" />

        <div class="actions">
          <p v-if="!valid" class="t-small t-soft why">{{ blockedReason }}</p>
          <BaseButton variant="ghost" :disabled="submitting" @click="router.push(`/projects/${route.params.id}`)">
            取消
          </BaseButton>
          <!-- 不写 :disabled="!valid"。禁用的提交按钮既不能点，也会挡掉 Enter 的
               隐式提交，于是 submit() 里那句 focusFirstInvalid 永远跑不到——
               校验没过时屏幕上什么也不会发生。现在按钮始终可点：
               点下去先把字段标成 touched，再把焦点送到第一个出错的控件上 -->
          <BaseButton
            type="submit"
            variant="primary"
            :loading="submitting"
            loading-text="提交中…"
          >
            提交并存证
          </BaseButton>
        </div>
      </form>
    </AsyncSection>
  </div>
</template>

<style scoped>
.crumbs { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

.layout { display: grid; gap: var(--sp-4); max-width: 720px; }

.fields { display: grid; gap: var(--sp-5); }
.count { text-align: right; }
.intro { margin-bottom: var(--sp-4); max-width: 60ch; }

.picked {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
}

.hash-line { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }

.hashing { display: flex; align-items: center; gap: var(--sp-3); }
.cancel {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--c-primary-text);
  font-size: var(--fs-small);
  font-weight: 600;
}
.cancel:hover { text-decoration: underline; }
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
