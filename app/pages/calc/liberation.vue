<script setup lang="ts">
import type { BossBoardResponse, CharacterDetail } from '#shared/types'
import { DIFFICULTY_LABELS, MAX_PARTY, bossPeriod, findBoss, type BossDifficulty } from '#shared/data/bosses'
import { DESTINY_SECOND_STEP, LIBERATIONS, isGenesisWeapon, traceOf, type LiberationKind } from '#shared/data/liberation'
import { planLiberation, type TraceBoss } from '#shared/calc/liberation'

useHead({ title: '해방 · 메이플스토리로그' })

const { me } = await useMe()
const today = kstToday()

// 캐릭터를 고르면 해방 단계에 맞는 종류로 바꿔 준다
const kind = ref<LiberationKind>('genesis')
const info = computed(() => LIBERATIONS[kind.value])
const total = computed(() => info.value.steps.reduce((n, s) => n + s.need, 0))

// 로그인 안 했으면 보스 세팅 없이 직접 고른다
const board = ref<BossBoardResponse | null>(null)
const ocid = ref<string | null>(null)
// 저장값·보스 세팅·해방 단계를 다 불러오기 전엔 스켈레톤으로 막아 값이 바뀌며 화면이 흔들리지 않게 한다
const ready = ref(false)
onMounted(async () => {
  if (me.value) {
    board.value = await $fetch<BossBoardResponse>('/api/ledger/bosses').catch(() => null)
    ocid.value = board.value?.roster[0]?.ocid ?? null
  }
  if (!character.value) {
    load(storeKey.value)
    ready.value = true
  }
})
const character = computed(() => board.value?.roster.find(c => c.ocid === ocid.value) ?? null)

// 넥슨 해방 완료 단계(0 미완료·1 제네시스·2 데스티니 1차·그 위 2차). 이 값이 없던 옛 캐릭터 정보는 무기 이름으로 판단한다
const cleared = ref<number | null>(null)
const checking = ref(false)
watch(character, async (c) => {
  cleared.value = null
  if (!c) return
  checking.value = true
  const detail = await $fetch<CharacterDetail>(`/api/character/${encodeURIComponent(c.name)}`).catch(() => null)
  if (c !== character.value) return
  const weapon = detail?.presets[detail.presetNo - 1]?.find(i => i.slot === '무기')
  cleared.value = !detail ? null : detail.liberation ?? (isGenesisWeapon(weapon?.name) ? 1 : 0)
  kind.value = (cleared.value ?? 0) >= LIBERATIONS.genesis.doneAt ? 'destiny' : 'genesis'
  load(storeKey.value)
  checking.value = false
  ready.value = true
})

// 데스티니 1차를 마쳤으면 2차 첫 단계부터
const minStep = computed(() => (kind.value === 'destiny' && (cleared.value ?? 0) >= 2 ? DESTINY_SECOND_STEP : 0))
const finished = computed(() => cleared.value !== null && cleared.value >= info.value.doneAt)
// 이 캐릭터가 할 수 없는 계산이면 입력을 잠그고 띄울 안내
const lock = computed(() => {
  if (finished.value) return { title: `${info.value.name}을 마친 캐릭터예요`, sub: kind.value === 'genesis' ? '데스티니 초월로 바꿔서 계산해 보세요' : '다른 캐릭터를 고르면 계산할 수 있어요' }
  if (kind.value === 'destiny' && cleared.value !== null && cleared.value < LIBERATIONS.genesis.doneAt) return { title: '제네시스 해방부터 마쳐야 해요', sub: '제네시스 해방으로 바꿔서 계산해 보세요' }
  return null
})

const inputs = ref<HTMLFormElement>()
// 잠기면 볼 입력이 없으니 맨 위로 올려 둔다
watch(() => !!lock.value, (locked) => {
  if (locked) inputs.value?.scrollTo({ top: 0 })
})

