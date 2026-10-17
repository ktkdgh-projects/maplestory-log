<script setup lang="ts">
import type { StageInfo } from '#shared/calc/starforce'

const props = defineProps<{ stages: StageInfo[] }>()

// 넘기는 데 평균 메소(1번 비용 ÷ 성공 확률)가 가장 큰 구간
const priciest = computed(() => {
  let best: StageInfo | null = null
  for (const s of props.stages) if (!best || s.cost / s.success > best.cost / best.success) best = s
  return best?.star ?? null
})
const percent = (p: number) => `${(p * 100).toFixed(p < 0.1 && p > 0 ? 2 : 1)}%`
</script>

<template>
  <div class="table-wrap">
    <table class="stages">
      <thead><tr><th>구간</th><th>성공</th><th>파괴</th><th>1번 비용</th><th>넘기는 데 평균</th></tr></thead>
      <tbody>
        <tr v-for="s in stages" :key="s.star" :class="{ hot: s.star === priciest }">
          <td><span class="star">★</span>{{ s.star }} → {{ s.star + 1 }}</td>
          <td class="gain">{{ percent(s.success) }}</td>
          <td :class="s.destroy ? 'loss' : 'dim'">{{ s.destroy ? percent(s.destroy) : '·' }}</td>
          <td>{{ formatShortNumber(s.cost) }}</td>
          <td>{{ Math.round(1 / s.success) }}번</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.star {
  color: var(--gold);
}
.table-wrap {
  overflow-x: auto;
}
.stages {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.stages th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
  text-align: right;
}
.stages td {
  padding: 6px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--panel-line) 50%, transparent);
  text-align: right;
}
.stages th:first-child,
.stages td:first-child {
  text-align: left;
}
.stages tr.hot td {
  background: color-mix(in srgb, var(--gold) 9%, transparent);
}
.stages tr.hot td:first-child {
  box-shadow: inset 3px 0 0 var(--gold);
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.dim {
  color: var(--tip-line);
}
</style>
