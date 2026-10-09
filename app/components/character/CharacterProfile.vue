<script setup lang="ts">
import type { CharacterDetail } from '#shared/types'

const props = defineProps<{ character: CharacterDetail, refreshing?: boolean, refreshError?: string }>()
const emit = defineEmits<{ refresh: [] }>()

const fetchedAgo = computed(() => {
  const minutes = Math.floor((Date.now() - Date.parse(props.character.fetchedAt)) / 60_000)
  return minutes < 1 ? '방금' : minutes < 60 ? `${minutes}분 전` : `${Math.floor(minutes / 60)}시간 전`
})

const best = computed(() => findBestPresetCombo(props.character))
const gain = computed(() => {
  const current = props.character.combatPower
  return best.value && current ? ((best.value.value - current) / current) * 100 : 0
})
</script>

<template>
  <GameWindow title="캐릭터 정보" :sub="character.world">
    <div class="head">
      <div class="name-row">
        <h1 class="name">{{ character.name }}</h1>
        <button type="button" class="refresh" :class="{ spinning: refreshing }" :disabled="refreshing" :title="refreshing ? '받는 중…' : `${fetchedAgo} 정보 · 누르면 바로 최신화`" aria-label="최신화" @click="emit('refresh')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
        </button>
      </div>
      <p v-if="refreshError" class="form-error">{{ refreshError }}</p>
      <div class="badges">
        <span class="badge level">LV.{{ character.level }}</span>
        <span class="badge job">{{ character.job }}</span>
        <span v-if="character.guild" class="badge guild">{{ character.guild }}</span>
      </div>
      <div class="meta">
        <span>유니온 <b class="union">{{ character.unionLevel?.toLocaleString('ko-KR') ?? '-' }}</b></span>
        <span>무릉도장 <b class="dojang">{{ character.dojangFloor ? `${character.dojangFloor}층` : '-' }}</b></span>
        <NuxtLink :to="{ path: '/growth', query: { name: character.name } }" class="growth-link">성장 기록 →</NuxtLink>
      </div>
    </div>
    <div class="tile power" style="--tone: var(--gold)">
      <span class="tile-label">전투력</span>
      <span class="tile-value">{{ character.combatPower === null ? '-' : formatKoreanNumber(character.combatPower) }}</span>
      <div v-if="best" class="combo" :class="{ up: !best.current }">
        <template v-if="best.current">
          <b>✓ 지금 조합이 가장 세요</b>
          <span>장비 프리셋 {{ best.equipPreset }} · 어빌리티 {{ best.abilityPreset }}</span>
        </template>
        <template v-else>
          <b>▲ 장비 프리셋 {{ best.equipPreset }} · 어빌리티 {{ best.abilityPreset }}</b>
          <span>이 조합이 가장 세요 · 약 +{{ gain.toFixed(1) }}%</span>
        </template>
      </div>
      <div v-else class="combo muted">이 직업은 프리셋 조합을 비교할 수 없어요</div>
    </div>
    <ExpBar :level="character.level" :rate="character.expRate" />
  </GameWindow>
</template>

<style scoped>
.head {
  display: grid;
  gap: 6px;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
/* 닉네임 옆에 붙는 작은 원형 아이콘 버튼. 받는 동안 아이콘이 돈다 */
.refresh {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgb(242 193 78 / 0.1);
  border: 1px solid rgb(242 193 78 / 0.35);
  border-radius: 50%;
  color: var(--gold);
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, transform var(--fast) var(--ease-spring);
}
.refresh:hover:not(:disabled) {
  background: rgb(242 193 78 / 0.2);
  border-color: var(--gold);
  transform: rotate(-30deg);
}
.refresh:disabled {
  cursor: wait;
}
.refresh svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.refresh.spinning svg {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { rotate: 360deg; }
}
.name {
  margin: 0;
  background: linear-gradient(90deg, #fff, #ffe3a3);
  background-clip: text;
  color: transparent;
  font-family: var(--f-title);
  font-size: 34px;
  font-weight: 400;
  line-height: 1.1;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.badge {
  padding: 2px 10px;
  border-radius: 999px;
  font-family: var(--f-title);
  font-size: 15px;
}
.level {
  background: linear-gradient(90deg, #ffb347, var(--gold));
  color: var(--on-gold);
}
.job {
  border: 1px solid var(--api);
  color: var(--api);
}
.guild {
  border: 1px solid var(--gain);
  color: var(--gain);
}
.meta {
  display: flex;
  gap: 16px;
  color: var(--sub);
  font-size: 14px;
}
.meta b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.growth-link {
  margin-left: auto;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 14px;
  text-decoration: none;
}
.growth-link:hover {
  text-decoration: underline;
}
.union {
  color: var(--calc);
}
.dojang {
  color: var(--loss);
}
.power .tile-value {
  font-size: 26px;
}
.combo {
  display: grid;
  gap: 1px;
  margin-top: 6px;
  padding: 6px 10px;
  background: rgb(127 217 154 / 0.08);
  border: 1px solid rgb(127 217 154 / 0.35);
  border-radius: 6px;
  color: var(--sub);
  font-size: 12px;
}
.combo b {
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.combo.up {
  background: rgb(242 193 78 / 0.1);
  border-color: rgb(242 193 78 / 0.45);
}
.combo.up b {
  color: var(--gold);
}
.combo.muted {
  background: none;
  border-color: var(--panel-line);
}
</style>
