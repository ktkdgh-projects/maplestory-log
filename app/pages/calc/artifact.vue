<script setup lang="ts">
import type { ArtifactResponse, BossBoardResponse, CharacterBrief } from '#shared/types'
import { ARTIFACT_CRYSTALS, ARTIFACT_EXP, ARTIFACT_MAX_CRYSTAL_GRADE, ARTIFACT_MAX_LEVEL, ARTIFACT_NORMAL_MISSION_EXP, ARTIFACT_TOP_LEVEL, artifactEffectOf, type ArtifactEffectKey } from '#shared/data/artifact'
import { jobTraitsOf, type JobTraits } from '#shared/data/jobTraits'
import { artifactPicks, artifactPriority, bossMissionExp, levelsOf, planCrystals, weeksToLevel } from '#shared/calc/artifact'
import { useKstToday } from '~/composables/useEnhanceRecords'
import type { ArtifactOptionRow } from '~/components/calc/ArtifactCrystalBoard.vue'

useHead({ title: '아티팩트 · 메이플스토리로그' })

const { me } = await useMe()
const today = useKstToday()
const characters = ref<CharacterBrief[]>([])
const ocid = ref<string | null>(me.value?.main?.ocid ?? null)
const data = shallowRef<ArtifactResponse | null>(null)
const loading = ref(false)
const failure = ref('')
const tab = ref<'mine' | 'plan'>('mine')
const bossDefense = ref(3)
const hunt = ref(true)
const traitsOpen = ref(false)

onMounted(async () => {
  if (!me.value) return
  characters.value = await $fetch<CharacterBrief[]>('/api/me/characters').catch(() => [])
  ocid.value ??= characters.value[0]?.ocid ?? null
})

let seq = 0
watch(ocid, async (id) => {
  if (!id) return
  const mine = ++seq
  loading.value = true
  failure.value = ''
  try {
    const result = await $fetch<ArtifactResponse>(`/api/artifact/${id}`)
    if (mine === seq) data.value = result
  }
  catch (error) {
    if (mine === seq) failure.value = errorMessage(error)
  }
  finally {
    if (mine === seq) loading.value = false
  }
}, { immediate: true })

const ready = computed(() => !!data.value && !loading.value)
const stat = (name: string) => Number(data.value?.stats.find(s => s.name === name)?.value ?? 0)
const baseTraits = computed(() => jobTraitsOf(data.value?.character.job ?? ''))
const traits = computed<JobTraits>(() => ({ ...baseTraits.value, ...data.value?.traits }))
const levels = computed(() => Object.fromEntries((data.value?.effects ?? []).map(e => [e.key, e.level])) as Partial<Record<ArtifactEffectKey, number>>)
const picks = computed(() => data.value
  ? artifactPicks({ job: data.value.character.job, stat, levels: levels.value, traits: traits.value, bossDefense: bossDefense.value, percents: data.value.percents })
  : [])
const priority = computed(() => artifactPriority(picks.value, traits.value, hunt.value))
const order = computed(() => priority.value.order)

const board = computed(() => ARTIFACT_CRYSTALS.map((c) => {
  const owned = data.value?.crystals.find(x => x.name === c.name) ?? null
  const keys = (owned?.options ?? []).map(o => artifactEffectOf(o)?.key).filter((k): k is ArtifactEffectKey => !!k)
  return { ...c, owned, keys, locked: !owned && (data.value?.level ?? 0) < c.unlock }
}))
const owned = computed(() => board.value.filter(c => c.owned))
const slots = computed(() => owned.value.map(c => ({ grade: c.owned!.level, options: c.keys })))
// 가진 크리스탈은 지금 이득인 쪽으로 짜고, 앞으로 열릴 크리스탈은 그 배치를 그대로 둔 채 빈칸만 채운다(Lv 60엔 모두 5등급)
const planNow = computed(() => planCrystals(order.value, slots.value, priority.value.important))
const planLevels = computed(() => levelsOf(planNow.value, slots.value.map(s => s.grade)))
const futurePlans = computed(() => {
  const acc = planNow.value.map(options => ({ grade: ARTIFACT_MAX_CRYSTAL_GRADE, options }))
  const result = new Map<string, ArtifactEffectKey[]>()
  for (const c of board.value.filter(b => !b.owned)) {
    acc.push({ grade: ARTIFACT_MAX_CRYSTAL_GRADE, options: [] })
    const plan = planCrystals(order.value, acc, [])
    plan.forEach((options, i) => (acc[i]!.options = options))
    result.set(c.name, plan.at(-1)!)
  }
  return result
})
const futureOf = (c: { name: string }) => futurePlans.value.get(c.name) ?? []
const nextCrystal = computed(() => board.value.find(c => c.locked) ?? null)

