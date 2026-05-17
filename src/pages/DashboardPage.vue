<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMonitorsStore } from '@/stores/monitors.js'
import { useAuthStore } from '@/stores/auth.js'
import VueApexCharts from 'vue3-apexcharts'
import { monitorsApi } from '@/api/index.js'

const monitorsStore = useMonitorsStore()
const auth = useAuthStore()

const dashboard = computed(() => monitorsStore.dashboard)
const monitors = computed(() => monitorsStore.monitors)
const loading = computed(() => monitorsStore.loading)

// ─────────────────────────────────────────────
// Auto-refresh every 30 seconds
// ─────────────────────────────────────────────

let refreshInterval = null

onMounted(async () => {
  await Promise.all([monitorsStore.fetchDashboard(), monitorsStore.fetchMonitors()])
  await fetchResponseTimes()
  refreshInterval = setInterval(async () => {
    await Promise.all([monitorsStore.fetchDashboard(), monitorsStore.fetchMonitors()])
    await fetchResponseTimes()
  }, 30000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})

// ─────────────────────────────────────────────
// Donut chart — status breakdown
// ─────────────────────────────────────────────

const donutSeries = computed(() => {
  const d = dashboard.value
  if (!d) return [0, 0, 0, 0]
  return [d.up, d.down, d.degraded, d.paused]
})

const donutOptions = computed(() => ({
  chart: {
    type: 'donut',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true, speed: 600 },
  },
  labels: ['Up', 'Down', 'Degraded', 'Paused'],
  colors: ['rgb(93, 135, 255)', '#fa5a7d', '#ff9f43', 'rgb(236, 242, 255)'],
  legend: {
    show: true,
    position: 'bottom',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '13px',
    labels: { colors: '#2A3547' },
    markers: { width: 10, height: 10, radius: 50 },
    itemMargin: { horizontal: 12, vertical: 4 },
  },
  dataLabels: { enabled: false },
  stroke: {
    width: 2,
    colors: ['#ffffff'],
  },
  plotOptions: {
    pie: {
      donut: {
        size: '85%',
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Total',
            fontSize: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            color: '#98a4ae',
            formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0),
          },
          value: {
            fontSize: '24px',
            fontWeight: 600,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            color: 'rgb(42, 53, 71)',
          },
          name: {
            fontSize: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            color: '#98a4ae',
          },
        },
      },
    },
  },
  tooltip: {
    theme: 'dark',
    style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px' },
    fillSeriesColor: false,
  },
}))

// ─────────────────────────────────────────────
// Uptime radial chart
// ─────────────────────────────────────────────

const uptimeSeries = computed(() => {
  const val = dashboard.value?.overall_uptime_percentage ?? 0
  return [parseFloat(val.toFixed(1))]
})

const uptimeOptions = computed(() => ({
  chart: {
    type: 'radialBar',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true, speed: 800 },
  },
  plotOptions: {
    radialBar: {
      startAngle: 0,
      endAngle: 360,
      hollow: {
        size: '70%',
        background: 'transparent',
      },
      track: {
        background: 'rgb(236, 242, 255)',
        strokeWidth: '100%',
        margin: 0,
        opacity: 1,
      },
      dataLabels: {
        name: {
          show: true,
          offsetY: 24,
          fontSize: '13px',
          fontWeight: 400,
          color: '#98a4ae',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        },
        value: {
          show: true,
          offsetY: -10,
          fontSize: '24px',
          fontWeight: 500,
          color: 'rgb(93, 135, 255)',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          formatter: (val) => `${val}%`,
        },
      },
    },
  },
  fill: {
    type: 'solid',
    opacity: 1,
  },
  colors: ['rgb(93, 135, 255)'],
  labels: ['Uptime'],
  stroke: {
    lineCap: 'butt',
    width: 2,
  },
  tooltip: {
    enabled: true,
    theme: 'dark',
    style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px' },
    fillSeriesColor: false,
    y: { formatter: (val) => `${val}%` },
  },
}))

// ─────────────────────────────────────────────
// Response time LINE chart — trend over time
// ─────────────────────────────────────────────

const responseTimePeriod = ref('7d')
const responseTimeData = ref([])
const responseTimeLoading = ref(false)

