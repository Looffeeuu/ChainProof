<template>
  <div id="app-root">
    <nav class="navbar">
      <div class="container navbar-inner">
        <router-link to="/" class="navbar-brand">ChainProof</router-link>
        <div class="navbar-links">
          <router-link to="/">Dashboard</router-link>
          <router-link to="/projects">Projects</router-link>
          <router-link to="/certificates">Certificates</router-link>
          <router-link to="/verify">Verify</router-link>
        </div>
        <div class="identity-switcher">
          <label>Identity:</label>
          <select :value="identity.currentMember" @change="identity.setMember($event.target.value)">
            <option v-for="m in identity.members" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>
    </nav>
    <main class="container main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useIdentityStore } from './stores/identity.js'
const identity = useIdentityStore()
</script>

<style scoped>
.navbar {
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  position: sticky;
  top: 0;
  z-index: 100;
}
.navbar-inner {
  display: flex;
  align-items: center;
  height: 56px;
  gap: 32px;
}
.navbar-brand {
  font-size: 18px;
  font-weight: 700;
  color: var(--c-primary);
}
.navbar-brand:hover { text-decoration: none; }
.navbar-links {
  display: flex;
  gap: 20px;
  flex: 1;
}
.navbar-links a {
  font-size: 14px;
  font-weight: 500;
  color: var(--c-text-secondary);
  padding: 4px 0;
  border-bottom: 2px solid transparent;
}
.navbar-links a:hover,
.navbar-links a.router-link-exact-active {
  color: var(--c-primary);
  border-bottom-color: var(--c-primary);
  text-decoration: none;
}
.identity-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.identity-switcher select {
  padding: 4px 8px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  font-size: 13px;
}
.main-content { padding-top: 24px; padding-bottom: 48px; }
</style>
