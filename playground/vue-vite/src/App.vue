<script setup lang="ts">
import BindingShowcase from './components/BindingShowcase.vue'
import BoundaryCases from './components/BoundaryCases.vue'
import OrderButton from './components/OrderButton.vue'
import OptionsApiShowcase from './components/OptionsApiShowcase.vue'
</script>

<template>
  <main>
    <p class="eyebrow">Vue 3 + Vite development playground</p>
    <h1>Why is this UI in this state?</h1>
    <p class="intro">
      Change state with the ordinary controls, then click <strong>WhyThis</strong> and select a
      native element with a bound attribute or interpolation.
    </p>
    <div class="guide" role="note">
      <strong>Suggested first checks:</strong> disabled <code>Order</code>, the inventory message,
      the profile header, a plan card, the Options API retry button, and the child badge.
    </div>
    <OrderButton />
    <BindingShowcase />
    <OptionsApiShowcase />
    <BoundaryCases />
  </main>
</template>
