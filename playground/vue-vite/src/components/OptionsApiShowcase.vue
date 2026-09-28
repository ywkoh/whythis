<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'OptionsApiShowcase',
  data() {
    return {
      account: { name: 'Jordan Lee', active: true },
      attempts: 1,
      acceptedTerms: false
    }
  },
  computed: {
    canRetry(): boolean {
      return this.account.active && this.attempts < 3
    },
    retryMessage(): string {
      return this.canRetry
        ? `${3 - this.attempts} retry attempts remaining`
        : 'No retry attempts remaining'
    }
  },
  methods: {
    retry(): void {
      if (this.canRetry) this.attempts += 1
    },
    reset(): void {
      this.attempts = 1
    }
  }
})
</script>

<template>
  <section class="card options-card" aria-labelledby="options-api-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Options API · component proxy</p>
        <h2 id="options-api-title">Retry state</h2>
      </div>
      <span class="test-count">data, computed, v-model</span>
    </div>

    <div class="controls">
      <button type="button" @click="account.active = !account.active">
        Account: {{ account.active ? 'active' : 'paused' }}
      </button>
      <button type="button" @click="reset">Reset attempts</button>
    </div>

    <p class="account-state" :class="{ paused: !account.active }" :data-account="account.name">
      {{ account.name }} is {{ account.active ? 'eligible' : 'paused' }}.
    </p>

    <button
      class="primary"
      type="button"
      :disabled="!canRetry"
      :title="retryMessage"
      :aria-label="`Retry for ${account.name}`"
      @click="retry"
    >
      Retry ({{ attempts }}/3)
    </button>
    <p class="muted">{{ retryMessage }}</p>

    <label class="checkbox-row">
      <input v-model="acceptedTerms" type="checkbox" :aria-label="`Terms accepted by ${account.name}`" />
      <span :class="{ confirmed: acceptedTerms }">
        {{ acceptedTerms ? 'Terms accepted' : 'Terms still need acceptance' }}
      </span>
    </label>
  </section>
</template>
