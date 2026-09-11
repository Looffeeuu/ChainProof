<script setup>
import { useRoute } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'

const route = useRoute()
</script>

<template>
  <div>
    <PageHeader
      eyebrow="404"
      title="这个地址没有对应的页面"
      :description="`${route.fullPath} 不存在。`"
    />
    <p><RouterLink to="/">返回概览</RouterLink></p>
  </div>
</template>
