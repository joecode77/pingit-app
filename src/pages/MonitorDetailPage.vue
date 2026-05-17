<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMonitorsStore } from '@/stores/monitors.js'
import { monitorsApi, channelsApi, tagsApi } from '@/api/index.js'
import VueApexCharts from 'vue3-apexcharts'
import UptimeBar from '@/components/monitors/UptimeBar.vue'

const route = useRoute()
const router = useRouter()
const monitorsStore = useMonitorsStore()

const monitorId = computed(() => parseInt(route.params.id))

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────

const loading = ref(true)
const notFound = ref(false)
const dailyStats = ref([])
const incidents = ref([])
const history = ref([])
const historyMeta = ref({ current_page: 1, per_page: 15, total: 0 })
const historyPage = ref(1)
const historyLoading = ref(false)
const channels = ref([])
const allTags = ref([])
const responseTimePeriod = ref('7d')
const responseTimeData = ref([])
const responseTimeLoading = ref(false)

// Edit modal
const showEditModal = ref(false)
const editSubmitting = ref(false)
const editErrors = ref({})
const editForm = ref({})

// Add channel modal
const showChannelModal = ref(false)
const channelSubmitting = ref(false)
const channelErrors = ref({})
const channelForm = ref({
  type: 'email',
  value: '',
  notify_on_down: true,
  notify_on_recovery: true,
  notify_on_degraded: false,
})

// Tag attach
const showTagSelect = ref(false)
const tagAttaching = ref(false)

let refreshInterval = null

// ─────────────────────────────────────────────
// Computed
// ─────────────────────────────────────────────

const monitor = computed(() => monitorsStore.currentMonitor)

const uptimeDays = computed(() =>
  dailyStats.value.map((d) => ({
    date: d.date,
    status:
      d.total_checks === 0
        ? 'no-data'
        : d.uptime_percentage === 100
          ? 'up'
          : d.uptime_percentage >= 80
            ? 'degraded'
            : 'down',
  })),
)

const summaryStats = computed(() => {
  if (!dailyStats.value.length) return { uptime: null, avgResponse: null, totalChecks: 0 }
  const totalChecks = dailyStats.value.reduce((s, d) => s + d.total_checks, 0)
  const successChecks = dailyStats.value.reduce((s, d) => s + d.successful_checks, 0)
  const avgResponses = dailyStats.value.filter((d) => d.avg_response_ms !== null)
  const avgResponse = avgResponses.length
    ? Math.round(avgResponses.reduce((s, d) => s + d.avg_response_ms, 0) / avgResponses.length)
    : null
  return {
    uptime: totalChecks > 0 ? ((successChecks / totalChecks) * 100).toFixed(2) : null,
    avgResponse,
    totalChecks,
  }
})

const activeIncident = computed(() => incidents.value.find((i) => !i.ended_at) ?? null)

const unattachedTags = computed(() =>
  allTags.value.filter((t) => !monitor.value?.tags?.some((mt) => mt.id === t.id)),
)

// ─────────────────────────────────────────────
// Load
// ─────────────────────────────────────────────

onMounted(async () => {
  await loadAll()
  refreshInterval = setInterval(async () => {
    await monitorsStore.fetchMonitor(monitorId.value)
  }, 30000)
})

onUnmounted(() => clearInterval(refreshInterval))

