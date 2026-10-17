<script setup lang="ts">
import type { ArtifactResponse } from '#shared/types'
import { ARTIFACT_CRYSTALS, ARTIFACT_EXP, ARTIFACT_TOP_LEVEL, artifactAp, type ArtifactEffectKey } from '#shared/data/artifact'
import { effectOf } from './ArtifactCrystalBoard.vue'

const props = defineProps<{
  data: ArtifactResponse | null
  ready: boolean
  failure: string
  tab: 'mine' | 'plan'
  today: string
  changes: number
  maxedNow: number
  maxedPlan: number
  nextCrystal: { name: string, unlock: number } | null
  nextOptions: ArtifactEffectKey[]
  goal: { plain: number | null, boosted: number | null }
  boosters: number
}>()

const apTotal = computed(() => artifactAp(props.data?.level ?? 0))
const apUsed = computed(() => apTotal.value - (props.data?.remainAp ?? 0))
const expire = computed(() => {
  const dates = (props.data?.crystals ?? []).map(c => c.expire).filter((d): d is string => !!d).sort()
  return dates[0] ? Math.ceil((Date.parse(dates[0]) - Date.now()) / 86_400_000) : null
})
const dateAfter = (weeks: number | null) => (weeks === null ? '-' : formatDay(addDays(props.today, weeks * 7)))
</script>

<template>
  <section class="hero">
    <template v-if="ready && data">
      <span class="ring" :style="{ '--p': `${Math.min(data.level / ARTIFACT_TOP_LEVEL, 1) * 100}%` }"><b>{{ data.level }}</b><small>레벨</small></span>
      <div class="exp">
        <span class="muted">{{ data.level < ARTIFACT_TOP_LEVEL ? `Lv ${data.level + 1}까지` : '만렙' }}</span>
        <div v-if="data.level < ARTIFACT_TOP_LEVEL" class="bar"><i :style="{ width: `${Math.min(data.exp / ARTIFACT_EXP[data.level]!, 1) * 100}%` }" /></div>
        <small v-if="data.level < ARTIFACT_TOP_LEVEL" class="muted">{{ data.exp.toLocaleString('ko-KR') }} / {{ ARTIFACT_EXP[data.level]!.toLocaleString('ko-KR') }}</small>
      </div>
      <dl class="facts">
        <div><dt>AP</dt><dd>{{ apUsed }}<small>/{{ apTotal }}</small></dd></div>
        <div><dt>크리스탈</dt><dd>{{ data.crystals.length }}<small>/{{ ARTIFACT_CRYSTALS.length }}</small></dd></div>
        <div><dt>포인트</dt><dd>{{ data.point.toLocaleString('ko-KR') }}</dd></div>
        <div><dt>만료</dt><dd :class="{ warn: expire !== null && expire <= 7 }">{{ expire === null ? '-' : `D-${expire}` }}</dd></div>
      </dl>
      <div v-if="tab === 'mine'" class="verdict" :class="{ good: !changes }">
        <b>{{ changes ? `${changes}칸 바꾸면 10레벨 ${maxedPlan}개` : '지금 배치 그대로 두세요' }}</b>
        <small>{{ changes ? `지금 ${maxedNow}개 · 바꿀 칸은 아래 금색` : nextCrystal ? `Lv ${nextCrystal.unlock} ${nextCrystal.name}엔 ${nextOptions.map(k => effectOf(k).short).join(' · ')}` : '모든 크리스탈이 열렸어요' }}</small>
      </div>
      <div v-else class="verdict">
        <b>{{ goal.plain === null ? 'Lv 60' : `Lv 60까지 ${goal.boosted}주` }}</b>
        <small>{{ dateAfter(goal.boosted) }}{{ boosters && goal.plain && goal.boosted ? ` · 부스터로 ${goal.plain - goal.boosted}주 단축` : '' }}</small>
      </div>
    </template>
    <span v-else-if="!failure" class="skeleton hero-skeleton" />
    <p v-else class="fail">{{ failure }}</p>
  </section>
</template>

<style scoped>
.muted {
  color: var(--sub);
}
.hero {
  display: grid;
  grid-template-columns: auto minmax(160px, 240px) auto minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 92px;
  padding: 12px 16px;
  background: radial-gradient(480px 160px at 0 50%, color-mix(in srgb, var(--api) 18%, transparent), transparent 70%), var(--panel);
  border: 1px solid color-mix(in srgb, var(--api) 55%, var(--panel-line));
  border-radius: 14px;
}
.hero-skeleton {
  grid-column: 1 / -1;
  height: 66px;
}
.fail {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--loss);
}
.ring {
  display: grid;
  place-content: center;
  width: 68px;
  height: 68px;
  background: radial-gradient(closest-side, var(--panel) 78%, transparent 79%), conic-gradient(var(--api) var(--p), var(--bar) 0);
  border-radius: 50%;
  text-align: center;
  line-height: 1;
}
.ring b {
  color: var(--api);
  font: 26px var(--f-title);
}
.ring small {
  color: var(--sub);
  font-size: 10.5px;
}
.exp {
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.bar {
  height: 8px;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}
.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--api), #bff0ff);
}
.facts {
  display: flex;
  margin: 0;
}
.facts div {
  display: grid;
  gap: 2px;
  padding: 0 14px;
  border-left: 1px solid var(--panel-line);
  text-align: center;
}
.facts dt {
  color: var(--sub);
  font-size: 11.5px;
}
.facts dd {
  margin: 0;
  font: 19px var(--f-title);
  font-variant-numeric: tabular-nums;
}
.facts dd small {
  color: var(--sub);
  font-size: 13px;
}
.facts dd.warn {
  color: var(--loss);
}
.verdict {
  display: grid;
  justify-self: end;
  gap: 2px;
  max-width: 100%;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  border: 1px solid var(--gold);
  border-radius: 10px;
  text-align: right;
}
.verdict.good {
  background: color-mix(in srgb, var(--gain) 10%, transparent);
  border-color: var(--gain);
}
.verdict b {
  color: var(--gold);
  font: 18px var(--f-title);
}
.verdict.good b {
  color: var(--gain);
}
.verdict small {
  color: var(--sub);
  font-size: 12px;
}
@media (max-height: 860px) {
  .hero {
    min-height: 0;
    padding: 6px 14px;
  }
  .ring {
    width: 54px;
    height: 54px;
  }
  .ring b {
    font-size: 21px;
  }
}
@media (max-width: 1100px) {
  .hero {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .facts,
  .verdict {
    grid-column: 1 / -1;
    justify-self: stretch;
    text-align: left;
  }
}
@media (max-width: 640px) {
  .facts div {
    padding: 0 8px;
  }
}
</style>