// 내가 고친 값은 캐릭터·해방 종류마다 이 브라우저에 남긴다. 고친 적 없으면 보스 세팅에서 채운다
interface Saved { step: number, collected: number, bosses: Omit<TraceBoss, 'cleared'>[], pass?: boolean, passUntil?: string }
const step = ref(0)
const collected = ref(0)
const bosses = ref<Omit<TraceBoss, 'cleared'>[]>([])
// passUntil을 비우면 끝까지 적용
const pass = ref(false)
const passUntil = ref('')
// 제네시스는 예전 키를 그대로 써서 전에 적어 둔 값을 잃지 않는다
const storeKey = computed(() => `${kind.value === 'genesis' ? 'liberation' : 'liberation-destiny'}:${ocid.value ?? 'guest'}`)
function fromRoster(): Omit<TraceBoss, 'cleared'>[] {
  return (character.value?.bosses ?? []).filter(b => info.value.traces[b.bossId]?.[b.difficulty as BossDifficulty]).map(b => ({ bossId: b.bossId, difficulty: b.difficulty, party: b.party }))
}
function load(key: string) {
  let saved: Saved | null = null
  try {
    saved = JSON.parse(localStorage.getItem(key) ?? 'null')
  }
  catch {}
  step.value = Math.min(info.value.steps.length - 1, Math.max(minStep.value, saved?.step ?? 0))
  collected.value = saved?.collected ?? 0
  bosses.value = saved?.bosses ?? fromRoster()
  pass.value = saved?.pass ?? false
  passUntil.value = saved?.passUntil ?? ''
}
watch(storeKey, (key) => {
  if (ready.value && !checking.value) load(key)
})
watch([step, collected, bosses, pass, passUntil], () => {
  if (!ready.value || checking.value) return
  try {
    localStorage.setItem(storeKey.value, JSON.stringify({ step: step.value, collected: collected.value, bosses: bosses.value, pass: pass.value, passUntil: passUntil.value } satisfies Saved))
  }
  catch {}
}, { deep: true })
function resetToRoster() {
  bosses.value = fromRoster()
}
function setCollected(value: number) {
  collected.value = Math.min(info.value.cap, Math.max(0, Math.round(value) || 0))
}

// 이번 주(월간은 이번 달) 가계부에 잡았다고 체크한 보스
const clearedNow = (bossId: string) => {
  const boss = findBoss(bossId)
  const period = bossPeriod(boss?.cycle ?? 'weekly', today)
  return !!board.value?.clears.some(c => c.ocid === ocid.value && c.bossId === bossId && c.period === period)
}
const traceBosses = computed<TraceBoss[]>(() => bosses.value.map(b => ({ ...b, cleared: clearedNow(b.bossId) })))
const usePass = computed(() => kind.value === 'genesis' && pass.value)
const plan = computed(() => planLiberation(kind.value, step.value, collected.value, traceBosses.value, today, { on: usePass.value, until: passUntil.value || null }))
// 보스 줄에 보이는 양은 이번 주 기준이라 패스 기간이 끝났으면 1배로 보여준다
const passNow = computed(() => usePass.value && (!passUntil.value || passUntil.value >= today))

const stepNeed = computed(() => info.value.steps[step.value]?.need ?? 0)
const overallPercent = computed(() => (finished.value ? 100 : Math.round(((total.value - plan.value.left) / total.value) * 100)))
const timeline = computed(() => info.value.steps.map((s, i) => ({
  ...s,
  state: finished.value || i < step.value ? 'done' : i === step.value ? 'now' : 'next',
  week: i >= step.value ? plan.value.steps[i - step.value]?.week ?? null : null,
})))

const addable = computed(() => Object.keys(info.value.traces).filter(id => !bosses.value.some(b => b.bossId === id)))
const adding = ref('')
watch(adding, (id) => {
  if (!id) return
  bosses.value.push({ bossId: id, difficulty: Object.keys(info.value.traces[id]!).at(-1)!, party: 1 })
  adding.value = ''
})
const difficulties = (bossId: string) => Object.keys(info.value.traces[bossId] ?? {}) as BossDifficulty[]
const difficultyOptions = (bossId: string) => difficulties(bossId).map(d => ({ value: d as string, label: DIFFICULTY_LABELS[d] }))
const PARTY_OPTIONS = Array.from({ length: MAX_PARTY }, (_, i) => ({ value: i + 1, label: `${i + 1}인` }))
const addOptions = computed(() => addable.value.map(id => ({ value: id, label: findBoss(id)?.name ?? id })))
const rosterOptions = computed(() => (board.value?.roster ?? []).map(c => ({ value: c.ocid, label: c.name, sub: `${c.job} · LV.${c.level}` })))
const anyCleared = computed(() => bosses.value.some(b => clearedNow(b.bossId)))
const anyWiki = computed(() => bosses.value.some(b => info.value.wikiBosses?.includes(b.bossId)))
const format = (n: number) => n.toLocaleString('ko-KR')

