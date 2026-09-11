<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './layouts/AppShell.vue'
import BareLayout from './layouts/BareLayout.vue'

/**
 * 根组件只做一件事：按路由的 meta.layout 选外壳，不写任何业务。
 *
 * 目前只有两种：默认的 AppShell（带侧栏），
 * 以及公开验证页用的 BareLayout（无侧栏，给项目外的人看）。
 */
const route = useRoute()
const layout = computed(() => (route.meta.layout === 'bare' ? BareLayout : AppShell))
</script>

<template>
  <component :is="layout" />
</template>
