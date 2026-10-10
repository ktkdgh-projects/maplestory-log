<script setup lang="ts">
import type { BossBoardResponse, LedgerSettings } from '#shared/types'
import { BOSS_PRICE_DATE, bossPeriod } from '#shared/data/bosses'

const { me } = await useMe()
const route = useRoute()
const today = kstToday()
// 메소 내역에서 보스 줄을 눌러 오면 그 주를 연다
const queryDate = typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date) && route.query.date <= today ? route.query.date : today
const week = ref(bossPeriod('weekly', queryDate))

const { getCachedData, revalidate } = useRevisitCache()
const [{ data: board, refresh }, { data: settings, refresh: refreshSettings }] = await Promise.all([
  useFetch<BossBoardResponse>('/api/ledger/bosses', { query: { week }, immediate: !!me.value, getCachedData }),
  useFetch<LedgerSettings>('/api/ledger/settings', { key: 'ledger-settings', immediate: !!me.value, getCachedData }),
])
revalidate(refresh, refreshSettings)

async function refreshAll() {
  await Promise.all([refresh(), refreshSettings()])
}

useHead({ title: '보스 수입 · 메이플스토리로그' })
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.bosses" />

  <GameWindow v-else class="fit" title="보스 수입" fill>
    <template #sub>
      <span class="pager">
        <button type="button" aria-label="지난주" @click="week = addDays(week, -7)">‹</button>
        <span>{{ formatMonthDay(week) }}(목) ~ {{ formatMonthDay(addDays(week, 6)) }}(수)</span>
        <button type="button" aria-label="다음주" :disabled="addDays(week, 7) > today" @click="week = addDays(week, 7)">›</button>
      </span>
    </template>

    <LedgerWallet :settings="settings ?? null" @changed="refreshAll">
      <span class="sources"><SourceBadge type="calc" /> 결정석({{ BOSS_PRICE_DATE }})</span>
    </LedgerWallet>
    <LedgerBossBoard :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" :week="week" :roster="board?.roster ?? []" :clears="board?.clears ?? []" @changed="refreshAll" />
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
.sources {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--sub);
  font-size: 13px;
}
.sources :deep(.badge) {
  padding: 2px 6px;
  font-size: 11px;
}
</style>
