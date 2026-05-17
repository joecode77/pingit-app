<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMonitorsStore } from '@/stores/monitors.js'
import { channelsApi } from '@/api/index.js'
import { useRouter } from 'vue-router'

const monitorsStore = useMonitorsStore()
const router = useRouter()

const loading = ref(true)
const allChannels = ref([])
const submitting = ref(false)
const deleting = ref(null)
const showModal = ref(false)
const formErrors = ref({})
const generalError = ref(null)
const selectedMonitorId = ref('')

const form = ref({
  type: 'email',
  value: '',
  notify_on_down: true,
  notify_on_recovery: true,
  notify_on_degraded: false,
})

onMounted(async () => {
  await Promise.all([monitorsStore.fetchMonitors(), loadAllChannels()])
  loading.value = false
})

async function loadAllChannels() {
  const monitors = monitorsStore.monitors
  const results = await Promise.all(
    monitors.map(async (m) => {
      try {
        const res = await channelsApi.list(m.id)
        return res.data.data.map((c) => ({ ...c, monitor: m }))
      } catch {
        return []
      }
    }),
  )
  allChannels.value = results.flat()
}

const channelsByMonitor = computed(() => {
  const map = {}
  allChannels.value.forEach((c) => {
    const key = c.monitor.id
    if (!map[key]) map[key] = { monitor: c.monitor, channels: [] }
    map[key].channels.push(c)
  })
  return Object.values(map)
})

function openModal() {
  form.value = {
    type: 'email',
    value: '',
    notify_on_down: true,
    notify_on_recovery: true,
    notify_on_degraded: false,
  }
  formErrors.value = {}
  generalError.value = null
  selectedMonitorId.value = monitorsStore.monitors[0]?.id?.toString() || ''
  showModal.value = true
}

async function handleCreate() {
  formErrors.value = {}
  generalError.value = null
  submitting.value = true
  try {
    const monitorId = parseInt(selectedMonitorId.value)
    const res = await channelsApi.create(monitorId, form.value)
    const monitor = monitorsStore.monitors.find((m) => m.id === monitorId)
    allChannels.value.push({ ...res.data.data, monitor })
    showModal.value = false
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

async function handleDelete(channel) {
  if (!confirm(`Delete this ${channel.type} channel?`)) return
  deleting.value = channel.id
  try {
    await channelsApi.remove(channel.monitor.id, channel.id)
    allChannels.value = allChannels.value.filter((c) => c.id !== channel.id)
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div class="channels-page">
    <!-- Header -->
    <div class="page-header mb-6">
      <div class="page-header-left">
        <h1 class="page-title">Notification Channels</h1>
        <span class="count-badge">{{ allChannels.length }}</span>
      </div>
      <button class="btn-primary" @click="openModal" :disabled="!monitorsStore.monitors.length">
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
        Add Channel
      </button>
    </div>

    <!-- No monitors warning -->
    <div v-if="!loading && !monitorsStore.monitors.length" class="empty-state">
      <div class="empty-icon">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c4cdd5"
          stroke-width="1.2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <h3 class="empty-title">No monitors yet</h3>
      <p class="empty-subtitle">Add a monitor first before configuring notification channels</p>
      <button class="btn-primary" @click="router.push('/monitors')">Go to Monitors</button>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="loading-stack">
      <div v-for="i in 3" :key="i" class="skeleton" />
    </div>

    <!-- Empty channels -->
    <div v-else-if="!allChannels.length" class="empty-state">
      <div class="empty-icon">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c4cdd5"
          stroke-width="1.2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <h3 class="empty-title">No notification channels</h3>
      <p class="empty-subtitle">
        Add email or webhook channels to get alerted when your monitors go down
      </p>
      <button class="btn-primary" @click="openModal">Add your first channel</button>
    </div>

    <!-- Channels grouped by monitor -->
    <div v-else class="monitors-list">
      <div
        v-for="group in channelsByMonitor"
        :key="group.monitor.id"
        class="monitor-group card mb-4"
      >
        <div class="group-header" @click="router.push(`/monitors/${group.monitor.id}`)">
          <div class="group-monitor-info">
            <p class="group-monitor-name">{{ group.monitor.name || group.monitor.url }}</p>
            <p v-if="group.monitor.name" class="group-monitor-url">{{ group.monitor.url }}</p>
          </div>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#98a4ae"
            stroke-width="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>

        <div class="channels-list">
          <div v-for="channel in group.channels" :key="channel.id" class="channel-row">
            <div
              class="channel-type-icon"
              :class="channel.type === 'email' ? 'icon--email' : 'icon--webhook'"
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
            <button
              class="delete-btn"
              :disabled="deleting === channel.id"
              @click="handleDelete(channel)"
            >
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
    </div>

    <!-- Add Channel Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Add Notification Channel</h2>
          <button class="modal-close" @click="showModal = false">
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

        <div v-if="generalError" class="error-banner">{{ generalError }}</div>

        <form @submit.prevent="handleCreate" novalidate>
          <div class="form-group">
            <label class="form-label">Monitor <span class="required">*</span></label>
            <select v-model="selectedMonitorId" class="form-input">
              <option v-for="m in monitorsStore.monitors" :key="m.id" :value="m.id.toString()">
                {{ m.name || m.url }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select v-model="form.type" class="form-input">
              <option value="email">Email</option>
              <option value="webhook">Webhook</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label"
              >{{ form.type === 'email' ? 'Email Address' : 'Webhook URL' }}
              <span class="required">*</span></label
            >
            <input
              v-model="form.value"
              :type="form.type === 'email' ? 'email' : 'url'"
              :placeholder="
                form.type === 'email' ? 'alerts@example.com' : 'https://hooks.slack.com/...'
              "
              class="form-input"
              :class="{ 'form-input--error': formErrors.value }"
            />
            <p v-if="formErrors.value" class="field-error">{{ formErrors.value[0] }}</p>
          </div>
          <div class="form-group">
            <label class="form-label">Notify on</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input v-model="form.notify_on_down" type="checkbox" />
                Down
              </label>
              <label class="checkbox-label">
                <input v-model="form.notify_on_recovery" type="checkbox" />
                Recovery
              </label>
              <label class="checkbox-label">
                <input v-model="form.notify_on_degraded" type="checkbox" />
                Degraded
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showModal = false">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="submitting">
              {{ submitting ? 'Adding...' : 'Add Channel' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.channels-page {
  width: 100%;
}
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

.count-badge {
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
}

.btn-secondary:hover {
  background: #e8edf2;
}

.card {
  background: #ffffff;
  border-radius: 7px;
  border: 0.1px solid #e8edf2;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 12px 24px -4px;
  padding: 24px;
}

.mb-4 {
  margin-bottom: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  cursor: pointer;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f4f8;
}

.group-monitor-name {
  font-size: 15px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin: 0 0 2px;
}

.group-monitor-url {
  font-size: 12px;
  color: #98a4ae;
  margin: 0;
}

.channels-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
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

.icon--email {
  background: #ecf2ff;
  color: rgb(93, 135, 255);
}
.icon--webhook {
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
.delete-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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

.loading-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton {
  height: 120px;
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
  max-width: 460px;
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
}

.modal-close:hover {
  background: #e8edf2;
  color: rgb(42, 53, 71);
}

.error-banner {
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

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  margin-bottom: 6px;
}

.required {
  color: #fa5a7d;
  margin-left: 2px;
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

.mb-6 {
  margin-bottom: 24px;
}
</style>
