<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

const stock = ref(0)
const member = reactive({ active: true })
const price = ref(12000)
const canOrder = computed(() => stock.value > 0)

function toggleStock(): void {
  stock.value = stock.value === 0 ? 3 : 0
}

function toggleMembership(): void {
  member.active = !member.active
}
</script>

<template>
  <section class="card">
    <div class="controls">
      <button type="button" @click="toggleStock">Toggle stock ({{ stock }})</button>
      <button type="button" @click="toggleMembership">
        Toggle member ({{ member.active }})
      </button>
    </div>

    <!-- Case 1: a direct dependency that is a computed value. -->
    <button class="primary" :disabled="!canOrder">Order</button>

    <!-- Case 2: an interpolation. -->
    <p class="price">Price: <span>{{ price }}</span></p>

    <!-- Case 3: multiple direct dependencies, including a member expression. -->
    <button :disabled="stock === 0 || !member.active">Member order</button>

    <!-- Case 4: a class binding. -->
    <div class="inventory" :class="{ soldout: stock === 0 }">
      Stock status: {{ stock === 0 ? 'Sold out' : `${stock} in stock` }}
    </div>
  </section>
</template>
