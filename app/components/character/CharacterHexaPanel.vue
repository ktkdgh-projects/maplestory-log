<script setup lang="ts">
import type { HexaCore } from '#shared/types'
import { HEXA_MAX_LEVEL, hexaCost, type HexaCostKind } from '#shared/data/hexa'

const props = defineProps<{ cores: HexaCore[] }>()

// API는 코어 종류만 주므로 첫 스킬 코어는 오리진, 그다음은 3rd, 공용 코어는 솔 야누스만 공용이고 나머지는 직업군 공용으로 본다
function costKind(core: HexaCore, index: number, cores: HexaCore[]): HexaCostKind {
  if (core.type === '스킬 코어') return cores.slice(0, index).some(c => c.type === '스킬 코어') ? 'skill3' : 'skill'
  if (core.type === '마스터리 코어') return 'mastery'
  if (core.type === '강화 코어') return 'enhance'
  return core.name.startsWith('솔 야누스') ? 'common' : 'jobCommon'
}

const initialRanges = () => props.cores.map(core => ({ from: core.level, to: HEXA_MAX_LEVEL }))
const ranges = ref(initialRanges())

const rows = computed(() => props.cores
  .map((core, i, all) => {
    const range = ranges.value[i]!
    return { core, range, cost: hexaCost(costKind(core, i, all), range.from, range.to) }
  })
  .sort((a, b) => b.core.level - a.core.level))

// 지금 레벨까지 이미 쓴 솔 에르다·조각
const spent = computed(() => {
  const used = { erda: 0, fragment: 0 }
  const all = { erda: 0, fragment: 0 }
  props.cores.forEach((core, i, list) => {
    const kind = costKind(core, i, list)
    const done = hexaCost(kind, 0, core.level)
    const full = hexaCost(kind, 0, HEXA_MAX_LEVEL)
    used.erda += done.erda
    used.fragment += done.fragment
    all.erda += full.erda
    all.fragment += full.fragment
  })
  const item = (label: string, tone: string, key: 'erda' | 'fragment') => ({
    label,
    tone,
    value: used[key].toLocaleString('ko-KR'),
    unit: '개',
    progress: all[key] ? used[key] / all[key] : 1,
    sub: all[key] > used[key] ? `만렙까지 ${(all[key] - used[key]).toLocaleString('ko-KR')}개 남음` : '모든 코어 만렙',
  })
  return [item('솔 에르다', 'var(--calc)', 'erda'), item('솔 에르다 조각', 'var(--api)', 'fragment')]
})

const totals = computed(() => {
  const erda = rows.value.reduce((sum, row) => sum + row.cost.erda, 0)
  const fragment = rows.value.reduce((sum, row) => sum + row.cost.fragment, 0)
  return [
    { label: '선택한 구간 솔 에르다', value: `${erda.toLocaleString('ko-KR')}개`, tone: 'var(--calc)' },
    { label: '선택한 구간 조각', value: `${fragment.toLocaleString('ko-KR')}개`, tone: 'var(--api)' },
  ]
})
</script>

<template>
  <div class="hexa">
    <p v-if="!rows.length" class="muted">장착한 헥사 코어가 없어요.</p>
    <template v-else>
      <CharacterRangeHeader :totals="totals" :spent="spent" hint="손잡이를 끌어 코어마다 구간을 정해요" @reset="ranges = initialRanges()" />
      <ul class="cores stagger">
        <li v-for="{ core, range, cost } in rows" :key="core.name" class="core">
          <div class="core-head">
            <span class="ellipsis" :title="core.name">{{ core.name }}</span>
            <small>{{ core.type }} · 현재 Lv.{{ core.level }}</small>
          </div>
          <RangeSlider
            v-if="core.level < HEXA_MAX_LEVEL"
            v-model:from="range.from"
            v-model:to="range.to"
            :min="0"
            :max="HEXA_MAX_LEVEL"
            :floor="core.level"
            :label="core.name"
          />
          <div class="core-foot">
            <b>Lv.{{ range.from }} → {{ range.to }}</b>
            <span v-if="cost.erda || cost.fragment" class="cost">에르다 {{ cost.erda }} · 조각 {{ cost.fragment.toLocaleString('ko-KR') }}</span>
            <span v-else-if="core.level >= HEXA_MAX_LEVEL" class="done">만렙</span>
            <span v-else class="muted">구간 없음</span>
          </div>
        </li>
      </ul>
    </template>
    <p class="footnote">비용: 나무위키 HEXA 강화표(2026-10-05 기준). 코어 종류 구분은 API 분류로 추정해요.</p>
  </div>
</template>

<style scoped>
.hexa {
  display: grid;
  gap: 10px;
}
.cores {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.core {
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.core-head {
  display: grid;
  min-width: 0;
  line-height: 1.3;
  font-size: 14px;
}
.core-head small {
  color: var(--sub);
  font-size: 12px;
}
.core-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 8px;
  font-size: 13px;
}
.core-foot b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.cost {
  color: var(--api);
}
.done {
  color: var(--gain);
}
</style>
