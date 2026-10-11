<script setup lang="ts">
import type { BossBoardResponse, LedgerSettings } from '#shared/types'
import { BOSS_PRICE_DATE, bossPeriod } from '#shared/data/bosses'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'

const { me } = await useMe()
const route = useRoute()
const today = kstToday()
// 메소 내역에서 보스 줄을 눌러 오면 그 주를 연다
const week = ref(bossPeriod('weekly', queryDate(route.query, today) ?? today))

const { getCachedData, revalidate } = useRevisitCache()
const [{ data: board, error, refresh }, { data: settings, refresh: refreshSettings }] = await Promise.all([
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
      <LedgerPager prev-label="지난주" next-label="다음주" :next-disabled="addDays(week, 7) > today" @prev="week = addDays(week, -7)" @next="week = addDays(week, 7)">
        {{ formatDay(week) }}(목) ~ {{ formatDay(addDays(week, 6)) }}(수)
      </LedgerPager>
    </template>

    <LedgerWallet :settings="settings ?? null" @changed="refreshAll">
      <SourceBadge type="calc" /> 결정석 {{ formatDay(BOSS_PRICE_DATE) }} 기준
    </LedgerWallet>
    <p class="load-error" :class="{ show: error }" role="alert">{{ error ? errorMessage(error) : ' ' }}</p>
    <LedgerBossBoard :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" :week="week" :roster="board?.roster ?? []" :clears="board?.clears ?? []" @changed="refreshAll" />
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
</style>
