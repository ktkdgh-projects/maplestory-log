<script setup lang="ts">
// 금액(억) + 가계부에 잡힐 날짜. 강화 칸은 강화 기록으로 센 참고값을 눌러서 그대로 채울 수 있다
const props = defineProps<{ value: number, date: string | null, label: string, reference?: number, estimated?: boolean }>()
const emit = defineEmits<{ save: [meso: number], date: [date: string | null] }>()

// 표는 억 단위 소수 둘째 자리(100만)까지 보여서, 그 자리까지 같으면 이미 채운 것으로 보고 참고값을 숨긴다
const SHOWN_UNIT = 1e6

const today = kstToday()
const showReference = computed(() => !!props.reference && Math.round(props.reference / SHOWN_UNIT) !== Math.round(props.value / SHOWN_UNIT))
</script>

<template>
  <div class="money">
    <ItemsEokCell :value="value" :label="label" @save="emit('save', $event)" />
    <div class="sub-line">
      <button
        v-if="showReference"
        type="button"
        class="ref"
        :title="`강화 기록으로 센 ${estimated ? '추정 ' : ''}값 ${formatKoreanNumber(reference!)} — 누르면 이 값으로 채워요${estimated ? ' (할인·복구 비용 빠짐)' : ''}`"
        @click="emit('save', Math.round(reference!))"
      >
        기록 {{ estimated ? '약 ' : '' }}{{ formatEok(reference!) }}
      </button>
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
.ref {
  padding: 0;
  background: none;
  border: 0;
  color: var(--api);
  font: inherit;
  cursor: pointer;
}
.ref:hover {
  text-decoration: underline;
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
