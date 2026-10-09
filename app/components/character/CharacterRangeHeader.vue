<script setup lang="ts">
defineProps<{ totals: { label: string, value: string, tone: string }[], hint: string }>()
defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="header">
    <div class="totals">
      <div v-for="total in totals" :key="total.label" class="tile" :style="{ '--tone': total.tone }">
        <span class="tile-label">{{ total.label }}</span>
        <span class="tile-value">{{ total.value }}</span>
      </div>
    </div>
    <div class="toolbar">
      <span class="muted">{{ hint }} · 줄무늬는 이미 올린 레벨</span>
      <button type="button" class="reset" @click="$emit('reset')">지금 레벨 → 만렙으로</button>
    </div>
  </div>
</template>

<style scoped>
.header {
  display: grid;
  gap: 10px;
}
.totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tile-value {
  font-size: 18px;
  white-space: nowrap;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.reset {
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--fast) ease;
}
.reset:hover {
  border-color: var(--calc);
}
</style>
