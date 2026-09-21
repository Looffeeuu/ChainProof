const BASE = '/api'

async function request(method, path, { body, headers, isFormData } = {}) {
  const opts = {
    method,
    headers: {
      ...headers,
    },
  }

  const identityStore = (await import('../stores/identity.js')).useIdentityStore()
  opts.headers['X-Member-Id'] = identityStore.currentMember

  if (body) {
    if (isFormData) {
      opts.body = body
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
  }

  const res = await fetch(`${BASE}${path}`, opts)
  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`)
    err.code = data?.error?.code || 'UNKNOWN'
    err.status = res.status
    throw err
  }

  return data
}

export const api = {
  getHealth: () => request('GET', '/health'),

  getProjects: () => request('GET', '/projects'),
  createProject: (body) => request('POST', '/projects', { body }),
  getProject: (id) => request('GET', `/projects/${id}`),
  getProjectMilestones: (id) => request('GET', `/projects/${id}/milestones`),
  getProjectHistory: (id) => request('GET', `/projects/${id}/history`),
  getProjectContributions: (id) => request('GET', `/projects/${id}/contributions`),

  createMilestone: (projectId, formData) =>
    request('POST', `/projects/${projectId}/milestones`, { body: formData, isFormData: true }),
  getMilestone: (id) => request('GET', `/milestones/${id}`),
  confirmContribution: (id, decision) =>
    request('POST', `/milestones/${id}/confirmations`, { body: { decision } }),

  issueCertificate: (projectId, memberId) =>
    request('POST', `/projects/${projectId}/certificates`, { body: { memberId } }),
  getCertificates: (params) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/certificates${qs ? '?' + qs : ''}`)
  },
  getCertificate: (id) => request('GET', `/certificates/${id}`),
  verifyCertificate: (id) => request('GET', `/verify/${id}`),
}
