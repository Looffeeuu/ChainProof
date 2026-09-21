<template>
  <div>
    <div class="page-header">
      <h1>Certificates</h1>
    </div>

    <div class="card mb-4">
      <div class="flex flex-gap items-center">
        <input v-model="filterProject" placeholder="Filter by projectId" style="flex:1;padding:8px 12px;border:1px solid var(--c-border);border-radius:var(--radius);font-size:14px" />
        <input v-model="filterMember" placeholder="Filter by memberId" style="flex:1;padding:8px 12px;border:1px solid var(--c-border);border-radius:var(--radius);font-size:14px" />
        <button class="btn btn-primary" @click="loadCerts">Search</button>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading certificates...</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <div v-else-if="certificates.length === 0" class="empty-state card">No certificates found.</div>
    <div v-else>
      <div class="cert-grid">
        <div v-for="c in certificates" :key="c.certificateId" class="card cert-card">
          <div class="flex justify-between items-center mb-4">
            <span class="mono text-sm">{{ c.certificateId }}</span>
            <StatusBadge :status="c.verificationStatus" />
          </div>
          <dl class="cert-detail">
            <dt>Project</dt>
            <dd><router-link :to="`/projects/${c.projectId}`">{{ c.projectId }}</router-link></dd>
            <dt>Member</dt><dd>{{ c.memberId }}</dd>
            <dt>Contribution</dt><dd>{{ c.contributionPercentage }}%</dd>
            <dt>Issued</dt><dd>{{ formatDate(c.issuedAt) }}</dd>
          </dl>
          <div class="mt-4 flex flex-gap">
            <router-link :to="`/certificates/${c.certificateId}`" class="btn btn-secondary btn-sm">Detail</router-link>
            <router-link :to="`/verify/${c.certificateId}`" class="btn btn-secondary btn-sm">Verify</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'
import StatusBadge from '../components/StatusBadge.vue'

const loading = ref(true)
const error = ref('')
const certificates = ref([])
const filterProject = ref('')
const filterMember = ref('')

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

async function loadCerts() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (filterProject.value) params.projectId = filterProject.value
    if (filterMember.value) params.memberId = filterMember.value
    const data = await api.getCertificates(params)
    certificates.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadCerts)
</script>

<style scoped>
.cert-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.cert-detail { display: grid; grid-template-columns: 110px 1fr; gap: 6px; font-size: 14px; }
.cert-detail dt { color: var(--c-text-secondary); }
</style>
