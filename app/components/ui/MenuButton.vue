<script setup lang="ts">
defineProps<{ to?: string, active?: boolean }>()
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="menu-btn" :class="{ active }">
    <slot />
  </NuxtLink>
  <button v-else type="button" class="menu-btn" :class="{ active }" :aria-pressed="active">
    <slot />
  </button>
</template>

<style scoped>
.menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font-family: var(--f-title);
  font-size: 16px;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--fast) var(--ease-out), background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease, box-shadow var(--fast) ease;
}
.menu-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--tip-line);
}
.menu-btn:active:not(:disabled) {
  transform: scale(0.96);
}
.menu-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.menu-btn.active,
.menu-btn.router-link-exact-active {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
  box-shadow: 0 4px 14px rgb(242 193 78 / 0.25);
}
</style>
