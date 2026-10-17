<script setup lang="ts">
import type { BossClear, BossPick, BossRosterCharacter } from '#shared/types'
import { WEEKLY_BOSS_LIMIT } from '#shared/data/bosses'

defineProps<{
  row: {
    character: BossRosterCharacter
    bosses: (BossPick & { boss: { cycle: 'weekly' | 'monthly' }, clear?: BossClear })[]
    weeklyDone: number
    weeklyTotal: number
    complete: boolean
    crystal: number
    loot: number
  }
  characters: number
  first: boolean
  last: boolean
  open: boolean
  dragging: boolean
  inflight: Set<string>
  others: BossRosterCharacter[]
}>()
const emit = defineEmits<{
  dragStart: [event: DragEvent]
  dragOver: []
  dragDrop: []
  dragEnd: []
  move: [delta: number, event: Event]
  toggleSetup: []
  remove: []
  clearAll: []
  unclearAll: []
  toggle: [pick: BossPick]
  loot: [clear: BossClear]
  save: [bosses: BossPick[]]
  copy: [to: string, bosses: BossPick[]]
  close: []
}>()
</script>

<template>
  <li
    class="row"
    :class="{ complete: row.complete, open, dragging }"
    @dragover.prevent="emit('dragOver')"
    @drop.prevent="emit('dragDrop')"
  >
    <div class="who">
      <button
        v-if="characters > 1"
        type="button"
        class="grip"
        draggable="true"
        title="끌어서 순서 바꾸기 · 위아래 화살표로도 옮겨요"
        :aria-label="`${row.character.name} 순서 바꾸기 (위아래 화살표)`"
        @dragstart="emit('dragStart', $event)"
        @dragend="emit('dragEnd')"
        @keydown.up.prevent="emit('move', -1, $event)"
        @keydown.down.prevent="emit('move', 1, $event)"
      >⠿</button>
      <!-- 터치 화면은 끌기가 안 되므로 위아래 버튼으로 옮긴다 -->
      <span v-if="characters > 1" class="nudge">
        <button type="button" :aria-label="`${row.character.name} 위로`" :disabled="first" @click="emit('move', -1, $event)">▲</button>
        <button type="button" :aria-label="`${row.character.name} 아래로`" :disabled="last" @click="emit('move', 1, $event)">▼</button>
      </span>
      <button
        type="button"
        class="who-main"
        :aria-expanded="open"
        :title="`${row.character.name}의 보스 세팅 ${open ? '접기' : '열기'}`"
        @click="emit('toggleSetup')"
      >
        <CharacterThumb v-if="row.character.imageUrl" :src="row.character.imageUrl" :height="56" crop="head" class="face" />
        <span class="who-text">
          <b class="ellipsis">{{ row.character.name }} <span class="caret" aria-hidden="true">▾</span></b>
          <small class="ellipsis">{{ row.character.job }} · LV.{{ row.character.level }}</small>
          <small><span :class="{ full: row.weeklyDone >= WEEKLY_BOSS_LIMIT }">{{ row.weeklyDone }}/{{ row.weeklyTotal }}</span> 잡음</small>
          <small>결정석 {{ formatShortNumber(row.crystal) }}</small>
          <small class="gold" :class="{ off: !row.loot }">물욕 {{ formatShortNumber(row.loot) }}</small>
          <span class="mini" :title="`주간 ${row.weeklyDone}/${row.weeklyTotal}`"><i :style="{ width: `${row.weeklyTotal ? (row.weeklyDone / row.weeklyTotal) * 100 : 0}%` }" /></span>
        </span>
      </button>
      <!-- 잡음·취소를 캐릭터 칸에 세로로 쌓아 보스 칸 너비를 줄이지 않는다 -->
      <div class="acts">
        <button type="button" class="out-btn" :title="`${row.character.name}을(를) 보스 표에서 빼기`" @click="emit('remove')">빼기</button>
        <!-- 세 칸 모두 늘 자리를 잡아 두고, 쓸 수 없을 땐 숨기기만 한다 -->
        <span v-if="row.weeklyTotal && row.complete" class="done-stamp">다 잡음</span>
        <button v-else type="button" class="all-btn" :class="{ off: !row.weeklyTotal }" :tabindex="row.weeklyTotal ? 0 : -1" :title="`${row.character.name}의 남은 주간 보스 ${row.weeklyTotal - row.weeklyDone}개를 한 번에 체크`" @click="emit('clearAll')">
          전부 잡음
        </button>
        <button
          type="button"
          class="none-btn"
          :class="{ off: !row.weeklyDone }"
          :tabindex="row.weeklyDone ? 0 : -1"
          :title="`${row.character.name}의 이번 주 주간 보스 체크 ${row.weeklyDone}개를 한 번에 풀기`"
          @click="emit('unclearAll')"
        >
          전부 취소
        </button>
      </div>
    </div>
    <div class="chips">
      <LedgerBossChip
        v-for="b in row.bosses"
        :key="b.bossId"
        :pick="b"
        :busy="inflight.has(`${row.character.ocid}:${b.bossId}`)"
        @toggle="emit('toggle', b)"
        @loot="emit('loot', $event)"
      />
      <button v-if="!row.bosses.length && !open" type="button" class="hint" @click="emit('toggleSetup')">보스를 아직 안 골랐어요 · 눌러서 고르기</button>
    </div>
    <LedgerBossSetup
      v-if="open"
      class="setup"
      :character="row.character"
      :others="others"
      @save="emit('save', $event)"
      @copy="(to, bosses) => emit('copy', to, bosses)"
      @close="emit('close')"
    />
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 240px 1fr;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  transition: border-color var(--normal) ease, box-shadow var(--normal) ease;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.grip {
  flex: none;
  margin: 0 -2px 0 -4px;
  padding: 6px 2px;
  background: none;
  border: 0;
  border-radius: 4px;
  font-family: inherit;
  color: var(--sub);
  font-size: 16px;
  line-height: 1;
  cursor: grab;
  opacity: 0.5;
  transition: opacity var(--fast) ease;
}
.row:hover .grip,
.grip:focus-visible {
  opacity: 1;
}
.row.dragging {
  opacity: 0.5;
}
.who-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: -4px;
  padding: 4px;
  background: none;
  border: 0;
  border-radius: 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--fast) ease;
}
.who-main:hover,
.row.open .who-main {
  background: color-mix(in srgb, var(--gold) 8%, transparent);
}
.caret {
  display: inline-block;
  color: var(--sub);
  font-size: 12px;
  transition: transform var(--fast) var(--ease-out), color var(--fast) ease;
}
.who-main:hover .caret {
  color: var(--gold);
}
.row.open .caret {
  color: var(--gold);
  transform: rotate(180deg);
}
.setup {
  grid-column: 1 / -1;
  margin: 2px -12px -8px;
}
.row.open {
  border-color: var(--gold);
}
.hint {
  padding: 6px 10px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.hint:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.face {
  flex: none;
  width: 56px;
  background: var(--bar);
  border-radius: 8px;
}
.who-text {
  display: grid;
  min-width: 0;
  line-height: 1.35;
}
.who-text b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.who-text small {
  color: var(--sub);
  font-size: 12px;
}
.mini {
  display: block;
  height: 4px;
  margin-top: 3px;
  overflow: hidden;
  background: var(--sunk);
  border-radius: 2px;
}
.mini i {
  display: block;
  height: 100%;
  background: var(--gain);
}
.who-text small.gold {
  color: var(--gold);
}
.full {
  color: var(--gain);
}
.gold {
  color: var(--gold);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.row.complete {
  border-color: var(--gain);
  box-shadow: inset 4px 0 0 var(--gain), 0 0 14px color-mix(in srgb, var(--gain) 15%, transparent);
}
.done-stamp {
  white-space: nowrap;
  padding: 2px 8px;
  border: 2px solid var(--gain);
  border-radius: 6px;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 13px;
  transform: rotate(-8deg);
  animation: stamp 0.35s var(--ease-spring);
}
@keyframes stamp {
  from { opacity: 0; transform: rotate(-8deg) scale(1.8); }
}
.all-btn {
  padding: 4px 10px;
  background: color-mix(in srgb, var(--gain) 12%, transparent);
  border: 1px solid var(--gain);
  border-radius: 6px;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--fast) ease, transform var(--fast) var(--ease-out);
}
/* 캐릭터마다 버튼 수가 달라도 빼기 크기가 같게 칸 너비를 고정한다 */
.acts {
  display: grid;
  flex: none;
  width: 68px;
  justify-items: stretch;
  gap: 4px;
  margin-left: auto;
  text-align: center;
}
.out-btn {
  padding: 2px 10px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--fast) ease, border-color var(--fast) ease;
}
.out-btn:hover:not(:disabled) {
  border-color: var(--loss);
  color: var(--loss);
}
.none-btn {
  padding: 3px 10px;
  background: color-mix(in srgb, var(--loss) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--loss) 60%, transparent);
  border-radius: 6px;
  color: var(--loss);
  font-family: var(--f-title);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--fast) ease, transform var(--fast) var(--ease-out);
}
.none-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--loss) 20%, transparent);
  transform: translateY(-1px);
}
.all-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--gain) 25%, transparent);
  transform: translateY(-1px);
}
/* 쓸 수 없는 버튼·표시도 자리는 남긴다 */
.off {
  visibility: hidden;
}
@media (max-width: 700px) {
  .row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 8px 10px;
  }
  .setup {
    margin: 2px -10px -8px;
  }
  .face {
    width: 44px;
  }
  .who-text b {
    font-size: 16px;
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }
  .hint {
    grid-column: 1 / -1;
  }
}
.nudge {
  display: none;
}
@media (pointer: coarse) {
  .grip {
    display: none;
  }
  .nudge {
    display: grid;
    flex: none;
    gap: 4px;
  }
  .nudge button {
    width: 30px;
    height: 26px;
    padding: 0;
    background: var(--bar);
    border: 1px solid var(--panel-line);
    border-radius: 6px;
    color: var(--sub);
    font-size: 11px;
    cursor: pointer;
  }
  .nudge button:disabled {
    opacity: 0.3;
    cursor: default;
  }
}
</style>
