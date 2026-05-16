// src/api/index.js

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────

export const authApi = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
}

// ─────────────────────────────────────────────
// Monitors
// ─────────────────────────────────────────────

export const monitorsApi = {
  list: (params) => api.get('/api/monitors', { params }),
  create: (data) => api.post('/api/monitors', data),
  get: (id) => api.get(`/api/monitors/${id}`),
  update: (id, data) => api.put(`/api/monitors/${id}`, data),
  remove: (id) => api.delete(`/api/monitors/${id}`),
  pause: (id) => api.post(`/api/monitors/${id}/pause`),
  resume: (id) => api.post(`/api/monitors/${id}/resume`),
  history: (id, params) => api.get(`/api/monitors/${id}/history`, { params }),
  exportHistory: (id) => api.get(`/api/monitors/${id}/history/export`, { responseType: 'blob' }),
  incidents: (id) => api.get(`/api/monitors/${id}/incidents`),
  responseTimes: (id, period) =>
    api.get(`/api/monitors/${id}/response-times`, { params: { period } }),
}

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

export const dashboardApi = {
  summary: () => api.get('/api/dashboard'),
}

// ─────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────

export const tagsApi = {
  list: () => api.get('/api/tags'),
  create: (data) => api.post('/api/tags', data),
  remove: (id) => api.delete(`/api/tags/${id}`),
  attach: (monitorId, tagId) => api.post(`/api/monitors/${monitorId}/tags`, { tag_id: tagId }),
  detach: (monitorId, tagId) => api.delete(`/api/monitors/${monitorId}/tags/${tagId}`),
}

// ─────────────────────────────────────────────
// Notification Channels
// ─────────────────────────────────────────────

export const channelsApi = {
  list: (monitorId) => api.get(`/api/monitors/${monitorId}/channels`),
  create: (monitorId, data) => api.post(`/api/monitors/${monitorId}/channels`, data),
  remove: (monitorId, channelId) => api.delete(`/api/monitors/${monitorId}/channels/${channelId}`),
}

export default api
