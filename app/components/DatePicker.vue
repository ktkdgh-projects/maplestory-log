<script setup lang="ts">
// 게임 창 느낌의 작은 달력. 값은 'YYYY-MM-DD' 문자열, 비우면 ''
const props = withDefaults(defineProps<{ min?: string, max?: string, placeholder?: string, suffix?: string }>(), { placeholder: '날짜 고르기', suffix: '' })
const value = defineModel<string>({ required: true })

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const open = ref(false)
const root = ref<HTMLElement>()
// 보고 있는 달의 1일
const view = ref(monthStart(value.value || props.max || kstToday()))

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}
function shiftMonth(date: string, months: number) {
  const [y, m] = date.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return d.toISOString().slice(0, 10)
}

const title = computed(() => `${Number(view.value.slice(0, 4))}년 ${Number(view.value.slice(5, 7))}월`)
const cells = computed(() => {
  const first = new Date(`${view.value}T00:00:00Z`)
  const lead = first.getUTCDay()
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const list: ({ date: string, day: number } | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) list.push({ date: `${view.value.slice(0, 8)}${String(d).padStart(2, '0')}`, day: d })
  return list
})
const today = kstToday()
const blocked = (date: string) => (!!props.min && date < props.min) || (!!props.max && date > props.max)
const canPrev = computed(() => !props.min || shiftMonth(view.value, -1) >= monthStart(props.min))
const canNext = computed(() => !props.max || shiftMonth(view.value, 1) <= monthStart(props.max))

function toggle() {
  if (!open.value) view.value = monthStart(value.value || props.max || today)
  open.value = !open.value
}
function pick(date: string) {
  if (blocked(date)) return
  value.value = date
  open.value = false
}
function clear() {
  value.value = ''
  open.value = false
}

function onOutside(event: Event) {
  if (open.value && !root.value?.contains(event.target as Node)) open.value = false
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="picker">
    <button type="button" class="trigger" :class="{ on: value }" :aria-expanded="open" aria-haspopup="dialog" @click="toggle">
      <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>
      {{ value ? `${formatMonthDay(value)}${suffix}` : placeholder }}
    </button>
    <Transition name="pop">
      <div v-if="open" class="pop" role="dialog" aria-label="날짜 고르기">
        <div class="pop-head">
          <button type="button" class="nav" :disabled="!canPrev" aria-label="이전 달" @click="view = shiftMonth(view, -1)">‹</button>
          <b>{{ title }}</b>
          <button type="button" class="nav" :disabled="!canNext" aria-label="다음 달" @click="view = shiftMonth(view, 1)">›</button>
        </div>
        <div class="grid">
          <span v-for="(w, i) in WEEKDAYS" :key="w" class="wd" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</span>
          <template v-for="(cell, i) in cells" :key="i">
            <span v-if="!cell" />
            <button
              v-else
              type="button"
              class="day"
              :class="{ picked: cell.date === value, today: cell.date === today, sun: i % 7 === 0, sat: i % 7 === 6 }"
              :disabled="blocked(cell.date)"
              @click="pick(cell.date)"
            >
              {{ cell.day }}
            </button>
          </template>
        </div>
        <div class="pop-foot">
          <button type="button" class="link" :disabled="blocked(today)" @click="pick(today)">오늘</button>
          <button v-if="value" type="button" class="link" @click="clear">지우기</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}
.trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 6px 11px;
  background: none;
  border: 0;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.trigger:hover {
  color: var(--text);
}
.trigger.on {
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.trigger svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
}
.pop {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 8px;
  width: 260px;
  padding: 12px;
  background: rgb(14 17 32 / 0.98);
  border: 1px solid var(--tip-line);
  border-radius: 12px;
  box-shadow: 0 16px 34px rgb(0 0 0 / 0.5);
}
.pop-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pop-head b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.nav {
  width: 28px;
  height: 28px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.nav:disabled {
  opacity: 0.3;
  cursor: default;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}
.wd {
  padding-bottom: 4px;
  color: var(--sub);
  font-size: 11px;
}
.sun {
  color: var(--loss);
}
.sat {
  color: var(--api);
}
.day {
  height: 30px;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease;
}
.day.sun {
  color: var(--loss);
}
.day.sat {
  color: var(--api);
}
.day:hover:not(:disabled) {
  background: var(--panel);
  border-color: var(--tip-line);
}
.day.today {
  border-color: rgb(242 193 78 / 0.5);
}
.day.picked {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.day:disabled {
  opacity: 0.25;
  cursor: default;
}
.pop-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 6px;
  border-top: 1px solid var(--panel-line);
}
.link {
  padding: 2px 4px;
  background: none;
  border: 0;
  color: var(--gold);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.link:disabled {
  opacity: 0.4;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity var(--fast) ease, translate var(--fast) var(--ease-out);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  translate: 0 -4px;
}
</style>
