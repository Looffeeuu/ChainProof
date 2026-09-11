<script setup>
import { ref } from 'vue'
import PageHeader from '../components/base/PageHeader.vue'
import BaseButton from '../components/base/BaseButton.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseSpinner from '../components/base/BaseSpinner.vue'
import StatusBadge from '../components/base/StatusBadge.vue'
import HashText from '../components/base/HashText.vue'
import EmptyState from '../components/base/EmptyState.vue'
import ErrorNotice from '../components/base/ErrorNotice.vue'
import AsyncSection from '../components/base/AsyncSection.vue'
import { useAsync } from '../composables/useAsync.js'
import { listProjects, getProject } from '../api/projects.js'

/**
 * 组件预览页（FE-4 的验收方式）。
 * 把每个基础组件的**所有状态**摆在一屏里，改样式时一眼能看出哪个状态被改坏了。
 * 这一页不接任何数据，值全部写死在这里。
 */
const HASH = '84a8d6e4b1c2f30945ac77e0d3915bb27f4e6a18cd90b2e1a3746cf074cbcccf'

// 里程碑的三种状态 + 项目状态 + 一个故意不在清单里的值
const statuses = ['VERIFIED', 'PENDING_CONFIRMATION', 'REJECTED', 'ACTIVE', 'SOMETHING_NEW']

const submitting = ref(false)
function fakeSubmit() {
  submitting.value = true
  setTimeout(() => { submitting.value = false }, 2000)
}

const demoError = Object.assign(new Error('贡献比例总和是 97%，还差 3%。'), {
  code: 'INVALID_PERCENTAGE_SUM'
})

