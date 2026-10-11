<script setup lang="ts">
import type { GrowthDay } from '#shared/calc/growth'

const props = defineProps<{ days: GrowthDay[] }>()
const selected = defineModel<number>({ required: true })

const MIN_SHARE = 0.15

// 경험치 절대값을 모두 알면 그것으로, 하나라도 모르면 퍼센트로 칸 길이를 정한다
const useExp = computed(() => props.days.slice(1).every(d => d.gainExp !== null))
// flex-grow 합이 1보다 작으면 막대가 다 채워지지 않으므로 비율의 합을 1로 맞춘다
const sizes = computed(() => {
  const values = props.days.map(d => Math.max((useExp.value ? d.gainExp : d.gainPercent) ?? 0, 0))
  const max = Math.max(...values)
  const weights = values.map(v => (max > 0 ? Math.max(v / max, MIN_SHARE) : 1))
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map(w => w / total)
})
</script>

<template>
  <div class="road">
    <span class="label">EXP ROAD · 칸 길이 = 그날 얻은 경험치</span>
    <div class="bar">
      <button
        v-for="(d, i) in days"
        :key="d.date"
        type="button"
        class="seg"
        :style="{ flexGrow: sizes[i], animationDelay: `${i * 25}ms` }"
        :aria-pressed="selected === i"
        :aria-label="`${formatMonthDay(d.date)} 경험치 ${d.gainPercent?.toFixed(2) ?? 0}%`"
        @click="selected = i"
      />
    </div>
  </div>
</template>

<style scoped>
.road {
  display: grid;
  gap: 4px;
}
.label {
  color: var(--sub);
  font-family: var(--f-pixel);
  font-size: 11px;
}
.bar {
  display: flex;
  gap: 2px;
  height: 26px;
  padding: 2px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 4px;
}
.seg {
  min-width: 4px;
  padding: 0;
  background: linear-gradient(180deg, #f5e27a, var(--exp) 60%, #c9b532);
  border: 0;
  border-radius: 3px;
  opacity: 0.5;
  cursor: pointer;
  transform-origin: left;
  animation: grow-x 0.7s var(--ease-out) backwards;
  transition: opacity var(--fast) ease, flex-grow 0.5s var(--ease-out);
}
.seg:hover {
  opacity: 0.8;
}
.seg[aria-pressed="true"] {
  opacity: 1;
  outline: 2px solid var(--text);
}
</style>
