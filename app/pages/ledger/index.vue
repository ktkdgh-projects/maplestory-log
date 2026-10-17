<script setup lang="ts">
import type { LedgerSettings, MesoEntry, MesoHistoryKind, MesoHistoryRef, MesoHistoryResponse } from '#shared/types'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'

const PERIODS = [
  { key: 'month', label: '이번 달' },
  { key: 'prev', label: '지난 달' },
  { key: '3m', label: '3개월' },
  { key: '1y', label: '1년' },
] as const
const KINDS: { key: Exclude<MesoHistoryKind, 'base'>, label: string, color: string, icon: string }[] = [
  { key: 'hunt', label: '사냥', color: 'var(--exp)', icon: 'M14.5 4H20v5.5L9.5 20 4 14.5 14.5 4ZM7 12l5 5M4 20l2.5-2.5' },
  { key: 'boss', label: '보스', color: 'var(--api)', icon: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z' },
  { key: 'sale', label: '조각 판매', color: 'var(--gain)', icon: 'M3 12V4h8l9 9-8 8-9-9ZM7.5 7.5h.01' },
  { key: 'item', label: '장비', color: 'var(--loss)', icon: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3Z' },
  { key: 'entry', label: '직접 등록', color: 'var(--calc)', icon: 'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4' },
]

const { me } = await useMe()
const today = kstToday()
const period = ref<typeof PERIODS[number]['key']>('month')
const range = computed(() => {
  const thisMonth = `${today.slice(0, 7)}-01`
  if (period.value === 'prev') {
    const from = `${shiftMonth(today.slice(0, 7), -1)}-01`
    return { from, to: addDays(thisMonth, -1) }
  }
  if (period.value === '3m') return { from: addDays(today, -89), to: today }
  if (period.value === '1y') return { from: addDays(today, -364), to: today }
  return { from: thisMonth, to: today }
})

const { getCachedData, revalidate } = useRevisitCache()
const [{ data, error, refresh, status }, { data: settings, refresh: refreshSettings }] = await Promise.all([
  // 다른 화면에서 고친 기록이 바로 보이게 내역은 들어올 때마다 새로 받는다
  useFetch<MesoHistoryResponse>('/api/ledger/history', { query: range, immediate: !!me.value, server: false }),
  useFetch<LedgerSettings>('/api/ledger/settings', { key: 'ledger-settings', immediate: !!me.value, getCachedData }),
])
revalidate(refreshSettings)
async function refreshAll() {
  await Promise.all([refresh(), refreshSettings()])
}

const shown = ref(new Set(KINDS.map(k => k.key)))
function toggleKind(key: Exclude<MesoHistoryKind, 'base'>) {
  const next = new Set(shown.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  shown.value = next
}
const days = computed(() => (data.value?.days ?? [])
  .map(d => ({ ...d, rows: d.rows.filter(r => r.kind === 'base' || shown.value.has(r.kind)) }))
  .filter(d => d.rows.length))

const totals = computed(() => data.value?.totals ?? { income: 0, spent: 0, byKind: {} })
// 그래프 아래 종류별 막대: 들어온 것과 나간 것을 가장 큰 값에 맞춰 같은 눈금으로 그린다
const kindBars = computed(() => {
  const rows = KINDS.map(k => ({ ...k, income: totals.value.byKind[k.key]?.income ?? 0, spent: totals.value.byKind[k.key]?.spent ?? 0 })).filter(k => k.income || k.spent)
  const max = Math.max(1, ...rows.flatMap(k => [k.income, k.spent]))
  return rows.map(k => ({ ...k, incomeWidth: (k.income / max) * 100, spentWidth: (k.spent / max) * 100 }))
})
const kindLine = (sign: 'income' | 'spent') => KINDS
  .filter(k => totals.value.byKind[k.key]?.[sign])
  .map(k => `${k.label} ${formatShortNumber(totals.value.byKind[k.key]![sign])}`)
  .join(' · ')

const entryOpen = ref(false)
const editing = ref<MesoEntry | null>(null)
function edit(entry: MesoEntry) {
  editing.value = entry
  entryOpen.value = true
}

// 지우기 실패는 확인 모달 안에 뜬다
const DELETE_PATHS: Record<MesoHistoryRef['kind'], string> = { hunt: 'hunts', sale: 'sales', clear: 'clears', entry: 'entries' }
const { ask } = useConfirm()
async function askRemove(target: MesoHistoryRef, label: string, amount: number, date: string) {
  const ok = await ask({
    title: '기록 지우기',
    name: label,
    detail: formatDay(date),
    amount,
    note: '지우면 보유 메소와 일별 기록에서도 빠지고 되돌릴 수 없어요.',
    run: () => $fetch(`/api/ledger/${DELETE_PATHS[target.kind]}/${target.id}`, { method: 'DELETE' }),
  })
  if (ok) await refreshAll()
}

useHead({ title: '메소 내역 · 메이플스토리로그' })
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.history" />

  <GameWindow v-else class="fit" title="메소 내역" fill>
    <template #sub>
      <span>{{ formatDay(range.from) }} ~ {{ range.from.slice(0, 4) === range.to.slice(0, 4) ? formatDay(range.to) : `${range.to.slice(0, 4)}년 ${formatMonthDay(range.to)}` }}</span>
    </template>

    <LedgerWallet :settings="settings ?? null" @changed="refreshAll" />
    <p class="load-error" :class="{ show: error }" role="alert">{{ error ? errorMessage(error) : ' ' }}</p>

    <!-- 지금 보유 메소는 위 지갑 줄에 있으므로 여기선 기간 흐름만 -->
    <div class="tiles stagger">
      <div class="tile" style="--tone: var(--gain)">
        <span class="tile-label">들어온 메소</span>
        <span class="tile-value gain">{{ data ? `+${formatKoreanNumber(totals.income)}` : '-' }}</span>
        <span class="tile-label ellipsis">{{ kindLine('income') || '기록 없음' }}</span>
      </div>
      <div class="tile" style="--tone: var(--loss)">
        <span class="tile-label">나간 메소</span>
        <span class="tile-value loss">{{ data ? `-${formatKoreanNumber(totals.spent)}` : '-' }}</span>
        <span class="tile-label ellipsis">{{ kindLine('spent') || '기록 없음' }}</span>
      </div>
      <div class="tile" style="--tone: var(--calc)">
        <span class="tile-label">순증감</span>
        <span class="tile-value" :class="totals.income - totals.spent < 0 ? 'loss' : 'gain'">{{ data ? formatSigned(totals.income - totals.spent) : '-' }}</span>
        <span class="tile-label">{{ PERIODS.find(p => p.key === period)!.label }} 기준</span>
      </div>
    </div>

    <div class="filters">
      <div class="seg" role="group" aria-label="기간">
        <button v-for="p in PERIODS" :key="p.key" type="button" :aria-pressed="period === p.key" @click="period = p.key">{{ p.label }}</button>
      </div>
      <div class="kinds" role="group" aria-label="종류">
        <button v-for="k in KINDS" :key="k.key" type="button" class="kind" :style="{ '--c': k.color }" :aria-pressed="shown.has(k.key)" @click="toggleKind(k.key)"><i />{{ k.label }}</button>
      </div>
    </div>

    <div class="body">
      <LedgerHistoryList :days="days" :kinds="KINDS" :loading="status === 'pending' && !!data" :waiting="!data || status === 'pending'" @edit="edit" @remove="askRemove" />
      <LedgerBalanceChart :series="data?.series ?? []" :bars="kindBars" />
    </div>

    <LedgerEntryModal v-model="entryOpen" :entry="editing" :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" :balance="settings?.balance?.current ?? null" @saved="refreshAll" />
  </GameWindow>
</template>

<style scoped>
.load-error {
  height: 18px;
  margin: -8px 0 -10px;
  overflow: hidden;
  color: var(--loss);
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0;
}
.load-error.show {
  opacity: 1;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.tile-value.gain {
  color: var(--gain);
}
.tile-value.loss {
  color: var(--loss);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.seg button {
  padding: 5px 12px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.seg button[aria-pressed="true"] {
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.kind {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 11px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity var(--fast) ease, border-color var(--fast) ease;
}
/* 끈 종류는 흐리고 점선이라 켠 것과 바로 구분된다 */
.kind[aria-pressed="false"] {
  border-style: dashed;
}
.kind i {
  width: 8px;
  height: 8px;
  background: var(--c);
  border-radius: 50%;
}
.kind[aria-pressed="true"] {
  border-color: var(--c);
  color: var(--text);
  opacity: 1;
}
.body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
  min-height: 0;
}
@media (max-width: 1000px) {
  .body {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 720px) {
  /* 칸마다 이름과 금액을 한 줄에 두어 금액이 두 줄로 꺾이지 않게 한다 */
  .tiles {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .tile {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: baseline;
    column-gap: 12px;
    padding: 8px 12px;
  }
  .tile > :first-child {
    grid-row: 1;
    grid-column: 1;
  }
  .tile > .tile-value {
    grid-row: 1;
    grid-column: 2;
    justify-self: end;
    font-size: 19px;
    white-space: nowrap;
  }
  .tile > :nth-child(3) {
    grid-column: 1 / -1;
    font-size: 12px;
  }
}
@media (max-width: 520px) {
  .filters {
    display: grid;
    gap: 6px;
  }
  .seg button {
    flex: 1;
    min-height: 34px;
  }
  /* 종류 칩은 한 줄로 두고 옆으로 밀어서 본다 */
  .kinds {
    flex-wrap: nowrap;
    margin: 0 -2px;
    padding: 0 2px 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .kind {
    flex: none;
    min-height: 32px;
  }
}
</style>
