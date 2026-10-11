<script setup lang="ts">
const props = defineProps<{ type: 'api' | 'calc' | 'input' | 'none' }>()

const LABELS = { api: 'API', calc: '계산', input: '입력', none: '불가' }
const label = computed(() => LABELS[props.type])
</script>

<template>
  <span class="badge" :class="type">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-family: var(--f-title);
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
}
.badge::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.api { color: var(--api); }
.calc { color: var(--calc); }
.input { color: var(--input); }
.none { color: var(--none); }
</style>
