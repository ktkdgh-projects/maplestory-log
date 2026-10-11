<script setup lang="ts">
import type { CharacterDetail } from '#shared/types'
import { findBestPresetCombo } from '#shared/calc/combatPower'

const props = defineProps<{ character: CharacterDetail, refreshing?: boolean, refreshError?: string }>()
const emit = defineEmits<{ refresh: [] }>()

// 서버 렌더링과 어긋나지 않게 화면에 붙은 뒤에만 재고, 1분마다 다시 잰다
const now = ref<number | null>(null)
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  clock = setInterval(() => (now.value = Date.now()), 60_000)
})
onBeforeUnmount(() => clearInterval(clock))
const fetchedAgo = computed(() => {
  if (now.value === null) return ''
  const minutes = Math.floor((now.value - Date.parse(props.character.fetchedAt)) / 60_000)
  return minutes < 1 ? '방금' : minutes < 60 ? `${minutes}분 전` : `${Math.floor(minutes / 60)}시간 전`
})

const best = computed(() => findBestPresetCombo(props.character))
// 더 센 조합이 있으면 큰 숫자는 그 조합의 전투력으로 보여준다
const upgrade = computed(() => (best.value && !best.value.current && props.character.combatPower ? best.value : null))
// 추산과 3% 안으로 맞는 가장 최근 실제 기록을 쓴다. 템을 팔거나 빼서 스펙이 바뀐 뒤의 옛 기록은 어긋나서 걸러진다
const RECORD_TOLERANCE = 0.03
const recorded = computed(() => {
  const estimated = upgrade.value?.value
  if (!estimated) return null
  return props.character.recentPowers?.find(record => Math.abs(record.value - estimated) / estimated <= RECORD_TOLERANCE) ?? null
})
const gain = computed(() => {
  const current = props.character.combatPower
  const target = recorded.value?.value ?? upgrade.value?.value
  return target && current ? Math.round(((target - current) / current) * 100) : 0
})
// 추산은 실제와 1% 안팎 차이 나므로 10만 단위로 반올림해 대략인 값임을 드러낸다
const estimate = computed(() => formatKoreanNumber(Math.round((upgrade.value?.value ?? 0) / 100_000) * 100_000))
</script>

<template>
  <GameWindow title="캐릭터 정보" :sub="character.world">
    <div class="head">
      <div class="name-row">
        <h1 class="name">{{ character.name }}</h1>
        <button type="button" class="refresh" :class="{ spinning: refreshing }" :disabled="refreshing" aria-label="최신화" @click="emit('refresh')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" /></svg>
        </button>
        <!-- 언제 받은 정보인지, 최신화 실패 이유를 같은 자리에 보여 줘서 줄이 생기지 않는다 -->
        <span class="fetched ellipsis" :class="{ failed: refreshError && !refreshing }" role="status">
          {{ refreshing ? '최신 정보 받는 중…' : refreshError ? `최신화하지 못했어요 · ${refreshError}` : fetchedAgo ? `${fetchedAgo} 정보` : '' }}
        </span>
      </div>
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
      <span class="tile-label">
        전투력
        <HoverInfo v-if="recorded" title="실제 기록" align="left">
          <span class="badge-mini record">{{ formatDay(recorded.date) }} 기록</span>
          <template #info>
            <span>이 조합의 추산과 맞는 가장 최근 실제 전투력이에요</span>
          </template>
        </HoverInfo>
        <HoverInfo v-else-if="upgrade" title="추산 전투력" align="left">
          <span class="badge-mini">추산</span>
          <template #info>
            <span>장착 정보로 계산한 값이라 실제와 1% 정도 차이 날 수 있어요</span>
          </template>
        </HoverInfo>
      </span>
      <span v-if="recorded" class="tile-value">{{ formatKoreanNumber(recorded.value) }}</span>
      <span v-else-if="upgrade" class="tile-value"><small class="about">약</small>{{ estimate }}</span>
      <span v-else class="tile-value">{{ character.combatPower === null ? '-' : formatKoreanNumber(character.combatPower) }}</span>
      <div v-if="upgrade" class="combo up">
        <p class="sentence">
          <b>▲ 장비 프리셋 {{ upgrade.equipPreset }} · 어빌리티 {{ upgrade.abilityPreset }}</b>으로 바꾸면<br>
          지금 <em>{{ formatKoreanNumber(character.combatPower!) }}</em>보다 <strong>약 {{ gain }}% 올라요!</strong>
        </p>
      </div>
      <div v-else-if="best" class="combo">
        <b>✓ 지금 조합이 가장 세요</b>
        <span>장비 프리셋 {{ best.equipPreset }} · 어빌리티 {{ best.abilityPreset }}</span>
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
.refresh {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
  border-radius: 50%;
  color: var(--gold);
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, transform var(--fast) var(--ease-spring);
}
.refresh:hover:not(:disabled) {
  background: color-mix(in srgb, var(--gold) 20%, transparent);
  border-color: var(--gold);
  transform: rotate(-30deg);
}
.refresh:disabled {
  cursor: wait;
}
.fetched {
  min-width: 0;
  color: var(--sub);
  font-size: 12.5px;
}
.fetched.failed {
  color: var(--loss);
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
  background: linear-gradient(90deg, #fff, var(--lamp-gold));
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
  background: linear-gradient(90deg, var(--gold-warm), var(--gold));
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
  flex-wrap: wrap;
  gap: 4px 16px;
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
  background: color-mix(in srgb, var(--gain) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--gain) 35%, transparent);
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
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  border-color: color-mix(in srgb, var(--gold) 45%, transparent);
}
.combo.up b {
  color: var(--gold);
}
.power .tile-label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.badge-mini {
  --c: var(--calc);
  padding: 0 7px;
  background: color-mix(in srgb, var(--c) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  border-radius: 999px;
  color: var(--c);
  font-size: 11px;
  line-height: 17px;
  cursor: help;
}
.badge-mini.record {
  --c: var(--api);
}
.about {
  margin-right: 5px;
  color: var(--sub);
  font-size: 15px;
}
/* 두 줄이 한 문장으로 읽히도록 붙여 쓰고 강조만 색으로 나눈다 */
.sentence {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.65;
}
.sentence em {
  color: var(--text);
  font-style: normal;
  font-weight: 700;
}
.sentence strong {
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.combo.muted {
  background: none;
  border-color: var(--panel-line);
}
</style>
