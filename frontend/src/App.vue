<script setup>
const stats = [
  { label: 'Projects', value: '1' },
  { label: 'Verified milestones', value: '0' },
  { label: 'Certificates', value: '0' }
]
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">BLOCKCHAIN CONTRIBUTION VERIFICATION</p>
        <h1>ChainProof</h1>
        <p class="subtitle">Make every team contribution traceable and verifiable.</p>
      </div>
      <span class="status">Development MVP</span>
    </header>

    <section class="hero card">
      <div>
        <p class="eyebrow">COURSE PROJECT</p>
        <h2>Trusted evidence for collaborative work</h2>
        <p>
          Submit milestones, hash project files, confirm contribution claims,
          and verify the final record through Hyperledger Fabric.
        </p>
      </div>
      <div class="flow">
        <span>Submit</span><b>→</b><span>Confirm</span><b>→</b><span>Verify</span>
      </div>
    </section>

    <section class="stats">
      <article v-for="item in stats" :key="item.label" class="card stat">
        <strong>{{ item.value }}</strong>
        <span>{{ item.label }}</span>
      </article>
    </section>

    <section class="card roadmap">
      <p class="eyebrow">MVP WORKFLOW</p>
      <ol>
        <li>Create a team project</li>
        <li>Submit a milestone and calculate SHA-256</li>
        <li>Allocate member contribution percentages</li>
        <li>Collect member confirmations</li>
        <li>Write verified evidence to Fabric</li>
        <li>Generate and verify a contribution certificate</li>
      </ol>
    </section>
  </main>
</template>
