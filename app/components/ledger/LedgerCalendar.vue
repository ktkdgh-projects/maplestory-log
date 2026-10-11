<script setup lang="ts">
import { dayIncome, type LedgerDay } from '#shared/calc/ledger'

const props = defineProps<{ month: string, days: Map<string, LedgerDay> }>()
const selected = defineModel<string>({ required: true })

const LOOT_SHOWN = 3
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
        :class="{ on: date === selected, today: date === today, future: date > today, sun: i % 7 === 0, sat: i % 7 === 6 }"
        :style="{ '--heat': income / best }"
        :aria-pressed="date === selected"
        :aria-label="`${formatDay(date)} 선택`"
        :disabled="date > today"
        @click="selected = date"
      >
        <span class="in">
          <span class="top">
            <span class="num">{{ Number(date.slice(8)) }}</span>
            <small v-if="date === today" class="tag now">오늘</small>
            <small v-else-if="i % 7 === 4" class="tag">리셋</small>
            <small v-if="day?.fragments" class="frag" :title="`솔 에르다 조각 ${day.fragments}개`"><img src="/icons/sol-erda-fragment.png" alt="">{{ day.fragments }}</small>
          </span>
          <template v-if="day">
            <b v-if="income" class="income">+{{ formatShortNumber(income) }}</b>
            <span v-if="spent" class="sub">
              <b class="spent">-{{ formatShortNumber(spent) }}</b>
            </span>
            <span v-if="day.loot.length" class="loot">
              <LedgerLootIcon v-for="(item, k) in day.loot.slice(0, LOOT_SHOWN)" :key="k" :item="item" :size="18" />
              <small v-if="day.loot.length > LOOT_SHOWN">+{{ day.loot.length - LOOT_SHOWN }}</small>
            </span>
          </template>
        </span>
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
/* 칸 높이에 따라 줄 배치를 바꾸려고 칸을 크기 기준(container)으로 둔다 */
.cell {
  position: relative;
  min-width: 0;
  min-height: 64px;
  padding: 0;
  overflow: hidden;
  container-type: size;
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
.in {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  height: 100%;
  padding: 5px 7px;
}
/* 낮은 칸은 번 금액과 쓴 금액을 한 줄에 두어 물욕템 줄이 바닥에 그대로 남게 한다 */
@container (max-height: 84px) and (min-width: 80px) {
  .in {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    column-gap: 5px;
    row-gap: 0;
    padding: 2px 6px;
  }
  .top,
  .loot {
    grid-column: 1 / -1;
  }
  .top {
    min-height: 14px;
    line-height: 14px;
  }
  .income,
  .sub {
    line-height: 16px;
  }
  .sub {
    grid-column: 2;
  }
  .loot {
    align-self: end;
  }
}
/* 한 화면 고정일 때는 칸이 달력 줄 높이에 맞춰 줄어야 아래 줄을 덮지 않는다 */
@media (min-width: 1100px) and (min-height: 700px) {
  .cell {
    min-height: 0;
  }
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
.top {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 18px;
}
.tag {
  color: var(--calc);
  font-family: var(--f-pixel);
  font-size: 8px;
  opacity: 0.7;
}
.tag.now {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 11px;
  opacity: 1;
}
.sub {
  display: flex;
  align-items: baseline;
  gap: 5px;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
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
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  color: var(--calc);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.frag img {
  width: 13px;
  height: 13px;
  object-fit: contain;
  image-rendering: pixelated;
}
.loot {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  margin-top: auto;
}
.loot small {
  margin-left: 1px;
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
    min-height: 66px;
    border-radius: 6px;
  }
  .in {
    padding: 4px 3px;
  }
  .num {
    font-size: 13px;
  }
  .tag,
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
