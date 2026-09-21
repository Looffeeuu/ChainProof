<template>
  <div>
    <div v-if="loading" class="loading">Loading project...</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <template v-else-if="project">
      <div class="page-header">
        <div>
          <h1>{{ project.name }}</h1>
          <p class="text-secondary text-sm mt-2">{{ project.description }}</p>
        </div>
        <div class="flex flex-gap">
          <router-link :to="`/projects/${projectId}/milestones/new`" class="btn btn-primary">+ Milestone</router-link>
          <router-link :to="`/projects/${projectId}/contributions`" class="btn btn-secondary">Contributions</router-link>
        </div>
      </div>

      <div class="detail-grid">
        <div class="card">
          <h3 style="margin-bottom:12px">Project Info</h3>
          <dl class="detail-list">
            <dt>ID</dt><dd class="mono">{{ project.projectId }}</dd>
            <dt>Owner</dt><dd>{{ project.ownerId }}</dd>
            <dt>Status</dt><dd><StatusBadge :status="project.status" /></dd>
            <dt>Created</dt><dd>{{ formatDate(project.createdAt) }}</dd>
          </dl>
          <div class="mt-4">
            <strong>Members:</strong>
            <div class="member-tags mt-2">
              <span v-for="m in project.members" :key="m" class="member-tag">{{ m }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <h2 style="margin-bottom:16px">Milestones</h2>
        <div v-if="milestones.length === 0" class="empty-state">No milestones yet.</div>
        <table v-else class="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>File</th>
              <th>Created</th>
              <th>Confirmations</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in milestones" :key="m.milestoneId">
              <td>
                <router-link :to="`/milestones/${m.milestoneId}`">{{ m.title }}</router-link>
              </td>
              <td><StatusBadge :status="m.status" /></td>
              <td class="text-sm text-secondary">{{ m.fileName || '-' }}</td>
              <td class="text-sm text-secondary">{{ formatDate(m.createdAt) }}</td>
              <td class="text-sm">{{ m.confirmations?.length || 0 }} / {{ m.contributors?.length || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card mt-4">
        <div class="flex justify-between items-center" style="margin-bottom:12px">
          <h2>Certificates</h2>
          <button class="btn btn-primary btn-sm" @click="handleIssueCert" :disabled="issuing">
            {{ issuing ? 'Issuing...' : 'Issue Certificate for Me' }}
          </button>
        </div>
        <div v-if="certError" class="error-banner">{{ certError }}</div>
        <div v-if="certificates.length === 0 && !certError" class="empty-state">No certificates yet.</div>
        <table v-else class="table">
          <thead><tr><th>ID</th><th>Member</th><th>Contribution</th><th>Status</th></tr></thead>
          <tbody>
            <tr v-for="c in certificates" :key="c.certificateId">
              <td><router-link :to="`/certificates/${c.certificateId}`" class="mono text-sm">{{ c.certificateId }}</router-link></td>
              <td>{{ c.memberId }}</td>
              <td>{{ c.contributionPercentage }}%</td>
              <td><StatusBadge :status="c.verificationStatus" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'
import { useIdentityStore } from '../stores/identity.js'
import StatusBadge from '../components/StatusBadge.vue'

const props = defineProps({ projectId: String })
const identity = useIdentityStore()

const loading = ref(true)
const error = ref('')
const project = ref(null)
const milestones = ref([])
const certificates = ref([])
const issuing = ref(false)
const certError = ref('')

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

async function loadData() {
  try {
    const [p, m, c] = await Promise.all([
      api.getProject(props.projectId),
      api.getProjectMilestones(props.projectId),
      api.getCertificates({ projectId: props.projectId }).catch(() => []),
    ])
    project.value = p
    milestones.value = Array.isArray(m) ? m : []
    certificates.value = Array.isArray(c) ? c : []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleIssueCert() {
  certError.value = ''
  issuing.value = true
  try {
    await api.issueCertificate(props.projectId, identity.currentMember)
    const c = await api.getCertificates({ projectId: props.projectId })
    certificates.value = Array.isArray(c) ? c : []
  } catch (e) {
    certError.value = e.message
  } finally {
    issuing.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.detail-grid { display: grid; gap: 16px; }
.detail-list { display: grid; grid-template-columns: 100px 1fr; gap: 8px; font-size: 14px; }
.detail-list dt { color: var(--c-text-secondary); font-weight: 500; }
.member-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.member-tag {
  padding: 4px 12px;
  background: #f3f4f6;
  border-radius: 16px;
  font-size: 13px;
}
</style>