// 三态演示：同一段模板，靠 useAsync 给出的 loading / error / empty 切换。
// 这里刻意不解构，好让模板里看得见 demo.loading 这些值是从哪来的。
const demo = useAsync(async (mode) => {
  if (mode === 'error') return getProject('NOT-EXIST')   // 真的会抛 PROJECT_NOT_FOUND
  if (mode === 'empty') return []
  return listProjects()
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="开发用"
      title="基础组件预览"
      description="spec/01 §2.6 的组件规格落地后的样子。每个组件的全部状态都摆在这一页，改样式后对照检查。"
    />

    <BaseCard class="block">
      <template #title><h2>按钮 BaseButton</h2></template>
      <div class="row">
        <BaseButton variant="primary">主按钮</BaseButton>
        <BaseButton variant="secondary">次按钮</BaseButton>
        <BaseButton variant="ghost">文字按钮</BaseButton>
      </div>
      <div class="row">
        <BaseButton variant="primary" disabled>禁用</BaseButton>
        <BaseButton variant="secondary" disabled>禁用</BaseButton>
        <BaseButton variant="primary" loading loading-text="提交中…">提交上链</BaseButton>
      </div>
      <div class="row">
        <BaseButton variant="primary" :loading="submitting" loading-text="提交中…" @click="fakeSubmit">
          点一下看加载态（2 秒）
        </BaseButton>
      </div>
      <p class="t-small t-soft">
        加载中按钮自动禁用，挡住第二次点击。主按钮每页最多一个，这一页是例外——它在展示规格本身。
      </p>
    </BaseCard>

    <BaseCard class="block">
      <template #title><h2>状态徽章 StatusBadge</h2></template>
      <div class="row">
        <StatusBadge v-for="s in statuses" :key="s" :status="s" />
      </div>
      <p class="t-small t-soft">
        每个徽章都是符号 + 文字，不只靠颜色（WCAG SC 1.4.1）。
        最后一个 <code>SOMETHING_NEW</code> 不在 spec/02 §2.3 的清单里，
        渲染成中性徽章并原样显示字符串——接口改了取值时前端不会假装正常。
      </p>
    </BaseCard>

    <BaseCard class="block">
      <template #title><h2>哈希 HashText</h2></template>
      <div class="stack">
        <div class="row">
          <span class="t-small t-soft">行内（首尾各 8 位）：</span>
          <HashText :value="HASH" label="文件哈希" />
        </div>
        <div class="row">
          <span class="t-small t-soft">不带复制按钮：</span>
          <HashText :value="HASH" :copyable="false" />
        </div>
        <div>
          <p class="t-small t-soft">详情页完整值（每 8 位断开，可整行选中）：</p>
          <HashText :value="HASH" full label="文件哈希" />
        </div>
      </div>
      <p class="t-small t-soft">
        点复制后按钮文字变「已复制」，2 秒复原。完整值在 <code>title</code> 里，悬停可见。
      </p>
    </BaseCard>

    <BaseCard class="block">
      <template #title><h2>加载态 BaseSpinner</h2></template>
      <div class="row">
        <BaseSpinner :size="16" />
        <BaseSpinner :size="24" />
        <span class="primary-tone"><BaseSpinner :size="24" /></span>
        <span class="t-small t-soft">描边用 currentColor，跟着上下文的文字颜色走</span>
      </div>
    </BaseCard>

    <BaseCard class="block" padding="none">
      <template #title><h2>空状态 EmptyState</h2></template>
      <EmptyState
        icon="◇"
        title="这个项目还没有里程碑"
        description="提交第一个里程碑后，它会以时间线的形式出现在这里，包含文件哈希与每位成员的贡献比例。"
      >
        <template #action>
          <BaseButton variant="primary">提交里程碑</BaseButton>
        </template>
      </EmptyState>
    </BaseCard>

    <BaseCard class="block">
      <template #title><h2>错误态 ErrorNotice</h2></template>
      <div class="stack">
        <ErrorNotice :error="demoError" />
        <ErrorNotice :error="demoError" title="没能读到项目列表" retryable />
      </div>
      <p class="t-small t-soft">
        接口给的 message 原样显示，不替换成「操作失败」（spec/01 §2.6）。
        <code>code</code> 单独一行，供排查用。
      </p>
    </BaseCard>

    <BaseCard class="block">
      <template #title><h2>三态 AsyncSection + useAsync</h2></template>
      <div class="row">
        <BaseButton @click="demo.run('data')">取数据</BaseButton>
        <BaseButton @click="demo.run('empty')">取到空列表</BaseButton>
        <BaseButton @click="demo.run('error')">让它出错</BaseButton>
      </div>
      <AsyncSection
        :loading="demo.loading.value"
        :error="demo.error.value"
        :empty="demo.data.value?.length === 0"
        loading-text="正在读取项目…"
        @retry="demo.run('data')"
      >
        <template #empty>
          <EmptyState title="还没有任何项目" description="创建第一个项目后，它会出现在这里。">
            <template #action><BaseButton variant="primary">创建项目</BaseButton></template>
          </EmptyState>
        </template>
        <ul class="t-small list">
          <li v-for="p in demo.data.value ?? []" :key="p.projectId">
            {{ p.projectId }} · {{ p.name }}
          </li>
        </ul>
      </AsyncSection>
      <p class="t-small t-soft">
        点「让它出错」走的是真的失败路径（请求一个不存在的项目），不是写死的假错误。
        出错优先于空：请求失败时 data 也是空的，先判空会把一次失败说成一次正常的空。
      </p>
    </BaseCard>

    <BaseCard class="block">
      <template #title><h2>卡片 BaseCard</h2></template>
      <template #actions><BaseButton variant="ghost">操作区</BaseButton></template>
      <div class="cards">
        <BaseCard padding="tight"><p class="t-small">padding = tight</p></BaseCard>
        <BaseCard><p class="t-small">padding = normal（默认）</p></BaseCard>
        <BaseCard floating><p class="t-small">floating：大阴影、无边框，只给弹层用</p></BaseCard>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.block { margin-bottom: var(--sp-5); }

.row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.list { padding-left: var(--sp-5); display: grid; gap: var(--sp-1); }
.stack { display: grid; gap: var(--sp-4); margin-bottom: var(--sp-3); }

.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-4); }

.primary-tone { color: var(--c-primary); display: inline-flex; }

code {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 0 var(--sp-1);
  background: var(--c-bg);
  border-radius: var(--r-sm);
}

@media (max-width: 900px) {
  .cards { grid-template-columns: 1fr; }
}
</style>
