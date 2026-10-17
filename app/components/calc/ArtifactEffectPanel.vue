<script lang="ts">
import type { ArtifactResponse } from '#shared/types'
import { ARTIFACT_MAX_LEVEL, type ArtifactEffectKey } from '#shared/data/artifact'
import type { JobTraits, MainStatType, TraitLevel } from '#shared/data/jobTraits'
import type { ArtifactPick } from '#shared/calc/artifact'
import { toneOf } from './ArtifactCrystalBoard.vue'

export const LEVEL_TEXT: Record<TraitLevel, string> = { high: '높음', mid: '보통', low: '낮음', unknown: '확인 중' }
const STAT_TEXT: Record<MainStatType, string> = { normal: '일반', xenon: '제논', demonAvenger: '데몬어벤져' }
const DEFENSES = [{ value: 3, label: '300%' }, { value: 3.8, label: '380%' }]
</script>

<script setup lang="ts">
const props = defineProps<{
  data: ArtifactResponse | null
  ready: boolean
  traits: JobTraits
  crit: number
  picks: ArtifactPick[]
  order: ArtifactEffectKey[]
  planLevels: Partial<Record<ArtifactEffectKey, number>>
}>()
defineEmits<{ editTraits: [] }>()
const bossDefense = defineModel<number>('bossDefense', { required: true })
const hunt = defineModel<boolean>('hunt', { required: true })

const pickOf = (key: ArtifactEffectKey) => props.picks.find(p => p.effect.key === key)!
const critNote = computed(() => {
  if (props.traits.critOver === 'yes') return ` · 리인포스 때 크뎀 +${(props.crit / 2).toFixed(1)}%`
  if (props.crit > 100) return ` · ${(props.crit - 100).toFixed(0)}%p 버려짐`
  if (props.crit < 100) return ` · 100까지 ${(100 - props.crit).toFixed(0)}%p`
  return ''
})
const effectRows = computed(() => {
  const all = props.order.map(pickOf)
  const unused = (p: ArtifactPick) => (p.effect.key === 'summon' && props.traits.summon !== 'yes') || (p.effect.key === 'finalAttack' && props.traits.finalAttack !== 'yes')
  return [
    { key: 'open', title: '올릴 효과 · 순서대로', list: all.filter(p => p.level < ARTIFACT_MAX_LEVEL && p.effect.group !== 'hunt' && !unused(p)) },
    { key: 'done', title: '10레벨 · 지금 주는 몫', list: all.filter(p => p.level >= ARTIFACT_MAX_LEVEL && p.effect.group !== 'hunt') },
    { key: 'hunt', title: '사냥', list: all.filter(p => p.effect.group === 'hunt') },
    { key: 'unused', title: '이 직업은 안 쓰는 효과', list: all.filter(p => p.level < ARTIFACT_MAX_LEVEL && unused(p)) },
  ].filter(s => s.list.length)
})
const percent = (n: number | null) => (n === null ? '-' : `+${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`)
function valueOf(p: ArtifactPick): { text: string, sub?: string, muted?: boolean } {
  if (p.effect.group === 'hunt') return { text: `${p.effect.max}${p.effect.unit}`, muted: true }
  if (p.level >= ARTIFACT_MAX_LEVEL) return p.worth !== null ? { text: percent(p.worth) } : { text: p.tag, muted: true }
  if (p.gain !== null) return { text: percent(p.gain), sub: p.burst ? `극딜 ${percent(p.burst)}` : undefined }
  const trait = p.effect.key === 'cooldown' ? props.traits.cooldown : p.effect.key === 'buff' ? props.traits.buff : null
  return { text: trait ? `중요도 ${LEVEL_TEXT[trait]}` : p.tag, muted: true }
}
</script>

