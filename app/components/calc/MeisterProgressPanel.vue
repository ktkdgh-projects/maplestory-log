<script setup lang="ts">
import { MEISTER_POTION_DAILY_LIMIT, MEISTER_POTION_FATIGUE, MEISTER_STAGES } from '#shared/data/meister'
import { stageTotal, todayCrafts, type MeisterDay, type MeisterProgress } from '#shared/calc/meister'

const props = defineProps<{
  progress: MeisterProgress
  ready: boolean
  done: boolean
  days: MeisterDay[]
  cap: number
  signedIn: boolean
  icons: Record<string, string>
  tones: string[]
}>()
const emit = defineEmits<{
  pickStage: [stage: number]
  setMade: [value: number]
  addPotion: [step: number]
}>()

// 오늘 할 일은 많아야 단계 수만큼이라 그만큼 자리를 잡아 둬서 단계를 바꿔도 칸이 움직이지 않는다
const TODAY_ROWS = 3
const GOALS = ['Lv 10', '장인', '명장']
const STAGE_LABELS = ['1~10', '장인', '명장', '달성']

// 그날 마치는 단계 중 가장 높은 등급
function dayGoal(i: number) {
  const parts = props.days[i]!.parts
  const next = props.days[i + 1]?.parts[0]?.stage
  const finished = parts.filter((p, j) => j < parts.length - 1 || p.stage !== next).map(p => p.stage)
  return finished.length ? GOALS[Math.max(...finished)] : ''
}
const dayTitle = (d: MeisterDay) => d.parts.map(p => `${MEISTER_STAGES[p.stage]!.short} ${p.count}회`).join(' · ')
// 명장을 달성했으면 오늘 할 일 자리에 지나온 길(제작 수·쓴 피로도)을 보여 준다
const route = computed(() => ({
  crafts: MEISTER_STAGES.reduce((n, st) => n + stageTotal(st), 0),
  fatigue: MEISTER_STAGES.reduce((n, st) => n + stageTotal(st) * st.fatigue, 0),
}))
const today = computed(() => todayCrafts(props.progress))
</script>

<template>
  <section class="panel">
    <div class="p-head">
      <h3 :title="signedIn ? '계정에 저장돼요' : '이 브라우저에 저장돼요'">내 진행도</h3>
      <div class="seg" role="group" aria-label="지금 등급">
        <button v-for="(label, s) in STAGE_LABELS" :key="label" type="button" :aria-pressed="progress.stage === s" :disabled="!ready" @click="emit('pickStage', s)">{{ label }}</button>
      </div>
    </div>
    <div class="controls">
      <label class="made">
        <span>만든 개수</span>
        <input :value="done ? '' : progress.made" type="number" inputmode="numeric" min="0" :max="MEISTER_STAGES[progress.stage] ? stageTotal(MEISTER_STAGES[progress.stage]!) : 0" :disabled="!ready || done" @input="emit('setMade', Number(($event.target as HTMLInputElement).value))">
      </label>
      <div class="extra" :title="`무한의 피로회복제 1개 = 피로도 ${MEISTER_POTION_FATIGUE} 회복 · 코인샵에서 하루 ${MEISTER_POTION_DAILY_LIMIT}개까지`">
        <img :src="icons['infinite-fatigue-potion']" alt="">
        <span>하루 회복제 <small class="muted">1개 = {{ MEISTER_POTION_FATIGUE }}</small></span>
        <div class="stepper">
          <button type="button" aria-label="회복제 하나 빼기" :disabled="!ready || progress.potions <= 0" @click="emit('addPotion', -1)">−</button>
          <b>{{ progress.potions }}<small>/{{ MEISTER_POTION_DAILY_LIMIT }}</small></b>
          <button type="button" aria-label="회복제 하나 더하기" :disabled="!ready || progress.potions >= MEISTER_POTION_DAILY_LIMIT" @click="emit('addPotion', 1)">＋</button>
        </div>
      </div>
    </div>
    <div class="today" :style="{ '--rows': TODAY_ROWS }">
      <span class="cap">오늘 할 일 · 피로도 {{ ready ? `${days[0]?.fatigue ?? 0} / ${cap}` : '-' }}</span>
      <div class="today-list">
        <template v-if="ready && today.length">
          <div v-for="t in today" :key="t.craft.name" class="today-row" :style="{ '--tone': tones[t.stage] }">
            <img :src="icons[t.craft.icon]" alt="">
            <span class="ellipsis">{{ t.craft.name }}</span>
            <span class="until">{{ t.craft.until }}까지</span>
            <b>×{{ t.count }}</b>
          </div>
        </template>
        <div v-else-if="ready && done" class="route">
          <b>명장 달성 · 크리티컬 데미지 +5% 버프</b>
          <span class="muted small">이 순서대로 왔다면 제작 {{ route.crafts.toLocaleString('ko-KR') }}회 · 피로도 {{ route.fatigue.toLocaleString('ko-KR') }}을 썼어요</span>
        </div>
        <p v-else-if="ready" class="muted small">남은 제작이 없어요.</p>
      </div>
    </div>
    <ul class="days">
      <li v-for="(d, i) in days" :key="i" class="day" :class="{ first: i === 0 }" :title="dayTitle(d)">
        <b>{{ i + 1 }}일</b>
        <div class="fbar">
          <span v-for="part in d.parts" :key="part.stage" :style="{ width: `${(part.count * MEISTER_STAGES[part.stage]!.fatigue / cap) * 100}%`, background: tones[part.stage] }" />
        </div>
        <em v-if="dayGoal(i)">{{ dayGoal(i) }}</em>
      </li>
    </ul>
  </section>
</template>

<style scoped>
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
@media (max-height: 860px) {
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
  .panel {
    overflow: visible;
  }
}
@media (max-width: 760px) {
  .controls {
    flex-wrap: wrap;
  }
}
.route {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  border-radius: 8px;
}
.route b {
  color: var(--gold);
}
</style>