// 지금 옵션 자리에 추천 옵션을 맞춰 놓는다. from이 있으면 그 옵션을 바꾸라는 뜻
function rowsOf(name: string, keys: ArtifactEffectKey[]): ArtifactOptionRow[] {
  const plan = planNow.value[owned.value.findIndex(c => c.name === name)] ?? []
  const added = plan.filter(k => !keys.includes(k))
  const rows = keys.map(k => (plan.includes(k) ? { key: k, from: null } : { key: added.shift() ?? k, from: k }))
  return [...rows, ...added.map(k => ({ key: k, from: null }))]
}
const changes = computed(() => owned.value.reduce((n, c) => n + rowsOf(c.name, c.keys).filter(r => r.from && r.from !== r.key).length, 0))
const maxedNow = computed(() => picks.value.filter(p => p.level >= ARTIFACT_MAX_LEVEL).length)
const maxedPlan = computed(() => Object.values(planLevels.value).filter(l => l! >= ARTIFACT_MAX_LEVEL).length)
const crit = computed(() => stat('크리티컬 확률'))

async function saveTrait(field: keyof JobTraits, value: string) {
  if (!data.value) return
  const job = data.value.character.job
  const body = { job, traits: { ...data.value.traits, [field]: value } }
  const result = await $fetch<{ traits: Partial<JobTraits> | null }>('/api/guides/traits', { method: 'PUT', body }).catch(() => null)
  if (result && data.value?.character.job === job) data.value = { ...data.value, traits: result.traits }
}
async function resetTraits() {
  if (!data.value) return
  const result = await $fetch<{ traits: null }>('/api/guides/traits', { method: 'PUT', body: { job: data.value.character.job, traits: null } }).catch(() => null)
  if (result && data.value) data.value = { ...data.value, traits: null }
}

