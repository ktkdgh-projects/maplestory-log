<script setup lang="ts">
import type { LedgerResponse, LedgerSettings } from '#shared/types'
import { dayNet, mesoPerHour, summarizeLedger } from '#shared/calc/ledger'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'
import { bossPeriod } from '#shared/data/bosses'

const { me } = await useMe()
const route = useRoute()
const today = kstToday()
// 메소 내역에서 날짜를 눌러 오면 그달·그날을 연다
const startDate = queryDate(route.query, today) ?? today
const month = ref(startDate.slice(0, 7))
const selectedDate = ref(startDate)

const { getCachedData, revalidate } = useRevisitCache()
const [{ data, error, refresh, status }, { data: settings, refresh: refreshSettings }] = await Promise.all([
  useFetch<LedgerResponse>('/api/ledger', { query: { month }, immediate: !!me.value, getCachedData }),
  useFetch<LedgerSettings>('/api/ledger/settings', { key: 'ledger-settings', immediate: !!me.value, getCachedData }),
])
revalidate(refresh, refreshSettings)

const summary = computed(() => summarizeLedger(data.value?.hunts ?? [], data.value?.clears ?? [], data.value?.items ?? [], data.value?.sales ?? [], data.value?.entries ?? []))
const perHour = computed(() => mesoPerHour(summary.value.total.huntMeso, summary.value.total.minutes))
const onDate = <T extends { date: string }>(list: T[] | undefined) => (list ?? []).filter(x => x.date === selectedDate.value)

// 다른 달을 받는 동안만 흐리게 한다(다시 들어와 새로 받을 때는 그대로)
const switching = ref(false)
watch(month, (m) => {
  switching.value = true
  if (selectedDate.value.slice(0, 7) !== m) selectedDate.value = m === today.slice(0, 7) ? today : `${m}-01`
})
watch(status, (value) => {
  if (value !== 'pending') switching.value = false
})
const loading = computed(() => switching.value && status.value === 'pending')

// 조각은 고른 날이 든 주(목요일 초기화)와 그 달에 먹은 개수를 위에 둔다
const weekStart = computed(() => bossPeriod('weekly', selectedDate.value))
const weekFragments = computed(() => {
  const end = addDays(weekStart.value, 6)
  return Object.entries(data.value?.fragmentsByDate ?? {}).reduce((n, [d, c]) => (d >= weekStart.value && d <= end ? n + c : n), 0)
})
const weekLabel = computed(() => (today >= weekStart.value && today <= addDays(weekStart.value, 6) ? '이번 주' : `${formatDay(weekStart.value)}~${formatDay(addDays(weekStart.value, 6))}`))
const monthLabel = computed(() => (month.value === today.slice(0, 7) ? '이번 달' : formatMonth(month.value)))

async function refreshAll() {
  await Promise.all([refresh(), refreshSettings()])
}

