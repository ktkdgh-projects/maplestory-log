<script setup lang="ts">
const props = defineProps<{ level: number, rate: number }>()
const width = computed(() => `${Math.min(Math.max(props.rate, 0), 100)}%`)
</script>

<template>
  <div class="exp" role="meter" :aria-valuenow="rate" aria-valuemin="0" aria-valuemax="100" :aria-label="`레벨 ${level} 경험치`">
    <div class="row">
      <span class="lv">LV.{{ level }}</span>
      <span>EXP {{ rate.toFixed(3) }}%</span>
    </div>
    <div class="track">
      <div class="fill" :style="{ width }" />
    </div>
  </div>
</template>

<style scoped>
.exp {
  display: grid;
  gap: 4px;
}
.row {
  display: flex;
  justify-content: space-between;
  font-family: var(--f-pixel);
  font-size: 11px;
}
.lv {
  color: var(--gold);
}
.track {
  height: 14px;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 4px;
}
.fill {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: linear-gradient(180deg, #f5e27a, var(--exp) 55%, #c9b532);
  border-radius: 3px;
  transform-origin: left;
  animation: grow-x 1.1s var(--ease-out) 0.2s both;
  transition: width 0.8s var(--ease-out);
}
.fill::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgb(255 255 255 / 0.55) 50%, transparent 70%) 0 0 / 200% 100%;
  animation: shimmer 2.6s linear infinite;
}
</style>