async function loadAll() {
  loading.value = true
  try {
    await monitorsStore.fetchMonitor(monitorId.value)
    if (!monitor.value) {
      notFound.value = true
      return
    }

    await Promise.all([
      loadDailyStats(),
      loadResponseTimes(),
      loadIncidents(),
      loadHistory(),
      loadChannels(),
      loadTags(),
    ])
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

async function loadDailyStats() {
  const res = await monitorsApi.dailyStats(monitorId.value, 90)
  dailyStats.value = res.data.data
}

async function loadResponseTimes() {
  responseTimeLoading.value = true
  try {
    if (responseTimePeriod.value === '24h') {
      const res = await monitorsApi.history(monitorId.value, { per_page: 100 })
      const checks = res.data.data.filter((c) => c.is_up && c.response_time_ms)
      const cutoff = Date.now() - 24 * 3600 * 1000
      const bucketMs = 3600 * 1000
      const buckets = {}
      checks
        .filter((c) => new Date(c.checked_at).getTime() >= cutoff)
        .forEach((c) => {
          const bucket = Math.floor(new Date(c.checked_at).getTime() / bucketMs) * bucketMs
          if (!buckets[bucket]) buckets[bucket] = []
          buckets[bucket].push(c.response_time_ms)
        })
      responseTimeData.value = Object.entries(buckets)
        .map(([t, vals]) => ({
          x: parseInt(t) + bucketMs / 2,
          y: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        }))
        .sort((a, b) => a.x - b.x)
    } else {
      const days = responseTimePeriod.value === '7d' ? 7 : 30
      const res = await monitorsApi.dailyStats(monitorId.value, days)
      responseTimeData.value = res.data.data
        .filter((d) => d.avg_response_ms !== null)
        .map((d) => ({
          x: new Date(`${d.date}T12:00:00`).getTime(),
          y: Math.round(d.avg_response_ms),
        }))
    }
  } finally {
    responseTimeLoading.value = false
  }
}

async function loadIncidents() {
  const res = await monitorsApi.incidents(monitorId.value)
  incidents.value = res.data.data
}

async function loadHistory(page = 1) {
  historyLoading.value = true
  try {
    const res = await monitorsApi.history(monitorId.value, { per_page: 15, page })
    history.value = res.data.data
    historyMeta.value = res.data.meta
    historyPage.value = page
  } finally {
    historyLoading.value = false
  }
}

async function loadChannels() {
  const res = await channelsApi.list(monitorId.value)
  channels.value = res.data.data
}

async function loadTags() {
  const res = await tagsApi.list()
  allTags.value = res.data.data
}

async function changePeriod(period) {
  responseTimePeriod.value = period
  await loadResponseTimes()
}

// ─────────────────────────────────────────────
// Response time chart options
// ─────────────────────────────────────────────

const responseTimeSeries = computed(() =>
  responseTimeData.value.length ? [{ name: 'Response Time', data: responseTimeData.value }] : [],
)

const responseTimeOptions = computed(() => ({
  chart: {
    type: 'area',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true, speed: 600 },
    zoom: { enabled: false },
    redrawOnWindowResize: true,
    redrawOnParentResize: true,
  },
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.05, stops: [0, 100] },
  },
  colors: ['rgb(93, 135, 255)'],
  dataLabels: { enabled: false },
  markers: { size: 0 },
  legend: { show: false },
  xaxis: {
    type: 'datetime',
    tickAmount: responseTimePeriod.value === '24h' ? 6 : responseTimePeriod.value === '7d' ? 7 : 10,
    labels: {
      style: { colors: '#98a4ae', fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif' },
      datetimeUTC: false,
      formatter: (val) => {
        const date = new Date(val)
        if (responseTimePeriod.value === '24h')
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        if (responseTimePeriod.value === '7d')
          return date.toLocaleDateString([], { weekday: 'short' })
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { colors: '#98a4ae', fontSize: '11px', fontFamily: 'Plus Jakarta Sans, sans-serif' },
      formatter: (val) => `${Math.round(val)}ms`,
    },
    min: 0,
  },
  grid: { borderColor: '#f0f4f8', strokeDashArray: 4, padding: { left: 0, right: 0 } },
  tooltip: {
    theme: 'dark',
    x: { format: 'dd MMM HH:mm' },
    style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px' },
    fillSeriesColor: false,
    y: { formatter: (val) => `${Math.round(val)}ms` },
  },
}))

// ─────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────

async function handlePauseResume() {
  if (monitor.value.status === 'paused') {
    await monitorsStore.resumeMonitor(monitorId.value)
  } else {
    await monitorsStore.pauseMonitor(monitorId.value)
  }
}

async function handleDelete() {
  if (!confirm(`Delete "${monitor.value.name || monitor.value.url}"? This cannot be undone.`))
    return
  await monitorsStore.removeMonitor(monitorId.value)
  router.push('/monitors')
}

function openEditModal() {
  editForm.value = {
    name: monitor.value.name || '',
    check_interval: monitor.value.check_interval,
    threshold: monitor.value.threshold,
    response_time_threshold_ms: monitor.value.response_time_threshold_ms || '',
    http_method: monitor.value.http_method,
    follow_redirects: monitor.value.follow_redirects,
  }
  editErrors.value = {}
  showEditModal.value = true
}

async function handleEdit() {
  editErrors.value = {}
  editSubmitting.value = true
  try {
    await monitorsStore.updateMonitor(monitorId.value, {
      name: editForm.value.name || undefined,
      check_interval: editForm.value.check_interval,
      threshold: editForm.value.threshold,
      response_time_threshold_ms: editForm.value.response_time_threshold_ms || undefined,
      http_method: editForm.value.http_method,
      follow_redirects: editForm.value.follow_redirects,
    })
    showEditModal.value = false
  } catch (err) {
    if (err.response?.status === 422) editErrors.value = err.response.data.errors || {}
  } finally {
    editSubmitting.value = false
  }
}

async function handleAddChannel() {
  channelErrors.value = {}
  channelSubmitting.value = true
  try {
    const res = await channelsApi.create(monitorId.value, channelForm.value)
    channels.value.unshift(res.data.data)
    showChannelModal.value = false
    channelForm.value = {
      type: 'email',
      value: '',
      notify_on_down: true,
      notify_on_recovery: true,
      notify_on_degraded: false,
    }
  } catch (err) {
    if (err.response?.status === 422) channelErrors.value = err.response.data.errors || {}
  } finally {
    channelSubmitting.value = false
  }
}

async function handleDeleteChannel(channelId) {
  await channelsApi.remove(monitorId.value, channelId)
  channels.value = channels.value.filter((c) => c.id !== channelId)
}

async function handleAttachTag(tagId) {
  tagAttaching.value = true
  try {
    await tagsApi.attach(monitorId.value, tagId)
    await monitorsStore.fetchMonitor(monitorId.value)
    showTagSelect.value = false
  } finally {
    tagAttaching.value = false
  }
}

async function handleDetachTag(tagId) {
  await tagsApi.detach(monitorId.value, tagId)
  await monitorsStore.fetchMonitor(monitorId.value)
}

async function handleExportCsv() {
  const res = await monitorsApi.exportHistory(monitorId.value)
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `monitor-${monitorId.value}-history.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────
// Helpers
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

function formatDuration(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="detail-page">
    <!-- ── Loading ───────────────────────────── -->
    <div v-if="loading" class="loading-state">
      <div v-for="i in 4" :key="i" class="skeleton-card" />
    </div>

    <!-- ── Not found ─────────────────────────── -->
    <div v-else-if="notFound" class="empty-state">
      <h3 class="empty-title">Monitor not found</h3>
      <p class="empty-subtitle">This monitor may have been deleted or doesn't belong to you</p>
      <button class="btn-secondary" @click="router.push('/monitors')">Back to Monitors</button>
    </div>

    <template v-else-if="monitor">
      <!-- ── Page header ──────────────────────── -->
      <div class="page-header mb-6">
        <div class="header-left">
          <button class="back-btn" @click="router.push('/monitors')">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div>
            <div class="header-title-row">
              <h1 class="page-title">{{ monitor.name || monitor.url }}</h1>
              <span
                class="status-badge"
                :style="{
                  color: getStatus(monitor.status).color,
                  background: getStatus(monitor.status).bg,
                }"
                >{{ getStatus(monitor.status).label }}</span
              >
            </div>
            <p v-if="monitor.name" class="header-url">{{ monitor.url }}</p>
            <p class="header-meta">
              Last checked {{ formatRelativeTime(monitor.last_checked_at) }}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" @click="openEditModal">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button class="btn-secondary" @click="handlePauseResume">
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
          <button class="btn-danger" @click="handleDelete">
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

      <!-- ── Hero: 90-day uptime bar ──────────── -->
      <div class="card mb-6">
        <div class="uptime-hero">
          <div class="uptime-hero-header">
            <div>
              <h3 class="card-title">Uptime</h3>
              <p class="card-subtitle">Last 90 days</p>
            </div>
            <div class="uptime-hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value" :style="{ color: 'rgb(93, 135, 255)' }">
                  {{ summaryStats.uptime ? summaryStats.uptime + '%' : '—' }}
                </span>
                <span class="hero-stat-label">90-day uptime</span>
              </div>
              <div class="hero-stat" v-if="activeIncident">
                <span class="hero-stat-value" style="color: #fa5a7d">Ongoing</span>
                <span class="hero-stat-label">Active incident</span>
              </div>
            </div>
          </div>
          <div class="uptime-bar-labels">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
          <UptimeBar :days="uptimeDays" :count="90" />
        </div>
      </div>

      <!-- ── Row 1: Key stats ──────────────────── -->
      <div class="grid-stats mb-6">
        <div class="card stat-card">
          <p class="stat-label">Uptime (90d)</p>
          <p class="stat-value" style="color: rgb(93, 135, 255)">
            {{ summaryStats.uptime ? summaryStats.uptime + '%' : '—' }}
          </p>
        </div>
        <div class="card stat-card">
          <p class="stat-label">Avg Response</p>
          <p class="stat-value" style="color: rgb(42, 53, 71)">
            {{ summaryStats.avgResponse ? summaryStats.avgResponse + 'ms' : '—' }}
          </p>
        </div>
        <div class="card stat-card">
          <p class="stat-label">Total Checks</p>
          <p class="stat-value" style="color: rgb(42, 53, 71)">
            {{ summaryStats.totalChecks.toLocaleString() }}
          </p>
        </div>
        <div class="card stat-card">
          <p class="stat-label">Check Interval</p>
          <p class="stat-value" style="color: rgb(42, 53, 71)">{{ monitor.check_interval }}m</p>
        </div>
        <div class="card stat-card">
          <p class="stat-label">SSL</p>
          <p
            class="stat-value"
            :style="{
              color: monitor.ssl_valid
                ? '#2ea95c'
                : monitor.ssl_valid === false
                  ? '#fa5a7d'
                  : '#98a4ae',
            }"
          >
            {{
              monitor.ssl_valid === true
                ? `${monitor.ssl_days_remaining}d left`
                : monitor.ssl_valid === false
                  ? 'Invalid'
                  : '—'
            }}
          </p>
        </div>
      </div>

      <!-- ── Row 2: Response time chart ───────── -->
      <div class="card mb-6">
        <div class="card-header">
          <div>
            <h3 class="card-title">Response Time</h3>
            <p class="card-subtitle">Average response time over time</p>
          </div>
          <div class="period-tabs">
            <button
              v-for="p in ['24h', '7d', '30d']"
              :key="p"
              class="period-tab"
              :class="{ 'period-tab--active': responseTimePeriod === p }"
              @click="changePeriod(p)"
            >
              {{ p }}
            </button>
          </div>
        </div>
        <div v-if="responseTimeLoading" class="chart-placeholder">Loading...</div>
        <div v-else-if="!responseTimeSeries.length" class="chart-placeholder">
          No response time data yet
        </div>
        <VueApexCharts
          v-else
          type="area"
          height="240"
          :series="responseTimeSeries"
          :options="responseTimeOptions"
        />
      </div>

      <!-- ── Row 3: Incidents + SSL/DNS ───────── -->
      <div class="grid-two mb-6">
        <!-- Incidents -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Incidents</h3>
              <p class="card-subtitle">{{ incidents.length }} total</p>
            </div>
            <span v-if="activeIncident" class="badge-danger">1 active</span>
          </div>
          <div v-if="!incidents.length" class="section-empty">
            <p>No incidents recorded</p>
          </div>
          <div v-else class="incidents-list">
            <div v-for="incident in incidents" :key="incident.id" class="incident-row">
              <div
                class="incident-indicator"
                :class="{ 'incident-indicator--active': incident.is_ongoing }"
              />
              <div class="incident-info">
                <p class="incident-started">{{ formatDateTime(incident.started_at) }}</p>
                <p class="incident-duration">
                  {{ incident.is_ongoing ? 'Ongoing' : formatDuration(incident.duration_seconds) }}
                </p>
              </div>
              <span v-if="incident.is_ongoing" class="badge-danger-sm">Active</span>
              <span v-else class="badge-resolved">Resolved</span>
            </div>
          </div>
        </div>

        <!-- SSL + Config -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Configuration</h3>
              <p class="card-subtitle">Monitor settings</p>
            </div>
          </div>
          <div class="config-list">
            <div class="config-row">
              <span class="config-label">URL</span>
              <a :href="monitor.url" target="_blank" class="config-value config-value--link">{{
                monitor.url
              }}</a>
            </div>
            <div class="config-row">
              <span class="config-label">Check Interval</span>
              <span class="config-value">{{ monitor.check_interval }} minutes</span>
            </div>
            <div class="config-row">
              <span class="config-label">Failure Threshold</span>
              <span class="config-value">{{ monitor.threshold }} consecutive failures</span>
            </div>
            <div class="config-row">
              <span class="config-label">Response Threshold</span>
              <span class="config-value">{{
                monitor.response_time_threshold_ms
                  ? monitor.response_time_threshold_ms + 'ms'
                  : 'Not set'
              }}</span>
            </div>
            <div class="config-row">
              <span class="config-label">HTTP Method</span>
              <span class="config-value">{{ monitor.http_method }}</span>
            </div>
            <div class="config-row">
              <span class="config-label">Follow Redirects</span>
              <span class="config-value">{{ monitor.follow_redirects ? 'Yes' : 'No' }}</span>
            </div>
            <div v-if="monitor.ssl_check_enabled" class="config-row">
              <span class="config-label">SSL Expires</span>
              <span
                class="config-value"
                :style="{
                  color:
                    monitor.ssl_days_remaining <= 14
                      ? '#fa5a7d'
                      : monitor.ssl_days_remaining <= 30
                        ? '#ff9f43'
                        : '#2ea95c',
                }"
              >
                {{
                  monitor.ssl_expires_at
                    ? formatDateTime(monitor.ssl_expires_at) + ` (${monitor.ssl_days_remaining}d)`
                    : '—'
                }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Row 4: Check history ──────────────── -->
      <div class="card mb-6">
        <div class="card-header">
          <div>
            <h3 class="card-title">Check History</h3>
            <p class="card-subtitle">{{ historyMeta.total.toLocaleString() }} total checks</p>
          </div>
          <button class="btn-secondary btn-sm" @click="handleExportCsv">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>

        <div v-if="historyLoading" class="chart-placeholder">Loading...</div>
        <div v-else-if="!history.length" class="section-empty"><p>No checks yet</p></div>
        <div v-else>
          <div class="history-table-wrap">
            <table class="history-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Code</th>
                  <th>Response</th>
                  <th>DNS</th>
                  <th>Checked At</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="check in history" :key="check.id">
                  <td>
                    <span
                      class="check-status"
                      :class="check.is_up ? 'check-status--up' : 'check-status--down'"
                    >
                      {{ check.is_up ? 'Up' : 'Down' }}
                    </span>
                  </td>
                  <td class="code-cell">{{ check.status_code || '—' }}</td>
                  <td class="muted">
                    {{ check.response_time_ms ? check.response_time_ms + 'ms' : '—' }}
                  </td>
                  <td class="muted">
                    {{ check.dns_resolution_ms ? check.dns_resolution_ms + 'ms' : '—' }}
                  </td>
                  <td class="muted">{{ formatDateTime(check.checked_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="pagination">
            <button
              class="page-btn"
              :disabled="historyPage === 1"
              @click="loadHistory(historyPage - 1)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span class="page-info"
              >Page {{ historyPage }} of
              {{ Math.ceil(historyMeta.total / historyMeta.per_page) }}</span
            >
            <button
              class="page-btn"
              :disabled="historyPage >= Math.ceil(historyMeta.total / historyMeta.per_page)"
              @click="loadHistory(historyPage + 1)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Row 5: Notification channels ─────── -->
      <div class="card mb-6">
        <div class="card-header">
          <div>
            <h3 class="card-title">Notification Channels</h3>
            <p class="card-subtitle">Who gets alerted</p>
          </div>
          <button class="btn-primary btn-sm" @click="showChannelModal = true">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Channel
          </button>
        </div>
        <div v-if="!channels.length" class="section-empty">
          <p>No notification channels configured</p>
        </div>
        <div v-else class="channels-list">
          <div v-for="channel in channels" :key="channel.id" class="channel-row">
            <div
              class="channel-type-icon"
              :class="
                channel.type === 'email' ? 'channel-type-icon--email' : 'channel-type-icon--webhook'
              "
            >
              <svg
                v-if="channel.type === 'email'"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                />
                <polyline points="22,6 12,13 2,6" />
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
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>
            <div class="channel-info">
              <p class="channel-value">{{ channel.value }}</p>
              <div class="channel-flags">
                <span v-if="channel.notify_on_down" class="flag flag--down">Down</span>
                <span v-if="channel.notify_on_recovery" class="flag flag--up">Recovery</span>
                <span v-if="channel.notify_on_degraded" class="flag flag--degraded">Degraded</span>
              </div>
            </div>
            <button class="delete-btn" @click="handleDeleteChannel(channel.id)">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Row 6: Tags ───────────────────────── -->
      <div class="card mb-6">
        <div class="card-header">
          <div>
            <h3 class="card-title">Tags</h3>
            <p class="card-subtitle">Organise this monitor</p>
          </div>
          <div class="tag-add-wrap">
            <button class="btn-secondary btn-sm" @click="showTagSelect = !showTagSelect">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Tag
            </button>
            <div v-if="showTagSelect" class="tag-dropdown">
              <div v-if="!unattachedTags.length" class="tag-dropdown-empty">All tags attached</div>
              <button
                v-for="tag in unattachedTags"
                :key="tag.id"
                class="tag-dropdown-item"
                :disabled="tagAttaching"
                @click="handleAttachTag(tag.id)"
              >
                {{ tag.name }}
              </button>
            </div>
          </div>
        </div>
        <div class="tags-wrap">
          <div v-if="!monitor.tags?.length" class="section-empty"><p>No tags attached</p></div>
          <div v-else class="tags-list">
            <span v-for="tag in monitor.tags" :key="tag.id" class="tag-chip">
              {{ tag.name }}
              <button class="tag-remove" @click="handleDetachTag(tag.id)">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Edit Modal ─────────────────────────── -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Edit Monitor</h2>
          <button class="modal-close" @click="showEditModal = false">
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
        <form @submit.prevent="handleEdit" novalidate>
          <div class="form-group">
            <label class="form-label">Name <span class="optional">(optional)</span></label>
            <input
              v-model="editForm.name"
              type="text"
              placeholder="My Website"
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Check Interval (mins)</label>
              <input
                v-model.number="editForm.check_interval"
                type="number"
                min="1"
                max="60"
                class="form-input"
                :class="{ 'form-input--error': editErrors.check_interval }"
              />
              <p v-if="editErrors.check_interval" class="field-error">
                {{ editErrors.check_interval[0] }}
              </p>
            </div>
            <div class="form-group">
              <label class="form-label">Failure Threshold</label>
              <input
                v-model.number="editForm.threshold"
                type="number"
                min="1"
                class="form-input"
                :class="{ 'form-input--error': editErrors.threshold }"
              />
              <p v-if="editErrors.threshold" class="field-error">{{ editErrors.threshold[0] }}</p>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label"
              >Response Time Threshold (ms) <span class="optional">(optional)</span></label
            >
            <input
              v-model="editForm.response_time_threshold_ms"
              type="number"
              min="1"
              placeholder="e.g. 2000"
              class="form-input"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">HTTP Method</label>
              <select v-model="editForm.http_method" class="form-input">
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Follow Redirects</label>
              <select v-model="editForm.follow_redirects" class="form-input">
                <option :value="true">Yes</option>
                <option :value="false">No</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showEditModal = false">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="editSubmitting">
              {{ editSubmitting ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Add Channel Modal ──────────────────── -->
    <div v-if="showChannelModal" class="modal-overlay" @click.self="showChannelModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Notification Channel</h2>
          <button class="modal-close" @click="showChannelModal = false">
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
        <form @submit.prevent="handleAddChannel" novalidate>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select v-model="channelForm.type" class="form-input">
              <option value="email">Email</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{
              channelForm.type === 'email' ? 'Email Address' : 'Webhook URL'
            }}</label>
            <input
              v-model="channelForm.value"
              :type="channelForm.type === 'email' ? 'email' : 'url'"
              :placeholder="
                channelForm.type === 'email' ? 'alerts@example.com' : 'https://hooks.slack.com/...'
              "
              class="form-input"
              :class="{ 'form-input--error': channelErrors.value }"
            />
            <p v-if="channelErrors.value" class="field-error">{{ channelErrors.value[0] }}</p>
          </div>
          <div class="form-group">
            <label class="form-label">Notify on</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input v-model="channelForm.notify_on_down" type="checkbox" />
                Down
              </label>
              <label class="checkbox-label">
                <input v-model="channelForm.notify_on_recovery" type="checkbox" />
                Recovery
              </label>
              <label class="checkbox-label">
                <input v-model="channelForm.notify_on_degraded" type="checkbox" />
                Degraded
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showChannelModal = false">
              Cancel
            </button>
            <button type="submit" class="btn-primary" :disabled="channelSubmitting">
              {{ channelSubmitting ? 'Adding...' : 'Add Channel' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-page {
  width: 100%;
}

/* ── Cards ────────────────────────────── */
.card {
  background: #ffffff;
  border-radius: 7px;
  border: 0.1px solid #e8edf2;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 12px 24px -4px;
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.card-title {
  font-size: 21px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  letter-spacing: 0.154412px;
  line-height: 25.6px;
  margin: 0;
}

.card-subtitle {
  font-size: 14px;
  font-weight: 400;
  color: rgb(42, 53, 71);
  letter-spacing: 0.13125px;
  margin: 4px 0 0;
}

/* ── Page header ──────────────────────── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  background: #ffffff;
  color: rgb(42, 53, 71);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
  transition: background 0.15s;
}

.back-btn:hover {
  background: #f4f6f9;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  font-size: 21px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0;
}

.header-url {
  font-size: 13px;
  color: #98a4ae;
  margin: 4px 0 0;
}

.header-meta {
  font-size: 12px;
  color: #98a4ae;
  margin: 4px 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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

/* ── Buttons ──────────────────────────── */
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
  padding: 8px 14px;
  background: #f4f6f9;
  color: rgb(42, 53, 71);
  font-size: 13px;
  font-weight: 500;
  font-family: 'Plus Jakarta Sans', sans-serif;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  -webkit-font-smoothing: antialiased;
}

.btn-secondary:hover {
  background: #e8edf2;
}

.btn-danger {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px;
  background: #fff0f3;
  color: #fa5a7d;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Plus Jakarta Sans', sans-serif;
  border: 1px solid #ffcdd9;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-danger:hover {
  background: #ffe0e8;
}

.btn-sm {
  padding: 6px 12px !important;
  font-size: 12px !important;
}

/* ── Hero uptime bar ──────────────────── */
.uptime-hero-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.uptime-hero-stats {
  display: flex;
  gap: 24px;
}

.hero-stat {
  text-align: right;
}

.hero-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
}

.hero-stat-label {
  display: block;
  font-size: 12px;
  color: #98a4ae;
  margin-top: 4px;
}

.uptime-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #98a4ae;
  margin-bottom: 6px;
}

/* ── Key stats row ────────────────────── */
.grid-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 20px;
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: #98a4ae;
  margin: 0 0 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  line-height: 1;
}

/* ── Period tabs ──────────────────────── */
.period-tabs {
  display: flex;
  gap: 4px;
  background: #f4f6f9;
  border-radius: 8px;
  padding: 3px;
}

.period-tab {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #98a4ae;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.period-tab--active {
  background: #ffffff;
  color: rgb(93, 135, 255);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.chart-placeholder {
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #98a4ae;
}

/* ── Two column row ───────────────────── */
.grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* ── Incidents ────────────────────────── */
.badge-danger {
  font-size: 11px;
  font-weight: 700;
  color: #fa5a7d;
  background: #fff0f3;
  padding: 3px 10px;
  border-radius: 6px;
}

.badge-danger-sm {
  font-size: 10px;
  font-weight: 700;
  color: #fa5a7d;
  background: #fff0f3;
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

.badge-resolved {
  font-size: 10px;
  font-weight: 700;
  color: #2ea95c;
  background: #e8f8f0;
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

.incidents-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.incident-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f7fa;
}

.incident-row:last-child {
  border-bottom: none;
}

.incident-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2ea95c;
  flex-shrink: 0;
}

.incident-indicator--active {
  background: #fa5a7d;
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

.incident-info {
  flex: 1;
}

.incident-started {
  font-size: 13px;
  font-weight: 500;
  color: rgb(42, 53, 71);
  margin: 0 0 2px;
}

.incident-duration {
  font-size: 12px;
  color: #98a4ae;
  margin: 0;
}

/* ── Config ───────────────────────────── */
.config-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid #f5f7fa;
  gap: 12px;
}

.config-row:last-child {
  border-bottom: none;
}

.config-label {
  font-size: 13px;
  color: #98a4ae;
  flex-shrink: 0;
}

.config-value {
  font-size: 13px;
  font-weight: 500;
  color: rgb(42, 53, 71);
  text-align: right;
}

.config-value--link {
  color: rgb(93, 135, 255);
  text-decoration: none;
  word-break: break-all;
}

.config-value--link:hover {
  text-decoration: underline;
}

/* ── History table ────────────────────── */
.history-table-wrap {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th {
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: #98a4ae;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 12px 12px;
  border-bottom: 1px solid #f0f4f8;
}

.history-table th:first-child {
  padding-left: 0;
}

.history-table td {
  padding: 12px;
  font-size: 13px;
  color: rgb(42, 53, 71);
  border-bottom: 1px solid #f5f7fa;
  vertical-align: middle;
}

.history-table td:first-child {
  padding-left: 0;
}

.check-status {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

.check-status--up {
  color: #2ea95c;
  background: #e8f8f0;
}
.check-status--down {
  color: #fa5a7d;
  background: #fff0f3;
}

.code-cell {
  font-family: monospace;
  font-size: 12px;
}
.muted {
  color: #98a4ae !important;
}

/* ── Pagination ───────────────────────── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid #f0f4f8;
  margin-top: 4px;
}

.page-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e8edf2;
  border-radius: 8px;
  background: #ffffff;
  color: rgb(42, 53, 71);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: #f4f6f9;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #98a4ae;
}

/* ── Channels ─────────────────────────── */
.channels-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f5f7fa;
}

.channel-row:last-child {
  border-bottom: none;
}

.channel-type-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.channel-type-icon--email {
  background: #ecf2ff;
  color: rgb(93, 135, 255);
}
.channel-type-icon--webhook {
  background: #fff8ec;
  color: #ff9f43;
}

.channel-info {
  flex: 1;
  min-width: 0;
}

.channel-value {
  font-size: 13px;
  font-weight: 500;
  color: rgb(42, 53, 71);
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-flags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.flag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.flag--down {
  color: #fa5a7d;
  background: #fff0f3;
}
.flag--up {
  color: #2ea95c;
  background: #e8f8f0;
}
.flag--degraded {
  color: #ff9f43;
  background: #fff8ec;
}

.delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  color: #98a4ae;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: #fff0f3;
  color: #fa5a7d;
}

/* ── Tags ─────────────────────────────── */
.tag-add-wrap {
  position: relative;
}

.tag-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #ffffff;
  border: 0.1px solid #e8edf2;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 12px 24px -4px;
  border-radius: 8px;
  min-width: 160px;
  overflow: hidden;
  z-index: 100;
}

.tag-dropdown-empty {
  padding: 12px 16px;
  font-size: 13px;
  color: #98a4ae;
}

.tag-dropdown-item {
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(42, 53, 71);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: background 0.15s;
  -webkit-font-smoothing: antialiased;
}

.tag-dropdown-item:hover {
  background: #f4f6f9;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 12px;
  background: #ecf2ff;
  color: rgb(93, 135, 255);
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.tag-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(93, 135, 255);
  display: flex;
  align-items: center;
  padding: 0;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.tag-remove:hover {
  opacity: 1;
}

/* ── Section empty ────────────────────── */
.section-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: #98a4ae;
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
  max-width: 480px;
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
}

.form-input:focus {
  border-color: rgb(93, 135, 255);
  box-shadow: 0 0 0 3px rgba(93, 135, 255, 0.12);
}

.form-input--error {
  border-color: #fa5a7d;
}

.field-error {
  font-size: 12px;
  color: #fa5a7d;
  margin: 4px 0 0;
}

.checkbox-group {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 500;
  color: rgb(42, 53, 71);
  cursor: pointer;
  -webkit-font-smoothing: antialiased;
}

.checkbox-label input {
  accent-color: rgb(93, 135, 255);
  width: 15px;
  height: 15px;
  cursor: pointer;
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

/* ── Loading skeleton ─────────────────── */
.loading-state {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.skeleton-card {
  height: 160px;
  background: linear-gradient(90deg, #f0f4f8 25%, #e8edf2 50%, #f0f4f8 75%);
  background-size: 200% 100%;
  border-radius: 7px;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  gap: 12px;
  text-align: center;
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
  margin: 0;
}

.mb-6 {
  margin-bottom: 24px;
}

/* ── Responsive ───────────────────────── */
@media (max-width: 900px) {
  .grid-two {
    grid-template-columns: 1fr;
  }
  .grid-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 640px) {
  .grid-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .header-actions {
    flex-wrap: wrap;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
  }
}
</style>
