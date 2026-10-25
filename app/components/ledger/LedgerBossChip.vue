<script setup lang="ts">
import type { BossClear, BossPick } from '#shared/types'
import { crystalPrice, type BossDifficulty } from '#shared/data/bosses'

defineProps<{ pick: BossPick & { boss: { cycle: 'weekly' | 'monthly' }, clear?: BossClear, takenOn?: string }, busy: boolean }>()
const emit = defineEmits<{ toggle: [], loot: [clear: BossClear] }>()
</script>

<template>
  <div class="chip" :class="{ done: pick.clear, taken: pick.takenOn }" :style="{ '--diff': DIFFICULTY_COLORS[pick.difficulty as BossDifficulty] }">
    <button
      type="button"
      class="toggle"
      :aria-pressed="!!pick.clear"
      :aria-busy="busy"
      :disabled="!!pick.takenOn"
      :title="pick.takenOn ? `이번 달은 ${formatDay(pick.takenOn)}에 잡았어요 · 그 주에서 풀 수 있어요` : `${bossLabel(pick.bossId, pick.difficulty)} · ${pick.party}인 · ${formatKoreanNumber(crystalPrice(pick.bossId, pick.difficulty, pick.party) ?? 0)}`"
      @click="emit('toggle')"
    >
      <span class="mark">
        <LedgerBossEmblem :boss-id="pick.bossId" :size="30" />
        <span class="check" aria-hidden="true">{{ pick.clear ? '✓' : '' }}</span>
      </span>
      <span class="name">{{ bossLabel(pick.bossId, pick.difficulty) }}</span>
      <small v-if="pick.takenOn" class="price">{{ formatDay(pick.takenOn) }} 잡음 · 월간</small>
      <small v-else class="price">{{ formatShortNumber(crystalPrice(pick.bossId, pick.difficulty, pick.party) ?? 0) }}<template v-if="pick.party > 1"> · {{ pick.party }}인</template><template v-if="pick.boss.cycle === 'monthly'"> · 월간</template></small>
    </button>
    <!-- 안 잡은 칸도 자리를 비워 두어야 체크할 때 칸 너비가 바뀌지 않는다 -->
    <button
      type="button"
      class="loot"
      :class="{ has: pick.clear?.loot.length, hidden: !pick.clear || pick.clear.id.startsWith('pending-') }"
      :tabindex="pick.clear ? 0 : -1"
      :title="pick.clear?.loot.length ? pick.clear.loot.map(l => l.item).join(', ') : '물욕템 기록'"
      :aria-label="`${bossLabel(pick.bossId, pick.difficulty)} 물욕템 기록`"
      @click="pick.clear && emit('loot', pick.clear)"
    >
      <template v-if="pick.clear?.loot.length">
        <LedgerLootIcon :item="pick.clear.loot[0]!.item" :size="20" />
        <template v-if="pick.clear.loot.length > 1">+{{ pick.clear.loot.length - 1 }}</template>
      </template>
      <template v-else>+<span class="loot-word">물욕</span></template>
    </button>
  </div>
</template>

<style scoped>
.chip {
  display: flex;
  align-items: stretch;
  min-width: 112px;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--diff);
  border-radius: 8px;
  color: var(--sub);
  transition: transform var(--fast) var(--ease-spring), background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease;
}
.chip:hover {
  transform: translateY(-2px);
  border-color: var(--tip-line);
  border-left-color: var(--diff);
}
/* 잡은 칩은 바탕을 채우고 체크를 크게 해서 안 잡은 칩과 한눈에 갈린다 */
.chip.done {
  background: color-mix(in srgb, var(--diff) 26%, var(--bar));
  border-color: var(--diff);
  color: var(--text);
}
.chip.done .name {
  font-weight: 700;
}
.toggle {
  display: grid;
  flex: 1;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 6px;
  padding: 4px 10px 4px 6px;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.toggle[aria-busy="true"] {
  cursor: progress;
}
/* 이번 달 다른 주에 잡은 월간 보스는 이 주엔 누를 수 없다 */
.chip.taken {
  border-style: dashed;
  border-left-style: solid;
}
.chip.taken:hover {
  transform: none;
}
.toggle:disabled {
  cursor: default;
}
.loot {
  padding: 0 8px;
  background: rgb(0 0 0 / 0.2);
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--diff) 40%, transparent);
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.loot:hover {
  background: rgb(0 0 0 / 0.35);
  color: var(--text);
}
.loot.has {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--gold);
}
.loot.hidden {
  visibility: hidden;
}
.mark {
  position: relative;
  grid-row: span 2;
}
.chip:not(.done) .mark {
  opacity: 0.55;
  filter: grayscale(0.6);
}
.check {
  position: absolute;
  right: -5px;
  bottom: -4px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: var(--bar);
  font-size: 13px;
  font-weight: 700;
}
.chip.done .check {
  background: var(--diff);
  box-shadow: 0 0 0 2px var(--bar);
  animation: pop 0.3s var(--ease-spring);
}
@keyframes pop {
  from { transform: scale(0.4); }
}
.name {
  font-family: var(--f-title);
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
}
.price {
  font-size: 11px;
  line-height: 1.2;
}
.chip.done .price {
  color: var(--gold);
}
@media (max-width: 700px) {
  .chip {
    min-width: 0;
  }
  .chip:hover {
    transform: none;
  }
  .toggle {
    min-width: 0;
    padding: 4px 6px 4px 5px;
    column-gap: 5px;
  }
  .name,
  .price {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    font-size: 13px;
  }
  /* 물욕 칸은 + 만 남겨 보스 이름 자리를 넓힌다 */
  .loot {
    min-width: 26px;
    padding: 0 4px;
    font-size: 13px;
  }
  .loot-word {
    display: none;
  }
}
</style>
