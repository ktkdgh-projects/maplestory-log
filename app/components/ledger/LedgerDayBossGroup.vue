<script setup lang="ts">
import type { BossClear } from '#shared/types'
import type { BossDifficulty } from '#shared/data/bosses'
import { clearMeso, lootMeso } from '#shared/calc/boss'

defineProps<{ group: { ocid: string, name: string, clears: BossClear[], meso: number }, open: boolean }>()
const emit = defineEmits<{ toggle: [], remove: [path: string, name: string, amount: number] }>()
</script>

<template>
  <li class="r-group" :class="{ open }">
    <button type="button" class="r r-btn" :aria-expanded="open" @click="emit('toggle')">
      <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" /></svg></span>
      <span class="main">
        <b class="ellipsis">{{ group.name }} <small>· {{ group.clears.length }}마리</small></b>
        <span class="stack">
          <span v-for="(c, k) in group.clears" :key="c.id" class="stack-item" :style="{ zIndex: k + 1 }" :title="bossLabel(c.bossId, c.difficulty)">
            <LedgerBossEmblem :boss-id="c.bossId" :size="22" />
          </span>
        </span>
      </span>
      <b class="amt gain">+{{ formatKoreanNumber(group.meso) }}</b>
      <span class="acts">
        <svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </span>
    </button>
    <!-- 높이를 0fr ↔ 1fr로 옮겨 메소 내역처럼 부드럽게 펼친다 -->
    <div class="detail-wrap">
      <ul class="detail" :inert="!open">
        <li v-for="c in group.clears" :key="c.id">
          <i class="diff" :style="{ background: DIFFICULTY_COLORS[c.difficulty as BossDifficulty] }" />
          <span class="boss ellipsis">{{ bossLabel(c.bossId, c.difficulty) }}<template v-if="c.party > 1"> · {{ c.party }}인</template></span>
          <LedgerBossSplit v-if="c.loot.length" class="d-split" :crystal="c.meso" :loot="lootMeso(c)" short equals>
            <template #icons><LedgerLootIcon v-for="l in c.loot" :key="l.item" :item="l.item" :size="18" /></template>
          </LedgerBossSplit>
          <b class="d-amt">{{ formatKoreanNumber(clearMeso(c)) }}</b>
          <LedgerAct kind="del" label="체크 취소" @click="emit('remove', `/api/ledger/clears/${c.id}`, `${group.name} · ${bossLabel(c.bossId, c.difficulty)}`, clearMeso(c))" />
        </li>
      </ul>
    </div>
  </li>
</template>

<style scoped>
.r {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 6px 4px 6px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 8px;
}
.r-btn {
  width: 100%;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.r-btn:hover {
  background: color-mix(in srgb, var(--c) 6%, var(--panel));
}
.ic {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: color-mix(in srgb, var(--c) 14%, var(--bar));
  border-radius: 7px;
  color: var(--c);
}
.ic svg:not(.coin) {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.main {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.main b {
  font-size: 14px;
}
.main b small,
.main > small {
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
}
.amt {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.gain {
  color: var(--gain);
}
.acts {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  min-width: 62px;
}
.caret {
  width: 15px;
  height: 15px;
  margin: 0 8px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transition: transform var(--normal) var(--ease-out);
}
.r-group.open .caret {
  transform: rotate(180deg);
}
.r-group {
  overflow: hidden;
  border-radius: 8px;
}
.r-group.open .r {
  border-radius: 8px 8px 0 0;
}
/* 칸은 줄어들 수 있고 그림은 제 크기로 넘쳐 다음 그림 밑에 깔린다 */
.stack {
  display: flex;
  min-width: 0;
  padding: 2px 22px 0 0;
}
.stack-item {
  position: relative;
  flex: 0 1 24px;
  min-width: 8px;
  height: 22px;
}
.stack-item > * {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: -2px 0 6px rgb(0 0 0 / 0.55);
}
.detail-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--normal) var(--ease-out);
}
.r-group.open .detail-wrap {
  grid-template-rows: 1fr;
}
.detail {
  display: grid;
  gap: 2px;
  min-height: 0;
  margin: 0;
  padding: 0 4px 0 13px;
  overflow: hidden;
  background: color-mix(in srgb, var(--sunk) 40%, transparent);
  border: 0 solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 0 0 8px 8px;
  list-style: none;
  opacity: 0;
  transition: opacity var(--normal) ease, padding var(--normal) var(--ease-out);
}
.r-group.open .detail {
  padding-block: 4px 6px;
  border-width: 0 1px 1px 3px;
  opacity: 1;
}
.detail li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 13px;
}
.diff {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.boss {
  flex: 1;
  min-width: 0;
}
.d-split {
  font-size: 12px;
  font-weight: 400;
}
.d-amt {
  color: var(--gain);
  font-family: var(--f-title);
  font-weight: 400;
  white-space: nowrap;
}
@media (max-width: 520px) {
  /* 좁으면 이름 줄을 통째로 쓰고, 금액은 덧말 줄 오른쪽으로 내린다 */
  .r {
    grid-template-columns: 28px minmax(0, 1fr) auto auto;
    grid-template-areas: "ic title title acts" "ic sub amt acts";
    column-gap: 8px;
    row-gap: 1px;
    padding: 6px 2px 6px 8px;
  }
  .r > .ic {
    grid-area: ic;
  }
  .r > .main {
    display: contents;
  }
  .main > :first-child {
    grid-area: title;
    min-width: 0;
  }
  .main > :nth-child(2) {
    grid-area: sub;
    align-self: center;
    min-width: 0;
  }
  .r > .amt {
    grid-area: amt;
    font-size: 14px;
  }
  .r > .acts {
    grid-area: acts;
    min-width: 0;
  }
  .main b {
    font-size: 13.5px;
  }
}
</style>
