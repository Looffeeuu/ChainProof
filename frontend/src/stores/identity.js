import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const MEMBERS = ['alice', 'bob', 'charlie']

export const useIdentityStore = defineStore('identity', () => {
  const currentMember = ref(localStorage.getItem('chainproof_member') || 'alice')

  const members = MEMBERS

  const displayName = computed(() => {
    const labels = { alice: 'Alice (项目负责人)', bob: 'Bob (开发者)', charlie: 'Charlie (设计师)' }
    return labels[currentMember.value] || currentMember.value
  })

  function setMember(id) {
    currentMember.value = id
    localStorage.setItem('chainproof_member', id)
  }

  return { currentMember, members, displayName, setMember }
})
