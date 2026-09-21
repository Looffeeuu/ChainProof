import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/projects',
    name: 'ProjectList',
    component: () => import('../views/ProjectListView.vue'),
  },
  {
    path: '/projects/new',
    name: 'CreateProject',
    component: () => import('../views/CreateProjectView.vue'),
  },
  {
    path: '/projects/:projectId',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetailView.vue'),
    props: true,
  },
  {
    path: '/projects/:projectId/milestones/new',
    name: 'CreateMilestone',
    component: () => import('../views/CreateMilestoneView.vue'),
    props: true,
  },
  {
    path: '/projects/:projectId/contributions',
    name: 'Contributions',
    component: () => import('../views/ContributionsView.vue'),
    props: true,
  },
  {
    path: '/milestones/:milestoneId',
    name: 'MilestoneDetail',
    component: () => import('../views/MilestoneDetailView.vue'),
    props: true,
  },
  {
    path: '/certificates',
    name: 'CertificateList',
    component: () => import('../views/CertificateListView.vue'),
  },
  {
    path: '/certificates/:certificateId',
    name: 'CertificateDetail',
    component: () => import('../views/CertificateDetailView.vue'),
    props: true,
  },
  {
    path: '/verify/:certificateId?',
    name: 'Verify',
    component: () => import('../views/VerifyView.vue'),
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
