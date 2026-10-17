<script setup lang="ts">
import type { RestoreOption } from '#shared/calc/starforce'
import { restoreCopies } from '#shared/data/starforce'

const props = defineProps<{ restores: RestoreOption[], copyPrice: number }>()

// 이어지는 성급에서 고를 길이 같으면 한 칩으로 묶는다 (★23~29 → ★22 흔적 복구)
const restoreGroups = computed(() => {
  const groups: { from: number, to: number, choice: RestoreOption['choice'], trace: number | null, items: RestoreOption[] }[] = []
  for (const r of props.restores) {
    // 흔적 복구는 22성 이하면 그 성급으로, 23성 이상이면 22성으로 돌아가서 이 기준으로 묶는다
    const trace = r.choice === 'restore' && r.trace !== r.star ? r.trace : null
    const last = groups.at(-1)
    if (last && last.choice === r.choice && last.trace === trace && last.to === r.star - 1) {
      last.to = r.star
      last.items.push(r)
    }
    else groups.push({ from: r.star, to: r.star, choice: r.choice, trace, items: [r] })
  }
  return groups
})
const groupLabel = (g: typeof restoreGroups.value[number]) => {
  const range = g.from === g.to ? `★${g.from}` : `★${g.from}~${g.to}`
  const action = g.choice === 'twelve' ? '12성 복구' : g.trace ? `★${g.trace} 흔적 복구` : g.from === g.to ? `★${g.from} 흔적 복구` : '그 성급으로 흔적 복구'
  return { range, action }
}
const restorePicked = ref(0)
watch(restoreGroups, () => (restorePicked.value = 0))
function restoreDetail(r: RestoreOption) {
  const cost = r.choice === 'restore' ? `노작 ${restoreCopies(r.trace)}개 + 복구 메소 ${formatShortNumber(r.restoreCost - restoreCopies(r.trace) * props.copyPrice)}` : '노작 1개'
  return `${cost}${r.saving >= 1e6 ? ` · 다른 길보다 ${formatShortNumber(r.saving)} 이득` : ''}`
}
</script>

<template>
  <div class="restore-plan">
    <span class="calc-caption">{{ restores.length ? '터지면 이렇게 하는 게 이득이에요 · 누르면 비용' : '이 구간은 파괴되지 않아요' }}</span>
    <template v-if="restores.length">
      <ul>
        <li v-for="(g, gi) in restoreGroups" :key="g.from">
          <button type="button" :class="g.choice" :aria-pressed="restorePicked === gi" @click="restorePicked = gi">
            {{ groupLabel(g).range }} 파괴 → <b>{{ groupLabel(g).action }}</b>
          </button>
        </li>
      </ul>
      <p class="restore-detail" aria-live="polite">
        <span v-for="r in restoreGroups[restorePicked]?.items" :key="r.star">★{{ r.star }} · {{ restoreDetail(r) }}</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.restore-plan {
  display: grid;
  gap: 6px;
}
.restore-plan ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.restore-plan button {
  min-height: 32px;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
}
.restore-plan button.twelve {
  background: color-mix(in srgb, var(--api) 8%, transparent);
  border-color: color-mix(in srgb, var(--api) 45%, transparent);
}
.restore-plan button[aria-pressed="true"] {
  box-shadow: inset 0 0 0 1px var(--gold);
  color: var(--text);
}
.restore-plan button.twelve[aria-pressed="true"] {
  box-shadow: inset 0 0 0 1px var(--api);
}
.restore-plan b {
  color: var(--gold);
  font-weight: 700;
}
.restore-plan .twelve b {
  color: var(--api);
}
/* 고른 칩의 성급별 비용. 높이를 잡아 둬서 다른 칩을 눌러도 아래가 들썩이지 않는다 */
.restore-detail {
  display: grid;
  align-content: start;
  height: 74px;
  margin: 0;
  padding: 6px 10px;
  overflow-y: auto;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
  line-height: 1.6;
  scrollbar-width: thin;
}
</style>
