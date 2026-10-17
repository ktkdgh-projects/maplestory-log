<script setup lang="ts">
defineProps<{
  timeline: { boss: string, need: number, tier?: string, state: string, week: string | null }[]
  boosts: { key: string, label: string, week: string, saved: number | null }[]
  locked: boolean
  stepBoss?: string
  weekLabel: (week: string) => string
}>()
const format = (n: number) => n.toLocaleString('ko-KR')
</script>

<template>
  <ol class="timeline">
    <li v-for="s in timeline" :key="s.boss" :class="s.state">
      <span class="node" aria-hidden="true" />
      <span class="what"><b>{{ s.boss }}</b><small>{{ s.tier ? `${s.tier} · ` : '' }}{{ format(s.need) }}</small></span>
      <span class="when">{{ s.state === 'done' ? '완료' : locked ? '-' : s.week ? `${formatDay(s.week)} 주 · ${weekLabel(s.week)}` : '-' }}</span>
    </li>
  </ol>

  <div v-if="boosts.length" class="boosts">
    <span class="calc-caption">이 보스를 바꾸거나 더하면 · {{ stepBoss }} 끝나는 주</span>
    <div v-for="b in boosts" :key="b.key" class="boost">
      <span>{{ b.label }}</span>
      <span class="when">{{ formatDay(b.week) }} 주</span>
      <b class="gain">{{ b.saved === null ? '3년 안에 끝남' : `${b.saved}주 당겨짐` }}</b>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.timeline li {
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
}
.timeline li::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 9px;
  width: 2px;
  background: var(--panel-line);
}
.timeline li.done::before {
  background: color-mix(in srgb, var(--gain) 40%, transparent);
}
.timeline li:first-child::before {
  top: 50%;
}
.timeline li:last-child::before {
  bottom: 50%;
}
.node {
  position: relative;
  width: 12px;
  height: 12px;
  margin-left: 4px;
  background: var(--panel);
  border: 2px solid var(--calc);
  border-radius: 50%;
}
.done .node {
  background: var(--gain);
  border-color: var(--gain);
}
.now .node {
  background: var(--calc);
  box-shadow: 0 0 8px var(--calc);
}
.what b {
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.done .what b {
  color: var(--sub);
}
.what small {
  margin-left: 6px;
  color: var(--sub);
  font-size: 12px;
}
.when {
  color: var(--sub);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.done .when {
  color: var(--gain);
}
.timeline li.next:last-child .when,
.timeline li.now:last-child .when {
  color: var(--gold);
  font-weight: 700;
}
.boosts {
  display: grid;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px dashed var(--panel-line);
}
.boost {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 5px 10px;
  background: color-mix(in srgb, var(--tint) 3%, transparent);
  border-radius: 6px;
  font-size: 13px;
}
.boost .when {
  color: var(--sub);
  font-variant-numeric: tabular-nums;
}
</style>
