<script setup lang="ts">
import type { GrowthDay } from '#shared/calc/growth'

const props = defineProps<{ days: GrowthDay[] }>()
const selected = defineModel<number>({ required: true })

const HEIGHT = 96
const PAD_X = 16
const PAD_TOP = 14
const PAD_BOTTOM = 18
const GRID_YS = [0, 1, 2].map(k => PAD_TOP + (k * (HEIGHT - PAD_TOP - PAD_BOTTOM)) / 2)

// 가로로 늘리면 점이 찌그러지므로 실제 폭을 재서 그 크기로 그린다. 재기 전엔 높이만 잡아 두고 그리지 않는다
const box = ref<HTMLElement | null>(null)
const width = ref(0)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (box.value) width.value = Math.max(box.value.clientWidth, 200)
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(entry.contentRect.width, 200)
  })
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

const known = computed(() => props.days.map(d => d.combatPower).filter((v): v is number => v !== null))
const scale = computed(() => {
  const min = Math.min(...known.value)
  const max = Math.max(...known.value)
  return { min, max, span: max - min || 1 }
})
const points = computed(() => props.days.flatMap((day, i) => {
  if (day.combatPower === null) return []
  const x = props.days.length > 1 ? PAD_X + (i * (width.value - PAD_X * 2)) / (props.days.length - 1) : width.value / 2
  const y = PAD_TOP + (1 - (day.combatPower - scale.value.min) / scale.value.span) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
  return [{ i, x, y, day }]
}))

