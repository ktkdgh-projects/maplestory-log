<script setup lang="ts">
import type { PartyTimeResponse } from '#shared/types'
import { PARTY_SLOT_COUNT, PARTY_SLOTS_PER_DAY, partyDayRanges } from '#shared/data/party'

definePageMeta({ layout: false })
useHead({
  title: '보스 시간 적기 · 레다봇',
  // 주소에 개인 링크 토큰이 있어서 검색에 안 잡히고 다른 사이트로 새지 않게 한다
  meta: [{ name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }],
})

// 세 칸(6시간)씩 묶어 시간대 이름을 붙인다
const BANDS = ['새벽', '오전', '오후', '저녁']
const BAND_SIZE = PARTY_SLOTS_PER_DAY / BANDS.length
const ROWS = Array.from({ length: PARTY_SLOTS_PER_DAY }, (_, s) => ({ s, hour: s * 2, band: s % BAND_SIZE === 0 ? BANDS[s / BAND_SIZE]! : '' }))
// 요일 번호는 목요일부터 센다: 목0 금1 토2 일3 월4 화5 수6
const PRESETS = [
  { label: '평일 20~24시', days: [0, 1, 4, 5, 6], from: 10, to: 12 },
  { label: '주말 12~24시', days: [2, 3], from: 6, to: 12 },
  { label: '매일 22~24시', days: [0, 1, 2, 3, 4, 5, 6], from: 11, to: 12 },
]

const token = useRoute().query.t
const { data, error } = await useFetch<PartyTimeResponse>('/api/discord/time', { query: { t: token } })
const openError = computed(() => (error.value?.data as { message?: string } | undefined)?.message ?? '디스코드에서 버튼을 다시 눌러 주세요.')

const toPicked = (slots: number[]) => Array.from({ length: PARTY_SLOT_COUNT }, (_, i) => slots.includes(i))
const picked = ref(toPicked(data.value?.slots ?? []))
const savedSlots = ref(data.value?.slots ?? [])
const saving = ref(false)
const failed = ref('')

const cell = (day: number, s: number) => day * PARTY_SLOTS_PER_DAY + s
const days = computed(() => Array.from({ length: 7 }, (_, d) => {
  const date = addDays(data.value!.week, d)
  const weekday = kstWeekday(date)
  return { d, label: WEEKDAYS[weekday]!, date: Number(date.slice(8)), weekend: weekday === 0 || weekday === 6 }
}))
const slots = computed(() => picked.value.flatMap((on, i) => (on ? [i] : [])))
const dirty = computed(() => slots.value.join() !== savedSlots.value.join())
const summary = computed(() => days.value.map(day => ({ ...day, text: partyDayRanges(slots.value, day.d) })).filter(day => day.text))
// 한 번도 안 냈으면 고른 시간이 없어도 "이번 주는 안 돼요"로 제출할 수 있다
const canSubmit = computed(() => !data.value?.closed && (dirty.value || !data.value?.saved))
const status = computed(() => {
  if (failed.value) return failed.value
  if (data.value?.closed) return '마감됐어요. 투표가 시작돼서 더는 고칠 수 없어요'
  if (dirty.value) return data.value?.saved ? '고친 내용을 아직 제출하지 않았어요' : '다 칠했으면 제출을 눌러 주세요'
  return data.value?.saved ? '제출했어요. 마감 전까지 고칠 수 있어요' : '되는 시간을 칠하고 제출을 눌러 주세요'
})

