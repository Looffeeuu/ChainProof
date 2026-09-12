<script setup>
import { computed } from 'vue'
import MemberAvatars from '../project/MemberAvatars.vue'
import { largestRemainder, sumPercentages, clampPercentage } from '../../utils/percentage.js'

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
  modelValue: { type: Array, required: true }
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
  <div class="allocator">
    <!-- 总和是这个表单最要紧的一处反馈，它一变就要播报出去，
         否则读屏用户完全不知道自己刚才那一拖把总数拖到了多少 -->
    <div class="bar-head" role="status" aria-live="polite">
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
        :style="{ width: `${Math.min(100, c.percentage)}%` }"
      ></span>
    </div>

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
            :aria-label="`${c.memberId} 的贡献比例，百分数`"
            @input="setPercentage(c.memberId, $event.target.value)"
          />
          <span class="t-small t-soft">%</span>
        </span>

        <!-- 原来这里只显示「+8」，含义全靠 title——触屏没有悬停，读屏念出来是「加八」。
             按钮上必须有说得通的文字 -->
        <button
          type="button"
          class="t-small link fill"
          :disabled="valid"
          :aria-label="`把 ${Math.abs(remaining)}% 记到 ${c.memberId} 头上`"
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

.bar-head { display: flex; align-items: center; gap: var(--sp-3); }
.total { font-size: 20px; }

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
  height: var(--sp-2);
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--c-bg);
}
.seg { height: 100%; }
.seg:nth-child(4n + 1) { background: var(--c-primary); }
.seg:nth-child(4n + 2) { background: var(--c-verified); }
.seg:nth-child(4n + 3) { background: var(--c-pending); }
.seg:nth-child(4n + 4) { background: var(--c-rejected); }

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