// 점 사이를 부드럽게 잇는 곡선 (Catmull-Rom을 베지어로 바꾼 것)
const curve = computed(() => {
  const p = points.value
  if (!p.length) return ''
  let d = `M${p[0]!.x},${p[0]!.y}`
  for (let k = 0; k < p.length - 1; k++) {
    const p0 = p[k - 1] ?? p[k]!
    const p1 = p[k]!
    const p2 = p[k + 1]!
    const p3 = p[k + 2] ?? p2
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`
  }
  return d
})
const area = computed(() => points.value.length ? `${curve.value} L${points.value.at(-1)!.x},${HEIGHT - PAD_BOTTOM} L${points.value[0]!.x},${HEIGHT - PAD_BOTTOM} Z` : '')
const active = computed(() => points.value.find(p => p.i === selected.value))
// 날짜 눈금은 너무 빽빽하지 않게 대략 5~7개만
const ticks = computed(() => {
  const step = Math.max(1, Math.ceil(points.value.length / 7))
  return points.value.filter((_, k) => k % step === 0 || k === points.value.length - 1)
})
</script>

<template>
  <div class="chart">
    <div class="head">
      <span class="label">전투력 추이</span>
      <span v-if="known.length" class="range">
        <i class="dot low" /> 최저 {{ formatKoreanNumber(scale.min) }}
        <i class="dot high" /> 최고 {{ formatKoreanNumber(scale.max) }}
      </span>
    </div>
    <div ref="box" class="plot">
      <svg v-if="points.length && width" :width="width" :height="HEIGHT" role="group" aria-label="날짜별 전투력 그래프">
        <defs>
          <linearGradient id="power-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style="stop-color: var(--gold)" stop-opacity="0.38" />
            <stop offset="1" style="stop-color: var(--gold)" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="power-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" style="stop-color: var(--gold-warm)" />
            <stop offset="1" style="stop-color: var(--gold-light)" />
          </linearGradient>
          <filter id="power-glow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <line v-for="y in GRID_YS" :key="y" class="grid" :x1="PAD_X" :x2="width - PAD_X" :y1="y" :y2="y" />
        <path :d="area" fill="url(#power-area)" class="area" />
        <path :d="curve" fill="none" stroke="url(#power-line)" stroke-width="6" opacity="0.35" filter="url(#power-glow)" />
        <path :d="curve" fill="none" stroke="url(#power-line)" stroke-width="2.5" stroke-linecap="round" class="line" pathLength="1" />

        <line v-if="active" class="guide" :x1="active.x" :x2="active.x" :y1="PAD_TOP - 6" :y2="HEIGHT - PAD_BOTTOM" />
        <g
          v-for="p in points"
          :key="p.i"
          class="point"
          :class="{ on: p.i === selected, today: p.day.isToday }"
          tabindex="0"
          role="button"
          :aria-label="`${dayLabel(p.day)} 전투력 ${formatKoreanNumber(p.day.combatPower!)}`"
          :aria-pressed="p.i === selected"
          @click="selected = p.i"
          @keydown.enter.space.prevent="selected = p.i"
        >
          <rect :x="p.x - 14" y="0" width="28" :height="HEIGHT" fill="transparent" />
          <circle :cx="p.x" :cy="p.y" :r="p.i === selected ? 6 : 3.5" />
        </g>
        <text v-for="t in ticks" :key="`t${t.i}`" class="tick" :x="t.x" :y="HEIGHT - 4">{{ dayLabel(t.day) }}</text>
      </svg>
      <div v-if="active && width" class="bubble" :class="{ below: active.y < 44 }" :style="{ left: `${Math.min(Math.max(active.x, 70), width - 70)}px`, top: `${active.y}px` }">
        <b>{{ formatKoreanNumber(active.day.combatPower!) }}</b>
        <span>{{ dayLabel(active.day) }}</span>
      </div>
      <p v-if="!points.length" class="muted">전투력 기록이 아직 없어요.</p>
    </div>
  </div>
</template>

<style scoped>
.chart {
  display: grid;
  gap: 4px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.label {
  color: var(--sub);
  font-family: var(--f-pixel);
  font-size: 11px;
}
.range {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--sub);
}
.range .dot {
  width: 8px;
  height: 8px;
  margin-left: 8px;
  border-radius: 50%;
}
.dot.low {
  background: var(--tip-line);
}
.dot.high {
  background: var(--gold);
  box-shadow: 0 0 6px var(--gold);
}
.plot {
  position: relative;
  min-height: 98px;
  overflow: hidden;
  background:
    radial-gradient(400px 80px at 80% 0, color-mix(in srgb, var(--gold) 8%, transparent), transparent 70%),
    var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
svg {
  display: block;
}
.grid {
  stroke: rgb(58 67 102 / 0.5);
  stroke-dasharray: 3 5;
}
.area {
  animation: fade-in 0.8s ease backwards;
}
@keyframes fade-in {
  from { opacity: 0; }
}
.line {
  stroke-dasharray: 1;
  animation: draw 1.1s var(--ease-out) backwards;
}
@keyframes draw {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
.guide {
  stroke: color-mix(in srgb, var(--gold) 45%, transparent);
  stroke-dasharray: 2 3;
}
.point {
  cursor: pointer;
  outline: none;
}
.point:focus-visible circle {
  stroke: #fff;
  r: 6;
}
.point circle {
  fill: var(--bar);
  stroke: var(--gold);
  stroke-width: 2;
  transition: r var(--fast) var(--ease-spring);
}
.point:hover circle {
  r: 5;
}
.point.on circle {
  fill: var(--gold);
  stroke: #fff;
  filter: drop-shadow(0 0 6px var(--gold));
}
.point.today circle {
  stroke-dasharray: 2 2;
}
.tick {
  fill: var(--sub);
  font-family: var(--f-pixel);
  font-size: 9px;
  text-anchor: middle;
}
.bubble {
  position: absolute;
  display: grid;
  justify-items: center;
  padding: 3px 8px;
  translate: -50% calc(-100% - 10px);
  background: rgb(10 12 22 / 0.92);
  border: 1px solid var(--gold);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.3;
  pointer-events: none;
  transition: left 0.4s var(--ease-out), top 0.4s var(--ease-out);
  white-space: nowrap;
}
.bubble.below {
  translate: -50% 12px;
}
.bubble b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 13px;
  font-weight: 400;
}
.bubble span {
  color: var(--sub);
}
.muted {
  padding: 12px;
}
</style>
