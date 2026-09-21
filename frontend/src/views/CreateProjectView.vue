<template>
  <div>
    <div class="page-header">
      <h1>Create Project</h1>
    </div>

    <div class="card" style="max-width:600px">
      <div v-if="error" class="error-banner">{{ error }}</div>

      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>Project Name</label>
          <input v-model="form.name" required placeholder="e.g. Graduation Project" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="form.description" placeholder="Brief description of the project" />
        </div>
        <div class="form-group">
          <label>Members (comma separated)</label>
          <input v-model="form.membersStr" required placeholder="alice, bob, charlie" />
        </div>
        <div class="flex flex-gap">
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? 'Creating...' : 'Create' }}
          </button>
          <router-link to="/projects" class="btn btn-secondary">Cancel</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api.js'

const router = useRouter()
const error = ref('')
const submitting = ref(false)
const form = reactive({
  name: '',
  description: '',
  membersStr: '',
})

async function handleSubmit() {
  error.value = ''
  submitting.value = true
  try {
    const members = form.membersStr.split(',').map(s => s.trim()).filter(Boolean)
    if (members.length === 0) throw new Error('At least one member required')
    const project = await api.createProject({
      name: form.name,
      description: form.description,
      members,
    })
    router.push(`/projects/${project.projectId}`)
  } catch (e) {
    error.value = e.message
  } finally {
    submitting.value = false
  }
}
</script>