async function fetchResponseTimes() {
  if (!monitors.value.length) return
  responseTimeLoading.value = true

  const activeMonitors = monitors.value
    .filter((m) => m.status !== 'pending' && m.last_checked_at)
    .slice(0, 8)

  // Fetch enough records to cover the period
  // 5min interval = 288/day, 10min = 144/day — use 400 for 24h, 100 max per_page so paginate
  const perPage =
    responseTimePeriod.value === '24h' ? 100 : responseTimePeriod.value === '7d' ? 100 : 100

  const allChecks = []
  await Promise.all(
    activeMonitors.map(async (m) => {
      try {
        // Fetch up to 3 pages to get enough coverage
        const pages =
          responseTimePeriod.value === '24h' ? 1 : responseTimePeriod.value === '7d' ? 3 : 7

        for (let page = 1; page <= pages; page++) {
          const res = await monitorsApi.history(m.id, { per_page: perPage, page })
          const checks = res.data.data.filter((c) => c.is_up && c.response_time_ms)
          allChecks.push(...checks)
          // Stop early if we got fewer results than requested (last page)
          if (res.data.data.length < perPage) break
        }
      } catch {
        // skip
      }
    }),
  )

  responseTimeData.value = allChecks
  responseTimeLoading.value = false
}

const responseTimeSeries = computed(() => {
  const periodHours =
    responseTimePeriod.value === '24h' ? 24 : responseTimePeriod.value === '7d' ? 168 : 720

  const cutoff = Date.now() - periodHours * 3600 * 1000
  const bucketMs =
    responseTimePeriod.value === '24h'
      ? 60 * 60 * 1000 // 1 hour buckets
      : responseTimePeriod.value === '7d'
        ? 6 * 60 * 60 * 1000 // 6 hour buckets
        : 24 * 60 * 60 * 1000 // 1 day buckets

  const filtered = responseTimeData.value.filter((c) => new Date(c.checked_at).getTime() >= cutoff)

  if (!filtered.length) return []

  // Group into time buckets and average
  const buckets = {}
  filtered.forEach((c) => {
    const t = new Date(c.checked_at).getTime()
    const bucket = Math.floor(t / bucketMs) * bucketMs
    if (!buckets[bucket]) buckets[bucket] = []
    buckets[bucket].push(c.response_time_ms)
  })

  const data = Object.entries(buckets)
    .map(([time, values]) => ({
      x: parseInt(time),
      y: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }))
    .sort((a, b) => a.x - b.x)

  return [{ name: 'Avg Response Time', data }]
})