const normal = ref(ARTIFACT_NORMAL_MISSION_EXP)
const boosters = ref(0)
const roster = shallowRef<BossBoardResponse['roster'] | null>(null)
const bossManual = ref<number | null>(null)
watch(tab, async (t) => {
  if (t === 'plan' && !roster.value) roster.value = (await $fetch<BossBoardResponse>('/api/ledger/bosses').catch(() => null))?.roster ?? []
})
// 보스 미션은 월드에서 가장 높은 3개. 보스 수입에 세팅한 같은 월드 캐릭터들의 보스로 센다
const bossAuto = computed(() => bossMissionExp((roster.value ?? []).filter(c => c.world === data.value?.character.world).flatMap(c => c.bosses)))
const boss = computed(() => bossManual.value ?? bossAuto.value.exp)
const planInput = computed(() => ({ level: data.value?.level ?? 0, exp: data.value?.exp ?? 0, normal: normal.value, boss: boss.value, boosters: boosters.value }))
const goal = computed(() => ({
  plain: weeksToLevel({ ...planInput.value, boosters: 0 }, ARTIFACT_TOP_LEVEL),
  boosted: weeksToLevel(planInput.value, ARTIFACT_TOP_LEVEL),
}))
const milestones = computed(() => ARTIFACT_CRYSTALS.filter(c => c.unlock > (data.value?.level ?? 0)).map(c => ({
  ...c,
  plain: weeksToLevel({ ...planInput.value, boosters: 0 }, c.unlock),
  boosted: weeksToLevel(planInput.value, c.unlock),
})))
const leftExp = computed(() => {
  const d = data.value
  if (!d || d.level >= ARTIFACT_TOP_LEVEL) return 0
  return ARTIFACT_EXP.slice(d.level + 1).reduce((n, e) => n + e, ARTIFACT_EXP[d.level]! - d.exp)
})
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.artifact" />

  <GameWindow v-else class="fit" title="아티팩트" accent="blue" fill>
    <template #sub>
      <span v-if="data">{{ data.character.world }} 월드 · 계정 공용</span>
    </template>
    <div class="artifact">
      <div class="toolbar">
        <CharacterSearch v-model="ocid" :characters="characters" />
        <div class="tabs" role="tablist" aria-label="보기">
          <button type="button" role="tab" :aria-selected="tab === 'mine'" @click="tab = 'mine'">내 아티팩트</button>
          <button type="button" role="tab" :aria-selected="tab === 'plan'" @click="tab = 'plan'">계획 · 부스터</button>
        </div>
      </div>

      <ArtifactHero
        :data="data"
        :ready="ready"
        :failure="failure"
        :tab="tab"
        :today="today"
        :changes="changes"
        :maxed-now="maxedNow"
        :maxed-plan="maxedPlan"
        :next-crystal="nextCrystal"
        :next-options="nextCrystal ? futureOf(nextCrystal) : []"
        :goal="goal"
        :boosters="boosters"
      />

      <div v-if="tab === 'mine'" class="mine">
        <ArtifactCrystalBoard :board="board" :next-crystal="nextCrystal" :ready="ready" :rows-of="rowsOf" :future-of="futureOf" />
        <ArtifactEffectPanel
          v-model:boss-defense="bossDefense"
          v-model:hunt="hunt"
          :data="data"
          :ready="ready"
          :traits="traits"
          :crit="crit"
          :picks="picks"
          :order="order"
          :plan-levels="planLevels"
          @edit-traits="traitsOpen = true"
        />
      </div>

      <ArtifactPlanTab
        v-else
        v-model:normal="normal"
        v-model:boosters="boosters"
        v-model:boss-manual="bossManual"
        :ready="ready"
        :today="today"
        :roster="roster"
        :boss-auto="bossAuto"
        :boss="boss"
        :goal="goal"
        :milestones="milestones"
        :left-exp="leftExp"
      />

      <p class="foot muted">AP·크리스탈·부스터: 공식 업데이트 731 · 효과 값: 넥슨 API · 레벨별·미션 EXP와 직업 특성: 나무위키 · 퍼센트는 보스 데미지 기준 추정</p>
    </div>

    <ArtifactTraitsModal v-model="traitsOpen" :data="data" :traits="traits" :base-traits="baseTraits" @save="saveTrait" @reset="resetTraits" />
  </GameWindow>
</template>

<style scoped>
.artifact {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 12px;
  height: 100%;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
.tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.tabs button {
  padding: 6px 14px;
  background: none;
  border: 0;
  border-radius: 7px;
  color: var(--sub);
  font: 15px var(--f-title);
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease;
}
.tabs button[aria-selected="true"] {
  background: var(--api);
  color: var(--bar);
}
.muted {
  color: var(--sub);
}
.mine {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 12px;
  min-height: 0;
}
.foot {
  margin: 0;
  font-size: 12px;
}
/* 낮은 화면: 크리스탈 세 줄이 잘리지 않게 칸 안을 줄인다 */
@media (max-height: 860px) {
  .artifact {
    gap: 8px;
  }
}
@media (max-width: 1100px) {
  .mine {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
