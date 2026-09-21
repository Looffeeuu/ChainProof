<template>
  <div>
    <div class="page-header">
      <h1>Projects</h1>
      <router-link to="/projects/new" class="btn btn-primary">+ New Project</router-link>
    </div>

    <div v-if="loading" class="loading">Loading projects...</div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <div v-else-if="projects.length === 0" class="empty-state card">
      <p>No projects yet. Create one to get started.</p>
    </div>
    <div v-else class="project-grid">
      <ProjectCard v-for="p in projects" :key="p.projectId" :project="p" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../services/api.js'
import ProjectCard from '../components/ProjectCard.vue'

const loading = ref(true)
const error = ref('')
const projects = ref([])

onMounted(async () => {
  try {
    const data = await api.getProjects()
    projects.value = Array.isArray(data) ? data : []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
</style>
