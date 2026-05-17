<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Array of { date: 'YYYY-MM-DD', status: 'up'|'down'|'degraded'|'no-data' }
  days: {
    type: Array,
    required: true,
  },
  // How many days to show
  count: {
    type: Number,
    default: 30,
  },
})

const bars = computed(() => {
  // Pad with no-data if fewer days than count
  const result = [...props.days].slice(-props.count)
  while (result.length < props.count) {
    result.unshift({ date: null, status: 'no-data' })
  }
  return result
})

const colorMap = {
  up: '#5d87ff',
  degraded: '#ff9f43',
  down: '#fa5a7d',
  'no-data': '#e8edf2',
}

function barColor(status) {
  return colorMap[status] || colorMap['no-data']
}

function barLabel(bar) {
  if (!bar.date) return 'No data'
  const label = bar.date
  const status = bar.status.charAt(0).toUpperCase() + bar.status.slice(1)
  return `${label} — ${status}`
}
</script>

<template>
  <div class="uptime-bar-wrap">
    <div class="uptime-bars">
      <div
        v-for="(bar, i) in bars"
        :key="i"
        class="uptime-bar"
        :style="{ background: barColor(bar.status) }"
        :title="barLabel(bar)"
      />
    </div>
  </div>
</template>

<style scoped>
.uptime-bar-wrap {
  width: 100%;
}

.uptime-bars {
  display: flex;
  align-items: stretch;
  gap: 2px;
  height: 34px;
}

.uptime-bar {
  flex: 1;
  border-radius: 3px;
  transition: opacity 0.15s;
  cursor: default;
}

.uptime-bar:hover {
  opacity: 0.75;
}
</style>