useHead({ title: '일별 기록 · 메이플스토리로그' })
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.days" />

  <GameWindow v-else class="fit" title="일별 기록" fill>
    <template #sub>
      <LedgerPager prev-label="지난달" next-label="다음달" :next-disabled="month >= today.slice(0, 7)" @prev="month = shiftMonth(month, -1)" @next="month = shiftMonth(month, 1)">{{ formatMonth(month) }}</LedgerPager>
    </template>

    <LedgerWallet :settings="settings ?? null" :add-button="false" @changed="refreshAll">
      <SourceBadge type="input" /> 직접 기록
      <template #end>
        <span class="frag-stat" :title="`${formatDay(weekStart)}(목)부터 한 주`"><img src="/icons/sol-erda-fragment.png" alt="">{{ weekLabel }} 먹은 조각 <b>{{ weekFragments.toLocaleString('ko-KR') }}개</b></span>
        <span class="frag-stat"><img src="/icons/sol-erda-fragment.png" alt="">{{ monthLabel }} 먹은 조각 <b>{{ summary.total.fragments.toLocaleString('ko-KR') }}개</b></span>
      </template>
    </LedgerWallet>
    <p class="load-error" :class="{ show: error }" role="alert">{{ error ? errorMessage(error) : ' ' }}</p>

    <div class="summary stagger" :class="{ loading }">
      <div class="tile" style="--tone: var(--gold)">
        <span class="tile-label">{{ formatMonth(month) }} 순수익</span>
        <span class="tile-value" :class="{ loss: dayNet(summary.total) < 0 }">{{ formatSigned(dayNet(summary.total)) }}</span>
        <span class="tile-label">
          <template v-if="summary.total.entryIn || summary.total.entryOut">직접 등록 <template v-if="summary.total.entryIn">수입 +{{ formatShortNumber(summary.total.entryIn) }}</template><template v-if="summary.total.entryIn && summary.total.entryOut"> · </template><template v-if="summary.total.entryOut">지출 -{{ formatShortNumber(summary.total.entryOut) }}</template></template>
          <template v-else>직접 등록 없음</template>
        </span>
      </div>
      <div class="tile" style="--tone: var(--api)">
        <span class="tile-label">사냥 메소<template v-if="perHour"> · 시간당 {{ formatShortNumber(perHour) }}</template></span>
        <span class="tile-value">{{ formatKoreanNumber(summary.total.huntMeso) }}</span>
        <span class="drop-list">
          <span v-for="d in HUNT_DROPS" :key="d.key"><i :style="{ background: d.color }" />{{ d.short }} <b>{{ summary.total[d.key].toLocaleString('ko-KR') }}</b></span>
          <span v-if="summary.total.saleMeso" class="sold">조각 판매 <b>+{{ formatShortNumber(summary.total.saleMeso) }}</b></span>
        </span>
      </div>
      <NuxtLink to="/ledger/bosses" class="tile link-tile" style="--tone: var(--calc)">
        <span class="tile-label">보스 수입 · {{ summary.total.clears }}마리<template v-if="summary.total.monthlyClears"> (월간 {{ summary.total.monthlyClears }})</template> →</span>
        <span class="tile-value">{{ formatKoreanNumber(summary.total.bossMeso) }}</span>
        <span class="tile-label"><LedgerBossSplit :crystal="summary.total.bossMeso - summary.total.bossLoot" :loot="summary.total.bossLoot" short /></span>
      </NuxtLink>
      <NuxtLink to="/items" class="tile link-tile" style="--tone: var(--loss)">
        <span class="tile-label">장비 지출<template v-if="summary.total.itemEarned"> · 판매 +{{ formatShortNumber(summary.total.itemEarned) }}</template></span>
        <span class="tile-value">{{ formatKoreanNumber(summary.total.itemSpent) }}</span>
        <span class="tile-label">구매 {{ formatShortNumber(summary.total.itemBought) }} · 강화 {{ formatShortNumber(summary.total.itemEnhanced) }} · 장비 결산 →</span>
      </NuxtLink>
    </div>
    <div class="split" :class="{ loading }">
      <LedgerCalendar v-model="selectedDate" :month="month" :days="summary.days" />
      <div class="day-panel">
        <LedgerDayPanel
          :date="selectedDate"
          :hunts="onDate(data?.hunts)"
          :clears="onDate(data?.clears)"
          :items="onDate(data?.items)"
          :item-lines="onDate(data?.itemLines)"
          :sales="onDate(data?.sales)"
          :entries="onDate(data?.entries)"
          :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE"
          :balance="settings?.balance?.current ?? null"
          @changed="refreshAll"
        />
      </div>
    </div>
  </GameWindow>
</template>

<style scoped>
.frag-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  background: color-mix(in srgb, var(--calc) 8%, var(--panel));
  border: 1px solid color-mix(in srgb, var(--calc) 35%, var(--panel-line));
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
  white-space: nowrap;
}
.frag-stat img {
  width: 18px;
  height: 18px;
  object-fit: contain;
  image-rendering: pixelated;
}
.frag-stat b {
  color: var(--calc);
  font-family: var(--f-title);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
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
.loading {
  opacity: 0.55;
  pointer-events: none;
}
.summary,
.split {
  transition: opacity var(--fast) ease;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.drop-list {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  color: var(--sub);
  font-size: 13px;
}
.link-tile {
  color: inherit;
  text-decoration: none;
}
.drop-list i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 2px;
  transform: rotate(45deg);
}
.sold b {
  color: var(--gain);
}
.drop-list b {
  font-family: var(--f-title);
  font-weight: 400;
}
.split {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1.7fr) minmax(340px, 1fr);
  gap: 14px;
  min-height: 0;
}
.day-panel {
  min-height: 0;
  padding: 12px 14px;
  background: rgb(10 12 22 / 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
/* 낮은 화면은 위 칸을 줄여 달력 칸 높이를 번다 */
@media (min-width: 1100px) and (max-height: 820px) {
  .summary .tile {
    gap: 0;
    padding: 6px 12px;
  }
  .summary .tile-value {
    font-size: 20px;
  }
}
@media (max-width: 1000px) {
  .summary {
    grid-template-columns: 1fr 1fr;
  }
  .split {
    grid-template-columns: 1fr;
  }
}
/* 좁은 화면은 칸마다 이름과 금액을 한 줄에 두어 금액이 꺾이지 않게 한다 */
@media (max-width: 520px) {
  .summary {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .summary .tile {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    column-gap: 10px;
    padding: 8px 12px;
  }
  .summary .tile > * {
    grid-column: 1 / -1;
  }
  .summary .tile > :first-child {
    grid-column: 1;
    grid-row: 1;
  }
  .summary .tile > .tile-value {
    grid-column: 2;
    grid-row: 1;
    font-size: 19px;
    white-space: nowrap;
  }
  .drop-list {
    font-size: 12px;
  }
  .day-panel {
    padding: 10px;
  }
}
</style>
