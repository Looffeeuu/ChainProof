<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import MemberAvatars from '../project/MemberAvatars.vue'
import { largestRemainder, sumPercentages, clampPercentage } from '../../utils/percentage.js'
import { memberTone } from '../../utils/member-tone.js'

/**
 * 贡献比例分配器。规则见 spec/01 §2.6 末段与需求文档 FR-04：
 * 总和必须严格等于 100%，不等于时提交按钮禁用。
 *
 * 每人一个滑块 + 一个数字框，两者双向绑定同一个值：
 * 滑块用来快速调整，数字框用来填准确值。只给滑块的话填不准，
 * 只给数字框的话调起来慢。
 *
 * 全部按整数处理（spec/02 §2.5 第 1 条）——用小数会出现
 * 「界面显示 100% 但提交被接口拒绝」。
 */
const props = defineProps({
  /** [{ memberId, percentage }]，由父组件持有，这里通过 update:modelValue 回写 */
  modelValue: { type: Array, required: true },

  /**
   * 父表单认为这一组值不合格。
   *
   * 组件自己也算得出 total !== 100，为什么还要父组件传：
   * 「什么时候该把错误摆出来」是表单的事，不是控件的事——
   * 用户刚打开页面时总和当然是 0，那一刻不该是红的。
   *
   * 它同时让容器带上 data-invalid 与 tabindex，
   * 好让 composables/useInvalidFocus.js 能把焦点送过来：
   * 这一组控件里没有单一的「那个出错的输入框」，
   * 不给一个落点的话，「只有比例不对」时点提交仍然是没反应。
   */
  invalid: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const total = computed(() => sumPercentages(props.modelValue))
const remaining = computed(() => 100 - total.value)
const valid = computed(() => total.value === 100)

const hint = computed(() => {
  if (valid.value) return { text: '刚好', tone: 'verified' }
  if (remaining.value > 0) return { text: `还差 ${remaining.value}%`, tone: 'pending' }
  return { text: `超出 ${-remaining.value}%`, tone: 'rejected' }
})

/**
 * 写回一个成员的比例。
 * 取值一律过 clampPercentage：数字框里粘贴 "33.7" 或 "-5" 都要收得住。
 */
function setPercentage(memberId, raw) {
  const value = clampPercentage(raw)
  emit(
    'update:modelValue',
    props.modelValue.map((c) => (c.memberId === memberId ? { ...c, percentage: value } : c))
  )
}

/**
 * 给读屏用的播报，**拖完再说**。
 *
 * 不能把 aria-live 挂在可见的总和那一行上：拖动 range 每一帧都触发 input，
 * 读屏会被「已分配 37%…38%…39%」淹没。这里等操作停下 500ms 再播一次结论，
 * 可见的那一行照常实时更新——两者的读者不同，节奏也该不同。
 */
const announced = ref('')
let announceTimer = null

watch(total, (value) => {
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => {
    announced.value = `已分配 ${value}%，${hint.value.text}`
  }, 500)
})

onBeforeUnmount(() => clearTimeout(announceTimer))

/** 平均分配。用最大余数法，三个人会得到 34/33/33 而不是三个 33（utils/percentage.js） */
function distributeEvenly() {
  const shares = largestRemainder(props.modelValue.map(() => 1))
  emit(
    'update:modelValue',
    props.modelValue.map((c, i) => ({ ...c, percentage: shares[i] }))
  )
}

/** 把差额补给某一个人，或从他身上扣掉 */
function giveRemainderTo(memberId) {
  emit(
    'update:modelValue',
    props.modelValue.map((c) =>
      c.memberId === memberId
        ? { ...c, percentage: Math.min(100, Math.max(0, c.percentage + remaining.value)) }
        : c
    )
  )
}
</script>

<template>
  <div
    class="allocator"
    :data-invalid="invalid ? 'true' : undefined"
    :tabindex="invalid ? -1 : undefined"
  >
    <!-- 播报走下面那个隐藏的 live 区域，不挂在这一行上：
         这一行每一帧都在变，挂上去读屏会被逐帧的数字淹没 -->
    <div class="bar-head">
      <span class="t-small">
        已分配 <strong class="t-nums total">{{ total }}</strong> %
      </span>
      <span class="t-small chip" :class="`tone--${hint.tone}`">{{ hint.text }}</span>
      <button type="button" class="t-small link" @click="distributeEvenly">平均分配</button>
    </div>

    <!-- 一条总览横条：超出 100 时最后一段会被裁掉，这个"装不下"的视觉本身就是提示 -->
    <div class="bar" aria-hidden="true">
      <span
        v-for="c in modelValue"
        :key="c.memberId"
        class="seg"
        :class="`tone--${memberTone(c.memberId)}`"
        :style="{ width: `${Math.min(100, c.percentage)}%` }"
      ></span>
    </div>

    <span class="sr-only" role="status" aria-live="polite">{{ announced }}</span>

    <ul class="rows">
      <li v-for="c in modelValue" :key="c.memberId" class="row">
        <MemberAvatars :members="[c.memberId]" :size="24" />
        <span class="name">{{ c.memberId }}</span>

        <input
          class="slider"
          type="range"
          min="0"
          max="100"
          step="1"
          :value="c.percentage"
          :aria-label="`${c.memberId} 的贡献比例`"
          @input="setPercentage(c.memberId, $event.target.value)"
        />

        <span class="num">
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            class="t-nums"
            :value="c.percentage"
            :aria-label="`${c.memberId} 的贡献比例`"
            @input="setPercentage(c.memberId, $event.target.value)"
          />
          <span class="t-small t-soft">%</span>
        </span>

        <!-- 按钮上要有说得通的文字。光一个「+8」的话，触屏没有悬停看不到 title，
             读屏念出来就是「加八」 -->
        <button
          type="button"
          class="t-small link fill"
          :disabled="valid"
          :aria-label="remaining >= 0 ? `给 ${c.memberId} 补 ${remaining}%` : `从 ${c.memberId} 减 ${-remaining}%`"
          @click="giveRemainderTo(c.memberId)"
        >
          {{ remaining >= 0 ? `补 ${remaining}%` : `减 ${-remaining}%` }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.allocator { display: grid; gap: var(--sp-3); }
/* 它只在校验没过时才可聚焦，而且是被脚本送过来的，不是用户自己 Tab 到的。
   所以不画焦点框——用户并没有「选中」这一整块，画个框反而像是出了什么事。
   真正说明问题的是下面「还差 N%」那行字，它本来就是红的 */
.allocator[tabindex]:focus { outline: none; }

.bar-head { display: flex; align-items: center; gap: var(--sp-3); }
.total { font-size: var(--fs-heading); font-weight: 640; letter-spacing: -0.012em; }

.chip {
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-sm);
  border: 1px solid currentColor;
  font-weight: 600;
}
.tone--verified { color: var(--c-verified); background: var(--c-verified-bg); }
.tone--pending { color: var(--c-pending); background: var(--c-pending-bg); }
.tone--rejected { color: var(--c-rejected); background: var(--c-rejected-bg); }

.link {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--c-primary-text);
  font-weight: 600;
}
.link:disabled { color: var(--c-text-soft); cursor: not-allowed; }

