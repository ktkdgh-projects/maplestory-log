<script setup lang="ts">
import type { BossBoardResponse, LedgerResponse, LedgerSettings } from '#shared/types'
import { BOSS_PRICE_DATE, bossPeriod } from '#shared/data/bosses'

const TABS = [{ key: 'calendar', label: '달력' }, { key: 'bosses', label: '주간 보스' }, { key: 'setup', label: '보스 세팅' }] as const

const { me } = await useMe()
const today = kstToday()
const tab = ref<typeof TABS[number]['key']>('calendar')
const month = ref(today.slice(0, 7))
const week = ref(bossPeriod('weekly', today))
const selectedDate = ref(today)

const { data, error, refresh } = await useFetch<LedgerResponse>('/api/ledger', {
  query: { month },
  immediate: !!me.value,
})
const { data: board, refresh: refreshBoard } = await useFetch<BossBoardResponse>('/api/ledger/bosses', {
  query: { week },
  immediate: !!me.value,
})

const { data: settings, refresh: refreshSettings } = await useFetch<LedgerSettings>('/api/ledger/settings', {
  immediate: !!me.value,
})
const settingsOpen = ref(false)

const summary = computed(() => summarizeLedger(data.value?.hunts ?? [], data.value?.clears ?? [], data.value?.items ?? [], data.value?.sales ?? []))
const daySales = computed(() => (data.value?.sales ?? []).filter(s => s.date === selectedDate.value))
const dayItems = computed(() => (data.value?.items ?? []).filter(i => i.date === selectedDate.value))
const perHour = computed(() => mesoPerHour(summary.value.total.huntMeso, summary.value.total.minutes))
const dayHunts = computed(() => (data.value?.hunts ?? []).filter(h => h.date === selectedDate.value))
const dayClears = computed(() => (data.value?.clears ?? []).filter(c => c.date === selectedDate.value))

watch(month, (m) => {
  selectedDate.value = m === today.slice(0, 7) ? today : `${m}-01`
})

async function refreshAll() {
  await Promise.all([refresh(), refreshBoard(), refreshSettings()])
}
function goSetup() {
  tab.value = 'setup'
}

useHead({ title: '메소 가계부 · 메이플스토리로그' })
</script>

