<script setup lang="ts">
import type { SymbolInfo } from '#shared/types'
import { findSymbolTable, symbolCost } from '#shared/data/symbol'

const props = defineProps<{ symbols: SymbolInfo[] }>()

const maxLevelOf = (symbol: SymbolInfo) => findSymbolTable(symbol.name)?.table.maxLevel ?? symbol.level
const initialRanges = () => props.symbols.map(symbol => ({ from: symbol.level, to: maxLevelOf(symbol) }))
const ranges = ref(initialRanges())

const rows = computed(() => props.symbols
  .map((symbol, i) => {
    const range = ranges.value[i]!
    return {
      symbol,
      range,
      maxLevel: maxLevelOf(symbol),
      shortName: symbol.name.split(':').at(-1)?.trim() ?? symbol.name,
      arcane: symbol.name.includes('아케인'),
      cost: symbolCost(symbol.name, range.from, range.to, symbol.level, symbol.growth),
    }
  })
  .sort((a, b) => Number(a.symbol.level >= a.maxLevel) - Number(b.symbol.level >= b.maxLevel)))

const totals = computed(() => {
  const sum = (arcane: boolean) => rows.value.filter(r => r.arcane === arcane).reduce((acc, r) => acc + (r.cost?.meso ?? 0), 0)
  return [
    { label: '선택한 구간 아케인', value: `${formatKoreanNumber(sum(true))} 메소`, tone: 'var(--api)' },
    { label: '선택한 구간 어센틱', value: `${formatKoreanNumber(sum(false))} 메소`, tone: '#c48bff' },
  ]
})
</script>

<template>
  <div class="symbols">
    <p v-if="!rows.length" class="muted">장착한 심볼이 없어요.</p>
    <template v-else>
      <CharacterRangeHeader :totals="totals" hint="손잡이를 끌어 심볼마다 구간을 정해요" @reset="ranges = initialRanges()" />
      <ul class="list stagger">
        <li v-for="{ symbol, range, maxLevel, shortName, arcane, cost } in rows" :key="symbol.name" class="card" :class="{ arcane }">
          <div class="top">
            <img :src="symbol.icon" alt="">
            <div class="title">
              <span class="ellipsis" :title="symbol.name">{{ shortName }}</span>
              <small v-if="symbol.level < maxLevel">현재 Lv.{{ symbol.level }} · 성장치 {{ symbol.growth }}/{{ symbol.requireGrowth }}</small>
            </div>
          </div>
          <div v-if="cost && symbol.level >= maxLevel" class="bottom">
            <b>Lv.{{ maxLevel }}</b>
            <span class="done">MAX</span>
          </div>
          <template v-else-if="cost">
            <RangeSlider v-model:from="range.from" v-model:to="range.to" :min="1" :max="maxLevel" :floor="symbol.level" :label="shortName" />
            <div class="bottom">
              <b>Lv.{{ range.from }} → {{ range.to }}</b>
              <span v-if="cost.meso" class="meso">{{ formatKoreanNumber(cost.meso) }} 메소 · {{ cost.symbols.toLocaleString('ko-KR') }}개</span>
              <span v-else class="muted">구간 없음</span>
            </div>
          </template>
          <span v-else class="footnote">비용표에 없는 지역이에요</span>
        </li>
      </ul>
    </template>
    <p class="footnote">메소는 지역별 강화 비용표 기준이에요.</p>
  </div>
</template>

<style scoped>
.symbols {
  display: grid;
  gap: 10px;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.card {
  --tone: #c48bff;
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}
.card.arcane {
  --tone: var(--api);
}
.top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.top img {
  flex: none;
  width: 34px;
  height: 34px;
  object-fit: contain;
}
.title {
  display: grid;
  min-width: 0;
  line-height: 1.3;
  font-size: 14px;
}
.title small {
  color: var(--sub);
  font-size: 12px;
}
.bottom {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 8px;
  font-size: 13px;
}
.bottom b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.meso {
  color: var(--gold);
}
.done {
  color: var(--gain);
  font-family: var(--f-pixel);
}
</style>
