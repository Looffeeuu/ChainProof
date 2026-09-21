<script setup>
import { useId } from 'vue'

/**
 * 表单字段的外壳：标签 + 说明 + 校验信息，控件本身由插槽传进来。
 *
 * 它存在的理由是「标签和控件要关联起来」这件事很容易漏。
 * label 的 for 必须等于控件的 id，否则点标签不会聚焦到输入框，
 * 读屏软件也念不出这个框是干什么的。这里用 useId 生成唯一 id，
 * 通过作用域插槽把 id 和 aria-* 一起交给调用方，漏不掉。
 */
defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false }
})

const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id" class="label">
      {{ label }}
      <span v-if="required" class="req" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only">必填</span>
    </label>

    <p v-if="hint" :id="`${id}-hint`" class="t-small t-soft">{{ hint }}</p>

    <slot
      :id="id"
      :described-by="[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined"
      :invalid="Boolean(error)"
    />

    <p v-if="error" :id="`${id}-error`" class="t-small err" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.field { display: grid; gap: var(--sp-2); }
.label { font-weight: 600; }
.req { color: var(--c-rejected); }
.err { color: var(--c-rejected); }
</style>
