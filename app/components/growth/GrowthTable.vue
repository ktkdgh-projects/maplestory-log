<script setup lang="ts">
import type { GrowthDay } from '#shared/calc/growth'

const props = defineProps<{ days: GrowthDay[] }>()
const selected = defineModel<number>({ required: true })

const rows = computed(() => props.days.map((day, i) => ({ day, i })).reverse())
</script>

<template>
  <div class="table-wrap">
    <!-- 칸 너비를 고정해 캐릭터를 바꿔도 숫자 길이에 따라 열이 움직이지 않는다 -->
    <table>
      <colgroup>
        <col style="width: 14%">
        <col style="width: 16%">
        <col style="width: 24%">
        <col style="width: 24%">
        <col style="width: 22%">
      </colgroup>
      <thead>
        <tr>
          <th>날짜</th>
          <th>레벨</th>
          <th>EXP</th>
          <th>획득 경험치</th>
          <th>전투력</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="{ day, i } in rows"
          :key="day.date"
          :class="{ on: i === selected, today: day.isToday }"
          tabindex="0"
          :aria-selected="i === selected"
          @click="selected = i"
          @keydown.enter.space.prevent="selected = i"
        >
          <td>{{ dayLabel(day) }}</td>
          <td>
            LV.{{ day.level }}
            <span v-if="day.levelUp" class="up">UP</span>
          </td>
          <td>
            {{ day.expRate.toFixed(3) }}%
            <small v-if="day.gainPercent !== null" :class="day.gainPercent > 0 ? 'gain' : 'muted'">{{ formatSignedPercent(day.gainPercent) }}</small>
          </td>
          <td>{{ day.gainExp === null ? '-' : formatSigned(day.gainExp) }}</td>
          <td>{{ day.combatPower === null ? '-' : formatKoreanNumber(day.combatPower) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  scrollbar-width: thin;
}
table {
  width: 100%;
  min-width: 640px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 12px;
  background: var(--title);
  color: var(--sub);
  font-family: var(--f-title);
  font-weight: 400;
  text-align: left;
}
td {
  overflow: hidden;
  padding: 7px 12px;
  border-top: 1px solid color-mix(in srgb, var(--panel-line) 60%, transparent);
  white-space: nowrap;
  text-overflow: ellipsis;
}
tbody tr {
  cursor: pointer;
  transition: background var(--fast) ease;
}
tbody tr:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: -2px;
}
tbody tr:hover {
  background: var(--panel);
}
tbody tr.on {
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--gold);
}
tbody tr.today td:first-child {
  color: var(--gold);
  font-family: var(--f-title);
}
small {
  margin-left: 4px;
  font-size: 12px;
}
.up {
  margin-left: 4px;
  padding: 0 4px;
  background: var(--gain);
  border-radius: 3px;
  color: var(--on-gain);
  font-family: var(--f-pixel);
  font-size: 9px;
}
</style>
