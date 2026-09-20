<script setup>
import { useRoute } from 'vue-router'
import PageHeader from '../components/base/PageHeader.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseButton from '../components/base/BaseButton.vue'
import EmptyState from '../components/base/EmptyState.vue'

const route = useRoute()
</script>

<template>
  <div>
    <PageHeader eyebrow="404" title="页面不存在" />

    <!-- 用和其他页面同一套的卡片 + 空状态：出错的一页也是这个产品的一页，
         它长得越像别的页面，用户越知道自己没有走丢 -->
    <BaseCard>
      <!-- 标题只说「哪个地址」，判断留给上面的页头，
           别在同一屏把同一件事说两遍（spec/01 §2.10 规则 2） -->
      <EmptyState
        icon="search"
        :title="route.fullPath"
        description="可能是链接抄漏了一段，或者这条记录已经不在了。"
      >
        <template #action>
          <BaseButton variant="primary" @click="$router.push('/')">返回概览</BaseButton>
        </template>
      </EmptyState>
    </BaseCard>
  </div>
</template>
