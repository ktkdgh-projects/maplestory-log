<script setup lang="ts">
// 금액(억) + 가계부에 잡힐 날짜 (구매·판매 칸)
defineProps<{ value: number, date: string | null, label: string }>()
const emit = defineEmits<{ save: [meso: number], date: [date: string | null] }>()

const today = kstToday()
</script>

<template>
  <div class="money">
    <ItemsEokCell :value="value" :label="label" @save="emit('save', $event)" />
    <div class="sub-line">
      <label v-if="value" class="date" :title="`${label} 날짜 · 가계부에 이 날로 잡혀요`">
        <span>{{ date ? formatShortDate(date) : '날짜' }}</span>
        <input type="date" :value="date ?? ''" :max="today" :aria-label="`${label} 날짜`" @click="($event.target as HTMLInputElement).showPicker?.()" @change="emit('date', ($event.target as HTMLInputElement).value || null)">
      </label>
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
/* 날짜 글자만 보이고, 누르면 그 위에 겹친 날짜 입력이 달력을 연다 */
.date {
  position: relative;
  color: var(--sub);
  cursor: pointer;
}
.date:hover {
  color: var(--gold);
}
.date input {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
  color-scheme: dark;
}
</style>
