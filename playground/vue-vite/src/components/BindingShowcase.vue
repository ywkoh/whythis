<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

type Plan = {
  id: 'starter' | 'team' | 'scale'
  name: string
  monthlyPrice: number
  description: string
}

const profile = reactive({
  id: 'usr_2048',
  name: 'Mina Park',
  tier: 'Pro',
  preferences: { compactMode: false }
})
const cart = reactive({ itemCount: 0, total: 0 })
const quantity = ref(0)
const query = ref('')
const isEditing = ref(true)
const isMuted = ref(false)
const selectedPlan = ref<Plan['id']>('team')
const demoAccessToken = ref('demo-value-that-must-not-be-revealed')
const plans: Plan[] = [
  { id: 'starter', name: 'Starter', monthlyPrice: 12, description: 'For personal projects' },
  { id: 'team', name: 'Team', monthlyPrice: 29, description: 'For growing teams' },
  { id: 'scale', name: 'Scale', monthlyPrice: 79, description: 'For larger organizations' }
]

const canAddToCart = computed(() => quantity.value > 0 && isEditing.value)
const inventoryMessage = computed(() =>
  quantity.value === 0 ? 'Choose a quantity to continue' : `${quantity.value} seats ready to add`
)
const inventoryTone = computed(() => (quantity.value === 0 ? 'warning' : 'success'))
const accentStyle = computed(() => ({
  '--accent': quantity.value === 0 ? '#b45309' : '#047857',
  opacity: isMuted.value ? 0.55 : 1
}))
const formattedTotal = computed(() => `$${cart.total.toFixed(2)}`)
const selectedPlanName = computed(
  () => plans.find((plan) => plan.id === selectedPlan.value)?.name ?? 'Unknown'
)
const querySummary = computed(() => (query.value ? `Filtering for “${query.value}”` : 'No filter'))

function changeQuantity(amount: number): void {
  quantity.value = Math.max(0, quantity.value + amount)
}

function addToCart(): void {
  if (!canAddToCart.value) return
  cart.itemCount += quantity.value
  cart.total += quantity.value * 29
}

function resetCart(): void {
  cart.itemCount = 0
  cart.total = 0
}
</script>

<template>
  <section class="card showcase" aria-labelledby="binding-showcase-title">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Script setup · supported bindings</p>
        <h2 id="binding-showcase-title">Binding matrix</h2>
      </div>
      <span class="test-count">attributes, properties, text, objects</span>
    </div>

    <div class="controls" aria-label="Binding matrix controls">
      <button type="button" @click="changeQuantity(-1)">− quantity</button>
      <button type="button" @click="changeQuantity(1)">+ quantity</button>
      <button type="button" @click="isEditing = !isEditing">
        Editing: {{ isEditing ? 'on' : 'off' }}
      </button>
      <button type="button" @click="isMuted = !isMuted">
        Visual mute: {{ isMuted ? 'on' : 'off' }}
      </button>
      <button type="button" @click="profile.preferences.compactMode = !profile.preferences.compactMode">
        Compact: {{ profile.preferences.compactMode ? 'on' : 'off' }}
      </button>
    </div>

    <header
      class="profile-header"
      :class="{ compact: profile.preferences.compactMode }"
      :data-user-id="profile.id"
      :title="`${profile.name} · ${profile.tier}`"
    >
      <p class="muted">Signed in as</p>
      <h3>{{ profile.name }}</h3>
      <p>{{ profile.tier }} workspace · {{ cart.itemCount }} cart items</p>
    </header>

    <div class="inventory-status" :class="inventoryTone" :style="accentStyle" aria-live="polite">
      <strong>{{ inventoryMessage }}</strong>
      <span>Current quantity: {{ quantity }}</span>
    </div>

    <div class="quantity-row">
      <label for="quantity-input">Quantity</label>
      <input
        id="quantity-input"
        v-model.number="quantity"
        type="number"
        min="0"
        :aria-label="`${profile.name}'s seat quantity`"
        :placeholder="isEditing ? 'Enter a quantity' : 'Editing is disabled'"
        :disabled="!isEditing"
      />
      <progress :value="quantity" :max="10" :aria-valuetext="`${quantity} of 10 seats`" />
    </div>

    <div class="action-row">
      <button
        class="primary"
        type="button"
        :disabled="!canAddToCart"
        :aria-label="`Add ${quantity} seats to ${profile.tier} cart`"
        :title="canAddToCart ? 'Add selected seats' : 'Choose at least one seat while editing'"
        :data-can-add="canAddToCart"
        @click="addToCart"
      >
        Add {{ quantity }} seats
      </button>
      <button type="button" :disabled="cart.itemCount === 0" :title="`Clear ${cart.itemCount} cart items`" @click="resetCart">
        Reset cart
      </button>
      <output class="cart-total" :data-total="cart.total">
        Cart total: {{ formattedTotal }}
      </output>
    </div>

    <label class="field-label" for="search-input">Search label</label>
    <input
      id="search-input"
      v-model="query"
      type="search"
      :aria-label="`Search ${profile.tier} plans`"
      :placeholder="`Try ${selectedPlanName}`"
      :disabled="!isEditing"
    />
    <p class="query-summary" :class="{ active: Boolean(query) }">{{ querySummary }}</p>

    <div class="plan-grid" aria-label="Plan choices">
      <article
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card"
        :class="{ selected: selectedPlan === plan.id }"
        :aria-current="selectedPlan === plan.id ? 'true' : undefined"
        :data-plan-id="plan.id"
      >
        <h3>{{ plan.name }}</h3>
        <p>{{ plan.description }}</p>
        <p class="plan-price">${{ plan.monthlyPrice }} / month</p>
        <button
          type="button"
          :aria-pressed="selectedPlan === plan.id"
          :title="`Choose ${plan.name}`"
          @click="selectedPlan = plan.id"
        >
          Select {{ plan.name }}
        </button>
      </article>
    </div>

    <p v-if="selectedPlan === 'scale'" class="notice" :data-selected-plan="selectedPlan">
      Scale plan selected for {{ profile.name }}.
    </p>
    <p v-else class="muted" :data-selected-plan="selectedPlan">
      Selected plan: {{ selectedPlanName }}.
    </p>

    <p class="redaction-case" :data-token="demoAccessToken">
      Select this element to verify that a token-like binding is redacted.
    </p>
  </section>
</template>
