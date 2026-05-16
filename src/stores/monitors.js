// src/stores/monitors.js

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { monitorsApi, dashboardApi } from '@/api/index.js'

export const useMonitorsStore = defineStore('monitors', () => {
  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  const monitors = ref([])
  const currentMonitor = ref(null)
  const dashboard = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────

  async function fetchMonitors(params = {}) {
    loading.value = true
    error.value = null

    try {
      const response = await monitorsApi.list(params)
      monitors.value = response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch monitors.'
    } finally {
      loading.value = false
    }
  }

  async function fetchMonitor(id) {
    loading.value = true
    error.value = null

    try {
      const response = await monitorsApi.get(id)
      currentMonitor.value = response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch monitor.'
    } finally {
      loading.value = false
    }
  }

  async function createMonitor(data) {
    loading.value = true
    error.value = null

    try {
      const response = await monitorsApi.create(data)
      monitors.value.unshift(response.data.data)
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to create monitor.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateMonitor(id, data) {
    loading.value = true
    error.value = null

    try {
      const response = await monitorsApi.update(id, data)
      const index = monitors.value.findIndex((m) => m.id === id)
      if (index !== -1) monitors.value[index] = response.data.data
      currentMonitor.value = response.data.data
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to update monitor.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function removeMonitor(id) {
    loading.value = true
    error.value = null

    try {
      await monitorsApi.remove(id)
      monitors.value = monitors.value.filter((m) => m.id !== id)
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to delete monitor.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function pauseMonitor(id) {
    try {
      const response = await monitorsApi.pause(id)
      updateMonitorInList(response.data.data)
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to pause monitor.'
      throw err
    }
  }

  async function resumeMonitor(id) {
    try {
      const response = await monitorsApi.resume(id)
      updateMonitorInList(response.data.data)
      return response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to resume monitor.'
      throw err
    }
  }

  async function fetchDashboard() {
    try {
      const response = await dashboardApi.summary()
      dashboard.value = response.data.data
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch dashboard.'
    }
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  function updateMonitorInList(updatedMonitor) {
    const index = monitors.value.findIndex((m) => m.id === updatedMonitor.id)
    if (index !== -1) monitors.value[index] = updatedMonitor
    if (currentMonitor.value?.id === updatedMonitor.id) {
      currentMonitor.value = updatedMonitor
    }
  }

  return {
    monitors,
    currentMonitor,
    dashboard,
    loading,
    error,
    fetchMonitors,
    fetchMonitor,
    createMonitor,
    updateMonitor,
    removeMonitor,
    pauseMonitor,
    resumeMonitor,
    fetchDashboard,
  }
})
