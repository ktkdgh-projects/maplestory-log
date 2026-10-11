<script setup lang="ts">
import { MEISTER_MATERIALS, MEISTER_POTION_DAILY_LIMIT, MEISTER_POTION_FATIGUE, MEISTER_STAGES, type MeisterMaterialKey } from '#shared/data/meister'
import { MEISTER_START, dailyFatigue, normalizeMeister, planMeisterDays, remainingCrafts, remainingMaterials, stageTotal, todayCrafts, type MeisterDay, type MeisterProgress } from '#shared/calc/meister'

useHead({ title: '명장 · 메이플스토리로그' })

const ICONS = assetsByName(import.meta.glob<string>('~/assets/meister/*.png', { eager: true, import: 'default' }))
const STORE_KEY = 'meister'
const SAVE_DELAY_MS = 600
const TONES = ['var(--exp)', 'var(--api)', 'var(--purple)']

const { me } = await useMe()
const progress = ref<MeisterProgress>({ ...MEISTER_START })
const ready = ref(false)

onMounted(async () => {
  let saved: Partial<MeisterProgress> | null = null
  if (me.value) saved = await $fetch<MeisterProgress>('/api/guides/meister').catch(() => null)
  else {
    try {
      saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null')
    }
    catch {}
  }
  progress.value = normalizeMeister(saved)
  ready.value = true
})

let timer: ReturnType<typeof setTimeout> | undefined
function save() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (me.value) $fetch('/api/guides/meister', { method: 'PUT', body: progress.value }).catch(() => {})
    else {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(progress.value))
      }
      catch {}
    }
  }, SAVE_DELAY_MS)
}
watch(progress, () => ready.value && save(), { deep: true })
onBeforeUnmount(() => clearTimeout(timer))

const done = computed(() => progress.value.stage >= MEISTER_STAGES.length)
const days = computed(() => planMeisterDays(progress.value))
const leftCrafts = computed(() => remainingCrafts(progress.value).reduce((n, c) => n + c.left, 0))
const leftFatigue = computed(() => days.value.reduce((n, d) => n + d.fatigue, 0))
const need = computed(() => remainingMaterials(progress.value))
const cap = computed(() => dailyFatigue(progress.value))
// 오늘 할 일은 많아야 단계 수만큼이라 그만큼 자리를 잡아 둬서 단계를 바꿔도 칸이 움직이지 않는다
const TODAY_ROWS = 3

const GOALS = ['Lv 10', '장인', '명장']
// 그날 마치는 단계 중 가장 높은 등급
function dayGoal(i: number) {
  const parts = days.value[i]!.parts
  const next = days.value[i + 1]?.parts[0]?.stage
  const finished = parts.filter((p, j) => j < parts.length - 1 || p.stage !== next).map(p => p.stage)
  return finished.length ? GOALS[Math.max(...finished)] : ''
}
const dayTitle = (d: MeisterDay) => d.parts.map(p => `${MEISTER_STAGES[p.stage]!.short} ${p.count}회`).join(' · ')
const stageLeft = (s: number) => remainingCrafts(progress.value).filter(c => c.stage === s).reduce((n, c) => n + c.left, 0)
const stageRate = (s: number) => 1 - stageLeft(s) / stageTotal(MEISTER_STAGES[s]!)
// 재료 10종을 늘 같은 자리에 두고 더 안 드는 재료는 다 쓴 것으로 체크한다
const items = computed(() => MEISTER_MATERIALS.map(m => ({ ...m, count: need.value.get(m.key) ?? 0 })))
const STAGE_LABELS = ['1~10', '장인', '명장', '달성']
const today = computed(() => todayCrafts(progress.value))
const materialOf = (key: MeisterMaterialKey) => MEISTER_MATERIALS.find(m => m.key === key)!

function pickStage(s: number) {
  progress.value = { ...progress.value, stage: s, made: 0 }
}
function setMade(value: number) {
  const max = MEISTER_STAGES[progress.value.stage] ? stageTotal(MEISTER_STAGES[progress.value.stage]!) : 0
  progress.value = { ...progress.value, made: Math.min(Math.max(Math.trunc(value) || 0, 0), max) }
}
function addPotion(step: number) {
  const potions = Math.min(Math.max(progress.value.potions + step, 0), MEISTER_POTION_DAILY_LIMIT)
  progress.value = { ...progress.value, potions }
}
function toggleHave(key: MeisterMaterialKey) {
  const have = progress.value.have.includes(key) ? progress.value.have.filter(k => k !== key) : [...progress.value.have, key]
  progress.value = { ...progress.value, have }
}
</script>

