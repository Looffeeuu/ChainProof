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
      :description="`${route.fullPath} 不在路由表里。可能是链接拼错，或者这条记录已经不在了。`"
    />
    <p><RouterLink to="/">返回概览</RouterLink></p>
  </div>
</template>
