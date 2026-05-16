// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ─────────────────────────────────────────────
    // Auth Routes
    // ─────────────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/pages/auth/RegisterPage.vue'),
      meta: { requiresGuest: true },
    },

    // ─────────────────────────────────────────────
    // App Routes (require authentication)
    // ─────────────────────────────────────────────
    {
      path: '/',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/DashboardPage.vue'),
        },
        {
          path: 'monitors',
          name: 'monitors',
          component: () => import('@/pages/MonitorsPage.vue'),
        },
        {
          path: 'monitors/:id',
          name: 'monitor-detail',
          component: () => import('@/pages/MonitorDetailPage.vue'),
        },
        {
          path: 'channels',
          name: 'channels',
          component: () => import('@/pages/ChannelsPage.vue'),
        },
        {
          path: 'tags',
          name: 'tags',
          component: () => import('@/pages/TagsPage.vue'),
        },
      ],
    },

    // ─────────────────────────────────────────────
    // Catch all — redirect to dashboard
    // ─────────────────────────────────────────────
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// ─────────────────────────────────────────────
// Navigation Guards
// ─────────────────────────────────────────────

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  const isAuthenticated = !!token

  // Route requires auth but user is not logged in
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }

  // Route requires guest but user is logged in
  if (to.meta.requiresGuest && isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
