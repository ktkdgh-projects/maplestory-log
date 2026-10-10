<script setup lang="ts">
import type { BossPick } from '#shared/types'
import { DIFFICULTY_LABELS, crystalPrice, type BossDifficulty, type BossInfo } from '#shared/data/bosses'

const props = defineProps<{ boss: BossInfo, pick: BossPick | undefined, locked?: boolean }>()
const emit = defineEmits<{ difficulty: [difficulty: string], party: [delta: number] }>()

// 고른 카드의 빈 곳을 누르면 뺀다(고른 난이도를 다시 눌러도 빠진다). 버튼 위를 누른 건 그 버튼이 처리한다
function onCard(event: MouseEvent) {
  if (!props.pick || (event.target as HTMLElement).closest('button')) return
  emit('difficulty', props.pick.difficulty)
}
</script>

<template>
  <div class="card" :class="{ picked: pick, locked }" :style="pick ? { '--diff': DIFFICULTY_COLORS[pick.difficulty as BossDifficulty] } : undefined" :title="pick ? '빈 곳을 누르면 빠져요' : undefined" @click="onCard">
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
    <!-- 고르기 전에도 자리를 잡아 두어야 고를 때 난이도 버튼이 줄바꿈되며 카드 크기가 바뀌지 않는다 -->
    <div class="info" :class="{ empty: !pick }" :aria-hidden="!pick">
      <b class="each">{{ pick ? formatShortNumber(crystalPrice(boss.id, pick.difficulty, pick.party) ?? 0) : '0' }}</b>
      <div class="party">
        <button type="button" aria-label="파티 인원 줄이기" :tabindex="pick ? 0 : -1" @click="emit('party', -1)">−</button>
        <span>{{ pick?.party ?? 1 }}인</span>
        <button type="button" aria-label="파티 인원 늘리기" :tabindex="pick ? 0 : -1" @click="emit('party', 1)">+</button>
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
.card.picked {
  cursor: pointer;
}
.card.picked:hover {
  border-color: color-mix(in srgb, var(--loss) 60%, var(--diff));
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
  /* 가격 글자 길이가 달라도 칸 너비가 같게 */
  min-width: 68px;
}
.card.picked .info {
  animation: rise-in 0.25s var(--ease-out);
}
.info.empty {
  visibility: hidden;
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