.bar {
  display: flex;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--c-sunken);
  box-shadow: inset 0 0 0 1px var(--c-border-subtle);
}
/* 分段用**人物色**，不是状态色：借了状态色，绿色就同时是「链上已验证」
   和「第二位成员」，红色段会让人把某位成员读成「被拒绝」。
   而且必须按 ID 折算（utils/member-tone.js）而不是按下标，
   否则同一个人换个列表就换个颜色。 */
/* flex-shrink: 0 是必须的。不写的话 flex 会把超过 100% 的部分按比例压回容器宽度，
   三个人各 60% 画出来仍然是一条不多不少刚好填满的横条——
   「装不下」这个提示从来不会出现。写了它才真的溢出、被 .bar 的 overflow 裁掉 */
.seg { height: 100%; flex-shrink: 0; }
.tone--1 { background: var(--c-member-1); }
.tone--2 { background: var(--c-member-2); }
.tone--3 { background: var(--c-member-3); }
.tone--4 { background: var(--c-member-4); }

.rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-3); }

.row { display: flex; align-items: center; gap: var(--sp-3); }
.name { width: 72px; flex-shrink: 0; }

.slider { flex: 1; min-width: 120px; width: auto; padding: 0; accent-color: var(--c-primary); }

.num { display: flex; align-items: center; gap: var(--sp-1); flex-shrink: 0; }
.num input { width: 72px; text-align: right; }

.fill { margin-left: 0; min-width: 64px; text-align: right; flex-shrink: 0; white-space: nowrap; }

@media (max-width: 900px) {
  .row { flex-wrap: wrap; }
  .slider { order: 3; flex-basis: 100%; }
}
</style>
