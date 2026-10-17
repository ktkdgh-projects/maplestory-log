<script setup lang="ts">
import type { EnhanceEvent } from '#shared/types'

type ShownDay = { date: string, events: (EnhanceEvent & { opts: string[], toolLabel: string })[], ups: number, meso: number }

defineProps<{ days: ShownDay[], open: Set<string>, lineStyle: (g: string | null, text: string, index: number) => Record<string, string> }>()
const emit = defineEmits<{ toggle: [date: string] }>()

const gradeStyle = (g: string | null) => ({ '--grade': potentialGradeColor(g) ?? 'var(--tip-line)' })
</script>

<template>
  <ol class="days">
    <li v-for="d in days" :key="d.date" class="day" :class="{ open: open.has(d.date) }">
      <button type="button" class="day-head" :aria-expanded="open.has(d.date)" @click="emit('toggle', d.date)">
        <span class="caret" aria-hidden="true">▸</span>
        <b>{{ formatDayWeek(d.date) }}</b>
        <span class="day-what">
          {{ d.events.length }}번<template v-if="d.ups"> · <span class="up">등급 상승 {{ d.ups }}</span></template>
        </span>
        <span class="day-meso">{{ d.meso ? formatShortNumber(d.meso) : '' }}</span>
      </button>
      <ol v-if="open.has(d.date)" class="events">
        <li v-for="(e, n) in d.events" :key="n" class="event" :class="{ up: e.success }" :style="gradeStyle(e.grade)">
          <time>{{ kstTime(e.at) }}</time>
          <span class="opts">
            <span v-for="(o, i) in e.opts" :key="i" :style="lineStyle(e.grade, o, i)">{{ o }}</span>
          </span>
          <span class="cost">{{ e.meso ? formatShortNumber(e.meso) : '' }}</span>
          <span class="result">
            <small class="tool">{{ e.toolLabel }}</small>
            <span class="grade">{{ e.grade }}<small v-if="e.success" class="up-mark">▲</small></span>
          </span>
        </li>
      </ol>
    </li>
  </ol>
</template>

<style scoped>
.days {
  display: grid;
  align-content: start;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.day {
  background: color-mix(in srgb, var(--tint) 2%, transparent);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.day.open {
  border-color: var(--tip-line);
}
.day-head {
  display: grid;
  grid-template-columns: 14px minmax(92px, max-content) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.caret {
  color: var(--sub);
  transition: rotate var(--fast) ease;
}
.day.open .caret {
  rotate: 90deg;
}
.day-head b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.day-what {
  color: var(--sub);
}
.up {
  color: var(--gain);
}
.day-meso {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.events {
  display: grid;
  gap: 2px;
  margin: 0 10px 8px;
  padding: 0;
  list-style: none;
}
/* 칸을 고정해 줄마다 위치가 같게 */
.event {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 70px 200px;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--tint) 2%, transparent);
  border-left: 3px solid var(--grade);
  border-radius: 4px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.event time {
  color: var(--sub);
}
.opts {
  display: grid;
  min-width: 0;
  line-height: 1.45;
}
.opts span {
  overflow: hidden;
  color: var(--line);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cost {
  color: var(--tip-line);
  text-align: right;
}
.result {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.tool {
  overflow: hidden;
  color: var(--tip-line);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grade {
  flex: none;
  color: var(--grade);
  font-family: var(--f-title);
  font-size: 13px;
}
.up-mark {
  margin-left: 2px;
  color: var(--gain);
  font-size: 10px;
}
@media (max-width: 640px) {
  .day-head {
    grid-template-columns: 12px minmax(72px, max-content) minmax(0, 1fr) auto;
    min-height: 40px;
    gap: 6px;
    font-size: 12px;
  }
  .events {
    margin: 0 6px 6px;
  }
  .event {
    grid-template-areas: "time cost result" "opts opts opts";
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 2px 10px;
    padding: 6px 8px;
  }
  .event time {
    grid-area: time;
  }
  .opts {
    grid-area: opts;
  }
  .cost {
    grid-area: cost;
  }
  .result {
    grid-area: result;
  }
}
</style>
