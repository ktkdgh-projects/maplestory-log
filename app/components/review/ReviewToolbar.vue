<script setup lang="ts">
import type { CharacterBrief, SundayNotice } from '#shared/types'

const props = defineProps<{ characters: CharacterBrief[], date: string, today: string, recordDays: string[], sundays: SundayNotice[], range: { from: string, to: string }, canSunday: boolean }>()
const emit = defineEmits<{ pick: [date: string], shift: [weeks: number] }>()
const ocid = defineModel<string | null>('ocid', { required: true })
const mode = defineModel<'day' | 'sunday' | 'week'>('mode', { required: true })

const MODES = [{ key: 'day', label: '하루' }, { key: 'sunday', label: '썬데이' }, { key: 'week', label: '이번 주' }] as const

// 주는 월요일부터 센다
const mondayOf = (d: string) => addDays(d, -((kstWeekday(d) + 6) % 7))
const sundayOn = (d: string) => props.sundays.find(n => kstDateOf(n.start) <= d && d <= kstDateOf(n.end)) ?? null
const week = computed(() => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(props.date), i)))
// 주가 두 달에 걸치면 "8~9월", 다른 해면 앞에 연도를 붙인다
const weekMonth = computed(() => {
  const [a, b] = [Number(week.value[0]!.slice(5, 7)), Number(week.value[6]!.slice(5, 7))]
  const year = week.value[0]!.slice(0, 4)
  return `${year === props.today.slice(0, 4) ? '' : `${year.slice(2)}년 `}${a === b ? `${a}월` : `${a}~${b}월`}`
})
const sundayDays = computed(() => props.sundays.flatMap((n) => {
  const days: string[] = []
  for (let d = kstDateOf(n.start); d <= kstDateOf(n.end); d = addDays(d, 1)) days.push(d)
  return days
}))
</script>

<template>
  <div class="toolbar">
    <div class="pick">
      <CharacterSearch v-model="ocid" :characters="characters" all-label="전체 캐릭터" />
    </div>
    <div class="week" role="group" aria-label="날짜">
      <button type="button" class="nav" aria-label="지난주" @click="emit('shift', -1)">‹</button>
      <span class="month">{{ weekMonth }}</span>
      <div class="days">
        <button
          v-for="d in week"
          :key="d"
          type="button"
          class="day"
          :class="{ has: recordDays.includes(d), sun: !!sundayOn(d), today: d === today, inrange: mode !== 'day' && d >= range.from && d <= range.to, weekend: [0, 6].includes(kstWeekday(d)) }"
          :aria-pressed="mode === 'day' && date === d"
          :disabled="d > today"
          :aria-label="`${formatDayWeek(d)}${recordDays.includes(d) ? ' · 강화 기록 있음' : ''}${sundayOn(d) ? ' · 썬데이' : ''}`"
          @click="emit('pick', d)"
        >
          <small>{{ d === today ? '오늘' : WEEKDAYS[kstWeekday(d)] }}</small>
          <b>{{ Number(d.slice(8)) }}</b>
          <i aria-hidden="true" />
        </button>
      </div>
      <button type="button" class="nav" aria-label="다음 주" :disabled="mondayOf(date) >= mondayOf(today)" @click="emit('shift', 1)">›</button>
      <DatePicker :model-value="date" class="other" :max="today" :marks="recordDays" :accents="sundayDays" placeholder="달력" quiet @update:model-value="(d: string) => d && emit('pick', d)" />
    </div>
    <div class="seg" role="group" aria-label="기간">
      <button v-for="m in MODES" :key="m.key" type="button" :aria-pressed="mode === m.key" :disabled="m.key === 'sunday' && !canSunday" @click="mode = m.key">{{ m.label }}</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.week {
  display: flex;
  align-items: stretch;
  height: 44px;
  overflow: visible;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.nav {
  width: 28px;
  background: none;
  border: 0;
  color: var(--sub);
  font-size: 18px;
  cursor: pointer;
}
.nav:hover:not(:disabled) {
  color: var(--gold);
}
.nav:disabled {
  opacity: 0.3;
  cursor: default;
}
.month {
  display: grid;
  place-items: center;
  min-width: 44px;
  padding: 0 4px;
  border-right: 1px solid var(--panel-line);
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  white-space: nowrap;
}
.days {
  display: grid;
  grid-template-columns: repeat(7, 40px);
}
.day {
  position: relative;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 1px;
  padding: 0;
  background: none;
  border: 0;
  border-right: 1px solid color-mix(in srgb, var(--panel-line) 60%, transparent);
  color: var(--sub);
  font: inherit;
  line-height: 1.1;
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease;
}
.day small {
  font-size: 10.5px;
}
.day.weekend small {
  color: var(--api);
}
.day.today small {
  color: var(--gold);
  font-weight: 700;
}
.day b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.day i {
  width: 4px;
  height: 4px;
  background: transparent;
  border-radius: 50%;
}
.day.has i {
  background: var(--gold);
}
.day.sun::before {
  content: "";
  position: absolute;
  top: 0;
  left: 6px;
  right: 6px;
  height: 2px;
  background: var(--gain);
  border-radius: 0 0 2px 2px;
  box-shadow: 0 0 6px var(--gain);
}
.day.inrange {
  background: color-mix(in srgb, var(--gold) 7%, transparent);
}
.day:hover:not(:disabled) {
  background: color-mix(in srgb, var(--tint) 5%, transparent);
}
.day[aria-pressed="true"] {
  background: var(--gold);
}
.day[aria-pressed="true"] small,
.day[aria-pressed="true"] b {
  color: var(--on-gold);
}
.day[aria-pressed="true"] i {
  background: var(--on-gold);
}
.day:disabled {
  cursor: default;
}
.day:disabled b,
.day:disabled small {
  opacity: 0.3;
}
.other {
  border-left: 1px solid var(--panel-line);
}
.other :deep(.trigger) {
  height: 100%;
  border-radius: 0 9px 9px 0;
}
.seg {
  display: inline-flex;
  margin-left: auto;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.seg button {
  padding: 8px 12px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.seg button:last-child {
  border-right: 0;
}
.seg button[aria-pressed="true"] {
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.seg button:disabled {
  opacity: 0.35;
  cursor: default;
}
@media (max-width: 760px) {
  .seg {
    margin-left: 0;
  }
}
@media (max-width: 640px) {
  .pick {
    width: 100%;
  }
  .week {
    width: 100%;
    height: 50px;
  }
  .nav {
    flex: none;
    width: 26px;
  }
  .month {
    min-width: 0;
    padding: 0 4px;
    font-size: 12.5px;
  }
  .days {
    flex: 1;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
  .other :deep(.trigger) {
    gap: 0;
    padding: 0 10px;
    font-size: 0;
  }
  .seg {
    display: flex;
    width: 100%;
  }
  .seg button {
    flex: 1;
    min-height: 38px;
  }
}
</style>