<template>
  <GameWindow class="fit" title="명장" sub="마이스터빌 장비제작 · Lv 100" fill>
    <div class="meister">
      <section class="hero">
        <img :src="ICONS['npc-eisen']" alt="" class="npc">
        <div class="big">
          <span v-if="!ready" class="skeleton hero-skeleton" />
          <template v-else-if="done">
            <span class="muted">장비제작</span>
            <b class="d">명장 달성</b>
          </template>
          <template v-else>
            <span class="muted">명장까지</span>
            <b class="d">{{ days.length }}일 <small>· 하루 피로도 {{ cap.toLocaleString('ko-KR') }} 기준</small></b>
          </template>
        </div>
        <div class="tips">
          <span class="reward">다 찍으면 크리티컬 데미지 +5% 버프</span>
          <p title="손재주로 숙련도가 두 배로 들어오면 적힌 개수보다 빨리 올라요">개수는 손재주 없이 센 최대치 · <b>목표 레벨에 닿으면</b> 다음 아이템으로</p>
        </div>
        <dl class="facts">
          <div><dt>하루 피로도</dt><dd>{{ cap }}</dd></div>
          <div><dt>남은 제작</dt><dd>{{ ready ? `${leftCrafts}회` : '-' }}</dd></div>
          <div><dt>남은 피로도</dt><dd>{{ ready ? leftFatigue.toLocaleString('ko-KR') : '-' }}</dd></div>
        </dl>
      </section>

      <div class="main">
        <ol class="stages">
          <li v-for="(stage, s) in MEISTER_STAGES" :key="stage.key" class="stage" :class="{ now: ready && progress.stage === s, past: ready && progress.stage > s }" :style="{ '--tone': TONES[s] }">
            <div class="s-top">
              <span class="ic"><img :src="ICONS[stage.crafts.at(-1)!.icon]" alt=""></span>
              <div class="s-title">
                <span class="lvl">{{ s + 1 }}단계 · {{ stage.range }}</span>
                <b>{{ stage.title }}</b>
              </div>
              <span v-if="ready && progress.stage > s" class="cnt done">완료</span>
              <span v-else class="cnt">{{ ready ? stageLeft(s) : stageTotal(stage) }}<small>/{{ stageTotal(stage) }}회</small></span>
            </div>
            <ul class="crafts">
              <li v-for="c in stage.crafts" :key="c.name">
                <img :src="ICONS[c.icon]" alt="">
                <span class="ellipsis">{{ c.name }}</span>
                <span class="until">~{{ c.until }}</span>
                <span class="mats">
                  <span v-for="m in c.materials" :key="m.key" class="mat"><img :src="ICONS[materialOf(m.key).icon]" :alt="materialOf(m.key).name">{{ m.each }}</span>
                </span>
                <b>×{{ c.count }}</b>
              </li>
            </ul>
            <div class="s-foot">
              <div class="s-bar"><i :style="{ width: `${ready ? stageRate(s) * 100 : 0}%` }" /></div>
              <span class="meta">피로도 {{ stage.fatigue }}씩(추정) · {{ stage.note }}</span>
            </div>
          </li>
        </ol>

        <div class="side">
          <section class="panel">
            <div class="p-head">
              <h3 :title="me ? '계정에 저장돼요' : '이 브라우저에 저장돼요'">내 진행도</h3>
              <div class="seg" role="group" aria-label="지금 등급">
                <button v-for="(label, s) in STAGE_LABELS" :key="label" type="button" :aria-pressed="progress.stage === s" :disabled="!ready" @click="pickStage(s)">{{ label }}</button>
              </div>
            </div>
            <div class="controls">
              <label class="made">
                <span>만든 개수</span>
                <input :value="done ? '' : progress.made" type="number" inputmode="numeric" min="0" :max="MEISTER_STAGES[progress.stage] ? stageTotal(MEISTER_STAGES[progress.stage]!) : 0" :disabled="!ready || done" @input="setMade(Number(($event.target as HTMLInputElement).value))">
              </label>
              <div class="extra" :title="`무한의 피로회복제 1개 = 피로도 ${MEISTER_POTION_FATIGUE} 회복 · 코인샵에서 하루 ${MEISTER_POTION_DAILY_LIMIT}개까지`">
                <img :src="ICONS['infinite-fatigue-potion']" alt="">
                <span>하루 회복제 <small class="muted">1개 = {{ MEISTER_POTION_FATIGUE }}</small></span>
                <div class="stepper">
                  <button type="button" aria-label="회복제 하나 빼기" :disabled="!ready || progress.potions <= 0" @click="addPotion(-1)">−</button>
                  <b>{{ progress.potions }}<small>/{{ MEISTER_POTION_DAILY_LIMIT }}</small></b>
                  <button type="button" aria-label="회복제 하나 더하기" :disabled="!ready || progress.potions >= MEISTER_POTION_DAILY_LIMIT" @click="addPotion(1)">＋</button>
                </div>
              </div>
            </div>
            <div class="today" :style="{ '--rows': TODAY_ROWS }">
              <span class="cap">오늘 할 일 · 피로도 {{ ready ? `${days[0]?.fatigue ?? 0} / ${cap}` : '-' }}</span>
              <div class="today-list">
                <template v-if="ready && today.length">
                  <div v-for="t in today" :key="t.craft.name" class="today-row" :style="{ '--tone': TONES[t.stage] }">
                    <img :src="ICONS[t.craft.icon]" alt="">
                    <span class="ellipsis">{{ t.craft.name }}</span>
                    <span class="until">{{ t.craft.until }}까지</span>
                    <b>×{{ t.count }}</b>
                  </div>
                </template>
                <p v-else-if="ready" class="muted small">남은 제작이 없어요.</p>
              </div>
            </div>
            <ul class="days">
              <li v-for="(d, i) in days" :key="i" class="day" :class="{ first: i === 0 }" :title="dayTitle(d)">
                <b>{{ i + 1 }}일</b>
                <div class="fbar">
                  <span v-for="part in d.parts" :key="part.stage" :style="{ width: `${(part.count * MEISTER_STAGES[part.stage]!.fatigue / cap) * 100}%`, background: TONES[part.stage] }" />
                </div>
                <em v-if="dayGoal(i)">{{ dayGoal(i) }}</em>
              </li>
            </ul>
          </section>

          <section class="panel shop">
            <div class="p-head">
              <h3>장보기</h3>
              <small class="muted">남은 제작에 드는 재료 · 산 건 눌러서 체크</small>
            </div>
            <div class="items" :style="{ '--rows': Math.ceil(MEISTER_MATERIALS.length / 3) }">
              <template v-if="ready">
                <button
                  v-for="m in items"
                  :key="m.key"
                  type="button"
                  class="item"
                  :class="{ got: progress.have.includes(m.key) || !m.count, used: !m.count }"
                  :aria-pressed="progress.have.includes(m.key) || !m.count"
                  :disabled="!m.count"
                  @click="toggleHave(m.key)"
                >
                  <span class="mic"><img :src="ICONS[m.icon]" alt=""><i class="chk" aria-hidden="true" /></span>
                  <span class="ellipsis">{{ m.name }}<small v-if="m.source === 'shop'" class="npc-tag">NPC</small></span>
                  <b>{{ m.count ? m.count.toLocaleString('ko-KR') : '다 씀' }}</b>
                </button>
              </template>
            </div>
          </section>
        </div>
      </div>

      <p class="foot muted">출처: 인벤 웹진 명장 공략 · 나무위키 전문기술 · 공식 업데이트 722(하루 피로도). 회당 피로도는 블로그 수치라 추정이에요.</p>
    </div>
  </GameWindow>
