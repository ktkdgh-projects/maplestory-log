<script setup lang="ts">
import type { BossClear, DropSale, HuntEntry, ItemFlow, ItemFlowLine, MesoEntry } from '#shared/types'
import { dayNet, summarizeLedger } from '#shared/calc/ledger'
import { mesoEntryDelta } from '#shared/calc/meso'

const props = defineProps<{ date: string, hunts: HuntEntry[], clears: BossClear[], items: ItemFlow[], itemLines: ItemFlowLine[], sales: DropSale[], entries: MesoEntry[] }>()

const summary = computed(() => summarizeLedger(props.hunts, props.clears, props.items, props.sales, props.entries).total)
// 직접 등록은 종류(경매장 판매·기타 지출 등)별로 합쳐 보여 준다
const entryParts = computed(() => [...Map.groupBy(props.entries, e => e.type)].map(([type, list]) => ({ type, label: mesoEntryLabel(type), amount: list.reduce((n, e) => n + mesoEntryDelta(e), 0) })).sort((a, b) => b.amount - a.amount))

// 기록이 많아지면 한 종류만 골라 본다. 고른 종류는 날짜를 옮겨도 그대로 둔다
const FILTERS = [
  { key: 'all', label: '전체', c: 'var(--gold)' },
  { key: 'hunt', label: '사냥', c: 'var(--exp)' },
  { key: 'sale', label: '판매', c: 'var(--gain)' },
  { key: 'boss', label: '보스', c: 'var(--api)' },
  { key: 'item', label: '장비', c: 'var(--loss)' },
  { key: 'entry', label: '직접', c: 'var(--calc)' },
] as const
type Filter = (typeof FILTERS)[number]['key']
const filter = defineModel<Filter>('filter', { required: true })
const counts = computed<Record<Filter, number>>(() => {
  const c = { hunt: props.hunts.length, sale: props.sales.length, boss: props.clears.length, item: props.itemLines.length, entry: props.entries.length }
  return { all: c.hunt + c.sale + c.boss + c.item + c.entry, ...c }
})
</script>

<template>
  <header class="head">
    <b class="date">{{ formatDay(date) }}</b>
    <span class="income" :class="{ loss: dayNet(summary) < 0 }">{{ formatSigned(dayNet(summary)) }}</span>
  </header>
  <div class="parts">
    <span><i class="dot" style="--c: var(--exp)" />사냥 {{ formatKoreanNumber(summary.huntMeso) }}</span>
    <span><i class="dot" style="--c: var(--api)" />보스 <LedgerBossSplit :crystal="summary.bossMeso - summary.bossLoot" :loot="summary.bossLoot" /></span>
    <span v-if="summary.saleMeso"><i class="dot" style="--c: var(--gain)" />조각 판매 {{ formatKoreanNumber(summary.saleMeso) }}</span>
    <span v-for="p in entryParts" :key="p.type"><i class="dot" style="--c: var(--calc)" />{{ p.label }} {{ formatSigned(p.amount) }}</span>
    <NuxtLink v-if="summary.itemSpent || summary.itemEarned" to="/items" class="item-link">
      <i class="dot" style="--c: var(--loss)" />장비<template v-if="summary.itemBought"> 구매 -{{ formatKoreanNumber(summary.itemBought) }}</template><template v-if="summary.itemEnhanced"> 강화 -{{ formatKoreanNumber(summary.itemEnhanced) }}</template><template v-if="summary.itemEarned"> 판매 +{{ formatKoreanNumber(summary.itemEarned) }}</template>
    </NuxtLink>
  </div>
  <div class="tabs" role="tablist" aria-label="기록 종류">
    <button v-for="f in FILTERS" :key="f.key" type="button" role="tab" :aria-selected="filter === f.key" :class="{ none: !counts[f.key] }" :style="{ '--c': f.c }" @click="filter = f.key">
      {{ f.label }}<b>{{ counts[f.key] }}</b>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  flex: none;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  padding: 3px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 9px;
}
.tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  height: 30px;
  padding: 0 4px;
  background: none;
  border: 0;
  border-radius: 7px;
  color: var(--sub);
  font: 13px var(--f-title);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease;
}
.tabs button b {
  min-width: 18px;
  padding: 0 5px;
  background: color-mix(in srgb, var(--c) 18%, transparent);
  border-radius: 999px;
  color: var(--c);
  font-size: 11.5px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  line-height: 17px;
  text-align: center;
}
.tabs button.none b {
  background: none;
  color: var(--sub);
  opacity: 0.6;
}
.tabs button:hover {
  color: var(--text);
}
.tabs button[aria-selected="true"] {
  background: color-mix(in srgb, var(--c) 16%, var(--bar));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 55%, transparent);
  color: var(--text);
}
.head,
.parts {
  flex: none;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.date,
.income {
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
.income {
  color: var(--gold);
  white-space: nowrap;
}
.income.loss {
  color: var(--loss);
}
.parts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--sub);
  font-size: 13px;
}
.dot {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  background: var(--c);
  border-radius: 50%;
}
.item-link {
  color: var(--sub);
  text-decoration: none;
}
.item-link:hover {
  color: var(--text);
}
@media (max-width: 520px) {
  .date,
  .income {
    font-size: 21px;
  }
  .parts {
    gap: 2px 12px;
    font-size: 12.5px;
  }
}
</style>
