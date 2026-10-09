<script setup lang="ts">
import type { LedgerDay } from '~/utils/ledger'

const props = defineProps<{ month: string, days: Map<string, LedgerDay> }>()
const selected = defineModel<string>({ required: true })

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const LOOT_SHOWN = 4
const today = kstToday()
const cells = computed(() => calendarCells(props.month))
// 그 달에서 가장 많이 번 날을 기준으로 칸 배경 진하기를 정한다
const best = computed(() => Math.max(1, ...[...props.days.values()].map(dayIncome)))
</script>

<template>
  <div class="calendar">
    <div v-for="(w, i) in WEEKDAYS" :key="w" class="weekday" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</div>
    <template v-for="(date, i) in cells" :key="date ?? `blank${i}`">
      <span v-if="!date" class="cell blank" />
      <button
        v-else
        type="button"
        class="cell"
        :class="{ on: date === selected, today: date === today, future: date > today, sun: i % 7 === 0, sat: i % 7 === 6, reset: i % 7 === 4 }"
        :style="{ '--heat': days.get(date) ? dayIncome(days.get(date)!) / best : 0 }"
        :aria-pressed="date === selected"
        :aria-label="`${formatMonthDay(date)} 선택`"
        :disabled="date > today"
        @click="selected = date"
      >
        <span class="num">{{ Number(date.slice(8)) }}</span>
        <template v-if="days.get(date)">
          <b v-if="dayIncome(days.get(date)!)" class="income">+{{ formatShortNumber(dayIncome(days.get(date)!)) }}</b>
          <b v-if="days.get(date)!.itemSpent" class="spent">-{{ formatShortNumber(days.get(date)!.itemSpent) }}</b>
          <small v-if="days.get(date)!.fragments" class="frag">조각 {{ days.get(date)!.fragments }}</small>
          <span v-if="days.get(date)!.loot.length" class="loot">
            <LedgerLootIcon v-for="(item, k) in days.get(date)!.loot.slice(0, LOOT_SHOWN)" :key="k" :item="item" :size="22" />
            <small v-if="days.get(date)!.loot.length > LOOT_SHOWN">+{{ days.get(date)!.loot.length - LOOT_SHOWN }}</small>
          </span>
        </template>
      </button>
    </template>
  </div>
</template>

<style scoped>
.calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  grid-template-rows: auto;
  gap: 5px;
  min-height: 0;
}
.weekday {
  padding-bottom: 2px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 14px;
  text-align: center;
}
.weekday.sun,
.cell.sun .num {
  color: var(--loss);
}
.weekday.sat,
.cell.sat .num {
  color: var(--api);
}
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  min-height: 64px;
  padding: 5px 7px;
  background:
    linear-gradient(180deg, rgb(242 193 78 / calc(var(--heat, 0) * 0.28)), transparent),
    var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform var(--fast) var(--ease-out), border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.cell.blank {
  background: transparent;
  border-style: dashed;
  border-color: rgb(58 67 102 / 0.4);
  cursor: default;
}
.cell:not(.blank):not(:disabled):hover {
  transform: translateY(-2px);
  border-color: var(--tip-line);
}
.cell.future {
  opacity: 0.4;
  cursor: default;
}
.cell.reset::after {
  content: "리셋";
  position: absolute;
  top: 5px;
  right: 6px;
  color: var(--calc);
  font-family: var(--f-pixel);
  font-size: 8px;
  opacity: 0.7;
}
.cell.today {
  border-color: var(--gold);
}
.cell.on {
  border: 2px solid var(--text);
  box-shadow: 0 0 14px rgb(242 193 78 / 0.3);
}
.num {
  font-family: var(--f-title);
  font-size: 15px;
  line-height: 1.1;
}
.cell.today .num::after {
  content: " 오늘";
  color: var(--gold);
  font-size: 11px;
}
.income {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
  line-height: 1.2;
}
.spent {
  color: var(--loss);
  font-family: var(--f-title);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.2;
}
.frag {
  color: #c9b6ff;
  font-size: 11px;
  line-height: 1.2;
}
/* 물욕템을 먹은 날만 칸 아래에 작게 남긴다 */
.loot {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: auto;
}
.loot small {
  margin-left: 2px;
  color: #ffd36b;
  font-size: 11px;
}
</style>
