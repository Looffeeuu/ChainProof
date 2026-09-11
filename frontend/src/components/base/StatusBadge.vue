<script setup>
import { computed } from 'vue'

/**
 * 状态徽章。规格见 spec/01 §2.6，取值见 spec/02 §2.3。
 *
 * 两条硬要求：
 * 1. 必须同时有符号和文字（WCAG SC 1.4.1）。只靠颜色时，
 *    色觉障碍用户区分不出，投影仪的色彩还原也不可靠。
 * 2. 遇到清单外的值不静默吞掉——渲染成中性徽章并显示原始字符串，
 *    否则接口改了取值，前端会假装一切正常（spec/02 §2.3）。
 */
const props = defineProps({
  status: { type: String, required: true }
})

const MAP = {
  VERIFIED: { text: '链上已验证', mark: '●', tone: 'verified' },
  PENDING_CONFIRMATION: { text: '待确认', mark: '◐', tone: 'pending' },
  REJECTED: { text: '已拒绝', mark: '✕', tone: 'rejected' },
  // Project.status 目前只见过 ACTIVE（spec/02 §2.3）
  ACTIVE: { text: '进行中', mark: '●', tone: 'neutral' },
  // Confirmation.decision 的两个取值，与里程碑状态同形不同义
  CONFIRMED: { text: '已确认', mark: '●', tone: 'verified' },
  // Certificate.verificationStatus 的两个取值（spec/02 §2.3）。
  // 注意证书用的是 VALID 不是 VERIFIED——VERIFIED 是里程碑的状态，
  // 两者同形不同义，别混用
  VALID: { text: '证书有效', mark: '●', tone: 'verified' },
  NOT_FOUND: { text: '查无此证', mark: '○', tone: 'neutral' }
}

const view = computed(
  () => MAP[props.status] ?? { text: props.status, mark: '○', tone: 'unknown' }
)
</script>

<template>
  <span class="badge" :class="`tone--${view.tone}`" :title="status">
    <span class="mark" aria-hidden="true">{{ view.mark }}</span>
    <span>{{ view.text }}</span>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--r-sm);
  border: 1px solid currentColor;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* 描边用 currentColor，底色单独给，于是每个状态只需定两个变量 */
.tone--verified { color: var(--c-verified); background: var(--c-verified-bg); }
.tone--pending { color: var(--c-pending); background: var(--c-pending-bg); }
.tone--rejected { color: var(--c-rejected); background: var(--c-rejected-bg); }
.tone--neutral { color: var(--c-primary); background: var(--c-primary-weak); }

/* 未知取值：中性灰 + 原样显示字符串，一眼能看出是「没见过的值」而不是某种正常状态 */
.tone--unknown {
  color: var(--c-text-soft);
  background: var(--c-bg);
  font-family: var(--font-mono);
  font-weight: 400;
}

.mark { line-height: 1; }
</style>
