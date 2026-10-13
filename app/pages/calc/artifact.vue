<script setup lang="ts">
import type { ArtifactResponse, BossBoardResponse, CharacterBrief } from '#shared/types'
import { ARTIFACT_BOOSTER_MAX_WEEKS, ARTIFACT_BOOSTER_WEEKS, ARTIFACT_CRYSTALS, ARTIFACT_EFFECTS, ARTIFACT_EXP, ARTIFACT_MAX_CRYSTAL_GRADE, ARTIFACT_MAX_LEVEL, ARTIFACT_NORMAL_MISSION_EXP, ARTIFACT_TOP_LEVEL, artifactAp, artifactEffectOf, type ArtifactEffectKey } from '#shared/data/artifact'
import { jobTraitsOf, type JobTraits, type MainStatType, type TraitFlag, type TraitLevel } from '#shared/data/jobTraits'
import { findBoss } from '#shared/data/bosses'
import { artifactPicks, artifactPriority, bossMissionExp, levelsOf, planCrystals, weeksToLevel, type ArtifactPick } from '#shared/calc/artifact'
import { useKstToday } from '~/composables/useEnhanceRecords'

useHead({ title: '아티팩트 · 메이플스토리로그' })

const ICONS = assetsByName(import.meta.glob<string>('~/assets/artifact/*.png', { eager: true, import: 'default' }))
const DEFENSES = [{ value: 3, label: '300%' }, { value: 3.8, label: '380%' }]
const LEVEL_TEXT: Record<TraitLevel, string> = { high: '높음', mid: '보통', low: '낮음', unknown: '확인 중' }
const FLAG_TEXT: Record<TraitFlag, string> = { yes: '예', no: '아니오', unknown: '확인 중' }
const STAT_TEXT: Record<MainStatType, string> = { normal: '일반', xenon: '제논', demonAvenger: '데몬어벤져' }
const TRAIT_FIELDS = [
  { key: 'critOver', label: '크확 100% 넘어도 이득(리인포스)', options: FLAG_TEXT },
  { key: 'cooldown', label: '재사용 미적용', options: LEVEL_TEXT },
  { key: 'buff', label: '버프 지속시간', options: LEVEL_TEXT },
  { key: 'summon', label: '소환수로 딜', options: FLAG_TEXT },
  { key: 'finalAttack', label: '파이널 어택 스킬', options: FLAG_TEXT },
] as const
const GROUP_TONES = { boss: 'var(--loss)', core: 'var(--api)', hunt: 'var(--gain)', util: 'var(--calc)' }
const NORMAL_CHOICES = [ARTIFACT_NORMAL_MISSION_EXP, 1000, 0]
const MAX_BOOSTERS = ARTIFACT_BOOSTER_MAX_WEEKS / ARTIFACT_BOOSTER_WEEKS

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
const pickOf = (key: ArtifactEffectKey) => picks.value.find(p => p.effect.key === key)!
const effectOf = (key: ArtifactEffectKey) => ARTIFACT_EFFECTS.find(e => e.key === key)!
const toneOf = (key: ArtifactEffectKey) => GROUP_TONES[effectOf(key).group]

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

interface OptionRow { key: ArtifactEffectKey, from: ArtifactEffectKey | null }
// 지금 옵션 자리에 추천 옵션을 맞춰 놓는다. from이 있으면 그 옵션을 바꾸라는 뜻
function rowsOf(name: string, keys: ArtifactEffectKey[]): OptionRow[] {
  const plan = planNow.value[owned.value.findIndex(c => c.name === name)] ?? []
  const added = plan.filter(k => !keys.includes(k))
  const rows = keys.map(k => (plan.includes(k) ? { key: k, from: null } : { key: added.shift() ?? k, from: k }))
  return [...rows, ...added.map(k => ({ key: k, from: null }))]
}
const changes = computed(() => owned.value.reduce((n, c) => n + rowsOf(c.name, c.keys).filter(r => r.from && r.from !== r.key).length, 0))
const maxedNow = computed(() => picks.value.filter(p => p.level >= ARTIFACT_MAX_LEVEL).length)
const maxedPlan = computed(() => Object.values(planLevels.value).filter(l => l! >= ARTIFACT_MAX_LEVEL).length)

