<script setup lang="ts">
import type { PartyTimeResponse } from '#shared/types'
import { PARTY_SLOT_COUNT, PARTY_SLOTS_PER_DAY } from '#shared/data/party'

definePageMeta({ layout: false })
useHead({
  title: '보스 시간 적기 · 레다봇',
  // 주소에 개인 링크 토큰이 있어서 검색에 안 잡히고 다른 사이트로 새지 않게 한다
  meta: [{ name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }],
})

const HOURS = Array.from({ length: PARTY_SLOTS_PER_DAY }, (_, i) => String(i * 2).padStart(2, '0'))

const token = useRoute().query.t
const { data, error } = await useFetch<PartyTimeResponse>('/api/discord/time', { query: { t: token } })

const openError = computed(() => (error.value?.data as { message?: string } | undefined)?.message ?? '디스코드에서 버튼을 다시 눌러 주세요.')

const toPicked = (slots: number[]) => Array.from({ length: PARTY_SLOT_COUNT }, (_, i) => slots.includes(i))
const picked = ref(toPicked(data.value?.slots ?? []))
const savedSlots = ref(data.value?.slots ?? [])
const saving = ref(false)
const failed = ref('')

const days = computed(() => Array.from({ length: 7 }, (_, d) => {
  const date = addDays(data.value!.week, d)
  return { label: WEEKDAYS[kstWeekday(date)]!, day: Number(date.slice(8)), start: d * PARTY_SLOTS_PER_DAY }
}))
const slots = computed(() => picked.value.flatMap((on, i) => (on ? [i] : [])))
const dirty = computed(() => slots.value.join() !== savedSlots.value.join())
const othersAll = (i: number) => !!data.value && data.value.othersSubmitted > 0 && data.value.othersCounts[i] === data.value.othersSubmitted
const status = computed(() => {
  if (failed.value) return failed.value
  if (dirty.value) return '저장하지 않은 변경이 있어요'
  return data.value?.saved ? '저장했어요. 마감 전까지 언제든 고칠 수 있어요' : '가능한 시간을 끌어서 칠해 주세요'
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

function loadLastWeek() {
  picked.value = toPicked(data.value!.lastWeekSlots)
}

async function save() {
  saving.value = true
  failed.value = ''
  try {
    data.value = await $fetch<PartyTimeResponse>('/api/discord/time', { method: 'PUT', body: { t: token, slots: slots.value } })
    savedSlots.value = data.value.slots
  }
  catch (e) {
    failed.value = (e as { data?: { message?: string } }).data?.message ?? '저장하지 못했어요. 다시 눌러 주세요.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="page">
    <p class="brand">레다봇</p>

    <section v-if="!data" class="card empty">
      <h1>링크를 열 수 없어요</h1>
      <p>{{ openError }}</p>
    </section>

    <template v-else>
      <header class="head">
        <h1>{{ data.partyName }} 보스 시간</h1>
        <p>{{ formatDayWeek(data.week) }} ~ {{ formatDayWeek(addDays(data.week, 6)) }} · 한 칸은 2시간</p>
      </header>

      <section class="card">
        <div class="grid" @pointerdown="startPaint" @pointermove="movePaint" @pointerup="endPaint" @pointercancel="endPaint">
          <span />
          <span v-for="h in HOURS" :key="h" class="hour">{{ h }}</span>
          <template v-for="d in days" :key="d.start">
            <span class="day"><b>{{ d.label }}</b>{{ d.day }}</span>
            <button
              v-for="(h, s) in HOURS"
              :key="s"
              type="button"
              class="cell"
              :class="{ on: picked[d.start + s], all: picked[d.start + s] && othersAll(d.start + s), hint: !picked[d.start + s] && othersAll(d.start + s) }"
              :data-i="d.start + s"
              :aria-pressed="picked[d.start + s]"
              :aria-label="`${d.label}요일 ${h}시부터 2시간`"
              @click="toggleByKey($event, d.start + s)"
            />
          </template>
        </div>
        <ul class="legend">
          <li><i class="on" />내가 가능</li>
          <li><i class="all" />낸 사람 모두 가능</li>
          <li><i class="hint" />다른 파티원은 다 되는 시간</li>
        </ul>
      </section>

      <section class="bar">
        <p class="status" :class="{ bad: failed, warn: !failed && dirty }" role="status">{{ status }}</p>
        <div class="actions">
          <button type="button" class="btn ghost compact" :disabled="!data.lastWeekSlots.length" @click="loadLastWeek">지난주 불러오기</button>
          <button type="button" class="btn" :disabled="saving || !dirty" @click="save">저장</button>
        </div>
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
  max-width: 720px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.brand {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
}
.head h1,
.empty h1 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 26px;
  font-weight: 400;
}
.head p,
.empty p {
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
.card h2 {
  margin: 0 0 10px;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}

.grid {
  display: grid;
  grid-template-columns: 34px repeat(12, minmax(0, 1fr));
  gap: 3px;
  touch-action: none;
  user-select: none;
}
.hour {
  color: var(--sub);
  font-family: var(--f-pixel);
  font-size: 10px;
  text-align: left;
}
.day {
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: var(--sub);
  font-size: 11px;
  line-height: 1.2;
}
.day b {
  color: var(--text);
  font-size: 14px;
}
.cell {
  height: 36px;
  padding: 0;
  background: var(--field);
  border: 1px solid var(--panel-line);
  border-radius: 4px;
  cursor: pointer;
}
.cell.hint {
  border: 2px dashed var(--gain);
}
.cell.on {
  background: var(--gold);
  border-color: var(--gold);
}
.cell.all {
  background: var(--gain);
  border-color: var(--gain);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  color: var(--sub);
  font-size: 13px;
}
.legend i {
  display: inline-block;
  width: 12px;
  height: 12px;
  margin-right: 6px;
  border-radius: 3px;
  vertical-align: -1px;
}
.legend .on {
  background: var(--gold);
}
.legend .all {
  background: var(--gain);
}
.legend .hint {
  border: 2px dashed var(--gain);
}

.bar {
  position: sticky;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.status {
  margin: 0;
  min-height: 20px;
  color: var(--sub);
  font-size: 14px;
}
.status.warn {
  color: var(--gold);
}
.status.bad {
  color: var(--loss);
}
.actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.members {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
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
