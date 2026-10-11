<script setup lang="ts">
import { dayIncome, type LedgerDay } from '#shared/calc/ledger'

const props = defineProps<{ month: string, days: Map<string, LedgerDay> }>()
const selected = defineModel<string>({ required: true })

const LOOT_SHOWN = 4
const today = kstToday()
const cells = computed(() => calendarCells(props.month).map((date) => {
  const day = date ? props.days.get(date) : undefined
  // 그날 패널의 순수익과 맞게 장비 지출과 직접 등록 지출을 같이 센다
  return { date, day, income: day ? dayIncome(day) : 0, spent: day ? day.itemSpent + day.entryOut : 0 }
}))
// 그 달에서 가장 많이 번 날을 기준으로 칸 배경 진하기를 정한다
const best = computed(() => Math.max(1, ...[...props.days.values()].map(dayIncome)))
</script>

<template>
  <div class="calendar">
    <div v-for="(w, i) in WEEKDAYS" :key="w" class="weekday" :class="{ sun: i === 0, sat: i === 6 }">{{ w }}</div>
    <template v-for="({ date, day, income, spent }, i) in cells" :key="date ?? `blank${i}`">
      <span v-if="!date" class="cell blank" />
      <button
        v-else
        type="button"
        class="cell"
        :class="{ on: date === selected, today: date === today, future: date > today, sun: i % 7 === 0, sat: i % 7 === 6, reset: i % 7 === 4 }"
        :style="{ '--heat': income / best }"
        :aria-pressed="date === selected"
        :aria-label="`${formatDay(date)} 선택`"
        :disabled="date > today"
        @click="selected = date"
      >
        <span class="num">{{ Number(date.slice(8)) }}</span>
        <template v-if="day">
          <b v-if="income" class="income">+{{ formatShortNumber(income) }}</b>
          <b v-if="spent" class="spent">-{{ formatShortNumber(spent) }}</b>
          <small v-if="day.fragments" class="frag">조각 {{ day.fragments }}</small>
          <span v-if="day.loot.length" class="loot">
            <LedgerLootIcon v-for="(item, k) in day.loot.slice(0, LOOT_SHOWN)" :key="k" :item="item" :size="22" />
            <small v-if="day.loot.length > LOOT_SHOWN">+{{ day.loot.length - LOOT_SHOWN }}</small>
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
    linear-gradient(180deg, color-mix(in srgb, var(--gold) calc(var(--heat, 0) * 28%), transparent), transparent),
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
  box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 30%, transparent);
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
  color: var(--calc);
  font-size: 11px;
  line-height: 1.2;
}
.loot {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: auto;
}
.loot small {
  margin-left: 2px;
  color: var(--gold);
  font-size: 11px;
}
.income,
.spent {
  max-width: 100%;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}
/* 칸이 40px 남짓이라 금액은 작게, 조각·물욕템은 줄인다 */
@media (max-width: 520px) {
  .calendar {
    gap: 3px;
  }
  .cell {
    min-height: 54px;
    padding: 4px 3px;
    border-radius: 6px;
  }
  .num {
    font-size: 13px;
  }
  .cell.today .num::after,
  .cell.reset::after,
  .frag {
    display: none;
  }
  .income,
  .spent {
    font-size: 10.5px;
    letter-spacing: -0.03em;
  }
  .loot > :nth-child(n + 2),
  .loot small {
    display: none;
  }
}
</style>
