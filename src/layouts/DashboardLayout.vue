<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const auth = useAuthStore()
const route = useRoute()
const sidebarOpen = ref(true)

const sections = [
  {
    label: 'HOME',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
      },
    ],
  },
  {
    label: 'MONITORING',
    items: [
      {
        label: 'Monitors',
        to: '/monitors',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
      },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      {
        label: 'Notification Channels',
        to: '/channels',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      },
      {
        label: 'Tags',
        to: '/tags',
        icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
      },
    ],
  },
]

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden" style="background: white">
    <!-- Sidebar -->
    <aside
      class="flex flex-col flex-shrink-0 transition-all duration-300"
      :style="{
        width: sidebarOpen ? '310px' : '72px',
        background: 'white',
        borderRight: '1px solid rgb(229, 234, 239)',
      }"
    >
      <!-- Logo -->
      <div class="px-6 pt-7 pb-6 flex-shrink-0">
        <img v-if="sidebarOpen" src="/images/logo-dark.png" alt="Pingit" class="h-8" />
        <img v-else src="/images/logo-dark.png" alt="Pingit" class="h-6 mx-auto" />
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto px-4">
        <template v-for="section in sections" :key="section.label">
          <!-- Nav items -->
          <RouterLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-4 px-4 rounded-xl mb-1 text-sm font-light transition-all"
            :class="!isActive(item.to) ? 'hover-nav' : ''"
            style="min-height: 45px"
            :style="
              isActive(item.to) ? 'background-color: #5d87ff; color: white;' : 'color: #2A3547;'
            "
          >
            <span class="flex-shrink-0" v-html="item.icon" />
            <span v-if="sidebarOpen" class="flex-1">{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>

      <!-- User card -->
      <div class="p-4 flex-shrink-0">
        <div class="flex items-center gap-3 px-4 py-4 rounded-xl" style="background-color: #ecf2ff">
          <!-- Avatar -->
          <img
            src="/images/user.jpg"
            alt="User"
            class="flex-shrink-0 w-10 h-10 rounded-full object-cover"
          />

          <div v-if="sidebarOpen" class="flex-1 min-w-0">
            <p class="text-base font-bold truncate" style="color: #1f2a3d">
              {{ auth.user?.name }}
            </p>
            <p class="text-sm truncate" style="color: #1f2a3d">
              {{ auth.user?.email }}
            </p>
          </div>

          <!-- Power/logout button -->
          <button
            v-if="sidebarOpen"
            @click="auth.logout()"
            class="flex-shrink-0 transition-opacity hover:opacity-70 cursor-pointer"
            style="color: #5d87ff"
            title="Sign out"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Top Navbar -->
      <header
        class="flex items-center justify-between px-6 flex-shrink-0"
        style="height: 70px; background: white"
      >
        <div class="flex items-center gap-4">
          <button
            @click="sidebarOpen = !sidebarOpen"
            class="p-2 rounded-lg transition-colors hover:bg-gray-100"
            style="color: #2a3547"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-3">
          <img
            src="/images/user.jpg"
            alt="User"
            class="w-9 h-9 rounded-full object-cover cursor-pointer"
          />
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-6" style="background: white">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.hover-nav:hover {
  background-color: #ecf2ff;
  color: #5d87ff !important;
}
</style>
