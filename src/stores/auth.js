// src/stores/auth.js

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/index.js'
import router from '@/router/index.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('user')) || null)
  const token = ref(localStorage.getItem('token') || null)
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!token.value)

  async function register(data) {
    loading.value = true
    error.value = null

    try {
      const response = await authApi.register(data)
      setAuth(response.data.data)
      router.push({ name: 'dashboard' })
    } catch (err) {
      error.value = err.response?.data?.message || 'Registration failed.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function login(data) {
    loading.value = true
    error.value = null

    try {
      const response = await authApi.login(data)
      setAuth(response.data.data)
      router.push({ name: 'dashboard' })
    } catch (err) {
      error.value = err.response?.data?.message || 'Login failed.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // Silently fail
    } finally {
      clearAuth()
      router.push({ name: 'login' })
    }
  }

  function setAuth({ user: userData, token: tokenData }) {
    user.value = userData
    token.value = tokenData
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('token', tokenData)
  }

  function clearAuth() {
    user.value = null
    token.value = null
    localStorage.removeItem('user')
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    logout,
  }
})
