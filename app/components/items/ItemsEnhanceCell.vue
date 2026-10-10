<script setup lang="ts">
import type { ItemPurchase } from '#shared/types'

// 스타포스·잠재 비용 칸. 날짜별로 여러 번 적고, 가계부에는 건마다 그 날짜로 들어간다.
// 강화 기록으로 센 날짜별 값을 보고 그대로 넣거나, 그날 결산 페이지로 넘어간다
const props = defineProps<{
  label: string
  name: string
  entries: ItemPurchase[]
  reference: number
  referenceDays: ItemPurchase[]
  shared: boolean
  estimated?: boolean
  ocid: string | null
}>()
const emit = defineEmits<{ save: [entries: ItemPurchase[]] }>()

const open = ref(false)
const today = kstToday()
const date = ref(today)
const eok = ref('')
const total = computed(() => props.entries.reduce((sum, e) => sum + e.amount, 0))
// 표는 억 단위 소수 둘째 자리(100만)까지라, 그 자리까지 같으면 이미 채운 것으로 본다
const SHOWN_UNIT = 1e6
const same = (a: number, b: number) => Math.round(a / SHOWN_UNIT) === Math.round(b / SHOWN_UNIT)
const showReference = computed(() => !!props.reference && !same(props.reference, total.value))
const filled = (day: ItemPurchase) => props.entries.some(e => e.date === day.date && same(e.amount, day.amount))

const sorted = (list: ItemPurchase[]) => [...list].sort((a, b) => a.date.localeCompare(b.date))
function add() {
  const amount = Math.round(Number(eok.value.replace(/,/g, '')) * EOK)
  if (!Number.isFinite(amount) || amount <= 0) return
  emit('save', sorted([...props.entries, { date: date.value || today, amount }]))
  eok.value = ''
}
function remove(index: number) {
  emit('save', props.entries.filter((_, i) => i !== index))
}
// 그날 기록 값으로 넣기. 같은 날 적은 건이 있으면 바꾼다
function useDay(day: ItemPurchase) {
  emit('save', sorted([...props.entries.filter(e => e.date !== day.date), { date: day.date, amount: Math.round(day.amount) }]))
}
function useAllDays() {
  emit('save', props.referenceDays.map(d => ({ date: d.date, amount: Math.round(d.amount) })))
}
const reviewLink = (day: string) => (props.ocid ? { path: '/review', query: { ocid: props.ocid, date: day } } : null)
</script>

<template>
  <div class="enhance">
    <button type="button" class="total" :class="{ blank: !total }" :title="`${name} ${label} 비용 내역`" @click="open = true">
      {{ total ? formatEok(total) : '-' }}
    </button>
    <div class="sub-line">
      <button v-if="showReference" type="button" class="ref" :title="`강화 기록으로 센 ${estimated ? '추정 ' : ''}값 — 누르면 날짜별로 보여요${estimated ? ' (MVP 할인·복구 메소 포함, 노작값 빠짐)' : ''}`" @click="open = true">
        기록 {{ estimated ? '약 ' : '' }}{{ formatEok(reference) }}
      </button>
      <span v-else-if="shared" class="shared" title="같은 이름 장비가 여러 줄이라 강화 기록을 어느 줄에 붙일지 알 수 없어요">기록 나눌 수 없음</span>
      <button v-if="entries.length" type="button" class="count" @click="open = true">{{ entries.length }}건</button>
    </div>

    <AppModal v-model="open" :title="`${name} ${label} 비용`" :width="440">
      <p class="muted small">강화한 날마다 한 건씩 적어요. 가계부에는 건마다 그 날짜로 들어가요.</p>
      <ol v-if="entries.length" class="list">
        <li v-for="(e, i) in entries" :key="`${e.date}-${i}`">
          <span class="date">{{ formatShortDate(e.date) }}</span>
          <b>{{ formatEok(e.amount) }}억</b>
          <NuxtLink v-if="reviewLink(e.date)" :to="reviewLink(e.date)!" class="go" @click="open = false">이날 결산 →</NuxtLink>
          <span v-else />
          <button type="button" class="icon-btn" :aria-label="`${formatShortDate(e.date)} 내역 지우기`" @click="remove(i)">×</button>
        </li>
      </ol>
      <p v-else class="muted small">아직 적은 내역이 없어요.</p>
      <form class="add" @submit.prevent="add">
        <input v-model="date" type="date" class="field-input" :max="today" :aria-label="`${label} 한 날`" required>
        <input v-model="eok" class="field-input amount" inputmode="decimal" placeholder="억 단위 금액" aria-label="금액 (억)" required>
        <button class="btn compact">+ 추가</button>
      </form>
      <p class="sum">합계 <b>{{ formatKoreanNumber(total) }}</b></p>

      <section v-if="referenceDays.length" class="records">
        <div class="records-head">
          <b>강화 기록으로 센 값</b>
          <button type="button" class="link" @click="useAllDays">기록대로 날짜별로 채우기</button>
        </div>
        <ol class="list">
          <li v-for="d in referenceDays" :key="d.date">
            <span class="date">{{ formatShortDate(d.date) }}</span>
            <b class="muted-b">{{ estimated ? '약 ' : '' }}{{ formatEok(d.amount) }}억</b>
            <NuxtLink v-if="reviewLink(d.date)" :to="reviewLink(d.date)!" class="go" @click="open = false">이날 결산 →</NuxtLink>
            <span v-else />
            <button type="button" class="use" :disabled="filled(d)" @click="useDay(d)">{{ filled(d) ? '넣음' : '넣기' }}</button>
          </li>
        </ol>
      </section>
    </AppModal>
  </div>
</template>

<style scoped>
.enhance {
  display: grid;
  padding: 3px 0;
}
.total {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
  cursor: pointer;
}
.total:hover {
  background: var(--bar);
  border-color: var(--panel-line);
}
.total.blank {
  color: var(--panel-line);
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
.ref,
.count {
  padding: 0;
  background: none;
  border: 0;
  color: var(--api);
  font: inherit;
  cursor: pointer;
}
.count {
  color: var(--sub);
}
.ref:hover,
.count:hover {
  text-decoration: underline;
}
.shared {
  color: var(--dim);
  cursor: help;
}
.small {
  margin: 0;
  font-size: 12.5px;
}
.list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.list li {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto 44px;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: rgb(255 255 255 / 0.03);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}
.date {
  color: var(--sub);
  font-size: 13px;
}
.muted-b {
  color: var(--sub);
  font-weight: 400;
}
.go {
  color: var(--gain);
  font-size: 12px;
  text-decoration: none;
}
.go:hover {
  text-decoration: underline;
}
.icon-btn {
  justify-self: end;
  padding: 0 6px;
  background: none;
  border: 0;
  color: var(--sub);
  font-size: 16px;
  cursor: pointer;
}
.icon-btn:hover {
  color: var(--loss);
}
.use {
  padding: 2px 0;
  background: none;
  border: 1px solid rgb(127 178 255 / 0.5);
  border-radius: 6px;
  color: var(--api);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.use:disabled {
  border-color: var(--panel-line);
  color: var(--sub);
  cursor: default;
}
.add {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) auto;
  gap: 6px;
}
.add .field-input {
  min-height: 36px;
  color-scheme: dark;
}
.sum {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
  text-align: right;
}
.sum b {
  color: var(--gold);
}
.records {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--panel-line);
}
.records-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}
.link {
  padding: 0;
  background: none;
  border: 0;
  color: var(--api);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
</style>