<template>
  <GameWindow v-if="!me" title="메소 가계부">
    <p class="muted">가계부는 API 키를 등록한 사용자만 쓸 수 있어요. 기록은 본인만 볼 수 있어요.</p>
    <div><NuxtLink to="/login" class="btn">API 키 등록하기</NuxtLink></div>
  </GameWindow>

  <GameWindow v-else class="fit" title="메소 가계부" fill>
    <template #sub>
      <span v-if="tab === 'calendar'" class="pager">
        <button type="button" aria-label="지난달" @click="month = shiftMonth(month, -1)">‹</button>
        <span>{{ formatMonth(month) }}</span>
        <button type="button" aria-label="다음달" :disabled="month >= today.slice(0, 7)" @click="month = shiftMonth(month, 1)">›</button>
      </span>
      <span v-else-if="tab === 'bosses'" class="pager">
        <button type="button" aria-label="지난주" @click="week = addDays(week, -7)">‹</button>
        <span>{{ formatMonthDay(week) }}(목) ~ {{ formatMonthDay(addDays(week, 6)) }}(수)</span>
        <button type="button" aria-label="다음주" :disabled="addDays(week, 7) > today" @click="week = addDays(week, 7)">›</button>
      </span>
    </template>

    <div class="tabs" role="tablist" aria-label="가계부 보기">
      <MenuButton v-for="t in TABS" :key="t.key" role="tab" :active="tab === t.key" :aria-selected="tab === t.key" @click="tab = t.key">{{ t.label }}</MenuButton>
      <span class="sources"><SourceBadge type="input" /> 직접 기록 <SourceBadge type="calc" /> 결정석({{ BOSS_PRICE_DATE }})</span>
      <button type="button" class="balance" :title="settings?.balance ? `${formatMonthDay(settings.balance.checkedAt)}에 맞춘 ${formatKoreanNumber(settings.balance.checked)}부터 계산` : '보유 메소를 맞추면 지금 보유 메소를 보여줘요'" @click="settingsOpen = true">
        <span class="balance-label">보유 메소</span>
        <b v-if="settings?.balance">{{ formatKoreanNumber(settings.balance.current) }}</b>
        <span v-else class="balance-empty">맞추기</span>
        <span class="gear" aria-hidden="true">⚙</span>
      </button>
    </div>
    <LedgerSettingsModal v-model="settingsOpen" :settings="settings ?? null" @saved="refreshSettings" />
    <p v-if="error" class="form-error">{{ errorMessage(error) }}</p>

    <Transition name="fade" mode="out-in">
      <div v-if="tab === 'calendar'" key="calendar" class="calendar-view">
        <div class="summary stagger">
          <div class="tile" style="--tone: var(--gold)">
            <span class="tile-label">{{ formatMonth(month) }} 순수익</span>
            <span class="tile-value" :class="{ loss: dayNet(summary.total) < 0 }">{{ formatSigned(dayNet(summary.total)) }}</span>
          </div>
          <div class="tile" style="--tone: var(--api)">
            <span class="tile-label">사냥 메소<template v-if="perHour"> · 시간당 {{ formatShortNumber(perHour) }}</template></span>
            <span class="tile-value">{{ formatKoreanNumber(summary.total.huntMeso) }}</span>
            <span class="drop-list">
              <span v-for="d in HUNT_DROPS" :key="d.key"><i :style="{ background: d.color }" />{{ d.short }} <b>{{ summary.total[d.key].toLocaleString('ko-KR') }}</b></span>
              <span v-if="summary.total.saleMeso" class="sold">조각 판매 <b>+{{ formatShortNumber(summary.total.saleMeso) }}</b></span>
            </span>
          </div>
          <div class="tile" style="--tone: var(--calc)">
            <span class="tile-label">보스 결정석</span>
            <span class="tile-value">{{ formatKoreanNumber(summary.total.bossMeso) }}</span>
            <span class="drop-list">
              <span>주간 <b>{{ formatShortNumber(summary.total.bossMeso - summary.total.bossMonthly) }}</b> · {{ summary.total.clears - summary.total.monthlyClears }}마리</span>
              <span>월간 <b>{{ formatShortNumber(summary.total.bossMonthly) }}</b> · {{ summary.total.monthlyClears }}마리</span>
            </span>
          </div>
          <NuxtLink to="/items" class="tile item-tile" style="--tone: var(--loss)">
            <span class="tile-label">장비 지출<template v-if="summary.total.itemEarned"> · 판매 +{{ formatShortNumber(summary.total.itemEarned) }}</template></span>
            <span class="tile-value">{{ formatKoreanNumber(summary.total.itemSpent) }}</span>
            <span class="tile-label">구매 {{ formatShortNumber(summary.total.itemBought) }} · 강화 {{ formatShortNumber(summary.total.itemEnhanced) }} · 장비 결산 →</span>
          </NuxtLink>
        </div>
        <div class="split">
          <LedgerCalendar v-model="selectedDate" :month="month" :days="summary.days" />
          <div class="day-panel">
            <LedgerDayPanel :date="selectedDate" :hunts="dayHunts" :clears="dayClears" :items="dayItems" :sales="daySales" :stock="data?.stock ?? { fragments: 0, traces: 0 }" :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" @changed="refreshAll" />
          </div>
        </div>
      </div>

      <LedgerBossBoard v-else-if="tab === 'bosses'" key="bosses" :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" :week="week" :roster="board?.roster ?? []" :clears="board?.clears ?? []" @changed="refreshAll" @setup="goSetup" />

      <LedgerBossRoster v-else key="setup" :roster="board?.roster ?? []" @saved="refreshBoard" />
    </Transition>
  </GameWindow>
</template>

<style scoped>
.pager {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}
.pager button {
  width: 30px;
  height: 30px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: border-color var(--fast) ease;
}
.pager button:hover:not(:disabled) {
  border-color: var(--gold);
}
.pager button:disabled {
  opacity: 0.35;
  cursor: default;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.sources {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--sub);
  font-size: 13px;
}
.balance {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px;
  background: linear-gradient(90deg, rgb(242 193 78 / 0.14), var(--panel));
  border: 1px solid var(--gold);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  transition: transform var(--fast) var(--ease-out), box-shadow var(--fast) ease;
}
.balance:hover {
  transform: translateY(-2px);
  box-shadow: var(--glow);
}
.balance-label {
  color: var(--sub);
  font-size: 13px;
}
.balance b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 19px;
  font-weight: 400;
}
.balance-empty {
  color: var(--gold);
  font-family: var(--f-title);
}
.gear {
  color: var(--sub);
}
.sources :deep(.badge) {
  padding: 2px 6px;
  font-size: 11px;
}
.calendar-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
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
.item-tile {
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
  overflow-y: auto;
  /* 목록을 펼쳐 스크롤바가 생겨도 폭이 줄어 내용이 출렁이지 않게 자리를 미리 비워 둔다 */
  scrollbar-gutter: stable;
  background: rgb(10 12 22 / 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  scrollbar-width: thin;
}
@media (max-width: 1000px) {
  .summary {
    grid-template-columns: 1fr 1fr;
  }
  .split {
    grid-template-columns: 1fr;
  }
}
</style>
