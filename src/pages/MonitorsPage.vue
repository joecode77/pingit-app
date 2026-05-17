<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMonitorsStore } from '@/stores/monitors.js'
import { monitorsApi } from '@/api/index.js'
import UptimeBar from '@/components/monitors/UptimeBar.vue'

const router = useRouter()
const monitorsStore = useMonitorsStore()

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

const search = ref('')
const statusFilter = ref('all')
const sortBy = ref('created_at')
const sortDir = ref('desc')
const showAddModal = ref(false)
const submitting = ref(false)
const formErrors = ref({})
const generalError = ref(null)
const uptimeHistories = ref({})

const form = ref({
  url: '',
  name: '',
  check_interval: 5,
  threshold: 3,
  response_time_threshold_ms: '',
  http_method: 'GET',
  follow_redirects: true,
})

// ─────────────────────────────────────────────
// Load data
// ─────────────────────────────────────────────

onMounted(async () => {
  await monitorsStore.fetchMonitors()
  await fetchAllUptimeHistories()
})

async function fetchAllUptimeHistories() {
  await Promise.all(
    monitorsStore.monitors.map(async (m) => {
      if (m.status === 'paused' || m.status === 'pending') return
      try {
        const res = await monitorsApi.dailyStats(m.id, 30)
        uptimeHistories.value[m.id] = res.data.data.map((d) => ({
          date: d.date,
          status:
            d.total_checks === 0
              ? 'no-data'
              : d.uptime_percentage === 100
                ? 'up'
                : d.uptime_percentage >= 80
                  ? 'degraded'
                  : 'down',
        }))
      } catch {
        uptimeHistories.value[m.id] = []
      }
    }),
  )
}

// ─────────────────────────────────────────────
// Computed — filtered + sorted monitors
// ─────────────────────────────────────────────

const monitors = computed(() => {
  let list = [...monitorsStore.monitors]

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (m) => (m.name || '').toLowerCase().includes(q) || m.url.toLowerCase().includes(q),
    )
  }

  if (statusFilter.value !== 'all') {
    list = list.filter((m) => m.status === statusFilter.value)
  }

  list.sort((a, b) => {
    let valA, valB
    if (sortBy.value === 'name') {
      valA = (a.name || a.url).toLowerCase()
      valB = (b.name || b.url).toLowerCase()
    } else if (sortBy.value === 'uptime_percentage') {
      valA = a.uptime_percentage ?? -1
      valB = b.uptime_percentage ?? -1
    } else {
      valA = new Date(a.last_checked_at ?? 0).getTime()
      valB = new Date(b.last_checked_at ?? 0).getTime()
    }
    if (valA < valB) return sortDir.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })

  return list
})

const statusCounts = computed(() => {
  const all = monitorsStore.monitors
  return {
    all: all.length,
    up: all.filter((m) => m.status === 'up').length,
    down: all.filter((m) => m.status === 'down').length,
    degraded: all.filter((m) => m.status === 'degraded').length,
    paused: all.filter((m) => m.status === 'paused').length,
    pending: all.filter((m) => m.status === 'pending').length,
  }
})

// ─────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────

const statusConfig = {
  up: { label: 'Up', color: '#2ea95c', bg: '#e8f8f0' },
  down: { label: 'Down', color: '#fa5a7d', bg: '#fff0f3' },
  degraded: { label: 'Degraded', color: '#ff9f43', bg: '#fff8ec' },
  paused: { label: 'Paused', color: '#98a4ae', bg: '#f3f5f7' },
  pending: { label: 'Pending', color: '#5d87ff', bg: '#ecf2ff' },
}

