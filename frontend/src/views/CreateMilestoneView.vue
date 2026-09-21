<template>
  <div>
    <div class="page-header">
      <h1>Submit Milestone</h1>
    </div>

    <div class="card" style="max-width:640px">
      <div v-if="error" class="error-banner">{{ error }}</div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>Title</label>
          <input v-model="form.title" required placeholder="Milestone title" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="form.description" placeholder="What was delivered in this milestone" />
        </div>

        <div class="form-group">
          <label>Contributors (percentages must sum to 100)</label>
          <div v-for="(c, i) in form.contributors" :key="i" class="contributor-row">
            <input v-model="c.memberId" placeholder="memberId" required style="flex:1" />
            <input v-model.number="c.percentage" type="number" min="0" max="100" placeholder="%" required style="width:80px" />
            <button type="button" class="btn btn-secondary btn-sm" @click="removeContributor(i)" v-if="form.contributors.length > 1">x</button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm mt-2" @click="addContributor">+ Add Contributor</button>
          <div v-if="totalPercentage !== 100" class="text-sm mt-2" style="color:var(--c-danger)">
            Total: {{ totalPercentage }}% (must be 100%)
          </div>
        </div>

        <div class="form-group">
          <label>File</label>
          <input type="file" @change="handleFileChange" required />
          <div v-if="fileHash" class="text-sm text-secondary mt-2">
            SHA-256: <span class="mono">{{ fileHash }}</span>
          </div>
        </div>

        <div class="flex flex-gap">
          <button type="submit" class="btn btn-primary" :disabled="submitting || totalPercentage !== 100 || !fileHash">
            {{ submitting ? 'Submitting...' : 'Submit' }}
          </button>
          <router-link :to="`/projects/${projectId}`" class="btn btn-secondary">Cancel</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'
import { sha256Hex } from '../utils/hash.js'

const props = defineProps({ projectId: String })
const router = useRouter()

const error = ref('')
const submitting = ref(false)
const fileRef = ref(null)
const fileHash = ref('')

const form = reactive({
  title: '',
  description: '',
  contributors: [{ memberId: '', percentage: 100 }],
})

const totalPercentage = computed(() => form.contributors.reduce((s, c) => s + (Number(c.percentage) || 0), 0))

function addContributor() {
  form.contributors.push({ memberId: '', percentage: 0 })
}
function removeContributor(i) {
  form.contributors.splice(i, 1)
}

async function handleFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  fileRef.value = file
  fileHash.value = await sha256Hex(file)
}

async function handleSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('description', form.description)
    fd.append('contributors', JSON.stringify(form.contributors.map(c => ({
      memberId: c.memberId.trim(),
      percentage: Number(c.percentage),
    }))))
    fd.append('clientFileHash', fileHash.value)
    fd.append('file', fileRef.value)

    await api.createMilestone(props.projectId, fd)
    router.push(`/projects/${props.projectId}`)
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.contributor-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.contributor-row input {
  padding: 6px 10px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  font-size: 14px;
}
</style>
