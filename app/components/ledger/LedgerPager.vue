<script setup lang="ts">
defineProps<{ prevLabel: string, nextLabel: string, nextDisabled?: boolean }>()
const emit = defineEmits<{ prev: [], next: [] }>()
</script>

<template>
  <span class="pager">
    <button type="button" :aria-label="prevLabel" @click="emit('prev')">‹</button>
    <span class="now"><slot /></span>
    <button type="button" :aria-label="nextLabel" :disabled="nextDisabled" @click="emit('next')">›</button>
  </span>
</template>

<style scoped>
.pager {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}
.now {
  white-space: nowrap;
}
.pager button {
  width: 32px;
  height: 32px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: border-color var(--fast) ease;
}
.pager button:hover:not(:disabled) {
  border-color: var(--gold);
}
.pager button:disabled {
  opacity: 0.35;
  cursor: default;
}
@media (pointer: coarse), (max-width: 640px) {
  .pager button {
    width: 36px;
    height: 36px;
  }
}
</style>