const weeksUntil = (week: string) => Math.round((Date.parse(week) - Date.parse(bossPeriod('weekly', today))) / (7 * 24 * 60 * 60 * 1000))
const weekLabel = (week: string) => {
  const n = weeksUntil(week)
  return n <= 0 ? '이번 주' : `${n}주 뒤`
}
</script>

<template>
  <GameWindow class="fit" title="해방" :sub="`${info.name} · ${info.currency}`" accent="purple" fill>
    <div class="calc-layout">
      <form v-if="ready" ref="inputs" class="calc-inputs" @submit.prevent novalidate>
        <section class="calc-section">
          <h3 class="calc-section-title">캐릭터</h3>
          <div v-if="board?.roster.length" class="calc-load">
            <label for="load-roster" class="calc-load-label">가계부 보스 세팅에서 불러오기</label>
            <AppSelect id="load-roster" :model-value="ocid ?? ''" :options="rosterOptions" @update:model-value="v => (ocid = v)" />
          </div>
          <p v-else class="calc-hint">{{ me ? '가계부에 보스 세팅을 해 두면 자동으로 채워져요. 아래에서 직접 골라도 돼요.' : '로그인하면 가계부 보스 세팅으로 자동으로 채워져요.' }}</p>
          <div class="calc-seg wide" role="group" aria-label="해방 종류">
            <button v-for="(l, k) in LIBERATIONS" :key="k" type="button" :aria-pressed="kind === k" @click="kind = k">{{ l.name }}</button>
          </div>
        </section>

        <!-- 할 수 없는 계산이면 캐릭터 고르기만 두고 잠근다. 안내는 겹쳐 띄워 자리가 바뀌지 않게 한다 -->
        <div class="lockable" :class="{ locked: lock }">
          <div class="lock-body" :inert="!!lock">
            <section class="calc-section">
              <h3 class="calc-section-title">진행 상황<small>퀘스트 창 기준</small></h3>
              <div class="calc-field">
                <span class="calc-label">지금 하는 단계</span>
                <div class="calc-chips grid steps" :style="{ '--cols': kind === 'genesis' ? 4 : 3 }">
                  <button v-for="(s, i) in info.steps" :key="s.boss" type="button" class="calc-chip" :class="{ past: i < step }" :aria-pressed="step === i" :disabled="i < minStep" :title="`${s.tier ? `${s.tier} · ` : ''}${s.boss} ${format(s.need)}`" @click="step = i">
                    <small>{{ s.tier ?? i + 1 }}</small>{{ s.boss }}
                  </button>
                </div>
              </div>
              <div class="calc-field">
                <span class="calc-label">이 단계에서 모은 {{ info.currency }}</span>
                <div class="calc-stepper">
                  <button type="button" aria-label="10 줄이기" :disabled="collected <= 0" @click="setCollected(collected - 10)">−</button>
                  <input :value="collected" type="number" min="0" :max="info.cap" :aria-label="`모은 ${info.currency}`" @change="setCollected(Number(($event.target as HTMLInputElement).value))">
                  <button type="button" aria-label="10 늘리기" :disabled="collected >= info.cap" @click="setCollected(collected + 10)">+</button>
                </div>
                <div class="meter" aria-hidden="true"><i :style="{ width: `${Math.min(100, (collected / stepNeed) * 100)}%` }" /></div>
                <span class="meter-text">
                  <b>{{ format(collected) }}</b> / {{ format(stepNeed) }}
                  <span>{{ collected > stepNeed ? `남는 ${format(collected - stepNeed)}은 다음 단계로` : `최대 ${format(info.cap)}까지 쌓여요` }}</span>
                </span>
              </div>
            </section>

            <!-- 데스티니 초월엔 패스가 없지만 구역은 남겨 둬서 종류를 바꿔도 아래가 들썩이지 않게 한다 -->
            <section class="calc-section pass-section" :class="{ off: kind !== 'genesis' }" :inert="kind !== 'genesis'">
              <h3 class="calc-section-title">제네시스 패스<small>{{ kind === 'genesis' ? '흔적 3배' : '제네시스 해방에만 있어요' }}</small></h3>
              <div class="calc-seg wide" role="group" aria-label="제네시스 패스">
                <button type="button" :aria-pressed="!usePass" @click="pass = false">없음</button>
                <button type="button" :aria-pressed="usePass" @click="pass = true">있음</button>
              </div>
              <!-- 패스가 없어도 자리를 잡아 둬서 눌러도 아래 칸이 밀리지 않게 한다 -->
              <div class="calc-field pass-until" :class="{ off: !usePass }" :inert="!usePass">
                <span class="calc-label">효과 끝나는 날 · 비워 두면 끝까지 3배</span>
                <div class="date-box">
                  <DatePicker v-model="passUntil" :min="today" placeholder="끝까지 적용" />
                </div>
              </div>
            </section>

            <section class="calc-section">
              <h3 class="calc-section-title">
                {{ info.currency }}을 주는 보스
                <button v-if="character" type="button" class="link" @click="resetToRoster">보스 세팅대로</button>
              </h3>
              <ul class="bosses">
                <li v-for="(b, i) in bosses" :key="b.bossId" :class="{ cleared: clearedNow(b.bossId) }">
                  <span class="tick" aria-hidden="true">✓</span>
                  <span class="boss-name">{{ findBoss(b.bossId)?.name }}<small v-if="findBoss(b.bossId)?.cycle === 'monthly'">월간</small><small v-if="info.wikiBosses?.includes(b.bossId)" class="wiki">위키</small><span v-if="clearedNow(b.bossId)" class="sr-only"> · 이번 주기에 잡음</span></span>
                  <AppSelect v-model="b.difficulty" class="mini" :options="difficultyOptions(b.bossId)" :label="`${findBoss(b.bossId)?.name} 난이도`" />
                  <AppSelect v-model="b.party" class="mini" :options="PARTY_OPTIONS" :label="`${findBoss(b.bossId)?.name} 파티 인원`" />
                  <b class="trace" :class="{ boosted: passNow }">{{ format(traceOf(kind, b.bossId, b.difficulty, b.party, passNow)) }}</b>
                  <button type="button" class="remove" :aria-label="`${findBoss(b.bossId)?.name} 빼기`" @click="bosses.splice(i, 1)">×</button>
                </li>
                <li v-if="!bosses.length" class="none">아래에서 {{ info.currency }}을 주는 보스를 더해 주세요.</li>
              </ul>
              <p v-if="anyCleared || anyWiki" class="calc-hint">
                <template v-if="anyCleared"><b class="tick-note">✓</b> 가계부에 이번 주기에 잡았다고 체크한 보스예요. 그 {{ info.currency }}은 모은 양에 들어 있다고 봐요.</template>
                <template v-if="anyWiki"> '위키'는 공식 공지에 획득량이 없어 위키 기준인 보스예요.</template>
              </p>
              <AppSelect v-if="addable.length" v-model="adding" :options="addOptions" placeholder="+ 보스 더하기" label="보스 더하기" />
            </section>
          </div>
          <p v-if="lock" class="lock-note"><b>{{ lock.title }}</b><span>{{ lock.sub }}</span></p>
        </div>
      </form>
      <div v-else class="calc-inputs skeleton input-skeleton" />

      <section class="calc-result" aria-live="polite">
        <template v-if="ready && !checking">
          <p class="calc-goal"><b>{{ character?.name ?? info.name }}</b> · {{ info.steps[0]!.boss }}부터 {{ info.steps.at(-1)!.boss }}까지 {{ info.steps.length }}단계</p>

          <p v-if="finished" class="calc-say">
            <em>{{ info.name }}</em>을 마쳤어요.<br>
            <span class="s2">넥슨 공식 기록에 완료로 나와 있어요.</span>
          </p>
          <p v-else-if="lock" class="calc-say">
            아직 <em>{{ info.name }}</em>을 할 수 없어요.<br>
            <span class="s2">{{ lock.title }}.</span>
          </p>
          <p v-else-if="plan.finish" class="calc-say">
            <em>{{ formatDay(plan.finish) }}</em> 주에 {{ kind === 'genesis' ? '해방해요' : '초월해요' }}.<br>
            <span class="s2">지금 세팅대로면 <em>{{ weekLabel(plan.finish) }}</em> {{ kind === 'genesis' ? '해방' : '초월' }}이에요{{ passNow ? ' · 패스 3배 적용' : '' }}.</span>
          </p>
          <p v-else class="calc-say">
            아직 <em>날짜를 못 잡았어요</em>.<br>
            <span class="s2">{{ plan.weekly || plan.monthly ? '3년 안에는 끝나지 않아요. 보스를 더해 보세요.' : `${info.currency}을 주는 보스를 골라 주세요.` }}</span>
          </p>

          <div class="calc-nums">
            <div class="calc-num"><small>남은 {{ info.currency }}</small><b>{{ finished ? 0 : format(plan.left) }}</b></div>
            <div class="calc-num"><small>매주 모이는 양</small><b>{{ format(plan.weekly) }}</b></div>
            <div class="calc-num"><small>매달 더 모이는 양</small><b>{{ plan.monthly ? format(plan.monthly) : '-' }}</b></div>
          </div>

          <div class="overall">
            <span class="calc-caption">전체 {{ format(total) }} 중 <b>{{ overallPercent }}%</b></span>
            <div class="meter big" aria-hidden="true"><i :style="{ width: `${overallPercent}%` }" /></div>
          </div>

          <ol class="timeline">
            <li v-for="s in timeline" :key="s.boss" :class="s.state">
              <span class="node" aria-hidden="true" />
              <span class="what"><b>{{ s.boss }}</b><small>{{ s.tier ? `${s.tier} · ` : '' }}{{ format(s.need) }}</small></span>
              <span class="when">{{ s.state === 'done' ? '완료' : lock ? '-' : s.week ? `${formatDay(s.week)} 주 · ${weekLabel(s.week)}` : '-' }}</span>
            </li>
          </ol>
        </template>
        <div v-else class="skeleton result-skeleton" />

        <div class="calc-src">
          <SourceBadge type="api" /><span>단계별 필요량·보스별 획득량·해방 완료는 넥슨 공식 기준</span>
          <SourceBadge type="calc" /><span>주간 보스는 매주, 월간 보스는 매달 첫 주에 잡는다고 보고 계산</span>
        </div>
      </section>
    </div>
  </GameWindow>
