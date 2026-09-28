<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import PropBadge from './PropBadge.vue'

const activeField = ref<'primary' | 'secondary'>('primary')
const values = reactive({ primary: 'Primary text', secondary: 'Secondary text' })
const visible = ref(true)
const status = ref<'neutral' | 'success' | 'warning'>('success')
const childLabel = computed(() => `Child prop is ${status.value}`)

function toggleField(): void {
  activeField.value = activeField.value === 'primary' ? 'secondary' : 'primary'
}
</script>

<template>
  <section class="card boundary-card" aria-labelledby="boundary-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Boundaries · expected fallbacks</p>
        <h2 id="boundary-title">Component, dynamic path, directive</h2>
      </div>
      <span class="test-count">verify limitations safely</span>
    </div>

    <div class="controls">
      <button type="button" @click="toggleField">Switch dynamic key</button>
      <button type="button" @click="visible = !visible">Toggle v-show</button>
      <button type="button" @click="status = status === 'success' ? 'warning' : 'success'">
        Toggle child prop
      </button>
    </div>

    <p class="muted">
      Parent-to-component prop bindings, dynamic member paths, event handlers, and v-model itself are
      intentionally outside the direct-source model. The child’s own native bindings remain inspectable.
    </p>

    <PropBadge :tone="status" :label="childLabel" />

    <button
      type="button"
      :title="values[activeField]"
      :data-active-field="activeField"
      @click="toggleField"
    >
      Dynamic member path: {{ values[activeField] }}
    </button>

    <p v-show="visible" class="v-show-example" :data-visible="visible">
      This text uses v-show plus a supported data binding.
    </p>

    <input v-model="values.primary" aria-label="v-model-only input" />
  </section>
</template>
