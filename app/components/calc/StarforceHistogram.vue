<script setup lang="ts">
import type { StarforcePlan } from '#shared/calc/starforce'

const props = defineProps<{ plan: StarforcePlan }>()

const markerRatio = (meso: number) => Math.min(1, meso / (props.plan.histogram.max || 1))
const markerAt = (meso: number) => `${markerRatio(meso) * 100}%`
// 오른쪽 끝에 가까운 선은 글자를 왼쪽에 붙여 그래프 밖으로 넘치지 않게 한다
const markerFlips = (meso: number) => markerRatio(meso) > 0.7
</script>

<template>
  <div class="hist-wrap">
    <span class="calc-caption">{{ plan.runs.toLocaleString('ko-KR') }}번 해 보면 드는 메소<template v-if="plan.runs < 1000"> · 오래 걸리는 구간이라 절반·10%는 대략</template></span>
    <div class="hist">
      <i v-for="(b, i) in plan.histogram.bins" :key="i" :class="{ over: (i + 0.5) / plan.histogram.bins.length * plan.histogram.max > plan.p90 }" :style="{ height: `${(b / Math.max(...plan.histogram.bins)) * 100}%` }" />
      <span class="marker" :class="{ flip: markerFlips(plan.p50) }" :style="{ left: markerAt(plan.p50) }"><span>절반 {{ formatShortNumber(plan.p50) }}</span></span>
      <span class="marker m90" :class="{ flip: markerFlips(plan.p90) }" :style="{ left: markerAt(plan.p90) }"><span>10% {{ formatShortNumber(plan.p90) }}</span></span>
    </div>
    <div class="axis"><span>0</span><span>{{ formatShortNumber(plan.histogram.max / 2) }}</span><span>{{ formatShortNumber(plan.histogram.max) }}+</span></div>
  </div>
</template>

<style scoped>
.hist-wrap {
  display: grid;
  gap: 6px;
}
.hist {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 96px;
  margin-top: 18px;
  padding: 0 4px;
  border-bottom: 1px solid var(--tip-line);
}
.hist i {
  flex: 1;
  background: color-mix(in srgb, var(--calc) 55%, transparent);
  border-radius: 3px 3px 0 0;
}
.hist i.over {
  background: color-mix(in srgb, var(--loss) 45%, transparent);
}
.marker {
  position: absolute;
  top: -6px;
  bottom: 0;
  border-left: 2px dashed var(--gold);
}
.marker span {
  position: absolute;
  top: -16px;
  left: 4px;
  color: var(--gold);
  font-size: 11px;
  white-space: nowrap;
}
.marker.flip span {
  right: 4px;
  left: auto;
}
.marker.m90 {
  border-color: var(--loss);
}
.marker.m90 span {
  color: var(--loss);
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--tip-line);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
