<script setup lang="ts">
const props = defineProps<{ min: number, max: number, floor?: number, label: string }>()
const from = defineModel<number>('from', { required: true })
const to = defineModel<number>('to', { required: true })

const percent = (value: number) => ((value - props.min) / (props.max - props.min)) * 100

function setFrom(event: Event) {
  const input = event.target as HTMLInputElement
  // 이미 올린 레벨보다 낮게는 못 내리고, 목표를 넘지도 못한다
  from.value = Math.min(Math.max(Number(input.value), props.floor ?? props.min), to.value)
  input.value = String(from.value)
}
function setTo(event: Event) {
  const input = event.target as HTMLInputElement
  to.value = Math.max(Number(input.value), from.value)
  input.value = String(to.value)
}
</script>

<template>
  <div class="range" :style="{ '--floor': `${percent(floor ?? min)}%`, '--from': `${percent(from)}%`, '--to': `${percent(to)}%` }">
    <div class="track"><span class="done" /><span class="selected" /></div>
    <input type="range" :min="min" :max="max" :value="from" :aria-label="`${label} 시작 레벨`" @input="setFrom">
    <input type="range" :min="min" :max="max" :value="to" :aria-label="`${label} 목표 레벨`" @input="setTo">
  </div>
</template>

<style scoped>
.range {
  position: relative;
  height: 22px;
}
.track {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 8px;
  translate: 0 -50%;
  background: var(--bar);
  border-radius: 4px;
}
.done {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--floor);
  background: repeating-linear-gradient(135deg, rgb(242 193 78 / 0.55) 0 4px, rgb(242 193 78 / 0.3) 4px 8px);
  border-radius: 4px;
}
.selected {
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--from);
  right: calc(100% - var(--to));
  background: linear-gradient(90deg, #8f74e6, var(--calc));
  border-radius: 4px;
  box-shadow: 0 0 10px rgb(183 156 255 / 0.5);
}
/* 두 입력을 겹쳐 놓고 손잡이만 눌리게 해서 양쪽 손잡이 슬라이더를 만든다 */
input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: none;
  pointer-events: none;
  appearance: none;
}
input::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  background: #fff;
  border: 3px solid var(--calc);
  border-radius: 50%;
  box-shadow: 0 2px 6px rgb(0 0 0 / 0.4);
  pointer-events: auto;
  cursor: grab;
  appearance: none;
  transition: scale var(--fast) ease;
}
input::-webkit-slider-thumb:hover {
  scale: 1.2;
}
input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #fff;
  border: 3px solid var(--calc);
  border-radius: 50%;
  pointer-events: auto;
  cursor: grab;
}
input::-webkit-slider-runnable-track {
  background: none;
}
input::-moz-range-track {
  background: none;
}
</style>
