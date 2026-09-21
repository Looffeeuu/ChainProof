<template>
  <router-link :to="`/projects/${project.projectId}`" class="project-card">
    <div class="project-card-header">
      <h3>{{ project.name }}</h3>
      <span class="badge badge-info">{{ project.status }}</span>
    </div>
    <p class="project-card-desc">{{ project.description || 'No description' }}</p>
    <div class="project-card-meta">
      <span>Owner: {{ project.ownerId }}</span>
      <span>{{ project.members?.length || 0 }} members</span>
    </div>
  </router-link>
</template>

<script setup>
defineProps({
  project: { type: Object, required: true },
})
</script>

<style scoped>
.project-card {
  display: block;
  padding: 20px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: border-color .15s, box-shadow .15s;
}
.project-card:hover {
  border-color: var(--c-primary);
  box-shadow: 0 2px 8px rgba(79,70,229,.12);
  text-decoration: none;
}
.project-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.project-card-header h3 { font-size: 16px; font-weight: 600; }
.project-card-desc {
  font-size: 14px;
  color: var(--c-text-secondary);
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-card-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--c-text-secondary);
}
</style>
