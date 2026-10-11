<script setup lang="ts">
const props = withDefaults(defineProps<{ min?: string, max?: string, placeholder?: string, suffix?: string, marks?: string[], accents?: string[], quiet?: boolean, field?: boolean, id?: string }>(), { placeholder: '날짜 고르기', suffix: '', marks: () => [], accents: () => [] })
const value = defineModel<string>({ required: true })

const open = ref(false)
const root = ref<HTMLElement>()
const pop = ref<HTMLElement>()
// 달력은 body에 띄워 모달·창 테두리에 잘리지 않게 한다. 아래 자리가 모자라면 위로 연다
const POP_HEIGHT = 330
const POP_WIDTH = 260
const place = ref({ top: 0, left: 0 })
function measure() {
  const rect = root.value?.getBoundingClientRect()
  if (!rect) return
  const below = window.innerHeight - rect.bottom
  place.value = {
    top: below < POP_HEIGHT + 16 && rect.top > POP_HEIGHT ? rect.top - POP_HEIGHT - 8 : rect.bottom + 8,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - POP_WIDTH - 8)),
  }
}
const view = ref(monthStart(value.value || props.max || kstToday()))

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}
const shiftView = (date: string, months: number) => `${shiftMonth(date.slice(0, 7), months)}-01`

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
const canPrev = computed(() => !props.min || shiftView(view.value, -1) >= monthStart(props.min))
const canNext = computed(() => !props.max || shiftView(view.value, 1) <= monthStart(props.max))

function toggle() {
  if (!open.value) {
    view.value = monthStart(value.value || props.max || today)
    measure()
  }
  open.value = !open.value
}
const fieldLabel = computed(() => (value.value ? `${value.value.replaceAll('-', '. ')} (${WEEKDAYS[kstWeekday(value.value)]})` : props.placeholder))
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
  const target = event.target as Node
  if (open.value && !root.value?.contains(target) && !pop.value?.contains(target)) open.value = false
}
// 띄운 달력은 스크롤하면 자리가 어긋나므로 닫는다
function onScroll(event: Event) {
  if (open.value && !pop.value?.contains(event.target as Node)) open.value = false
}
// 모달 안에서는 달력만 닫고 모달은 그대로 둔다
function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.stopPropagation()
  open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>

<template>
  <div ref="root" class="picker" :class="{ field }">
    <button :id="id" type="button" class="trigger" :class="{ on: value && !quiet && !field, open }" :aria-expanded="open" aria-haspopup="dialog" @click="toggle">
      <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /></svg>
      <template v-if="field">{{ fieldLabel }}</template>
      <template v-else>{{ value && !quiet ? `${formatDay(value)}${suffix}` : placeholder }}</template>
    </button>
    <Teleport to="body">
      <Transition name="pop">
        <div v-if="open" ref="pop" class="pop" role="dialog" aria-label="날짜 고르기" :style="{ top: `${place.top}px`, left: `${place.left}px` }">
          <div class="pop-head">
            <button type="button" class="nav" :disabled="!canPrev" aria-label="이전 달" @click="view = shiftView(view, -1)">‹</button>
            <b>{{ title }}</b>
            <button type="button" class="nav" :disabled="!canNext" aria-label="다음 달" @click="view = shiftView(view, 1)">›</button>
          </div>
          <div class="grid">
            <span v-for="(w, i) in WEEKDAYS" :key="w" class="wd" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</span>
            <template v-for="(cell, i) in cells" :key="i">
              <span v-if="!cell" />
              <button
                v-else
                type="button"
                class="day"
                :class="{ picked: cell.date === value, today: cell.date === today, sun: i % 7 === 0, sat: i % 7 === 6, mark: marks.includes(cell.date), accent: accents.includes(cell.date) }"
                :disabled="blocked(cell.date)"
                @click="pick(cell.date)"
              >
                {{ cell.day }}
              </button>
            </template>
          </div>
          <div class="pop-foot">
            <button type="button" class="link" :disabled="blocked(today)" @click="pick(today)">오늘</button>
            <span v-if="marks.length" class="legend"><i class="dot" />기록 있는 날</span>
            <button v-if="value && !quiet && !field" type="button" class="link" @click="clear">지우기</button>
          </div>
        </div>
      </Transition>
    </Teleport>
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
.field .trigger {
  width: 100%;
  min-height: 38px;
  padding: 0 12px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
  transition: border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.field .trigger:hover,
.field .trigger.open {
  border-color: var(--gold);
}
.field .trigger.open {
  box-shadow: var(--glow);
}
.field .trigger svg {
  color: var(--sub);
}
.pop {
  position: fixed;
  z-index: 120;
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
  position: relative;
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
  border-color: color-mix(in srgb, var(--gold) 50%, transparent);
}
/* 기록 있는 날은 숫자 아래 금색 점, 썬데이 같은 날은 초록 테두리 */
.day.mark::after {
  content: "";
  position: absolute;
  bottom: 3px;
  left: 50%;
  width: 4px;
  height: 4px;
  background: var(--gold);
  border-radius: 50%;
  translate: -50% 0;
}
.day.accent {
  border-color: color-mix(in srgb, var(--gain) 55%, transparent);
}
.day.picked.mark::after {
  background: var(--on-gold);
}
.legend {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  margin-right: 8px;
  color: var(--sub);
  font-size: 11.5px;
}
.legend .dot {
  width: 5px;
  height: 5px;
  background: var(--gold);
  border-radius: 50%;
}
.trigger.open {
  color: var(--text);
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
</style>