</template>

<style scoped>
.input-skeleton {
  height: 560px;
}
.result-skeleton {
  height: 420px;
}
.steps .calc-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.steps .calc-chip small {
  color: var(--sub);
  font-size: 10.5px;
}
.steps .calc-chip.past {
  color: var(--gain);
  border-color: color-mix(in srgb, var(--gain) 30%, transparent);
}
.steps .calc-chip[aria-pressed="true"] small {
  color: inherit;
}
.meter {
  height: 6px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.05);
  border-radius: 999px;
}
.meter i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--calc), var(--gold));
  border-radius: inherit;
  transition: width var(--fast) ease;
}
.meter.big {
  height: 8px;
}
.meter-text {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.meter-text b {
  color: var(--gold);
}
.meter-text span {
  margin-left: auto;
}
.pass-until,
.pass-section {
  transition: opacity var(--fast) ease;
}
.pass-until.off,
.pass-section.off {
  opacity: 0.35;
}
.pass-section.off .pass-until.off {
  opacity: 1;
}
.tick-note {
  color: var(--gain);
}
.lockable {
  position: relative;
}
.lock-body {
  display: grid;
  transition: opacity var(--fast) ease;
}
/* 잠기면 아래 입력은 볼 필요가 없어 짧게 접고 흐리게 끝을 지워 스크롤이 생기지 않게 한다 */
.lockable.locked .lock-body {
  max-height: 260px;
  overflow: hidden;
  opacity: 0.25;
  filter: grayscale(0.6);
  mask-image: linear-gradient(180deg, #000 40%, transparent);
}
.lock-note {
  position: absolute;
  top: 90px;
  left: 50%;
  display: grid;
  gap: 4px;
  width: max-content;
  margin: 0;
  padding: 14px 20px;
  translate: -50% 0;
  background: rgb(10 12 22 / 0.92);
  border: 1px solid color-mix(in srgb, var(--gain) 45%, transparent);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.45);
  text-align: center;
}
.lock-note b {
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.lock-note span {
  color: var(--sub);
  font-size: 12.5px;
}
.date-box {
  display: flex;
  align-items: stretch;
  min-height: 36px;
  background: #141a30;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.link {
  margin-left: auto;
  padding: 0;
  background: none;
  border: 0;
  color: var(--calc);
  font: inherit;
  font-family: var(--f-body);
  font-size: 12px;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.bosses {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 모든 줄이 같은 칸 너비를 써서 숫자·버튼이 세로로 줄 맞춰 선다 */
.bosses li {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) 78px 54px 42px 24px;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 8px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  font-size: 13px;
}
.bosses li.cleared {
  background: color-mix(in srgb, var(--gain) 5%, transparent);
  border-color: color-mix(in srgb, var(--gain) 40%, transparent);
}
.tick {
  visibility: hidden;
  color: var(--gain);
  font-size: 12px;
  font-weight: 700;
}
.cleared .tick {
  visibility: visible;
}
.boss-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.boss-name small.wiki {
  color: var(--sub);
}
.boss-name small {
  margin-left: 4px;
  color: var(--calc);
  font-size: 11px;
}
.mini :deep(.trigger) {
  min-height: 30px;
  padding: 0 6px;
  font-size: 12px;
}
.mini :deep(.list li) {
  min-height: 32px;
  padding: 2px 6px;
  font-size: 12.5px;
}
.trace {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
  text-align: right;
}
.trace.boosted {
  color: var(--gold);
}
.remove {
  height: 30px;
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.remove:hover {
  color: var(--loss);
}
.bosses .none {
  display: block;
  padding: 12px;
  color: var(--sub);
  font-size: 12.5px;
  text-align: center;
}
.overall {
  display: grid;
  gap: 6px;
}
.overall b {
  color: var(--gold);
}
.timeline {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.timeline li {
  position: relative;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
}
.timeline li::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 9px;
  width: 2px;
  background: var(--panel-line);
}
.timeline li.done::before {
  background: color-mix(in srgb, var(--gain) 40%, transparent);
}
.timeline li:first-child::before {
  top: 50%;
}
.timeline li:last-child::before {
  bottom: 50%;
}
.node {
  position: relative;
  width: 12px;
  height: 12px;
  margin-left: 4px;
  background: var(--panel);
  border: 2px solid var(--calc);
  border-radius: 50%;
}
.done .node {
  background: var(--gain);
  border-color: var(--gain);
}
.now .node {
  background: var(--calc);
  box-shadow: 0 0 8px var(--calc);
}
.what b {
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.done .what b {
  color: var(--sub);
}
.what small {
  margin-left: 6px;
  color: var(--sub);
  font-size: 12px;
}
.when {
  color: var(--sub);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.done .when {
  color: var(--gain);
}
.timeline li.next:last-child .when,
.timeline li.now:last-child .when {
  color: var(--gold);
  font-weight: 700;
}
/* 휴대폰: 보스 이름이 잘리지 않게 이름 줄과 난이도·인원 줄로 나누고, 단계 칩은 두 칸씩 */
@media (max-width: 480px) {
  .calc-chips.grid.steps {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bosses li {
    grid-template-columns: 14px minmax(0, 1fr) minmax(0, 1fr) 42px 30px;
    grid-template-areas:
      'tick name name trace remove'
      '. diff party . .';
    row-gap: 4px;
    padding: 6px 8px;
  }
  .bosses .tick { grid-area: tick; }
  .bosses .boss-name { grid-area: name; }
  .bosses .mini:nth-of-type(1) { grid-area: diff; }
  .bosses .mini:nth-of-type(2) { grid-area: party; }
  .bosses .trace { grid-area: trace; }
  .bosses .remove { grid-area: remove; }
}
</style>
