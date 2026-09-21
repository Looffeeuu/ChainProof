<template>
  <div>
    <div class="page-header">
      <h1>Contribution Dashboard</h1>
      <router-link :to="`/projects/${projectId}`" class="btn btn-secondary">Back to Project</router-link>
    </div>

    <div v-if="loading" class="loading">Loading contributions...</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <template v-else-if="data">
      <div class="card">
        <p class="text-secondary text-sm">Based on {{ data.basedOnMilestones }} verified milestone(s)</p>
      </div>

      <div class="card mt-4">
        <h3 style="margin-bottom:16px">Member Contributions</h3>
        <div v-if="data.members.length === 0" class="empty-state">No verified contributions yet.</div>
        <div v-else>
          <div v-for="m in data.members" :key="m.memberId" class="contrib-bar-row">
            <div class="contrib-label">
              <span>{{ m.memberId }}</span>
              <span class="contrib-pct">{{ m.percentage }}%</span>
            </div>
            <div class="contrib-bar-bg">
              <div class="contrib-bar-fill" :style="{ width: m.percentage + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-4">
        <h3 style="margin-bottom:12px">Breakdown</h3>
        <table class="table">
          <thead><tr><th>Member</th><th>Percentage</th></tr></thead>
          <tbody>
            <tr v-for="m in data.members" :key="m.memberId">
              <td>{{ m.memberId }}</td>
              <td>{{ m.percentage }}%</td>
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

const props = defineProps({ projectId: String })
const loading = ref(true)
const error = ref('')
const data = ref(null)

onMounted(async () => {
  try {
    data.value = await api.getProjectContributions(props.projectId)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.contrib-bar-row { margin-bottom: 16px; }
.contrib-label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}
.contrib-pct { color: var(--c-primary); font-weight: 700; }
.contrib-bar-bg {
  height: 24px;
  background: #f3f4f6;
  border-radius: 12px;
  overflow: hidden;
}
.contrib-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-primary), #818cf8);
  border-radius: 12px;
  transition: width .5s ease;
  min-width: 2px;
}
</style>
