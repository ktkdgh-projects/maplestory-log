<script setup lang="ts">
import type { BossPick } from '#shared/types'
import { DIFFICULTY_LABELS, crystalPrice, type BossDifficulty, type BossInfo } from '#shared/data/bosses'

defineProps<{ boss: BossInfo, pick: BossPick | undefined, locked?: boolean }>()
const emit = defineEmits<{ difficulty: [difficulty: string], party: [delta: number] }>()
</script>

<template>
  <div class="card" :class="{ picked: pick, locked }" :style="pick ? { '--diff': DIFFICULTY_COLORS[pick.difficulty as BossDifficulty] } : undefined">
    <LedgerBossEmblem :boss-id="boss.id" :size="44" />
    <div class="body">
      <span class="name ellipsis" :title="boss.name">{{ boss.name }}</span>
      <div class="diffs">
        <button
          v-for="(price, diff) in boss.prices"
          :key="diff"
          type="button"
          class="diff"
          :class="{ on: pick?.difficulty === diff }"
          :style="{ '--tone': DIFFICULTY_COLORS[diff as BossDifficulty] }"
          :title="`${DIFFICULTY_LABELS[diff as BossDifficulty]} ${boss.name} · ${formatKoreanNumber(price!)} 메소`"
          :disabled="locked"
          :aria-pressed="pick?.difficulty === diff"
          @click="emit('difficulty', diff)"
        >
          {{ DIFFICULTY_LABELS[diff as BossDifficulty] }}
        </button>
      </div>
    </div>
    <div v-if="pick" class="info">
      <b class="each">{{ formatShortNumber(crystalPrice(boss.id, pick.difficulty, pick.party) ?? 0) }}</b>
      <div class="party">
        <button type="button" aria-label="파티 인원 줄이기" @click="emit('party', -1)">−</button>
        <span>{{ pick.party }}인</span>
        <button type="button" aria-label="파티 인원 늘리기" @click="emit('party', 1)">+</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  --diff: var(--panel-line);
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 2px 8px 2px 3px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  transition: border-color var(--fast) ease, background var(--fast) ease, opacity var(--fast) ease, transform var(--fast) var(--ease-out);
}
.card:not(.locked):hover {
  transform: translateY(-1px);
  border-color: var(--tip-line);
}
.card.picked {
  background: linear-gradient(90deg, color-mix(in srgb, var(--diff) 16%, var(--panel)), var(--panel) 70%);
  border-color: var(--diff);
  box-shadow: 0 0 10px color-mix(in srgb, var(--diff) 25%, transparent);
}
.card.locked {
  opacity: 0.35;
  filter: grayscale(0.8);
}
.body {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}
.name {
  font-family: var(--f-title);
  font-size: 15px;
  line-height: 1.2;
}
.diffs {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.diff {
  padding: 2px 8px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 5px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease, border-color var(--fast) ease, transform var(--fast) var(--ease-spring);
}
.diff:hover:not(:disabled) {
  border-color: var(--tone);
  color: var(--tone);
}
.diff:active:not(:disabled) {
  transform: scale(0.92);
}
.diff:disabled {
  cursor: not-allowed;
}
.diff.on {
  background: var(--tone);
  border-color: var(--tone);
  color: var(--bar);
}
.info {
  display: grid;
  flex: none;
  justify-items: end;
  gap: 2px;
  animation: rise-in 0.25s var(--ease-out);
}
.each {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.party {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
}
.party button {
  width: 20px;
  height: 20px;
  padding: 0;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 4px;
  color: var(--text);
  line-height: 1;
  cursor: pointer;
}
.party span {
  min-width: 24px;
  text-align: center;
}
</style>
