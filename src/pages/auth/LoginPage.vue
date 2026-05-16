<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'

const auth = useAuthStore()

const form = ref({
  email: '',
  password: '',
  remember: false,
})

const errors = ref({})
const generalError = ref(null)
const isLoading = computed(() => auth.loading)
const showPassword = ref(false)

async function handleLogin() {
  errors.value = {}
  generalError.value = null

  try {
    await auth.login(form.value)
  } catch (err) {
    if (err.response?.status === 422) {
      errors.value = err.response.data.errors || {}
    } else if (err.response?.status === 401) {
      generalError.value = err.response?.data?.message || 'Invalid credentials.'
    } else {
      generalError.value = 'Something went wrong. Please try again.'
    }
  }
}
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Left Panel — Illustration -->
    <div
      class="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden"
      style="background-color: #ecf2ff"
    >
      <!-- Logo top left -->
      <div class="absolute top-8 left-8 z-10">
        <img src="/images/logo-dark.png" alt="Pingit" class="h-8" />
      </div>

      <!-- Illustration centered -->
      <div class="flex-1 flex items-center justify-center p-16">
        <img src="/images/auth-illustration.svg" alt="" class="w-full max-w-lg" />
      </div>
    </div>

    <!-- Right Panel — Form -->
    <div class="w-full lg:w-1/2 flex items-center justify-center bg-white p-12">
      <div class="w-full max-w-md">
        <!-- Mobile Logo -->
        <div class="mb-6 lg:hidden">
          <img src="/images/logo-dark.png" alt="Pingit" class="h-8" />
        </div>

        <!-- Heading -->
        <h2 class="text-2xl font-bold mb-1" style="color: #1f2a3d">Welcome to Pingit</h2>
        <p class="text-sm mb-6" style="color: rgba(0, 0, 0, 0.87)">
          Your Uptime Monitoring Dashboard
        </p>

        <!-- Error -->
        <div
          v-if="generalError"
          class="mb-5 p-3 rounded-lg text-sm flex items-center gap-2"
          style="background-color: #fff0f3; color: #fa5a7d; border: 1px solid #ffcdd9"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {{ generalError }}
        </div>

        <form @submit.prevent="handleLogin" novalidate>
          <!-- Email -->
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-2" style="color: #2a3547">
              Username
            </label>
            <input
              v-model="form.email"
              type="email"
              placeholder="info@example.com"
              autocomplete="email"
              class="auth-input w-full px-4 py-3 rounded-lg text-sm outline-none transition-all"
              :class="errors.email ? 'input-error' : ''"
            />
            <p v-if="errors.email" class="mt-1 text-xs" style="color: #fa5a7d">
              {{ errors.email[0] }}
            </p>
          </div>

          <!-- Password -->
          <div class="mb-4">
            <label class="block text-sm font-semibold mb-2" style="color: #2a3547">
              Password
            </label>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="current-password"
                class="auth-input w-full px-4 py-3 rounded-lg text-sm outline-none transition-all pr-11"
                :class="errors.password ? 'input-error' : ''"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                style="color: #98a4ae"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="!showPassword"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg
                  v-else
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                  />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              </button>
            </div>
            <p v-if="errors.password" class="mt-1 text-xs" style="color: #fa5a7d">
              {{ errors.password[0] }}
            </p>
          </div>

          <!-- Remember + Forgot -->
          <div class="flex items-center justify-between mb-6">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                v-model="form.remember"
                type="checkbox"
                style="accent-color: #5d87ff; width: 16px; height: 16px"
              />
              <span class="text-sm" style="color: rgba(0, 0, 0, 0.87)">Remember this Device</span>
            </label>
            <a href="#" class="text-sm font-medium" style="color: #5d87ff"> Forgot Password? </a>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all"
            style="background-color: #5d87ff"
            :class="isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'"
          >
            <span v-if="isLoading" class="flex items-center justify-center gap-2">
              <svg
                class="animate-spin"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Signing in...
            </span>
            <span v-else>Sign In</span>
          </button>
        </form>

        <!-- Register -->
        <h6
          class="flex items-center gap-1 mt-6 text-sm font-medium"
          style="color: rgba(0, 0, 0, 0.87)"
        >
          New to Pingit?
          <RouterLink to="/register" class="font-medium pl-1" style="color: #5d87ff">
            Create an account
          </RouterLink>
        </h6>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-input {
  background: transparent;
  border: 1px solid #e5eaef;
  color: #1f2a3d;
}

.auth-input:focus {
  border-color: #5d87ff;
  border-width: 2px;
}

.auth-input::placeholder {
  color: #adbcc8;
}

.input-error {
  border-color: #fa5a7d;
}
</style>
