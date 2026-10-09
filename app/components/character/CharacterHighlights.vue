<script setup lang="ts">
import type { CharacterDetail } from '#shared/types'

const props = defineProps<{ character: CharacterDetail }>()

const HIGHLIGHTS = [
  { name: '보스 몬스터 데미지', label: '보공', unit: '%', color: 'var(--loss)' },
  { name: '방어율 무시', label: '방무', unit: '%', color: 'var(--calc)' },
  { name: '최종 데미지', label: '최종뎀', unit: '%', color: 'var(--gold)' },
  { name: '크리티컬 데미지', label: '크뎀', unit: '%', color: '#ff9f5a' },
  { name: '스타포스', label: '스타포스', unit: '', color: 'var(--exp)' },
  { name: '아케인포스', label: '아케인', unit: '', color: 'var(--api)' },
  { name: '어센틱포스', label: '어센틱', unit: '', color: '#c48bff' },
  { name: '추가 경험치 획득', label: '추가 경험치', unit: '%', color: 'var(--gain)' },
]

const tiles = computed(() => HIGHLIGHTS.flatMap(({ name, label, unit, color }) => {
  const value = props.character.stats.find(s => s.name === name)?.value
  return value === undefined ? [] : [{ name, label, color, value: `${Number(value).toLocaleString('ko-KR')}${unit}` }]
}))
</script>

<template>
  <GameWindow title="주요 능력치" accent="green" fill>
    <ul class="tiles stagger">
      <li v-for="tile in tiles" :key="tile.name" class="tile" :style="{ '--tone': tile.color }" :title="tile.name">
        <span class="tile-label ellipsis">{{ tile.label }}</span>
        <span class="tile-value">{{ tile.value }}</span>
      </li>
    </ul>
  </GameWindow>
</template>

<style scoped>
.tiles {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 6px;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tile {
  align-content: center;
  padding: 4px 10px;
}
.tile-value {
  font-size: 18px;
}
</style>