function getStatus(status) {
  return statusConfig[status] || statusConfig.pending
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

async function handlePauseResume(monitor) {
  if (monitor.status === 'paused') {
    await monitorsStore.resumeMonitor(monitor.id)
  } else {
    await monitorsStore.pauseMonitor(monitor.id)
  }
}

async function handleDelete(monitor) {
  if (!confirm(`Delete "${monitor.name || monitor.url}"? This cannot be undone.`)) return
  await monitorsStore.removeMonitor(monitor.id)
}

// ─────────────────────────────────────────────
// Add monitor
// ─────────────────────────────────────────────

function openAddModal() {
  form.value = {
    url: '',
    name: '',
    check_interval: 5,
    threshold: 3,
    response_time_threshold_ms: '',
    http_method: 'GET',
    follow_redirects: true,
  }
  formErrors.value = {}
  generalError.value = null
  showAddModal.value = true
}

async function handleAddMonitor() {
  formErrors.value = {}
  generalError.value = null
  submitting.value = true

  try {
    const payload = {
      url: form.value.url,
      name: form.value.name || undefined,
      check_interval: form.value.check_interval,
      threshold: form.value.threshold,
      http_method: form.value.http_method,
      follow_redirects: form.value.follow_redirects,
    }
    if (form.value.response_time_threshold_ms) {
      payload.response_time_threshold_ms = parseInt(form.value.response_time_threshold_ms)
    }

    const monitor = await monitorsStore.createMonitor(payload)
    showAddModal.value = false
    router.push(`/monitors/${monitor.id}`)
  } catch (err) {
    if (err.response?.status === 422) {
      formErrors.value = err.response.data.errors || {}
    } else {
      generalError.value = err.response?.data?.message || 'Something went wrong.'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="monitors-page">
    <!-- ── Page header ──────────────────────── -->
    <div class="page-header mb-6">
      <div class="page-header-left">
        <h1 class="page-title">Monitors</h1>
        <span class="monitor-count">{{ monitorsStore.monitors.length }}</span>
      </div>
      <button class="btn-primary" @click="openAddModal">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Monitor
      </button>
    </div>

    <!-- ── Status filter tabs ───────────────── -->
    <div class="status-tabs mb-6">
      <button
        v-for="tab in [
          { key: 'all', label: 'All' },
          { key: 'up', label: 'Up' },
          { key: 'down', label: 'Down' },
          { key: 'degraded', label: 'Degraded' },
          { key: 'paused', label: 'Paused' },
          { key: 'pending', label: 'Pending' },
        ]"
        :key="tab.key"
        class="status-tab"
        :class="{ 'status-tab--active': statusFilter === tab.key }"
        @click="statusFilter = tab.key"
      >
        {{ tab.label }}
        <span class="tab-count">{{ statusCounts[tab.key] }}</span>
      </button>
    </div>

    <!-- ── Search + Sort ────────────────────── -->
    <div class="toolbar mb-6">
      <div class="search-wrap">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#98a4ae"
          stroke-width="2"
          class="search-icon"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search by name or URL..."
          class="search-input"
        />
      </div>
      <div class="sort-wrap">
        <select v-model="sortBy" class="sort-select">
          <option value="created_at">Last Added</option>
          <option value="last_checked_at">Last Checked</option>
          <option value="name">Name</option>
          <option value="uptime_percentage">Uptime</option>
        </select>
        <button
          class="sort-dir-btn"
          @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
          :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path v-if="sortDir === 'asc'" d="M12 19V5M5 12l7-7 7 7" />
            <path v-else d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- ── Empty state ──────────────────────── -->
    <div v-if="!monitorsStore.monitors.length" class="empty-state">
      <div class="empty-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c4cdd5"
          stroke-width="1.2"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <h3 class="empty-title">No monitors yet</h3>
      <p class="empty-subtitle">Add your first URL to start monitoring its uptime</p>
      <button class="btn-primary" @click="openAddModal">Add your first monitor</button>
    </div>

    <!-- ── No results ───────────────────────── -->
    <div v-else-if="!monitors.length" class="empty-state">
      <div class="empty-icon">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c4cdd5"
          stroke-width="1.2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <h3 class="empty-title">No monitors found</h3>
      <p class="empty-subtitle">Try adjusting your search or filter</p>
    </div>

    <!-- ── Monitor cards ────────────────────── -->
    <div v-else class="monitors-grid">
      <div
        v-for="monitor in monitors"
        :key="monitor.id"
        class="monitor-card"
        @click="router.push(`/monitors/${monitor.id}`)"
      >
        <!-- Card header -->
        <div class="monitor-card-header">
          <div class="monitor-identity">
            <div
              class="status-dot"
              :class="{ 'status-dot--pulse': monitor.status === 'down' }"
              :style="{ background: getStatus(monitor.status).color }"
            />
            <div class="monitor-names">
              <p class="monitor-name">{{ monitor.name || monitor.url }}</p>
              <p v-if="monitor.name" class="monitor-url">{{ monitor.url }}</p>
            </div>
          </div>
          <span
            class="status-badge"
            :style="{
              color: getStatus(monitor.status).color,
              background: getStatus(monitor.status).bg,
            }"
            >{{ getStatus(monitor.status).label }}</span
          >
        </div>

        <!-- Stats row -->
        <div class="monitor-stats">
          <div class="monitor-stat">
            <p class="stat-value">
              {{
                monitor.uptime_percentage !== null
                  ? parseFloat(monitor.uptime_percentage).toFixed(1) + '%'
                  : '—'
              }}
            </p>
            <p class="stat-label">Uptime</p>
          </div>
          <div class="monitor-stat">
            <p class="stat-value">
              {{ monitor.last_checked_at ? formatRelativeTime(monitor.last_checked_at) : '—' }}
            </p>
            <p class="stat-label">Last Check</p>
          </div>
          <div class="monitor-stat">
            <p class="stat-value">
              {{ monitor.response_time_ms ? monitor.response_time_ms + 'ms' : '—' }}
            </p>
            <p class="stat-label">Response</p>
          </div>
          <div class="monitor-stat">
            <p class="stat-value">{{ monitor.check_interval }}m</p>
            <p class="stat-label">Interval</p>
          </div>
        </div>

        <!-- Uptime bar -->
        <div class="uptime-bar-section">
          <div class="uptime-bar-labels">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
          <UptimeBar :days="uptimeHistories[monitor.id] || []" :count="30" />
        </div>

        <!-- Actions -->
        <div class="monitor-actions" @click.stop>
          <button
            class="action-btn"
            :title="monitor.status === 'paused' ? 'Resume' : 'Pause'"
            @click="handlePauseResume(monitor)"
          >
            <svg
              v-if="monitor.status === 'paused'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <svg
              v-else
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            {{ monitor.status === 'paused' ? 'Resume' : 'Pause' }}
          </button>
          <button
            class="action-btn action-btn--danger"
            title="Delete"
            @click="handleDelete(monitor)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- ── Add Monitor Modal ─────────────────── -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Monitor</h2>
          <button class="modal-close" @click="showAddModal = false">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div v-if="generalError" class="form-error-banner">{{ generalError }}</div>

        <form @submit.prevent="handleAddMonitor" novalidate>
          <!-- URL -->
          <div class="form-group">
            <label class="form-label">URL <span class="required">*</span></label>
            <input
              v-model="form.url"
              type="url"
              placeholder="https://example.com"
              class="form-input"
              :class="{ 'form-input--error': formErrors.url }"
            />
            <p v-if="formErrors.url" class="field-error">{{ formErrors.url[0] }}</p>
          </div>

          <!-- Name -->
          <div class="form-group">
            <label class="form-label">Name <span class="optional">(optional)</span></label>
            <input v-model="form.name" type="text" placeholder="My Website" class="form-input" />
          </div>

          <!-- Check interval + Threshold -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Check Interval (mins)</label>
              <input
                v-model.number="form.check_interval"
                type="number"
                min="1"
                max="60"
                class="form-input"
                :class="{ 'form-input--error': formErrors.check_interval }"
              />
              <p v-if="formErrors.check_interval" class="field-error">
                {{ formErrors.check_interval[0] }}
              </p>
            </div>
            <div class="form-group">
              <label class="form-label">Failure Threshold</label>
              <input
                v-model.number="form.threshold"
                type="number"
                min="1"
                class="form-input"
                :class="{ 'form-input--error': formErrors.threshold }"
              />
              <p v-if="formErrors.threshold" class="field-error">{{ formErrors.threshold[0] }}</p>
            </div>
          </div>

          <!-- Response time threshold -->
          <div class="form-group">
            <label class="form-label"
              >Response Time Threshold (ms) <span class="optional">(optional)</span></label
            >
            <input
              v-model="form.response_time_threshold_ms"
              type="number"
              min="1"
              placeholder="e.g. 2000"
              class="form-input"
            />
            <p class="form-hint">Mark as degraded when response exceeds this value</p>
          </div>

          <!-- HTTP Method + Follow Redirects -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">HTTP Method</label>
              <select v-model="form.http_method" class="form-input">
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Follow Redirects</label>
              <select v-model="form.follow_redirects" class="form-input">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </div>

          <!-- Actions -->
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showAddModal = false">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="submitting">
              <svg
                v-if="submitting"
                class="spin"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {{ submitting ? 'Adding...' : 'Add Monitor' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitors-page {
  width: 100%;
}

/* ── Page header ──────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 21px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  letter-spacing: 0.154412px;
  margin: 0;
}

.monitor-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: #ecf2ff;
  color: rgb(93, 135, 255);
  font-size: 12px;
  font-weight: 700;
  border-radius: 20px;
}

/* ── Primary button ───────────────────── */
.btn-primary {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  background: rgb(93, 135, 255);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Plus Jakarta Sans', sans-serif;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.2s;
  -webkit-font-smoothing: antialiased;
}

.btn-primary:hover {
  opacity: 0.88;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  background: #f4f6f9;
  color: rgb(42, 53, 71);
  font-size: 14px;
  font-weight: 600;
  font-family: 'Plus Jakarta Sans', sans-serif;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e8edf2;
}

/* ── Status tabs ──────────────────────── */
.status-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.status-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(42, 53, 71, 0.7);
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition:
    background 0.15s,
    color 0.15s;
  -webkit-font-smoothing: antialiased;
}

.status-tab:hover {
  background: rgba(42, 53, 71, 0.06);
  color: rgb(42, 53, 71);
}

.status-tab--active {
  background: rgba(42, 53, 71, 0.08);
  color: rgb(42, 53, 71);
  font-weight: 600;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgba(42, 53, 71, 0.08);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}

.status-tab--active .tab-count {
  background: rgba(42, 53, 71, 0.12);
}

/* ── Toolbar ──────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-wrap {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 42px;
  padding: 0 16px 0 38px;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: rgb(42, 53, 71);
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: rgb(93, 135, 255);
  box-shadow: 0 0 0 3px rgba(93, 135, 255, 0.12);
}

.search-input::placeholder {
  color: #98a4ae;
}

.sort-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.sort-select {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: rgb(42, 53, 71);
  background: #ffffff;
  outline: none;
  cursor: pointer;
}

.sort-select:focus {
  border-color: rgb(93, 135, 255);
  box-shadow: 0 0 0 3px rgba(93, 135, 255, 0.12);
}

.sort-dir-btn {
  width: 42px;
  height: 42px;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  background: #ffffff;
  color: rgb(42, 53, 71);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}

.sort-dir-btn:hover {
  background: #f4f6f9;
}

/* ── Empty state ──────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  gap: 12px;
  text-align: center;
}

.empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #f4f6f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0;
}

.empty-subtitle {
  font-size: 14px;
  color: #98a4ae;
  margin: 0 0 8px;
}

/* ── Monitor cards grid ───────────────── */
.monitors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.monitor-card {
  background: #ffffff;
  border-radius: 7px;
  border: 0.1px solid #e8edf2;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 12px 24px -4px;
  padding: 20px;
  cursor: pointer;
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.monitor-card:hover {
  box-shadow:
    rgba(145, 158, 171, 0.25) 0px 0px 4px 0px,
    rgba(145, 158, 171, 0.18) 0px 16px 32px -4px;
}

/* ── Card header ──────────────────────── */
.monitor-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.monitor-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--pulse {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
}

.monitor-names {
  min-width: 0;
}

.monitor-name {
  font-size: 14px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.monitor-url {
  font-size: 12px;
  color: #98a4ae;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

/* ── Stats row ────────────────────────── */
.monitor-stats {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 12px 0;
  border-top: 1px solid #f5f7fa;
  border-bottom: 1px solid #f5f7fa;
}

.monitor-stat {
  flex: 1;
  text-align: center;
  padding: 0 8px;
  border-right: 1px solid #f0f4f8;
}

.monitor-stat:last-child {
  border-right: none;
}

.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0 0 2px;
  white-space: nowrap;
}

.stat-label {
  font-size: 11px;
  color: #98a4ae;
  margin: 0;
}

/* ── Uptime bar ───────────────────────── */
.uptime-bar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.uptime-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #98a4ae;
}

/* ── Card actions ─────────────────────── */
.monitor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  font-family: 'Plus Jakarta Sans', sans-serif;
  border: 1px solid #e8edf2;
  background: #ffffff;
  color: rgb(42, 53, 71);
  cursor: pointer;
  transition: background 0.15s;
  -webkit-font-smoothing: antialiased;
}

.action-btn:hover {
  background: #f4f6f9;
}

.action-btn--danger {
  color: #fa5a7d;
}
.action-btn--danger:hover {
  background: #fff0f3;
  border-color: #ffcdd9;
}

/* ── Modal ────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(30, 35, 50, 0.45);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: #ffffff;
  border-radius: 12px;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 24px 48px -4px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 28px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f4f6f9;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a4ae;
  transition: background 0.15s;
}

.modal-close:hover {
  background: #e8edf2;
  color: rgb(42, 53, 71);
}

.form-error-banner {
  background: #fff0f3;
  border: 1px solid #ffcdd9;
  color: #fa5a7d;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 18px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin-bottom: 6px;
  -webkit-font-smoothing: antialiased;
}

.required {
  color: #fa5a7d;
  margin-left: 2px;
}
.optional {
  color: #98a4ae;
  font-weight: 400;
}

.form-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: rgb(42, 53, 71);
  background: #ffffff;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
  -webkit-font-smoothing: antialiased;
}

.form-input:focus {
  border-color: rgb(93, 135, 255);
  box-shadow: 0 0 0 3px rgba(93, 135, 255, 0.12);
}

.form-input::placeholder {
  color: #98a4ae;
}

.form-input--error {
  border-color: #fa5a7d;
}
.form-input--error:focus {
  box-shadow: 0 0 0 3px rgba(250, 90, 125, 0.12);
}

.field-error {
  font-size: 12px;
  color: #fa5a7d;
  margin: 4px 0 0;
}

.form-hint {
  font-size: 12px;
  color: #98a4ae;
  margin: 4px 0 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f4f8;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── Responsive ───────────────────────── */
@media (max-width: 640px) {
  .monitors-grid {
    grid-template-columns: 1fr;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  .search-wrap {
    width: 100%;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .status-tabs {
    gap: 2px;
  }
  .status-tab {
    padding: 6px 10px;
    font-size: 12px;
  }
}

.mb-6 {
  margin-bottom: 24px;
}
</style>
