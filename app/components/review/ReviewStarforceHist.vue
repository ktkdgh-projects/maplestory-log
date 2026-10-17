<script setup lang="ts">
import type { StarforcePlan } from '#shared/calc/starforce'
import type { starforceVerdict } from '#shared/calc/review'

const props = defineProps<{ plan: StarforcePlan, verdict: NonNullable<ReturnType<typeof starforceVerdict>> }>()

const max = computed(() => props.plan.histogram.max || 1)
const at = (meso: number) => `${Math.min(100, (meso / max.value) * 100)}%`
</script>

<template>
  <div class="hist-wrap">
    <span class="caption">{{ plan.runs.toLocaleString('ko-KR') }}번 해 보면 드는 메소 · 초록 선이 나</span>
    <div class="hist">
      <i v-for="(b, i) in plan.histogram.bins" :key="i" :class="{ over: (i + 0.5) / plan.histogram.bins.length * plan.histogram.max > plan.p90 }" :style="{ height: `${(b / Math.max(...plan.histogram.bins)) * 100}%` }" />
      <span class="mark me" :class="{ flip: verdict.actual > max * 0.6 }" :style="{ left: at(verdict.actual) }"><span>나 {{ formatShortNumber(verdict.actual) }} · {{ luckText(verdict.rank!) }}</span></span>
      <span class="mark" :class="{ flip: verdict.expected > max * 0.6 }" :style="{ left: at(verdict.expected) }"><span>평균 {{ formatShortNumber(verdict.expected) }}</span></span>
    </div>
    <div class="axis"><span>0</span><span>{{ formatShortNumber(max / 2) }}</span><span>{{ formatShortNumber(max) }}+</span></div>
  </div>
</template>

<style scoped>
.caption {
  color: var(--sub);
  font-size: 12px;
}
.hist-wrap {
  display: grid;
  gap: 6px;
}
.hist {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 92px;
  margin-top: 34px;
  border-bottom: 1px solid var(--tip-line);
}
.hist i {
  flex: 1;
  background: color-mix(in srgb, var(--calc) 50%, transparent);
  border-radius: 3px 3px 0 0;
}
.hist i.over {
  background: color-mix(in srgb, var(--loss) 40%, transparent);
}
.mark {
  position: absolute;
  top: -8px;
  bottom: 0;
  border-left: 2px dashed var(--tip-line);
}
.mark span {
  position: absolute;
  top: -16px;
  left: 4px;
  color: var(--sub);
  font-size: 11px;
  white-space: nowrap;
}
.mark.flip span {
  right: 4px;
  left: auto;
}
.mark.me {
  border-left: 3px solid var(--gain);
}
.mark.me span {
  top: -30px;
  color: var(--gain);
  font-weight: 800;
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--sub);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