// 처음 누른 칸의 반대 상태로, 끌고 지나간 칸을 모두 칠한다
let painting: boolean | null = null
function cellAt(e: PointerEvent): number | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]')
  return el ? Number(el.dataset.i) : null
}
function startPaint(e: PointerEvent) {
  const i = cellAt(e)
  if (i === null) return
  painting = !picked.value[i]
  picked.value[i] = painting
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function movePaint(e: PointerEvent) {
  if (painting === null) return
  const i = cellAt(e)
  if (i !== null) picked.value[i] = painting
}
function endPaint() {
  painting = null
}
// 마우스·터치는 위에서 처리하고, 키보드로 누른 것만 여기서 바꾼다
function toggleByKey(e: MouseEvent, i: number) {
  if (e.detail === 0) picked.value[i] = !picked.value[i]
}

// 여러 칸을 한 번에 칠하고, 이미 다 칠해져 있으면 지운다
function toggleCells(cells: number[]) {
  const fill = !cells.every(i => picked.value[i])
  for (const i of cells) picked.value[i] = fill
}
const dayCells = (d: number) => ROWS.map(row => cell(d, row.s))
const timeCells = (s: number) => days.value.map(day => cell(day.d, s))
const presetCells = (preset: typeof PRESETS[number]) => preset.days.flatMap(d => ROWS.filter(row => row.s >= preset.from && row.s < preset.to).map(row => cell(d, row.s)))
const presetOn = (preset: typeof PRESETS[number]) => presetCells(preset).every(i => picked.value[i])

function loadLastWeek() {
  picked.value = toPicked(data.value!.lastWeekSlots)
}

async function submit() {
  saving.value = true
  failed.value = ''
  try {
    const sent = slots.value
    data.value = await $fetch<PartyTimeResponse>('/api/discord/time', { method: 'PUT', body: { t: token, slots: sent } })
    savedSlots.value = sent
  }
  catch (e) {
    failed.value = (e as { data?: { message?: string } }).data?.message ?? '제출하지 못했어요. 다시 눌러 주세요.'
  }
  finally {
    saving.value = false
  }
}

// 제출하지 않은 채 창을 닫으려 하면 브라우저가 한 번 물어본다
function warnUnsaved(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnUnsaved))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnsaved))
</script>

