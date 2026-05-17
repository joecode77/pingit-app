<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const auth = useAuthStore()
const route = useRoute()
const menuOpen = ref(false)
const dropdownOpen = ref(false)

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Monitors', to: '/monitors' },
  { label: 'Channels', to: '/channels' },
  { label: 'Tags', to: '/tags' },
]

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

function closeAll() {
  dropdownOpen.value = false
  menuOpen.value = false
}
</script>

<template>
  <div class="app-shell">
    <!-- ── Top Navbar ─────────────────────────── -->
    <header class="navbar">
      <div class="navbar-inner">
        <!-- Logo -->
        <RouterLink to="/" class="navbar-logo">
          <img src="/images/logo-dark.png" alt="Pingit" class="logo-img" />
        </RouterLink>

        <!-- Nav links — desktop -->
        <nav class="navbar-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :class="{ 'nav-link--active': isActive(item.to) }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>

        <!-- Right side -->
        <div class="navbar-right">
          <!-- User avatar + dropdown -->
          <div class="user-menu" @click="dropdownOpen = !dropdownOpen">
            <img src="/images/user.jpg" alt="User" class="user-avatar" />
            <div class="user-info">
              <p class="user-name">{{ auth.user?.name }}</p>
            </div>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="chevron"
              :class="{ 'chevron--open': dropdownOpen }"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>

            <!-- Dropdown -->
            <div v-if="dropdownOpen" class="user-dropdown" @click.stop>
              <div class="dropdown-header">
                <img src="/images/user.jpg" alt="" class="dropdown-avatar" />
                <div>
                  <p class="dropdown-name">{{ auth.user?.name }}</p>
                  <p class="dropdown-email">{{ auth.user?.email }}</p>
                </div>
              </div>
              <div class="dropdown-divider" />
              <button class="dropdown-item dropdown-item--danger" @click="auth.logout()">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          </div>

          <!-- Mobile hamburger -->
          <button class="hamburger" @click="menuOpen = !menuOpen" aria-label="Toggle menu">
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
      </div>

      <!-- Mobile nav -->
      <div v-if="menuOpen" class="mobile-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="mobile-nav-link"
          :class="{ 'mobile-nav-link--active': isActive(item.to) }"
          @click="menuOpen = false"
        >
          {{ item.label }}
        </RouterLink>
        <div class="mobile-nav-divider" />
        <button class="mobile-nav-link mobile-nav-link--danger" @click="auth.logout()">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </header>

    <!-- Click outside to close -->
    <div v-if="dropdownOpen || menuOpen" class="backdrop" @click="closeAll" />

    <!-- ── Page Content ───────────────────────── -->
    <main class="page-main">
      <div class="page-container">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────── */
.app-shell {
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

/* ── Navbar ───────────────────────────── */
.navbar {
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar-inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px;
  height: 70px;
  display: flex;
  align-items: center;
  gap: 32px;
}

/* ── Logo ─────────────────────────────── */
.navbar-logo {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.logo-img {
  height: 30px;
}

/* ── Nav links ────────────────────────── */
.navbar-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: rgba(42, 53, 71, 0.8);
  text-decoration: none;
  text-transform: capitalize;
  text-indent: 1.25px;
  letter-spacing: normal;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  -webkit-font-smoothing: antialiased;
}

.nav-link:hover {
  color: rgb(42, 53, 71);
  background: rgba(42, 53, 71, 0.06);
}

.nav-link--active {
  color: rgb(42, 53, 71);
  font-weight: 600;
  background: rgba(42, 53, 71, 0.08);
}

.nav-link--active:hover {
  background: rgba(42, 53, 71, 0.08);
}

/* ── Right side ───────────────────────── */
.navbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  flex-shrink: 0;
}

/* ── User menu ────────────────────────── */
.user-menu {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 0.15s;
  position: relative;
  user-select: none;
}

.user-menu:hover {
  background: #f4f6f9;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a3d;
  margin: 0;
  line-height: 1;
}

.chevron {
  color: #98a4ae;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.chevron--open {
  transform: rotate(180deg);
}

/* ── Dropdown ─────────────────────────── */
.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #ffffff;
  border: 0.1px solid #e8edf2;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 12px 24px -4px;
  border-radius: 10px;
  min-width: 220px;
  overflow: hidden;
  z-index: 200;
}

.dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.dropdown-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.dropdown-name {
  font-size: 14px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0 0 2px;
  line-height: 1.2;
}

.dropdown-email {
  font-size: 12px;
  color: #98a4ae;
  margin: 0;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.dropdown-divider {
  height: 1px;
  background: #f0f4f8;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: background 0.15s;
  text-align: left;
  color: rgb(42, 53, 71);
  -webkit-font-smoothing: antialiased;
}

.dropdown-item:hover {
  background: #f4f6f9;
}

.dropdown-item--danger {
  color: #fa5a7d;
}

.dropdown-item--danger:hover {
  background: #fff0f3;
}

/* ── Backdrop ─────────────────────────── */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* ── Page content ─────────────────────── */
.page-main {
  flex: 1;
  padding: 16px 24px 28px;
}

.page-container {
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Hamburger (mobile only) ──────────── */
.hamburger {
  display: none;
  padding: 8px;
  border: none;
  background: none;
  cursor: pointer;
  color: #2a3547;
  border-radius: 8px;
  transition: background 0.15s;
}

.hamburger:hover {
  background: #f4f6f9;
}

/* ── Mobile nav ───────────────────────── */
.mobile-nav {
  display: none;
  flex-direction: column;
  padding: 12px 16px 16px;
  border-top: 1px solid #f0f4f8;
  gap: 2px;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #2a3547;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  width: 100%;
  text-align: left;
}

.mobile-nav-link:hover {
  background: rgba(42, 53, 71, 0.06);
  color: rgb(42, 53, 71);
}

.mobile-nav-link--active {
  background: rgba(42, 53, 71, 0.08);
  color: rgb(42, 53, 71);
  font-weight: 600;
}

.mobile-nav-link--danger {
  color: #fa5a7d;
}

.mobile-nav-link--danger:hover {
  background: #fff0f3;
}

.mobile-nav-divider {
  height: 1px;
  background: #f0f4f8;
  margin: 8px 0;
}

/* ── Responsive ───────────────────────── */
@media (max-width: 768px) {
  .navbar-nav {
    display: none;
  }
  .user-info {
    display: none;
  }
  .chevron {
    display: none;
  }
  .hamburger {
    display: flex;
  }
  .mobile-nav {
    display: flex;
  }
  .user-menu {
    padding: 4px;
  }
  .navbar-inner {
    gap: 16px;
  }
}

@media (max-width: 480px) {
  .page-main {
    padding: 16px 16px;
  }
}
</style>