<template>
  <aside class="side">
    <section class="basis">
      <div class="basis-head">
        <b>{{ data?.character.job ?? '직업' }} 기준</b>
        <button v-if="data" type="button" class="link" @click="$emit('editTraits')">직업 특성 고치기</button>
      </div>
      <div class="chips">
        <span class="chip" :class="{ hi: traits.critOver === 'yes' }">크확 {{ crit }}%{{ critNote }}</span>
        <span class="chip" :class="{ hi: traits.cooldown === 'high' }">재사용 {{ LEVEL_TEXT[traits.cooldown] }}</span>
        <span class="chip" :class="{ hi: traits.buff === 'high' }">벞지 {{ LEVEL_TEXT[traits.buff] }}</span>
        <span v-if="traits.summon === 'yes'" class="chip on">소환수</span>
        <span v-if="traits.finalAttack === 'yes'" class="chip on">파이널 어택</span>
        <span v-if="traits.stat !== 'normal'" class="chip on">주스탯 {{ STAT_TEXT[traits.stat] }}</span>
        <span v-if="data?.traits" class="chip mine">고친 값</span>
      </div>
      <div class="opts-row">
        <span class="muted">보스 방어율</span>
        <div class="mini-seg">
          <button v-for="d in DEFENSES" :key="d.value" type="button" :aria-pressed="bossDefense === d.value" @click="bossDefense = d.value">{{ d.label }}</button>
        </div>
        <label class="check"><input v-model="hunt" type="checkbox">사냥 효과 포함</label>
      </div>
    </section>

    <section class="effects scroll-fade">
      <template v-if="ready">
        <template v-for="g in effectRows" :key="g.key">
          <span class="cap">{{ g.title }}</span>
          <div v-for="(p, i) in g.list" :key="p.effect.key" class="ef" :class="g.key" :style="{ '--c': toneOf(p.effect.key) }">
            <span class="rank">{{ g.key === 'open' ? i + 1 : '' }}</span>
            <span class="ename">{{ p.effect.name }}</span>
            <span class="lv" :aria-label="`${p.level}레벨`"><i v-for="n in ARTIFACT_MAX_LEVEL" :key="n" :class="{ on: n <= p.level, up: n > p.level && n <= (planLevels[p.effect.key] ?? 0) }" /></span>
            <span class="val" :class="{ muted: valueOf(p).muted }">{{ valueOf(p).text }}<small v-if="valueOf(p).sub">{{ valueOf(p).sub }}</small></span>
          </div>
        </template>
      </template>
      <template v-else>
        <span v-for="n in 10" :key="n" class="skeleton ef-skeleton" />
      </template>
    </section>
  </aside>
</template>

<style scoped>
.muted {
  color: var(--sub);
}
.link {
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  text-decoration: underline dotted;
  cursor: pointer;
}
.link:hover {
  color: var(--api);
}
.side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}
.side > section {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.basis-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.basis-head b {
  color: var(--calc);
  font: 16px var(--f-title);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  padding: 1px 9px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 12px;
}
.chip.hi {
  border-color: var(--gold);
  color: var(--gold);
}
.chip.on {
  border-color: var(--gain);
  color: var(--gain);
}
.chip.mine {
  border-style: dashed;
  color: var(--text);
}
.opts-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding-top: 8px;
  border-top: 1px solid var(--panel-line);
  font-size: 12.5px;
}
.mini-seg {
  display: inline-flex;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 7px;
}
.mini-seg button {
  padding: 3px 10px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.mini-seg button:last-child {
  border-right: 0;
}
.mini-seg button[aria-pressed="true"] {
  background: var(--api);
  color: var(--bar);
  font-weight: 700;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  color: var(--sub);
  cursor: pointer;
}
.check input {
  accent-color: var(--api);
}
.effects {
  align-content: start;
  gap: 5px !important;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}
.cap {
  margin-top: 6px;
  color: var(--sub);
  font-size: 11.5px;
  letter-spacing: 0.04em;
}
.cap:first-child {
  margin-top: 0;
}
.ef {
  display: grid;
  grid-template-columns: 16px 112px minmax(0, 1fr) 70px;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.ef.done,
.ef.hunt {
  opacity: 0.8;
}
.ef.unused {
  opacity: 0.45;
}
.rank {
  color: var(--gold);
  font: 13px var(--f-title);
  text-align: center;
}
.ename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lv {
  display: flex;
  gap: 2px;
}
.lv i {
  flex: 1;
  height: 9px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 2px;
}
.lv i.on {
  background: var(--c);
  border-color: var(--c);
}
.lv i.up {
  background: color-mix(in srgb, var(--gold) 35%, transparent);
  border: 1px dashed var(--gold);
}
.val {
  display: grid;
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}
.val.muted {
  color: var(--sub);
  font-size: 11.5px;
  white-space: nowrap;
}
.val small {
  color: var(--calc);
  font-size: 10.5px;
}
.ef-skeleton {
  height: 18px;
}
@media (max-width: 1100px) {
  .effects {
    overflow: visible;
  }
}
</style>
