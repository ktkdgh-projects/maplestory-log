<script setup lang="ts">
const props = defineProps<{
  series: { date: string, balance: number }[]
  bars: { key: string, label: string, color: string, income: number, spent: number, incomeWidth: number, spentWidth: number }[]
}>()

const W = 300
const H = 170
const PAD = { left: 46, right: 10, top: 14, bottom: 24 }
const chart = computed(() => {
  const series = props.series
  if (series.length < 2) return null
  const values = series.map(s => s.balance)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 1e8) {
    min -= 5e7
    max += 5e7
  }
  const span = max - min
  const x = (i: number) => PAD.left + (i / (series.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom)
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.balance).toFixed(1)}`).join(' ')
  const ticks = [max, (max + min) / 2, min].map(v => ({ y: y(v), label: formatShortNumber(v) }))
  let drop = { i: -1, by: 0 }
  series.forEach((s, i) => {
    const by = i ? s.balance - series[i - 1]!.balance : 0
    if (by < drop.by) drop = { i, by }
  })
  const last = series.length - 1
  return {
    line,
    area: `${line} L${x(last).toFixed(1)} ${H - PAD.bottom} L${x(0).toFixed(1)} ${H - PAD.bottom} Z`,
    ticks,
    end: { x: x(last), y: y(series[last]!.balance) },
    drop: drop.i > 0 ? { x: x(drop.i), y: y(series[drop.i]!.balance), date: series[drop.i]!.date, by: drop.by } : null,
    first: formatDay(series[0]!.date),
    lastLabel: formatDay(series[last]!.date),
  }
})
</script>

<template>
  <aside class="chart-card scroll-fade">
    <h3>보유 메소 흐름</h3>
    <p class="muted small">날마다 그날 끝 잔액</p>
    <svg v-if="chart" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="`${chart.first}부터 ${chart.lastLabel}까지 보유 메소`">
      <defs>
        <linearGradient id="balance-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.28" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g class="grid">
        <line v-for="t in chart.ticks" :key="t.label" :x1="PAD.left" :x2="W - PAD.right" :y1="t.y" :y2="t.y" />
      </g>
      <g class="axis">
        <text v-for="t in chart.ticks" :key="t.label" :x="PAD.left - 6" :y="t.y + 3.5" text-anchor="end">{{ t.label }}</text>
        <text :x="PAD.left" :y="H - 6" text-anchor="start">{{ chart.first }}</text>
        <text :x="W - PAD.right" :y="H - 6" text-anchor="end">{{ chart.lastLabel }}</text>
      </g>
      <path :d="chart.area" fill="url(#balance-fill)" class="area" />
      <path :d="chart.line" fill="none" class="line" stroke-width="2" />
      <circle v-if="chart.drop" :cx="chart.drop.x" :cy="chart.drop.y" r="4" class="drop" />
      <circle :cx="chart.end.x" :cy="chart.end.y" r="4.5" class="end" />
    </svg>
    <p v-else class="muted small chart-empty">보유 메소를 맞추고 기록이 이틀 이상 쌓이면 그래프가 그려져요.</p>
    <!-- 줄어든 날이 없어도 자리는 잡아 둔다 -->
    <p class="muted small drop-line" :class="{ off: !chart?.drop }">가장 크게 줄어든 날 <b class="loss">{{ chart?.drop ? `${formatDay(chart.drop.date)} ${formatSigned(chart.drop.by)}` : '-' }}</b></p>
    <div v-if="bars.length" class="kind-bars">
      <h3>종류별 들고 남</h3>
      <div v-for="k in bars" :key="k.key" class="kb" :style="{ '--c': k.color }">
        <span class="kb-name"><i />{{ k.label }}</span>
        <span class="kb-track"><i class="in" :style="{ width: `${k.incomeWidth}%` }" /><i class="out" :style="{ width: `${k.spentWidth}%` }" /></span>
        <span class="kb-amt"><b v-if="k.income" class="gain">+{{ formatShortNumber(k.income) }}</b><b v-if="k.spent" class="loss">-{{ formatShortNumber(k.spent) }}</b></span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.chart-card {
  display: grid;
  align-content: start;
  gap: 6px;
  max-height: 100%;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.kind-bars {
  display: grid;
  gap: 6px;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--panel-line);
}
.kind-bars h3 {
  font-size: 15px;
}
.kb {
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.kb-name {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--sub);
  white-space: nowrap;
}
.kb-name i {
  width: 7px;
  height: 7px;
  background: var(--c);
  border-radius: 50%;
}
.kb-track {
  display: grid;
  gap: 2px;
}
.kb-track i {
  display: block;
  min-width: 0;
  height: 5px;
  border-radius: 3px;
}
.kb-track .in {
  background: var(--c);
}
.kb-track .out {
  background: color-mix(in srgb, var(--loss) 70%, transparent);
}
.kb-amt {
  display: grid;
  justify-items: end;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.chart-card h3 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.chart-card svg {
  display: block;
  width: 100%;
  height: auto;
  color: var(--gold);
}
.grid line {
  stroke: var(--panel-line);
  stroke-width: 1;
}
.axis text {
  fill: var(--sub);
  font-size: 10px;
}
.line {
  stroke: var(--gold);
}
.drop {
  fill: var(--loss);
}
.end {
  fill: var(--gold);
  stroke: var(--page);
  stroke-width: 1.5;
}
.drop-line.off {
  visibility: hidden;
}
.chart-empty {
  padding: 30px 0;
  text-align: center;
}
.small {
  font-size: 12.5px;
}
</style>
