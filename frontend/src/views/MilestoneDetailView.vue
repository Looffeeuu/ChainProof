<template>
  <div>
    <div v-if="loading" class="loading">Loading milestone...</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <template v-else-if="milestone">
      <div class="page-header">
        <div>
          <h1>{{ milestone.title }}</h1>
          <p class="text-secondary text-sm mt-2">{{ milestone.description }}</p>
        </div>
        <StatusBadge :status="milestone.status" />
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">Milestone Info</h3>
        <dl class="detail-list">
          <dt>ID</dt><dd class="mono">{{ milestone.milestoneId }}</dd>
          <dt>Project</dt><dd><router-link :to="`/projects/${milestone.projectId}`">{{ milestone.projectId }}</router-link></dd>
          <dt>File</dt><dd>{{ milestone.fileName || '-' }}</dd>
          <dt>File Hash</dt><dd class="mono text-sm" style="word-break:break-all">{{ milestone.fileHash }}</dd>
          <dt>Created</dt><dd>{{ formatDate(milestone.createdAt) }}</dd>
          <dt>txId</dt><dd class="mono text-sm" style="word-break:break-all">{{ milestone.txId }}</dd>
        </dl>
      </div>

      <div class="card mt-4">
        <h3 style="margin-bottom:12px">Contributors</h3>
        <table class="table">
          <thead><tr><th>Member</th><th>Percentage</th><th>Decision</th><th>Time</th></tr></thead>
          <tbody>
            <tr v-for="c in milestone.contributors" :key="c.memberId">
              <td>{{ c.memberId }}</td>
              <td>{{ c.percentage }}%</td>
              <td>
                <template v-if="getConfirmation(c.memberId)">
                  <StatusBadge :status="getConfirmation(c.memberId).decision === 'CONFIRMED' ? 'VERIFIED' : 'REJECTED'" />
                </template>
                <span v-else class="badge badge-gray">Pending</span>
              </td>
              <td class="text-sm text-secondary">
                {{ getConfirmation(c.memberId) ? formatDate(getConfirmation(c.memberId).timestamp) : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="canConfirm" class="card mt-4">
        <h3 style="margin-bottom:12px">Your Confirmation</h3>
        <p class="text-sm text-secondary mb-4">
          As <strong>{{ identity.currentMember }}</strong>, review this milestone and confirm or reject.
        </p>
        <div v-if="confirmError" class="error-banner">{{ confirmError }}</div>
        <div class="flex flex-gap">
          <button class="btn btn-primary" @click="handleConfirm('CONFIRMED')" :disabled="confirming">Confirm</button>
          <button class="btn btn-danger" @click="handleConfirm('REJECTED')" :disabled="confirming">Reject</button>
        </div>
      </div>

      <div v-if="milestone.fileHash" class="card mt-4">
        <h3 style="margin-bottom:12px">Verify File Integrity</h3>
        <p class="text-sm text-secondary mb-4">
          Select the original file to verify its SHA-256 matches the on-chain hash.
        </p>
        <input type="file" @change="handleVerifyFile" />
        <div v-if="verifyResult !== null" class="mt-2" :style="{ color: verifyResult ? 'var(--c-success)' : 'var(--c-danger)' }">
          {{ verifyResult ? 'File hash matches on-chain record.' : 'File hash MISMATCH! The file may have been tampered with.' }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../services/api.js'
import { useIdentityStore } from '../stores/identity.js'
import { sha256Hex } from '../utils/hash.js'
import StatusBadge from '../components/StatusBadge.vue'

const props = defineProps({ milestoneId: String })
const identity = useIdentityStore()

const loading = ref(true)
const error = ref('')
const milestone = ref(null)
const confirming = ref(false)
const confirmError = ref('')
const verifyResult = ref(null)

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

function getConfirmation(memberId) {
  return milestone.value?.confirmations?.find(c => c.memberId === memberId)
}

const isClosed = computed(() => ['VERIFIED', 'REJECTED'].includes(milestone.value?.status))

const myConfirmation = computed(() => getConfirmation(identity.currentMember))

const isContributor = computed(() =>
  milestone.value?.contributors?.some(c => c.memberId === identity.currentMember)
)

const canConfirm = computed(() =>
  isContributor.value && !myConfirmation.value && !isClosed.value
)

async function handleConfirm(decision) {
  confirmError.value = ''
  confirming.value = true
  try {
    milestone.value = await api.confirmContribution(props.milestoneId, decision)
  } catch (e) {
    confirmError.value = e.message
  } finally {
    confirming.value = false
  }
}

async function handleVerifyFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const hash = await sha256Hex(file)
  verifyResult.value = hash === milestone.value.fileHash
}

onMounted(async () => {
  try {
    milestone.value = await api.getMilestone(props.milestoneId)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-list { display: grid; grid-template-columns: 100px 1fr; gap: 8px; font-size: 14px; }
.detail-list dt { color: var(--c-text-secondary); font-weight: 500; }
</style>
