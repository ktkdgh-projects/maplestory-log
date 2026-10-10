<script setup lang="ts">
import type { LedgerSettings, MesoEntry, MesoHistoryKind, MesoHistoryRef, MesoHistoryResponse, MesoHistoryRow } from '#shared/types'

const PERIODS = [
  { key: 'month', label: '이번 달' },
  { key: 'prev', label: '지난 달' },
  { key: '3m', label: '3개월' },
  { key: '1y', label: '1년' },
] as const
// 줄 앞 아이콘(24칸 선 그림)
const KINDS: { key: Exclude<MesoHistoryKind, 'base'>, label: string, color: string, icon: string }[] = [
  { key: 'hunt', label: '사냥', color: 'var(--exp)', icon: 'M14.5 4H20v5.5L9.5 20 4 14.5 14.5 4ZM7 12l5 5M4 20l2.5-2.5' },
  { key: 'boss', label: '보스', color: 'var(--api)', icon: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z' },
  { key: 'sale', label: '조각 판매', color: 'var(--gain)', icon: 'M3 12V4h8l9 9-8 8-9-9ZM7.5 7.5h.01' },
  { key: 'item', label: '장비', color: 'var(--loss)', icon: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3Z' },
  { key: 'entry', label: '직접 등록', color: 'var(--calc)', icon: 'M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4' },
]
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

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
revalidate(refresh, refreshSettings)
async function refreshAll() {
  await Promise.all([refresh(), refreshSettings()])
}

// 종류 칩으로 걸러 보기. 맞추기 줄은 늘 보인다
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

const BASE_KIND = { label: '맞추기', color: 'var(--tip-line)', icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z' }
const kindOf = (kind: MesoHistoryKind) => KINDS.find(k => k.key === kind) ?? BASE_KIND
const dayLabel = (date: string) => `${formatDay(date)} (${WEEKDAYS[new Date(`${date}T12:00:00+09:00`).getUTCDay()]})`
const totals = computed(() => data.value?.totals ?? { income: 0, spent: 0, byKind: {} })
const kindLine = (sign: 'income' | 'spent') => KINDS
  .filter(k => totals.value.byKind[k.key]?.[sign])
  .map(k => `${k.label} ${formatShortNumber(totals.value.byKind[k.key]![sign])}`)
  .join(' · ')

// 여러 건을 묶은 줄은 눌러서 펼치고, 직접 등록은 눌러서 고친다. 나머지는 적은 화면으로 간다
const open = ref<string | null>(null)
function closeOutside(event: MouseEvent) {
  const grp = (event.target as HTMLElement).closest('[data-row]')
  if (!grp || grp.getAttribute('data-row') !== open.value) open.value = null
}
watch(open, (value) => {
  if (value) setTimeout(() => document.addEventListener('click', closeOutside))
  else document.removeEventListener('click', closeOutside)
})
onBeforeUnmount(() => document.removeEventListener('click', closeOutside))
const entryOpen = ref(false)
const editing = ref<MesoEntry | null>(null)
const sourceOf = (row: MesoHistoryRow, date: string) => {
  if (row.kind === 'hunt' || row.kind === 'sale') return { path: '/ledger/days', query: { date } }
  if (row.kind === 'boss') return { path: '/ledger/bosses', query: { date } }
  if (row.kind === 'item') return { path: '/items' }
  return null
}
function pick(row: MesoHistoryRow) {
  if (row.entry) {
    editing.value = row.entry
    entryOpen.value = true
  }
  else if (row.children.length) open.value = open.value === row.key ? null : row.key
}

// 보유 메소 흐름 그래프: 날마다 그날 끝 잔액
const W = 300
const H = 170
const PAD = { left: 46, right: 10, top: 14, bottom: 24 }
const chart = computed(() => {
  const series = data.value?.series ?? []
  if (series.length < 2) return null
  const values = series.map(s => s.balance)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1e8) {
    min -= 5e7
    max += 5e7
  }
  const span = max - min
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom)
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.balance).toFixed(1)}`).join(' ')
  const ticks = [max, (max + min) / 2, min].map(v => ({ y: y(v), label: formatShortNumber(v) }))
  // 하루에 가장 크게 줄어든 날을 짚는다
  let drop = { i: -1, by: 0 }
  series.forEach((s, i) => {
    const by = i ? s.balance - series[i - 1]!.balance : 0
    if (by < drop.by) drop = { i, by }
  })
  const last = series.length - 1
  return {
    line,
    area: `${line} L${x(last).toFixed(1)} ${H - PAD.bottom} L${x(0).toFixed(1)} ${H - PAD.bottom} Z`,
    ticks,
    end: { x: x(last), y: y(series[last]!.balance) },
    drop: drop.i > 0 ? { x: x(drop.i), y: y(series[drop.i]!.balance), date: series[drop.i]!.date, by: drop.by } : null,
    first: formatDay(series[0]!.date),
    lastLabel: formatDay(series[last]!.date),
  }
})

// 지우기: 확인 모달에서 한 번 더 묻고 그 기록을 적은 곳의 API로 지운다
const DELETE_PATHS: Record<MesoHistoryRef['kind'], string> = { hunt: 'hunts', sale: 'sales', clear: 'clears', entry: 'entries' }
const removing = ref<{ ref: MesoHistoryRef, label: string, amount: number, date: string } | null>(null)
const removeOpen = computed({
  get: () => !!removing.value,
  set: (value) => {
    if (!value) removing.value = null
  },
})
const removeBusy = ref(false)
const removeFailure = ref('')
function askRemove(ref: MesoHistoryRef, label: string, amount: number, date: string) {
  removeFailure.value = ''
  removing.value = { ref, label, amount, date }
}
async function confirmRemove() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await $fetch(`/api/ledger/${DELETE_PATHS[removing.value.ref.kind]}/${removing.value.ref.id}`, { method: 'DELETE' })
    removing.value = null
    await refreshAll()
  }
  catch (error) {
    removeFailure.value = errorMessage(error)
  }
  finally {
    removeBusy.value = false
  }
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
    <p v-if="error" class="form-error">{{ errorMessage(error) }}</p>

    <div class="tiles stagger">
      <div class="tile" style="--tone: var(--gold)">
        <span class="tile-label">지금 보유 메소</span>
        <span class="tile-value">{{ settings?.balance ? formatKoreanNumber(settings.balance.current) : '-' }}</span>
        <span class="tile-label">{{ settings?.balance ? `${formatDay(settings.balance.checkedAt)}에 ${formatKoreanNumber(settings.balance.checked)}으로 맞춤` : '보유 메소를 맞추면 잔액을 따라가요' }}</span>
      </div>
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
      <div class="list" :class="{ loading: status === 'pending' && !!data }">
        <div v-for="d in days" :key="d.date" class="day">
          <div class="day-h">
            <b>{{ dayLabel(d.date) }}</b>
            <span class="muted">{{ d.rows.filter(r => r.kind !== 'base').length }}줄</span>
            <span class="net" :class="d.net < 0 ? 'loss' : 'gain'">{{ d.net ? formatSigned(d.net) : '' }}</span>
          </div>
          <div v-for="r in d.rows" :key="r.key" class="grp" :class="{ open: open === r.key, base: r.kind === 'base' }" :data-row="r.key" :style="{ '--c': kindOf(r.kind).color }">
            <div class="row">
              <button type="button" class="row-main" :disabled="r.kind === 'base' || (!r.entry && !r.children.length)" :aria-expanded="r.children.length ? open === r.key : undefined" @click="pick(r)">
                <span class="ic" :class="{ item: r.icon }">
                  <img v-if="r.icon" :src="r.icon" alt="">
                  <!-- 사냥은 메소 동전 -->
                  <svg v-else-if="r.kind === 'hunt'" viewBox="0 0 24 24" class="coin" aria-hidden="true"><circle cx="12" cy="12" r="9" class="coin-face" /><circle cx="12" cy="12" r="5.5" class="coin-ring" /><path d="M9.5 14.5v-5l2.5 3 2.5-3v5" class="coin-mark" /></svg>
                  <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path :d="kindOf(r.kind).icon" /></svg>
                </span>
                <span class="what">
                  <b class="title"><span class="ellipsis">{{ r.title }}</span><svg v-if="r.children.length" class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></b>
                  <small class="ellipsis">{{ r.detail }}</small>
                </span>
                <span class="amt" :class="r.kind === 'base' ? '' : r.amount < 0 ? 'loss' : 'gain'">{{ r.kind === 'base' ? '기준' : formatSigned(r.amount) }}</span>
                <span class="bal">{{ r.balance === null ? '' : formatKoreanNumber(r.balance) }}</span>
              </button>
              <!-- 지우기·이동 버튼. 없는 줄도 자리는 잡아 둔다 -->
              <span class="acts">
                <button v-if="r.ref" type="button" class="act del" title="지우기" aria-label="지우기" @click="askRemove(r.ref, r.title, r.amount, d.date)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
                <span v-else class="act-space" />
                <NuxtLink v-if="sourceOf(r, d.date)" :to="sourceOf(r, d.date)!" class="act go" :title="`${kindOf(r.kind).label} 화면으로`" aria-label="적은 화면으로"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></NuxtLink>
                <span v-else class="act-space" />
              </span>
            </div>
            <div v-if="r.children.length" class="children-wrap">
              <ul class="children" :inert="open !== r.key">
                <li v-for="(c, i) in r.children" :key="i">
                  <img v-if="c.icon" :src="c.icon" alt="" class="child-icon">
                  <span v-else class="child-dot" />
                  <span class="child-label ellipsis">{{ c.label }}</span>
                  <b class="child-amt" :class="c.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(c.amount) }}</b>
                  <button v-if="c.ref" type="button" class="child-del" title="지우기" :aria-label="`${c.label} 지우기`" @click="askRemove(c.ref, c.label, c.amount, d.date)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
                  <span v-else class="child-del-space" />
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-if="!days.length" class="empty">
          <img src="/favicon.svg" alt="" width="40" height="40">
          <p class="muted">{{ !data || status === 'pending' ? '내역을 불러오는 중이에요…' : '이 기간엔 메소가 움직인 기록이 없어요.' }}</p>
        </div>
      </div>

      <aside class="chart-card">
        <h3>보유 메소 흐름</h3>
        <p class="muted small">날마다 그날 끝 잔액</p>
        <svg v-if="chart" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${chart.first}부터 ${chart.lastLabel}까지 보유 메소`">
          <defs>
            <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="currentColor" stop-opacity="0.28" />
              <stop offset="1" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <g class="grid">
            <line v-for="t in chart.ticks" :key="t.label" :x1="PAD.left" :x2="W - PAD.right" :y1="t.y" :y2="t.y" />
          </g>
          <g class="axis">
            <text v-for="t in chart.ticks" :key="t.label" :x="PAD.left - 6" :y="t.y + 3.5" text-anchor="end">{{ t.label }}</text>
            <text :x="PAD.left" :y="H - 6" text-anchor="start">{{ chart.first }}</text>
            <text :x="W - PAD.right" :y="H - 6" text-anchor="end">{{ chart.lastLabel }}</text>
          </g>
          <path :d="chart.area" fill="url(#balance-fill)" class="area" />
          <path :d="chart.line" fill="none" class="line" stroke-width="2" />
          <circle v-if="chart.drop" :cx="chart.drop.x" :cy="chart.drop.y" r="4" class="drop" />
          <circle :cx="chart.end.x" :cy="chart.end.y" r="4.5" class="end" />
        </svg>
        <p v-else class="muted small chart-empty">보유 메소를 맞추고 기록이 이틀 이상 쌓이면 그래프가 그려져요.</p>
        <p v-if="chart?.drop" class="muted small">가장 크게 줄어든 날 <b class="loss">{{ formatDay(chart.drop.date) }} {{ formatSigned(chart.drop.by) }}</b></p>
      </aside>
    </div>

    <AppModal v-model="removeOpen" title="기록 지우기" :width="376">
      <div v-if="removing" class="confirm">
        <div class="confirm-row">
          <span><b>{{ removing.label }}</b><small class="muted">{{ formatDay(removing.date) }}</small></span>
          <b :class="removing.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(removing.amount) }}</b>
        </div>
        <p class="muted small">지우면 보유 메소와 일별 기록에서도 빠지고 되돌릴 수 없어요.</p>
        <p v-if="removeFailure" class="form-error">{{ removeFailure }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn ghost compact" @click="removeOpen = false">취소</button>
          <button type="button" class="btn compact remove-btn" :disabled="removeBusy" @click="confirmRemove">지우기</button>
        </div>
      </div>
    </AppModal>

    <LedgerEntryModal v-model="entryOpen" :entry="editing" :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" :balance="settings?.balance?.current ?? null" @saved="refreshAll" />
  </GameWindow>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
  opacity: 0.55;
  transition: opacity var(--fast) ease, border-color var(--fast) ease;
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
.list {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 0;
  max-height: 100%;
  padding-right: 6px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  transition: opacity var(--fast) ease;
}
.list.loading {
  opacity: 0.55;
}
.day {
  display: grid;
  gap: 4px;
}
.day-h {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 2px 2px 0;
  font-size: 12.5px;
}
.day-h b {
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.net {
  margin-left: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
/* 줄 + 펼친 내역을 한 카드로. 열리면 테두리가 이어진다 */
.grp {
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 8px;
  transition: border-color var(--normal) ease, box-shadow var(--normal) ease;
}
.grp.open {
  border-color: color-mix(in srgb, var(--c) 55%, var(--panel-line));
  border-left-color: var(--c);
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
}
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}
/* 줄 끝 둥근 버튼 두 개 */
.acts {
  display: flex;
  gap: 2px;
  padding-right: 8px;
}
.act,
.act-space {
  width: 28px;
  height: 28px;
}
.act {
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease, border-color var(--fast) ease;
}
.act svg,
.child-del svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.act.del:hover {
  background: rgb(255 138 122 / 0.12);
  border-color: rgb(255 138 122 / 0.4);
  color: var(--loss);
}
.act.go:hover {
  background: rgb(242 193 78 / 0.12);
  border-color: rgb(242 193 78 / 0.4);
  color: var(--gold);
}
.child-del,
.child-del-space {
  grid-column: 5;
  justify-self: start;
  width: 24px;
  height: 24px;
}
.child-del {
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: 0;
  border-radius: 50%;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.child-del:hover {
  background: rgb(255 138 122 / 0.12);
  color: var(--loss);
}
.confirm {
  display: grid;
  gap: 10px;
}
.confirm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--loss);
  border-radius: 8px;
}
.confirm-row > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.confirm-row small {
  font-size: 12px;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.remove-btn {
  background: var(--loss);
  border-color: var(--loss);
  color: #2a1210;
}
.grp.base {
  background: repeating-linear-gradient(135deg, var(--panel), var(--panel) 8px, rgb(255 255 255 / 0.015) 8px, rgb(255 255 255 / 0.015) 16px);
}
.row-main {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto 120px;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 7px 4px 7px 10px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.row-main:disabled {
  cursor: default;
}
.row-main:not(:disabled):hover {
  background: rgb(255 255 255 / 0.03);
}
.ic {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: color-mix(in srgb, var(--c) 14%, var(--bar));
  border-radius: 7px;
  color: var(--c);
}
/* 아이템 아이콘은 칸 없이 그림만 */
.ic.item {
  background: none;
}
.ic svg.coin {
  width: 20px;
  height: 20px;
}
.coin-face {
  fill: #f2c14e;
  stroke: #b98a1e;
  stroke-width: 1.4;
}
.coin-ring {
  fill: none;
  stroke: #fff2b8;
  stroke-width: 1.2;
  opacity: 0.8;
}
.coin-mark {
  fill: none;
  stroke: #8a5d10;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}
.ic img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  image-rendering: pixelated;
}
.child-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  image-rendering: pixelated;
}
.ic svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.what {
  display: grid;
  min-width: 0;
}
.what b {
  font-size: 14px;
}
.what small {
  color: var(--sub);
  font-size: 12px;
}
.title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.caret {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
  transition: transform var(--normal) var(--ease-out);
}
.grp.open .caret {
  transform: rotate(180deg);
}
.amt {
  font-family: var(--f-title);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.bal {
  color: var(--sub);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
/* 높이를 0fr ↔ 1fr로 옮겨 부드럽게 펼친다 */
.children-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--normal) var(--ease-out);
}
.grp.open .children-wrap {
  grid-template-rows: 1fr;
}
.children {
  display: grid;
  gap: 1px;
  min-height: 0;
  margin: 0;
  padding: 0 2px 0 48px;
  overflow: hidden;
  background: rgb(10 12 22 / 0.35);
  list-style: none;
  font-size: 12.5px;
  opacity: 0;
  transition: opacity var(--normal) ease, padding var(--normal) var(--ease-out);
}
.grp.open .children {
  padding-block: 6px 8px;
  border-top: 1px dashed var(--panel-line);
  opacity: 1;
}
/* 위 줄과 같은 칸: 그림 · 이름 · 금액 · 잔액 자리 · 지우기 */
.children li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto 120px 58px;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
}
.child-amt {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}
.child-dot {
  justify-self: center;
  width: 6px;
  height: 6px;
  background: var(--c);
  border-radius: 50%;
}
.child-label {
  color: var(--sub);
}
.empty {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 40px 0;
  text-align: center;
}
.chart-card {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.chart-card h3 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.chart-card svg {
  display: block;
  width: 100%;
  height: auto;
  color: var(--gold);
}
.grid line {
  stroke: var(--panel-line);
  stroke-width: 1;
}
.axis text {
  fill: var(--sub);
  font-size: 10px;
}
.line {
  stroke: var(--gold);
}
.drop {
  fill: var(--loss);
}
.end {
  fill: var(--gold);
  stroke: var(--page);
  stroke-width: 1.5;
}
.chart-empty {
  padding: 30px 0;
  text-align: center;
}
.small {
  font-size: 12.5px;
}
@media (max-width: 1000px) {
  .tiles {
    grid-template-columns: 1fr 1fr;
  }
  .body {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .row-main {
    grid-template-columns: 28px minmax(0, 1fr) auto;
  }
  .bal {
    display: none;
  }
}
</style>