</template>

<style scoped>
.meister {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  height: 100%;
}
.muted {
  color: var(--sub);
}
.small {
  font-size: 12px;
}
img {
  image-rendering: pixelated;
  object-fit: contain;
}

.hero {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 8px 18px;
  background: radial-gradient(420px 140px at 0 50%, rgb(242 193 78 / 0.18), transparent 70%), var(--panel);
  border: 1px solid var(--gold);
  border-radius: 12px;
}
.npc {
  width: 44px;
}
.big {
  display: grid;
  gap: 2px;
}
.big .muted {
  font-size: 12.5px;
}
.d {
  color: var(--gold);
  font: 30px/1 var(--f-title);
}
.d small {
  color: var(--sub);
  font-size: 14px;
}
.hero-skeleton {
  width: 220px;
  height: 46px;
}
.tips {
  display: grid;
  gap: 4px;
  justify-items: start;
  min-width: 0;
}
.tips p {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  color: var(--sub);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tips p b {
  color: var(--text);
}
.until {
  flex: none;
  padding: 0 7px;
  background: color-mix(in srgb, var(--tone) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
  border-radius: 999px;
  color: var(--tone);
  font-size: 11px;
  font-weight: 700;
  line-height: 17px;
}
.today-row .until {
  margin-left: auto;
}
.reward {
  justify-self: start;
  padding: 2px 10px;
  background: rgb(242 193 78 / 0.14);
  border: 1px solid var(--gold);
  border-radius: 999px;
  color: var(--gold);
  font-size: 12px;
  font-weight: 700;
}
.facts {
  display: flex;
  margin: 0;
}
.facts div {
  display: grid;
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

.main {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

/* 단계 카드: 내용만큼 자리를 잡고 남는 높이는 세 장이 똑같이 나눠 가진다 */
.stages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  margin: 0;
  padding: 0;
  list-style: none;
}
.stage {
  display: grid;
  flex: 1 0 auto;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 6px;
  padding: 10px 14px;
  background: linear-gradient(110deg, color-mix(in srgb, var(--tone) 14%, var(--panel)), var(--panel) 55%);
  border: 1px solid color-mix(in srgb, var(--tone) 45%, var(--panel-line));
  border-radius: 12px;
  transition: box-shadow var(--normal) ease, opacity var(--normal) ease;
}
.stage.now {
  box-shadow: 0 0 0 2px var(--tone), 0 0 16px color-mix(in srgb, var(--tone) 30%, transparent);
}
.stage.past {
  opacity: 0.6;
}
.s-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ic {
  display: grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.ic img {
  width: 34px;
  height: 34px;
}
.s-title {
  display: grid;
  flex: 1;
  min-width: 0;
}
.lvl {
  color: var(--tone);
  font: 13px var(--f-title);
}
.s-title b {
  font: 18px/1.2 var(--f-title);
}
.cnt {
  color: var(--tone);
  font: 30px/1 var(--f-title);
  font-variant-numeric: tabular-nums;
}
.cnt small {
  color: var(--sub);
  font-size: 13px;
}
.cnt.done {
  color: var(--gain);
  font-size: 22px;
}
.crafts {
  display: grid;
  align-content: center;
  gap: 3px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}
.crafts li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.crafts li > img {
  width: 22px;
  height: 22px;
}
.mats {
  display: flex;
  flex: none;
  gap: 3px;
  margin-left: auto;
}
.mat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px 0 2px;
  background: var(--bar);
  border-radius: 999px;
  font-size: 11.5px;
}
.mat img {
  width: 16px;
  height: 16px;
}
.crafts b {
  flex: none;
  min-width: 34px;
  color: var(--tone);
  font: 15px var(--f-title);
  text-align: right;
}
.s-foot {
  display: grid;
  gap: 4px;
}
.s-bar {
  height: 6px;
  overflow: hidden;
  background: var(--bar);
  border-radius: 999px;
}
.s-bar i {
  display: block;
  height: 100%;
  background: var(--tone);
  transition: width var(--normal) var(--ease-out);
}
.meta {
  overflow: hidden;
  color: var(--sub);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 진행도 칸이 남는 높이를 갖고, 장보기는 재료 10종 자리로 높이를 고정한다 */
.side {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 0;
}
.panel {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.p-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.p-head .seg {
  flex: 1;
}
.p-head h3 {
  margin: 0;
  font: 16px var(--f-title);
}
.p-head small {
  font-size: 12px;
}
.seg {
  display: grid;
  flex: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.seg button {
  padding: 5px 4px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  cursor: pointer;
}
.seg button:first-child {
  border-radius: 7px 0 0 7px;
}
.seg button:last-child {
  border-right: 0;
  border-radius: 0 7px 7px 0;
}
.seg button[aria-pressed="true"] {
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.controls {
  display: flex;
  gap: 8px;
}
.made {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px 0 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
}
.made input {
  width: 64px;
  min-height: 30px;
  padding: 0 6px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-align: right;
}
.extra {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 4px 0 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
}
.extra img {
  width: 22px;
  height: 22px;
}
.extra span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stepper {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}
.stepper button {
  width: 26px;
  height: 26px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}
.stepper button:disabled {
  opacity: 0.35;
  cursor: default;
}
.stepper b {
  min-width: 38px;
  color: var(--gold);
  font: 16px var(--f-title);
  text-align: center;
}
.stepper small {
  color: var(--sub);
  font-size: 11px;
}
.today {
  display: grid;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--panel-line);
}
.today-list {
  display: grid;
  grid-auto-rows: 28px;
  align-content: start;
  gap: 4px;
  height: calc(var(--rows) * 28px + (var(--rows) - 1) * 4px);
}
.cap {
  color: var(--sub);
  font-size: 11.5px;
  letter-spacing: 0.04em;
}
.today-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: var(--bar);
  border-left: 3px solid var(--tone);
  border-radius: 6px;
  font-size: 13.5px;
}
.today-row img {
  width: 22px;
  height: 22px;
}
.today-row b {
  min-width: 34px;
  text-align: right;
  color: var(--tone);
  font: 18px var(--f-title);
}
.days {
  display: flex;
  gap: 6px;
  min-height: 30px;
  margin: auto 0 0;
  padding: 0;
  list-style: none;
}
.day {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px 8px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.day.first {
  border-color: var(--gold);
}
.day b {
  flex: none;
  font: 14px var(--f-title);
}
.day.first b {
  color: var(--gold);
}
.day em {
  flex: none;
  color: var(--gold);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}
.fbar {
  display: flex;
  flex: 1;
  min-width: 20px;
  height: 7px;
  overflow: hidden;
  background: var(--panel);
  border-radius: 999px;
}

.side > .panel:first-child {
  display: flex;
  flex-direction: column;
}
.shop {
  overflow: visible;
}
.items {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 32px;
  align-content: start;
  gap: 6px;
  height: calc(var(--rows) * 32px + (var(--rows) - 1) * 6px);
}
.item {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 4px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: opacity var(--fast) ease, border-color var(--fast) ease;
}
.item:hover {
  border-color: var(--tip-line);
}
/* 산(다 쓴) 재료는 그림 위에 체크를 얹는다 */
.chk {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: none;
  width: 13px;
  height: 13px;
  background: var(--gain);
  border: 2px solid var(--bar);
  border-radius: 50%;
}
.item.got {
  opacity: 0.5;
}
.item.used {
  cursor: default;
}
.item.used b {
  color: var(--gain);
  font-size: 13px;
}
.item.used .ellipsis {
  text-decoration: line-through;
}
.item.got .chk {
  display: block;
}
.mic {
  position: relative;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  background: var(--panel);
  border-radius: 6px;
}
.mic img {
  max-width: 22px;
  max-height: 22px;
}
.item b {
  color: var(--gold);
  font: 16px var(--f-title);
  font-variant-numeric: tabular-nums;
}
.npc-tag {
  margin-left: 6px;
  padding: 0 5px;
  background: rgb(127 217 154 / 0.15);
  border-radius: 4px;
  color: var(--gain);
  font-size: 10.5px;
  font-weight: 700;
}
.foot {
  margin: 0;
  font-size: 12px;
}
/* 낮은 화면에서는 여백과 글자를 줄여 한 화면에 담는다 */
@media (max-height: 860px) {
  .meister {
    gap: 8px;
  }
  .hero {
    padding: 2px 16px;
  }
  .tips {
    gap: 2px;
  }
  .reward {
    padding: 0 10px;
  }
  .npc {
    width: 36px;
  }
  .d {
    font-size: 24px;
  }
  .stage {
    gap: 4px;
    padding: 7px 12px;
  }
  .ic {
    width: 38px;
    height: 38px;
  }
  .ic img {
    width: 28px;
    height: 28px;
  }
  .cnt {
    font-size: 24px;
  }
  .panel {
    gap: 4px;
    padding: 8px 12px;
  }
  .seg button {
    padding: 3px 4px;
  }
  .made input {
    min-height: 26px;
  }
  .stepper button {
    width: 22px;
    height: 22px;
  }
  .today {
    padding-top: 4px;
  }
  .today-list {
    grid-auto-rows: 20px;
    gap: 3px;
    height: calc(var(--rows) * 20px + (var(--rows) - 1) * 3px);
  }
  .controls label {
    font-size: 12px;
  }
  .panel > .controls,
  .panel > .today {
    margin-top: -2px;
  }
  .days {
    min-height: 26px;
  }
  .day {
    padding: 2px 8px;
  }

}
@media (max-width: 1100px), (max-height: 700px) {
  .main {
    grid-template-columns: minmax(0, 1fr);
  }
  .items,
  .stages,
  .panel {
    overflow: visible;
  }
  .side {
    grid-template-rows: none;
  }
}
@media (max-width: 760px) {
  .hero {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .tips,
  .facts {
    grid-column: 1 / -1;
  }
  .controls {
    flex-wrap: wrap;
  }
}
</style>
