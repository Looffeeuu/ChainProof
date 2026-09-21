<template>
  <div>
    <div class="page-header">
      <h1>Certificate Verification</h1>
    </div>

    <div class="card" style="max-width:600px">
      <p class="text-secondary text-sm mb-4">
        Enter a certificate ID to verify its authenticity on the blockchain.
      </p>

      <form @submit.prevent="handleVerify">
        <div class="form-group">
          <label>Certificate ID</label>
          <input v-model="inputId" placeholder="e.g. CP-1789971200361" />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="verifying || !inputId">
          {{ verifying ? 'Verifying...' : 'Verify' }}
        </button>
      </form>

      <div v-if="result" class="verify-result mt-4" :class="result.verificationStatus === 'VALID' ? 'valid' : 'invalid'">
        <div class="verify-status">
          <span class="verify-icon">{{ result.verificationStatus === 'VALID' ? '&#10003;' : '&#10007;' }}</span>
          <span>{{ result.verificationStatus === 'VALID' ? 'VALID' : 'NOT FOUND' }}</span>
        </div>
        <div v-if="result.certificate" class="mt-4">
          <dl class="verify-detail">
            <dt>Certificate ID</dt><dd class="mono">{{ result.certificateId }}</dd>
            <dt>Project</dt><dd><router-link :to="`/projects/${result.certificate.projectId}`">{{ result.certificate.projectId }}</router-link></dd>
            <dt>Member</dt><dd>{{ result.certificate.memberId }}</dd>
            <dt>Contribution</dt><dd>{{ result.certificate.contributionPercentage }}%</dd>
            <dt>Issued At</dt><dd>{{ formatDate(result.certificate.issuedAt) }}</dd>
            <dt>txId</dt><dd class="mono text-sm" style="word-break:break-all">{{ result.certificate.txId }}</dd>
          </dl>
        </div>
        <div v-else class="mt-4 text-secondary">
          No certificate found with ID: {{ result.certificateId }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'

const props = defineProps({ certificateId: String })
const inputId = ref('')
const verifying = ref(false)
const result = ref(null)

function formatDate(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString()
}

async function handleVerify() {
  verifying.value = true
  result.value = null
  try {
    result.value = await api.verifyCertificate(inputId.value)
  } catch (e) {
    result.value = { certificateId: inputId.value, verificationStatus: 'NOT_FOUND' }
  } finally {
    verifying.value = false
  }
}

onMounted(() => {
  if (props.certificateId) {
    inputId.value = props.certificateId
    handleVerify()
  }
})
</script>

<style scoped>
.verify-result {
  padding: 20px;
  border-radius: var(--radius);
  border: 2px solid;
}
.verify-result.valid { border-color: var(--c-success); background: #f0fdf4; }
.verify-result.invalid { border-color: var(--c-danger); background: #fef2f2; }
.verify-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
}
.verify-icon { font-size: 28px; }
.valid .verify-status { color: var(--c-success); }
.invalid .verify-status { color: var(--c-danger); }
.verify-detail { display: grid; grid-template-columns: 120px 1fr; gap: 8px; font-size: 14px; }
.verify-detail dt { color: var(--c-text-secondary); font-weight: 500; }
</style>
