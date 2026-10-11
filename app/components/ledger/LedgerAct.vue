<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{ kind: 'edit' | 'del' | 'go', label: string, to?: RouteLocationRaw }>()
const ICONS = {
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4',
  del: 'M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13',
  go: 'M9 6l6 6-6 6',
}
const icon = computed(() => ICONS[props.kind])
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="act" :class="kind" :title="label" :aria-label="label"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="icon" /></svg></NuxtLink>
  <button v-else type="button" class="act" :class="kind" :title="label" :aria-label="label"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="icon" /></svg></button>
</template>

<style scoped>
.act {
  --tone: var(--gold);
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease, border-color var(--fast) ease;
}
.act.del {
  --tone: var(--loss);
}
.act svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.act:hover:not(:disabled),
.act:focus-visible {
  background: color-mix(in srgb, var(--tone) 12%, transparent);
  border-color: color-mix(in srgb, var(--tone) 40%, transparent);
  color: var(--tone);
}
.act:disabled {
  cursor: wait;
  opacity: 0.5;
}
@media (pointer: coarse), (max-width: 640px) {
  .act {
    width: 36px;
    height: 36px;
  }
}
</style>
