<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    tone?: 'neutral' | 'success' | 'warning'
  }>(),
  { tone: 'neutral' }
)
</script>

<template>
  <span class="prop-badge" :class="`tone-${tone}`" :title="label" :data-tone="tone">
    {{ label }}
  </span>
</template>
