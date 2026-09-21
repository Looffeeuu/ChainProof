<template>
  <span class="badge" :class="badgeClass">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
})

const STATUS_MAP = {
  ACTIVE: { label: 'Active', class: 'badge-info' },
  PENDING_CONFIRMATION: { label: 'Pending', class: 'badge-warning' },
  VERIFIED: { label: 'Verified', class: 'badge-success' },
  REJECTED: { label: 'Rejected', class: 'badge-danger' },
  VALID: { label: 'Valid', class: 'badge-success' },
  NOT_FOUND: { label: 'Not Found', class: 'badge-gray' },
}

const badgeClass = computed(() => STATUS_MAP[props.status]?.class || 'badge-gray')
const label = computed(() => STATUS_MAP[props.status]?.label || props.status)
</script>