const effectRows = computed(() => {
  const all = order.value.map(pickOf)
  const unused = (p: ArtifactPick) => (p.effect.key === 'summon' && traits.value.summon !== 'yes') || (p.effect.key === 'finalAttack' && traits.value.finalAttack !== 'yes')
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
  const trait = p.effect.key === 'cooldown' ? traits.value.cooldown : p.effect.key === 'buff' ? traits.value.buff : null
  return { text: trait ? `중요도 ${LEVEL_TEXT[trait]}` : p.tag, muted: true }
}

const apTotal = computed(() => artifactAp(data.value?.level ?? 0))
const apUsed = computed(() => apTotal.value - (data.value?.remainAp ?? 0))
const expire = computed(() => {
  const dates = (data.value?.crystals ?? []).map(c => c.expire).filter((d): d is string => !!d).sort()
  return dates[0] ? Math.ceil((Date.parse(dates[0]) - Date.now()) / 86_400_000) : null
})
const crit = computed(() => stat('크리티컬 확률'))
const critNote = computed(() => {
  if (traits.value.critOver === 'yes') return ` · 리인포스 때 크뎀 +${(crit.value / 2).toFixed(1)}%`
  if (crit.value > 100) return ` · ${(crit.value - 100).toFixed(0)}%p 버려짐`
  if (crit.value < 100) return ` · 100까지 ${(100 - crit.value).toFixed(0)}%p`
  return ''
})

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
const dateAfter = (weeks: number | null) => (weeks === null ? '-' : formatDay(addDays(today.value, weeks * 7)))
const at = (weeks: number | null) => `${goal.value.plain ? Math.min((weeks ?? 0) / goal.value.plain, 1) * 100 : 0}%`
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
            <small>{{ changes ? `지금 ${maxedNow}개 · 바꿀 칸은 아래 금색` : nextCrystal ? `Lv ${nextCrystal.unlock} ${nextCrystal.name}엔 ${futureOf(nextCrystal).map(k => effectOf(k).short).join(' · ')}` : '모든 크리스탈이 열렸어요' }}</small>
          </div>
          <div v-else class="verdict">
            <b>{{ goal.plain === null ? 'Lv 60' : `Lv 60까지 ${goal.boosted}주` }}</b>
            <small>{{ dateAfter(goal.boosted) }}{{ boosters && goal.plain && goal.boosted ? ` · 부스터로 ${goal.plain - goal.boosted}주 단축` : '' }}</small>
          </div>
        </template>
        <span v-else-if="!failure" class="skeleton hero-skeleton" />
        <p v-else class="fail">{{ failure }}</p>
      </section>

      <div v-if="tab === 'mine'" class="mine">
        <ul class="board">
          <li v-for="c in board" :key="c.name" class="crystal" :class="{ locked: c.locked, next: c === nextCrystal, expired: c.owned && !c.owned.valid }">
            <div class="c-art">
              <img :src="ICONS[c.icon]" alt="">
              <span v-if="!c.owned" class="lock">Lv {{ c.unlock }}</span>
            </div>
            <div class="c-head">
              <span class="c-name">{{ c.name }}</span>
              <span v-if="c.owned" class="pips" :aria-label="`${c.owned.level}등급`"><i v-for="n in ARTIFACT_MAX_CRYSTAL_GRADE" :key="n" :class="{ on: n <= c.owned.level }" /></span>
            </div>
            <ul v-if="c.owned && ready" class="opts">
              <li v-for="(r, i) in rowsOf(c.name, c.keys)" :key="i" :class="{ change: r.from && r.from !== r.key }" :style="{ '--c': toneOf(r.key) }">
                <i class="dot" />
                <template v-if="r.from && r.from !== r.key"><s>{{ effectOf(r.from).short }}</s><span class="arrow">→</span></template>
                <span>{{ effectOf(r.key).name }}</span>
              </li>
            </ul>
            <ul v-else-if="ready && futureOf(c).length" class="opts" :class="{ later: c !== nextCrystal }">
              <li v-for="k in futureOf(c)" :key="k" class="change" :style="{ '--c': toneOf(k) }"><i class="dot" /><span>{{ effectOf(k).name }}</span></li>
            </ul>
            <p v-else class="c-empty">{{ c.locked ? '아직 안 열렸어요' : ready ? '비어 있어요' : '' }}</p>
          </li>
        </ul>

        <aside class="side">
          <section class="basis">
            <div class="basis-head">
              <b>{{ data?.character.job ?? '직업' }} 기준</b>
              <button v-if="data" type="button" class="link" @click="traitsOpen = true">직업 특성 고치기</button>
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

          <section class="effects">
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
      </div>

      <div v-else class="plan">
        <aside class="inputs">
          <section>
            <b class="t">한 주에 받는 EXP</b>
            <span class="label">일반 미션 <small class="muted">몬스터 2만 + 접속 4회 = 2,000</small></span>
            <div class="mini-seg wide">
              <button v-for="n in NORMAL_CHOICES" :key="n" type="button" :aria-pressed="normal === n" @click="normal = n">{{ n ? n.toLocaleString('ko-KR') : '안 함' }}</button>
            </div>
            <span class="label">보스 미션 <small class="muted">월드에서 가장 높은 3개</small></span>
            <div v-if="bossManual === null && bossAuto.counted.length" class="chips">
              <span v-for="id in bossAuto.counted" :key="id" class="chip">{{ findBoss(id)?.name ?? id }}</span>
            </div>
            <label class="num-in">
              <span class="muted">{{ bossManual !== null ? '직접 입력' : roster === null ? '보스 세팅 불러오는 중' : bossAuto.counted.length ? '보스 수입 세팅 기준' : '보스 수입 세팅이 없어요' }}</span>
              <input :value="boss || ''" type="number" inputmode="numeric" min="0" placeholder="0" @input="bossManual = Number(($event.target as HTMLInputElement).value) || 0">
            </label>
            <button v-if="bossManual !== null" type="button" class="link" @click="bossManual = null">보스 세팅 값으로 되돌리기</button>
            <div class="total"><span class="muted">합계</span><b>{{ (normal + boss).toLocaleString('ko-KR') }}</b><span class="muted">/ 주</span></div>
          </section>
          <section class="booster">
            <b class="t">아티팩트 부스터</b>
            <div class="stepper">
              <button type="button" aria-label="하나 빼기" :disabled="boosters <= 0" @click="boosters--">−</button>
              <b>{{ boosters }}<small>개</small></b>
              <button type="button" aria-label="하나 더하기" :disabled="boosters >= MAX_BOOSTERS" @click="boosters++">＋</button>
            </div>
            <small class="muted">일반 미션만 2배 · 개당 4주(소급) · 월드당 한 달 2개 · 9,900캐시 · 리부트 불가</small>
          </section>
        </aside>

        <section class="timeline">
          <div class="tl-head">
            <b>Lv 60까지 남은 EXP {{ leftExp.toLocaleString('ko-KR') }}</b>
            <span class="muted">주 {{ (normal + boss).toLocaleString('ko-KR') }} 기준</span>
          </div>
          <div v-for="track in [{ key: 'plain', label: '부스터 없이' }, { key: 'boosted', label: `부스터 ${boosters}개` }] as const" :key="track.key" class="track" :class="track.key">
            <span class="t-label">{{ track.label }}</span>
            <div class="line">
              <i class="tl-fill" :style="{ width: at(goal[track.key]) }" />
              <span v-for="m in milestones" :key="m.name" class="mark" :style="{ left: at(m[track.key]) }" :title="`${m.name} · ${dateAfter(m[track.key])}`"><img :src="ICONS[m.icon]" alt=""></span>
            </div>
            <span class="t-end"><b>{{ goal[track.key] === null ? '-' : `${goal[track.key]}주` }}</b><small>{{ dateAfter(goal[track.key]) }}</small></span>
          </div>
          <table v-if="milestones.length" class="miles">
            <thead><tr><th>크리스탈</th><th>레벨</th><th class="num">부스터 없이</th><th class="num">부스터 {{ boosters }}개</th><th class="num">당김</th></tr></thead>
            <tbody>
              <tr v-for="m in milestones" :key="m.name">
                <td><span class="mrow"><img :src="ICONS[m.icon]" alt="">{{ m.name }}</span></td>
                <td>Lv {{ m.unlock }}</td>
                <td class="num">{{ m.plain === null ? '-' : `${m.plain}주 · ${dateAfter(m.plain)}` }}</td>
                <td class="num gold">{{ m.boosted === null ? '-' : `${m.boosted}주 · ${dateAfter(m.boosted)}` }}</td>
                <td class="num">{{ m.plain !== null && m.boosted !== null && m.plain > m.boosted ? `${m.plain - m.boosted}주` : '-' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else-if="ready" class="muted">크리스탈이 다 열렸어요.</p>
          <p class="muted small">보스 미션 EXP가 적을수록(키우는 중일수록) 부스터 효과가 커요. 일반 미션을 다 못 채우면 2배도 줄어요.</p>
        </section>
      </div>

      <p class="foot muted">AP·크리스탈·부스터: 공식 업데이트 731 · 효과 값: 넥슨 API · 레벨별·미션 EXP와 직업 특성: 나무위키 · 퍼센트는 보스 데미지 기준 추정</p>
    </div>

    <AppModal v-model="traitsOpen" :title="`${data?.character.job ?? ''} 직업 특성`" :width="460">
      <div v-if="data" class="trait-edit">
        <p class="muted small">넥슨 API가 주지 않아 나무위키 직업 문서로 채운 값이에요. 다르면 고쳐 주세요. 이 직업 캐릭터 모두에 적용돼요.</p>
        <div v-for="f in TRAIT_FIELDS" :key="f.key" class="edit-row">
          <span>{{ f.label }}</span>
          <div class="mini-seg wide">
            <button v-for="(text, value) in f.options" :key="value" type="button" :aria-pressed="traits[f.key] === value" @click="saveTrait(f.key, value)">{{ text }}</button>
          </div>
        </div>
        <div class="edit-foot">
          <a v-if="baseTraits.source" :href="baseTraits.source" target="_blank" rel="noopener" class="link">출처 · {{ baseTraits.why }}</a>
          <button v-if="data.traits" type="button" class="link" @click="resetTraits">표 값으로 되돌리기</button>
        </div>
      </div>
    </AppModal>
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
.small {
  font-size: 12px;
}
.gold {
  color: var(--gold);
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

.hero {
  display: grid;
  grid-template-columns: auto minmax(160px, 240px) auto minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 92px;
  padding: 12px 16px;
  background: radial-gradient(480px 160px at 0 50%, rgb(127 178 255 / 0.18), transparent 70%), var(--panel);
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
  background: rgb(242 193 78 / 0.1);
  border: 1px solid var(--gold);
  border-radius: 10px;
  text-align: right;
}
.verdict.good {
  background: rgb(127 217 154 / 0.1);
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

.mine {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 12px;
  min-height: 0;
}
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.crystal {
  position: relative;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  column-gap: 0;
  row-gap: 4px;
  min-height: 0;
  padding: 8px 10px 8px 4px;
  overflow: hidden;
  background: radial-gradient(90px 90px at 44px 50%, rgb(140 120 255 / 0.35), transparent 70%), linear-gradient(160deg, rgb(106 79 216 / 0.3), rgb(43 35 112 / 0.2) 60%), var(--panel);
  border: 1px solid #6f66c4;
  border-radius: 14px;
}
.crystal.locked {
  background: var(--panel);
  border: 1px dashed var(--panel-line);
}
.crystal.next {
  border: 1px dashed var(--gold);
  background: radial-gradient(90px 90px at 44px 50%, rgb(242 193 78 / 0.18), transparent 70%), var(--panel);
}
.crystal.expired {
  opacity: 0.55;
}
/* 크리스탈 그림은 크게, 옵션 줄이 그림 오른쪽 끝에 살짝 걸친다 */
.c-art {
  position: relative;
  grid-row: 1 / -1;
  display: grid;
  place-items: center;
  align-self: center;
}
.c-art img {
  width: 116px;
  height: 116px;
  max-width: none;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgb(111 214 255 / 0.55));
}
.crystal.locked .c-art img {
  filter: grayscale(1) brightness(0.55);
}
.c-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: -10px;
}
.c-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font: 16px var(--f-title);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pips {
  display: flex;
  flex: none;
  gap: 3px;
}
.pips i {
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  background: rgb(255 255 255 / 0.2);
}
.pips i.on {
  background: #fff;
  box-shadow: 0 0 4px #fff;
}
.lock {
  position: absolute;
  top: 2px;
  left: 50%;
  translate: -50% 0;
  padding: 0 7px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 11px;
  white-space: nowrap;
}
.crystal.next .lock {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
  font-weight: 800;
}
.opts {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  gap: 4px;
  margin: 0 0 0 -18px;
  padding: 0;
  list-style: none;
}
.opts li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 10px;
  background: rgb(14 17 28 / 0.86);
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 999px;
  font-size: 12.5px;
  white-space: nowrap;
}
.opts li.change {
  background: rgb(242 193 78 / 0.1);
  border: 1px dashed var(--gold);
}
.dot {
  flex: none;
  width: 7px;
  height: 7px;
  background: var(--c);
  border-radius: 2px;
}
.opts s {
  color: var(--sub);
}
.arrow {
  color: var(--gold);
}
.opts li.change span:last-child {
  color: var(--gold);
  font-weight: 700;
}
.opts.later {
  opacity: 0.55;
}
.c-empty {
  align-self: center;
  margin: 0;
  padding-left: 6px;
  color: var(--sub);
  font-size: 12px;
}

.side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
}
.side > section,
.inputs > section,
.timeline {
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
.mini-seg.wide {
  display: flex;
}
.mini-seg.wide button {
  flex: 1;
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
  background: rgb(242 193 78 / 0.35);
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

.plan {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}
.inputs {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
}
.t {
  font: 16px var(--f-title);
}
.label {
  font-size: 12.5px;
}
.num-in {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
}
.num-in input {
  width: 96px;
  min-height: 32px;
  padding: 0 8px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  text-align: right;
}
.total {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--panel-line);
  font-size: 13px;
}
.total b {
  color: var(--api);
  font: 24px var(--f-title);
}
.booster {
  background: linear-gradient(135deg, rgb(183 156 255 / 0.15), transparent 70%), var(--panel) !important;
  border-color: var(--calc) !important;
}
.stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.stepper button {
  width: 36px;
  height: 36px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
}
.stepper button:disabled {
  opacity: 0.4;
  cursor: default;
}
.stepper b {
  min-width: 64px;
  color: var(--calc);
  font: 30px var(--f-title);
  text-align: center;
}
.stepper small {
  font-size: 14px;
}
.timeline {
  align-content: start;
  gap: 14px !important;
  min-height: 0;
  overflow-y: auto;
}
.tl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
}
.tl-head b {
  font: 17px var(--f-title);
}
.track {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 120px;
  align-items: center;
  gap: 14px;
}
.t-label {
  color: var(--sub);
  font-size: 13px;
}
.line {
  position: relative;
  height: 34px;
}
.line::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 6px;
  transform: translateY(-50%);
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}
.tl-fill {
  position: absolute;
  top: 50%;
  left: 0;
  height: 6px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: var(--tip-line);
  transition: width var(--normal) var(--ease-out);
}
.track.boosted .tl-fill {
  background: var(--calc);
}
.mark {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  transition: left var(--normal) var(--ease-out);
}
.mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.t-end {
  display: grid;
  text-align: right;
  line-height: 1.2;
}
.t-end b {
  font: 18px var(--f-title);
}
.track.boosted .t-end b {
  color: var(--calc);
}
.t-end small {
  color: var(--sub);
  font-size: 12px;
}
.miles {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.miles th,
.miles td {
  padding: 7px 8px;
  border-bottom: 1px solid var(--panel-line);
  text-align: left;
}
.miles th {
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
}
.miles .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mrow img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.trait-edit {
  display: grid;
  gap: 10px;
}
.edit-row {
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.edit-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
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
  .board {
    gap: 6px;
  }
  .crystal {
    row-gap: 2px;
    padding: 4px 8px 4px 2px;
  }
  .c-art img {
    width: 92px;
    height: 92px;
  }
  .c-name {
    font-size: 14px;
  }
  .opts {
    gap: 2px;
  }
  .opts li {
    padding: 1px 9px;
    font-size: 12px;
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
  .mine,
  .plan {
    grid-template-columns: minmax(0, 1fr);
  }
  .board {
    grid-auto-rows: auto;
  }
  .effects,
  .inputs,
  .timeline {
    overflow: visible;
  }
}
@media (max-width: 640px) {
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .facts div {
    padding: 0 8px;
  }
  .track {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .t-end {
    text-align: left;
  }
}
</style>
