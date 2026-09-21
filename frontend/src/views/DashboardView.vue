<template>
  <div>
    <div class="page-header">
      <h1>Dashboard</h1>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ stats.projectCount }}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.verifiedMilestones }}</div>
        <div class="stat-label">Verified Milestones</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.certificates }}</div>
        <div class="stat-label">Certificates</div>
      </div>
    </div>

    <div class="card mt-4">
      <h2 style="margin-bottom:16px">Recent Projects</h2>
      <div v-if="loading" class="loading">Loading...</div>
      <div v-else-if="projects.length === 0" class="empty-state">
        <p>No projects yet.</p>
        <router-link to="/projects/new" class="btn btn-primary mt-2">Create Project</router-link>
      </div>
      <div v-else class="project-grid">
        <ProjectCard v-for="p in projects.slice(0, 6)" :key="p.projectId" :project="p" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'
import ProjectCard from '../components/ProjectCard.vue'

const loading = ref(true)
const projects = ref([])
const stats = ref({ projectCount: 0, verifiedMilestones: 0, certificates: 0 })

onMounted(async () => {
  try {
    const [projectList, certs] = await Promise.all([
      api.getProjects(),
      api.getCertificates().catch(() => []),
    ])
    projects.value = Array.isArray(projectList) ? projectList : []
    stats.value.projectCount = projects.value.length

    let verified = 0
    for (const p of projects.value) {
      try {
        const milestones = await api.getProjectMilestones(p.projectId)
        verified += (Array.isArray(milestones) ? milestones : []).filter(m => m.status === 'VERIFIED').length
      } catch { /* skip */ }
    }
    stats.value.verifiedMilestones = verified
    stats.value.certificates = Array.isArray(certs) ? certs.length : 0
  } catch (e) {
    console.error('Dashboard load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  padding: 24px;
  text-align: center;
  box-shadow: var(--shadow);
}
.stat-value { font-size: 36px; font-weight: 700; color: var(--c-primary); }
.stat-label { font-size: 14px; color: var(--c-text-secondary); margin-top: 4px; }
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
</style>
