<script setup>
import { ref, onMounted } from 'vue'
import { tagsApi } from '@/api/index.js'

const tags = ref([])
const loading = ref(true)
const submitting = ref(false)
const deleting = ref(null)
const showModal = ref(false)
const form = ref({ name: '' })
const formErrors = ref({})
const generalError = ref(null)

onMounted(async () => {
  await loadTags()
})

async function loadTags() {
  loading.value = true
  try {
    const res = await tagsApi.list()
    tags.value = res.data.data
  } finally {
    loading.value = false
  }
}

function openModal() {
  form.value = { name: '' }
  formErrors.value = {}
  generalError.value = null
  showModal.value = true
}

async function handleCreate() {
  formErrors.value = {}
  generalError.value = null
  submitting.value = true
  try {
    const res = await tagsApi.create({ name: form.value.name })
    tags.value.push(res.data.data)
    tags.value.sort((a, b) => a.name.localeCompare(b.name))
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

async function handleDelete(tag) {
  if (!confirm(`Delete tag "${tag.name}"?`)) return
  deleting.value = tag.id
  try {
    await tagsApi.remove(tag.id)
    tags.value = tags.value.filter((t) => t.id !== tag.id)
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div class="tags-page">
    <!-- Header -->
    <div class="page-header mb-6">
      <div class="page-header-left">
        <h1 class="page-title">Tags</h1>
        <span class="count-badge">{{ tags.length }}</span>
      </div>
      <button class="btn-primary" @click="openModal">
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
        New Tag
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-grid">
      <div v-for="i in 6" :key="i" class="skeleton" />
    </div>

    <!-- Empty -->
    <div v-else-if="!tags.length" class="empty-state">
      <div class="empty-icon">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c4cdd5"
          stroke-width="1.2"
        >
          <path
            d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
          />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      </div>
      <h3 class="empty-title">No tags yet</h3>
      <p class="empty-subtitle">Create tags to organise your monitors by project or environment</p>
      <button class="btn-primary" @click="openModal">Create your first tag</button>
    </div>

    <!-- Tags grid -->
    <div v-else class="tags-grid">
      <div v-for="tag in tags" :key="tag.id" class="tag-card">
        <div class="tag-card-inner">
          <div class="tag-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
              />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <span class="tag-name">{{ tag.name }}</span>
        </div>
        <button
          class="tag-delete"
          :disabled="deleting === tag.id"
          @click="handleDelete(tag)"
          title="Delete tag"
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
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Create modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">New Tag</h2>
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
            <label class="form-label">Tag Name <span class="required">*</span></label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. production"
              class="form-input"
              :class="{ 'form-input--error': formErrors.name }"
              autofocus
            />
            <p v-if="formErrors.name" class="field-error">{{ formErrors.name[0] }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" @click="showModal = false">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="submitting">
              {{ submitting ? 'Creating...' : 'Create Tag' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tags-page {
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
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #e8edf2;
}

/* Tags grid */
.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.tag-card {
  background: #ffffff;
  border-radius: 7px;
  border: 0.1px solid #e8edf2;
  box-shadow:
    rgba(145, 158, 171, 0.2) 0px 0px 2px 0px,
    rgba(145, 158, 171, 0.12) 0px 12px 24px -4px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tag-card-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tag-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #ecf2ff;
  color: rgb(93, 135, 255);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tag-name {
  font-size: 14px;
  font-weight: 600;
  color: rgb(42, 53, 71);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-delete {
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

.tag-delete:hover {
  background: #fff0f3;
  color: #fa5a7d;
}
.tag-delete:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Empty state */
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

/* Loading */
.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.skeleton {
  height: 64px;
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

/* Modal */
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
  max-width: 400px;
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
