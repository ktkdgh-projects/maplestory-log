<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 })
</script>

<template>
  <svg viewBox="0 0 24 24" class="coin" :width="size" :height="size" aria-hidden="true">
    <circle cx="12" cy="12" r="9" class="face" />
    <circle cx="12" cy="12" r="5.5" class="ring" />
    <path d="M9.5 14.5v-5l2.5 3 2.5-3v5" class="mark" />
  </svg>
</template>

<style scoped>
.coin {
  --coin: var(--gold);
  flex: none;
}
.face {
  fill: var(--coin);
  stroke: color-mix(in srgb, var(--coin) 70%, black);
  stroke-width: 1.4;
}
.ring {
  fill: none;
  stroke: color-mix(in srgb, var(--coin) 35%, white);
  stroke-width: 1.2;
  opacity: 0.8;
}
.mark {
  fill: none;
  stroke: color-mix(in srgb, var(--coin) 45%, black);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}
</style>
