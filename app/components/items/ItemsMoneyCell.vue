<script setup lang="ts">
defineProps<{ value: number, date: string | null, label: string }>()
const emit = defineEmits<{ save: [meso: number], date: [date: string | null] }>()

const today = kstToday()
</script>

<template>
  <div class="money">
    <ItemsEokCell :value="value" :label="label" @save="emit('save', $event)" />
    <div class="sub-line">
      <!-- 가계부에 이 날로 잡힌다 -->
      <DatePicker v-if="value" class="date" :model-value="date ?? ''" :max="today" :placeholder="`${label} 날짜`" @update:model-value="emit('date', $event || null)" />
    </div>
  </div>
</template>

<style scoped>
.money {
  display: grid;
  padding: 3px 0;
}
.sub-line {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  min-height: 15px;
  padding: 0 9px;
  font-size: 11px;
  line-height: 15px;
}
.date :deep(.trigger),
.date :deep(.trigger.on) {
  gap: 3px;
  padding: 0;
  background: none;
  color: var(--sub);
  font-size: 11px;
  font-weight: 400;
  line-height: 15px;
}
.date :deep(.trigger:hover) {
  color: var(--gold);
}
.date :deep(.trigger svg) {
  width: 10px;
  height: 10px;
}
</style>