const responseTimeOptions = computed(() => ({
  chart: {
    type: 'area',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    toolbar: { show: false },
    animations: { enabled: true, speed: 600 },
    zoom: { enabled: false },
  },
  stroke: {
    curve: 'smooth',
    width: 2,
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.45,
      opacityTo: 0.05,
      stops: [0, 100],
    },
  },
  colors: ['rgb(93, 135, 255)'],
  dataLabels: { enabled: false },
  markers: { size: 0 },
  legend: { show: false },
  xaxis: {
    type: 'datetime',
    tickAmount: responseTimePeriod.value === '24h' ? 6 : responseTimePeriod.value === '7d' ? 7 : 6,
    labels: {
      style: {
        colors: '#98a4ae',
        fontSize: '11px',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      },
      datetimeUTC: false,
      formatter: (val) => {
        const date = new Date(val)
        if (responseTimePeriod.value === '24h') {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
        if (responseTimePeriod.value === '7d') {
          return date.toLocaleDateString([], { weekday: 'short' })
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: {
        colors: '#98a4ae',
        fontSize: '11px',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
      },
      formatter: (val) => `${Math.round(val)}ms`,
    },
    min: 0,
  },
  grid: {
    borderColor: '#f0f4f8',
    strokeDashArray: 4,
    padding: { left: 0, right: 0 },
  },
  tooltip: {
    theme: 'dark',
    x: { format: 'dd MMM HH:mm' },
    style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px' },
    fillSeriesColor: false,
    y: { formatter: (val) => `${Math.round(val)}ms` },
  },
}))
</script>

<template>
  <div class="dashboard">
    <!-- ── Loading skeleton ─────────────────────── -->
    <div v-if="loading && !dashboard" class="loading-state">
      <div v-for="i in 6" :key="i" class="skeleton-card" />
    </div>

    <template v-else>
      <!-- ── Row 1: Welcome card + Uptime radial ── -->
      <div class="grid-welcome mb-6">
        <!-- Welcome card -->
        <div class="card welcome-card">
          <div class="welcome-text">
            <p class="welcome-greeting">Welcome back {{ auth.user?.name }}!</p>
            <div class="welcome-stats">
              <div class="welcome-stat">
                <span class="welcome-stat-value">{{ dashboard?.up ?? 0 }}</span>
                <span class="welcome-stat-label">Sites Up</span>
              </div>
              <div class="welcome-stat-divider" />
              <div class="welcome-stat">
                <span class="welcome-stat-value">{{ dashboard?.down ?? 0 }}</span>
                <span class="welcome-stat-label">Sites Down</span>
              </div>
              <div class="welcome-stat-divider" />
              <div class="welcome-stat">
                <span class="welcome-stat-value">{{ dashboard?.degraded ?? 0 }}</span>
                <span class="welcome-stat-label">Degraded</span>
              </div>
            </div>
          </div>
          <img src="/images/welcome-bg.png" alt="" aria-hidden="true" class="welcome-img" />
        </div>

        <!-- Uptime radial -->
        <div class="card uptime-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Overall Uptime</h3>
              <p class="card-subtitle">All monitors</p>
            </div>
          </div>
          <VueApexCharts
            type="radialBar"
            height="160"
            :series="uptimeSeries"
            :options="uptimeOptions"
          />
        </div>
      </div>

      <!-- ── Row 2: Donut + Response time line ── -->
      <div class="grid-charts mb-6">
        <!-- Status donut -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Status Breakdown</h3>
              <p class="card-subtitle">Current monitor statuses</p>
            </div>
          </div>
          <VueApexCharts type="donut" height="280" :series="donutSeries" :options="donutOptions" />
        </div>

        <!-- Response time area line chart -->
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Response Time Trends</h3>
              <p class="card-subtitle">Average response time over time</p>
            </div>
            <select v-model="responseTimePeriod" class="period-select">
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <div v-if="responseTimeLoading" class="chart-loading">
            <span>Loading...</span>
          </div>
          <div v-else-if="!responseTimeSeries.length" class="chart-empty">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#98a4ae"
              stroke-width="1.5"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            <p>No response time data yet</p>
          </div>
          <VueApexCharts
            v-else
            type="area"
            height="260"
            :series="responseTimeSeries"
            :options="responseTimeOptions"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  width: 100%;
  min-width: 0;
  overflow: hidden;
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
  margin-bottom: 16px;
}

.card-title {
  font-size: 21px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  letter-spacing: 0.154412px;
  line-height: 25.6px;
  margin: 0;
  white-space: nowrap;
}

.card-subtitle {
  font-size: 14px;
  font-weight: 400;
  color: rgb(42, 53, 71);
  letter-spacing: 0.13125px;
  line-height: 17.6px;
  margin: 4px 0 0;
}

.card-label {
  font-size: 12px;
  color: #98a4ae;
  margin: 0 0 4px;
  font-weight: 500;
  text-align: center;
}

/* ── Welcome card ─────────────────────── */
.grid-welcome {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 20px;
}

.welcome-card {
  background: rgb(236, 242, 255);
  border: none;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32px;
  overflow: hidden;
  position: relative;
  min-height: 160px;
}

.welcome-text {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.welcome-greeting {
  font-size: 18px;
  font-weight: 600;
  color: rgb(0, 0, 0);
  margin: 0 0 52px 0;
  line-height: 25.6px;
  letter-spacing: normal;
}

.welcome-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.welcome-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.welcome-stat-value {
  font-size: 30px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  line-height: 36px;
  letter-spacing: -0.25px;
  text-align: center;
}

.welcome-stat-label {
  font-size: 14px;
  font-weight: 400;
  color: rgb(42, 53, 71);
  margin-top: 4px;
  letter-spacing: 0.13125px;
  line-height: 17.6px;
  text-align: center;
}

.welcome-stat-divider {
  display: flex;
  flex-shrink: 1;
  flex-grow: 1;
  flex-basis: 100%;
  align-self: stretch;
  border-right: 1px solid rgb(229, 234, 239);
  margin-left: 20px;
  margin-right: 20px;
  max-width: 0px;
  width: 1px;
  opacity: 1;
}

.welcome-img {
  height: 160px;
  object-fit: contain;
  flex-shrink: 0;
  position: absolute;
  right: 24px;
  bottom: 0;
  z-index: 0;
}

.uptime-card {
  display: flex;
  flex-direction: column;
}

/* ── Charts row ───────────────────────── */
.grid-charts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 20px;
}

.grid-charts > .card {
  min-width: 0;
  overflow: hidden;
}

/* ── Period dropdown ──────────────────── */
.period-select {
  height: 42px;
  border-radius: 8px;
  border: 1px solid #e8edf2;
  background: #ffffff;
  color: rgb(42, 53, 71);
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.13125px;
  line-height: 21px;
  padding-left: 12px;
  padding-right: 12px;
  cursor: pointer;
  outline: none;
  appearance: auto;
}

.period-select:focus {
  border-color: rgb(93, 135, 255);
  box-shadow: 0 0 0 3px rgba(93, 135, 255, 0.15);
}

.chart-loading,
.chart-empty {
  height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #98a4ae;
  font-size: 13px;
}

/* ── Loading skeleton ─────────────────── */
.loading-state {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.skeleton-card {
  height: 120px;
  background: linear-gradient(90deg, #f0f4f8 25%, #e8edf2 50%, #f0f4f8 75%);
  background-size: 200% 100%;
  border-radius: 14px;
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

.mb-6 {
  margin-bottom: 24px;
}

/* ── Responsive ───────────────────────── */

@media (min-width: 1280px) {
  .grid-charts {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  }
  .grid-welcome {
    grid-template-columns: minmax(0, 1fr) 280px;
  }
}

@media (max-width: 1279px) and (min-width: 900px) {
  .grid-welcome {
    grid-template-columns: minmax(0, 1fr) 240px;
  }
  .grid-charts {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

@media (max-width: 899px) and (min-width: 641px) {
  .grid-welcome {
    grid-template-columns: 1fr;
  }
  .welcome-card {
    flex-direction: column;
    align-items: flex-start;
    padding-bottom: 24px;
    min-height: unset;
  }
  .welcome-img {
    position: static;
    height: 120px;
    margin-top: 20px;
    align-self: center;
  }
  .grid-charts {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard {
    padding: 0;
  }

  .grid-welcome {
    grid-template-columns: 1fr;
  }
  .welcome-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 24px;
    min-height: unset;
  }
  .welcome-img {
    position: static;
    height: 160px;
    margin-top: 20px;
    align-self: center;
  }
  .welcome-stats {
    flex-wrap: wrap;
    gap: 0;
  }
  .welcome-stat {
    min-width: 80px;
  }

  .grid-charts {
    grid-template-columns: 1fr;
  }

  .card {
    padding: 16px;
  }
  .welcome-card {
    padding: 20px;
  }
}

/* Last stat orphaned on its own line — hide preceding divider, add spacing */
</style>

<style>
/* ── ApexCharts tooltip global override ── */
.apexcharts-tooltip.apexcharts-theme-dark {
  background: rgba(30, 35, 50, 0.92) !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
  border-radius: 8px !important;
  padding: 2px 0 !important;
}

.apexcharts-tooltip.apexcharts-theme-dark .apexcharts-tooltip-title {
  background: transparent !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 11px !important;
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  padding: 6px 10px 5px !important;
  margin-bottom: 0 !important;
}

.apexcharts-tooltip.apexcharts-theme-dark .apexcharts-tooltip-series-group {
  background: transparent !important;
  padding: 5px 10px !important;
  align-items: center !important;
}

.apexcharts-tooltip.apexcharts-theme-dark .apexcharts-tooltip-text-y-label,
.apexcharts-tooltip.apexcharts-theme-dark .apexcharts-tooltip-text-y-value {
  color: #ffffff !important;
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  font-size: 12px !important;
}

.apexcharts-tooltip.apexcharts-theme-dark .apexcharts-tooltip-marker {
  width: 8px !important;
  height: 8px !important;
  border-radius: 50% !important;
  margin-right: 6px !important;
  flex-shrink: 0 !important;
  align-self: center !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
</style>
