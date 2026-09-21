<template>
  <div>
    <div v-if="loading" class="loading">Loading certificate...</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <template v-else-if="cert">
      <div class="page-header">
        <h1>Certificate</h1>
        <StatusBadge :status="cert.verificationStatus" />
      </div>

      <div class="cert-display card">
        <div class="cert-header">
          <h2>Contribution Certificate</h2>
          <p class="mono text-sm text-secondary">{{ cert.certificateId }}</p>
        </div>

        <div class="cert-body">
          <div class="cert-field">
            <span class="cert-label">Project</span>
            <router-link :to="`/projects/${cert.projectId}`" class="cert-value">{{ cert.projectId }}</router-link>
          </div>
          <div class="cert-field">
            <span class="cert-label">Member</span>
            <span class="cert-value">{{ cert.memberId }}</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">Contribution</span>
            <span class="cert-value cert-pct">{{ cert.contributionPercentage }}%</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">Verified Milestones</span>
            <span class="cert-value">{{ cert.milestoneIds?.join(', ') || '-' }}</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">Issued At</span>
            <span class="cert-value">{{ formatDate(cert.issuedAt) }}</span>
          </div>
          <div class="cert-field">
            <span class="cert-label">Transaction ID</span>
            <span class="cert-value mono text-sm" style="word-break:break-all">{{ cert.txId }}</span>
          </div>
        </div>

        <div class="flex flex-gap mt-4">
          <router-link :to="`/verify/${cert.certificateId}`" class="btn btn-primary">Verify</router-link>
          <router-link to="/certificates" class="btn btn-secondary">All Certificates</router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'
import StatusBadge from '../components/StatusBadge.vue'

const props = defineProps({ certificateId: String })
const loading = ref(true)
const error = ref('')
const cert = ref(null)

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

onMounted(async () => {
  try {
    cert.value = await api.getCertificate(props.certificateId)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.cert-display { max-width: 640px; }
.cert-header { border-bottom: 2px solid var(--c-primary); padding-bottom: 16px; margin-bottom: 20px; }
.cert-header h2 { font-size: 22px; color: var(--c-primary); }
.cert-body { display: grid; gap: 14px; }
.cert-field { display: flex; gap: 16px; align-items: baseline; }
.cert-label { min-width: 140px; font-size: 13px; color: var(--c-text-secondary); font-weight: 500; }
.cert-value { font-size: 15px; }
.cert-pct { font-size: 24px; font-weight: 700; color: var(--c-primary); }
</style>