<template>
  <main class="page">
    <section v-if="!data" class="card">
      <p class="brand">레다봇</p>
      <h1>링크를 열 수 없어요</h1>
      <p class="sub">{{ openError }}</p>
    </section>

    <template v-else>
      <header class="head">
        <p class="brand">레다봇 · {{ data.partyName }}</p>
        <div class="title">
          <h1>보스 되는 시간을 칠해 주세요</h1>
          <NuxtLink v-if="data.leader" class="btn ghost compact" :to="{ path: '/party/lead', query: { t: token as string } }">파티장 화면</NuxtLink>
        </div>
        <p class="sub">{{ formatDayWeek(data.week) }} ~ {{ formatDayWeek(addDays(data.week, 6)) }}</p>
      </header>

      <section class="card">
        <div class="quick">
          <button v-for="preset in PRESETS" :key="preset.label" type="button" class="chip" :class="{ on: presetOn(preset) }" :aria-pressed="presetOn(preset)" @click="toggleCells(presetCells(preset))">{{ preset.label }}</button>
          <button type="button" class="chip" :disabled="!data.lastWeekSlots.length" @click="loadLastWeek">지난주 그대로</button>
        </div>

        <div class="grid" @pointerdown="startPaint" @pointermove="movePaint" @pointerup="endPaint" @pointercancel="endPaint">
          <span />
          <button v-for="day in days" :key="day.d" type="button" class="day" :class="{ weekend: day.weekend }" :aria-label="`${day.label}요일 하루 종일`" @click="toggleCells(dayCells(day.d))">
            <b>{{ day.label }}</b>{{ day.date }}
          </button>
          <template v-for="row in ROWS" :key="row.s">
            <button type="button" class="time" :class="{ band: row.band }" :aria-label="`매일 ${row.hour}시부터 2시간`" @click="toggleCells(timeCells(row.s))">
              <small>{{ row.band }}</small>{{ row.hour }}시
            </button>
            <button
              v-for="day in days"
              :key="day.d"
              type="button"
              class="cell"
              :class="{
                on: picked[cell(day.d, row.s)],
                up: row.s > 0 && picked[cell(day.d, row.s - 1)],
                down: row.s < PARTY_SLOTS_PER_DAY - 1 && picked[cell(day.d, row.s + 1)],
                band: row.band,
                weekend: day.weekend,
              }"
              :data-i="cell(day.d, row.s)"
              :aria-pressed="picked[cell(day.d, row.s)]"
              :aria-label="`${day.label}요일 ${row.hour}시부터 2시간`"
              @click="toggleByKey($event, cell(day.d, row.s))"
            />
          </template>
        </div>
        <p class="hint">한 칸은 2시간이에요. 끌어서 칠하고, 요일이나 시간을 누르면 한 줄이 칠해져요.</p>
      </section>

      <section class="card">
        <h2>고른 시간</h2>
        <ul v-if="summary.length" class="summary">
          <li v-for="day in summary" :key="day.d"><b :class="{ weekend: day.weekend }">{{ day.label }} {{ day.date }}일</b>{{ day.text }}</li>
        </ul>
        <p v-else class="sub">아직 고른 시간이 없어요.</p>
      </section>

      <section class="bar">
        <p class="status" :class="{ bad: failed, warn: !failed && dirty, done: !failed && !dirty && data.saved }" role="status">{{ status }}</p>
        <button type="button" class="btn" :disabled="saving || !canSubmit" @click="submit">{{ data.saved && !dirty ? '제출 완료' : '제출' }}</button>
      </section>

      <section class="card">
        <h2>파티원 {{ data.members.filter(m => m.submitted).length }} / {{ data.members.length }} 제출</h2>
        <ul class="members">
          <li v-for="m in data.members" :key="m.character" :class="{ done: m.submitted }">
            {{ m.character }}<span v-if="m.me" class="me">나</span><small>{{ m.submitted ? '제출' : '아직' }}</small>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page {
  max-width: 560px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.brand {
  margin: 0 0 4px;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
}
.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h1 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
h2 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.sub {
  margin: 4px 0 0;
  color: var(--sub);
  font-size: 14px;
}
.card {
  padding: 14px;
  background: var(--win);
  border: 1px solid var(--win-line);
  border-radius: 10px;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.chip {
  min-height: 34px;
  padding: 0 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.chip.on {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.chip:disabled {
  cursor: default;
  opacity: 0.45;
}

.grid {
  display: grid;
  grid-template-columns: 46px repeat(7, minmax(0, 1fr));
  gap: 0 4px;
  touch-action: none;
  user-select: none;
}
.day,
.time {
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font-family: inherit;
  cursor: pointer;
}
.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 6px;
  font-size: 11px;
  line-height: 1.25;
}
.day b {
  color: var(--text);
  font-size: 15px;
}
.day.weekend b,
.summary b.weekend {
  color: var(--gold);
}
.time {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  height: 34px;
  font-size: 12px;
  line-height: 1.1;
}
.time small {
  min-height: 11px;
  color: var(--gold);
  font-size: 10px;
}
.cell {
  height: 34px;
  padding: 0;
  background: var(--field);
  border: 0;
  border-top: 1px solid var(--panel-line);
  cursor: pointer;
}
.cell.weekend {
  background: color-mix(in srgb, var(--gold) 7%, var(--field));
}
.cell.band {
  border-top-color: var(--tip-line);
}
.cell.on {
  background: var(--gold);
  border-top-color: var(--gold);
  border-radius: 6px;
}
.cell.on.up {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top-color: color-mix(in srgb, var(--on-gold) 18%, var(--gold));
}
.cell.on.down {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}
.hint {
  margin: 12px 0 0;
  color: var(--sub);
  font-size: 13px;
}

.bar {
  position: sticky;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 10px 10px 14px;
  background: var(--panel);
  border: 1px solid var(--tip-line);
  border-radius: 10px;
}
.bar .btn {
  flex: none;
  min-width: 96px;
}
.bar .btn:disabled {
  cursor: default;
}
.status {
  margin: 0;
  color: var(--sub);
  font-size: 14px;
}
.status.warn {
  color: var(--gold);
}
.status.done {
  color: var(--gain);
}
.status.bad {
  color: var(--loss);
}
.summary {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.summary b {
  display: inline-block;
  min-width: 64px;
  font-weight: 700;
}

.members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}
.members li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  font-size: 14px;
}
.members li.done {
  border-color: var(--gain);
}
.members small {
  color: var(--sub);
}
.members li.done small {
  color: var(--gain);
}
.me {
  padding: 0 6px;
  background: var(--gold);
  border-radius: 999px;
  color: var(--on-gold);
  font-size: 11px;
}
</style>
