<script setup lang="ts">
import type { ReviewStarforce, StarforceRestore } from '#shared/types'
import type { StarforcePlan } from '#shared/calc/starforce'
import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'
import { LEVELS_FOR_STARFORCE, starforceActual, starforceVerdict } from '#shared/calc/review'

const props = defineProps<{ s: ReviewStarforce, plan: StarforcePlan | null, level: number | null, open: boolean, character: string, ocid: string, addDate: string | null }>()
const emit = defineEmits<{ toggle: [], level: [level: number] }>()

const verdict = computed(() => (props.plan ? starforceVerdict(props.s, props.plan) : null))
const gain = computed(() => (verdict.value ? verdict.value.expected - verdict.value.actual : null))
const reached = computed(() => props.s.to > props.s.from)

// 구간마다 실제 누른 횟수와, 그만큼 성공하는 데 평균 몇 번이 드는지(성공 횟수 ÷ 성공 확률)
const stages = computed(() => {
  const info = new Map((props.plan?.stages ?? []).map(st => [st.star, st]))
  return props.s.stages.flatMap((st) => {
    const i = info.get(st.star)
    if (!i || !st.success) return []
    const mean = st.success / i.success
    const luck = st.attempts < mean * 0.85 ? 'good' : st.attempts > mean * 1.15 ? 'bad' : 'even'
    return [{ ...st, mean, luck, saved: (mean - st.attempts) * i.cost }]
  })
})
const reason = computed(() => {
  const list = stages.value
  if (!list.length || gain.value === null) return ''
  const best = list.reduce((a, b) => (b.saved > a.saved ? b : a))
  const worst = list.reduce((a, b) => (b.saved < a.saved ? b : a))
  const pick = gain.value >= 0 ? best : worst
  const range = `★${pick.star} → ${pick.star + 1}`
  const main = pick.saved >= 0
    ? `${range} 구간이 평균 ${pick.mean.toFixed(1)}번인데 ${pick.attempts}번에 붙어서 가장 크게 아꼈어요.`
    : `${range} 구간에서 평균 ${pick.mean.toFixed(1)}번보다 많은 ${pick.attempts}번을 눌러 가장 크게 잃었어요.`
  const boom = props.s.destroys ? ` 파괴 ${props.s.destroys}번${props.s.restoreMeso ? `(복구 메소 ${formatShortNumber(props.s.restoreMeso)})` : ''}도 들어 있어요.` : ''
  return main + boom
})
const conditions = computed(() => [
  props.level ? `Lv.${props.level}` : null,
  props.s.discount ? '이벤트 할인 받음' : null,
  ...props.s.sundayEffects.filter(e => e !== 'discount').map(e => SUNDAY_STARFORCE_EFFECTS.find(x => x.key === e)?.label ?? e),
  props.s.protectStars.length ? `파괴방지 ★${props.s.protectStars.join('·')}` : '파괴방지 안 씀',
  props.s.manual !== null ? '쓴 메소는 장비 결산에 적은 값' : '노작값은 빠짐',
].filter(Boolean).join(' · '))

// 터지거나 멈추기 전까지 연달아 올린 걸 한 구간으로 묶는다
type Segment = { from: number, to: number, tries: number, end: 'destroy' | 'stop' | 'goal', restore: StarforceRestore | null }
const segments = computed(() => {
  const list: Segment[] = []
  let cur: Segment | null = null
  for (const step of props.s.path) {
    cur ??= { from: step.star, to: step.star, tries: 0, end: 'goal', restore: null }
    cur.tries += step.tries
    if (step.result === 'up') {
      cur.to = step.star + 1
      continue
    }
    cur.to = step.star
    cur.end = step.result
    cur.restore = step.restore
    list.push(cur)
    cur = null
  }
  if (cur) list.push(cur)
  return list
})
// 구간이 많으면 앞 둘·뒤 둘만 보이고 가운데는 "파괴 n번 더"로 접는다(null 자리)
const SEGMENTS_FOLDED = 6
const showAll = ref(false)
const shownSegments = computed<(Segment | null)[]>(() => {
  const list = segments.value
  if (showAll.value || list.length <= SEGMENTS_FOLDED) return list
  return [...list.slice(0, 2), null, ...list.slice(-2)]
})
const hiddenDestroys = computed(() => segments.value.slice(2, -2).filter(seg => seg.end === 'destroy').length)
const restoreText = (r: StarforceRestore | null) => (!r ? '복구 방법 모름' : r.to === 12 ? '12성 복구' : `★${r.to} 흔적 복구${r.fee ? ` ${formatShortNumber(r.fee)}` : ''}`)
const restoreSummary = computed(() => {
  const list = props.s.path.filter(p => p.result === 'destroy')
  const twelve = list.filter(p => p.restore?.to === 12).length
  const trace = list.filter(p => p.restore && p.restore.to !== 12).length
  return [`파괴 ${list.length}번`, twelve ? `12성 복구 ${twelve}` : '', trace ? `흔적 복구 ${trace}` : '', props.s.copies ? `노작 ${props.s.copies}개` : ''].filter(Boolean).join(' · ')
})

const max = computed(() => props.plan?.histogram.max || 1)
const at = (meso: number) => `${Math.min(100, (meso / max.value) * 100)}%`
const rankText = (rank: number) => `상위 ${Math.max(1, Math.round(rank * 100))}%`
</script>

<template>
  <div class="row" :class="{ open }">
    <button type="button" class="head" :aria-expanded="open" @click="emit('toggle')">
      <span class="caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
      <img v-if="s.icon" :src="s.icon" alt="" class="icon">
      <span v-else class="icon" />
      <span class="nm">
        <b>{{ s.item }}<span v-if="s.condition" class="cond">{{ s.condition }}</span></b>
        <small>{{ s.slot ?? '지금 안 낀 장비' }} · <span class="star">★</span>{{ s.from }} → <span class="star">★</span>{{ s.to }} · {{ s.attempts }}번<template v-if="s.destroys"> · <span class="loss">파괴 {{ s.destroys }}</span></template></small>
      </span>
      <span class="cell">쓴 메소<span v-if="s.manual !== null" class="src">수기</span><b>{{ formatShortNumber(starforceActual(s)) }}</b></span>
      <span class="cell avg">평균이면<b>{{ verdict ? formatShortNumber(verdict.expected) : reached && level ? '…' : '-' }}</b></span>
      <span class="luck">
        <template v-if="verdict && verdict.rank !== null">
          <span class="bar"><i :style="{ left: `${verdict.rank * 100}%` }" /></span>1만 번 중 {{ rankText(verdict.rank!) }}
        </template>
        <template v-else-if="!reached">목표 없음</template>
        <template v-else-if="!level">레벨을 골라 주세요</template>
      </span>
      <span class="cell">{{ gain === null ? '' : gain >= 0 ? '이득' : '손해' }}<b :class="gain === null ? '' : gain >= 0 ? 'gain' : 'loss'">{{ gain === null ? '-' : formatSigned(gain, formatShortNumber) }}</b></span>
    </button>

    <div v-if="open" class="body">
      <div v-if="!reached" class="why">
        <span><b>올린 성급이 없어요.</b> ★{{ s.from }}에서 시작해 ★{{ s.to }}에서 멈춰서 비교할 목표가 없어요. 쓴 메소와 파괴만 보여 드려요.</span>
      </div>
      <div v-else-if="!level" class="pick-level">
        <span>지금 끼고 있지 않아 착용 레벨을 몰라요. 골라 주면 계산해요.</span>
        <div class="levels">
          <button v-for="l in LEVELS_FOR_STARFORCE" :key="l" type="button" @click="emit('level', l)">{{ l }}</button>
        </div>
      </div>
      <template v-else-if="plan && verdict">
        <div class="nums">
          <div>쓴 메소<span v-if="s.manual !== null" class="src">수기</span><b>{{ formatShortNumber(verdict.actual) }}</b><small>{{ s.manual !== null ? `기록으로 센 값 ${formatShortNumber(s.meso + s.restoreMeso)}` : `누른 비용 ${formatShortNumber(s.meso)}${s.restoreMeso ? ` + 복구 메소 ${formatShortNumber(s.restoreMeso)}` : ''}` }}</small></div>
          <div>평균이면<b>{{ formatShortNumber(verdict.expected) }}</b><small>같은 조건으로 끝까지 했을 때</small></div>
          <div>절반은 이 안에<b>{{ formatShortNumber(plan.p50) }}</b><small>운이 나쁘면(10%) {{ formatShortNumber(plan.p90) }}</small></div>
        </div>
        <div class="two">
          <div class="hist-wrap">
            <span class="caption">{{ plan.runs.toLocaleString('ko-KR') }}번 해 보면 드는 메소 · 초록 선이 나</span>
            <div class="hist">
              <i v-for="(b, i) in plan.histogram.bins" :key="i" :class="{ over: (i + 0.5) / plan.histogram.bins.length * plan.histogram.max > plan.p90 }" :style="{ height: `${(b / Math.max(...plan.histogram.bins)) * 100}%` }" />
              <span class="mark me" :class="{ flip: verdict.actual > max * 0.6 }" :style="{ left: at(verdict.actual) }"><span>나 {{ formatShortNumber(verdict.actual) }} · {{ rankText(verdict.rank!) }}</span></span>
              <span class="mark" :class="{ flip: verdict.expected > max * 0.6 }" :style="{ left: at(verdict.expected) }"><span>평균 {{ formatShortNumber(verdict.expected) }}</span></span>
            </div>
            <div class="axis"><span>0</span><span>{{ formatShortNumber(max / 2) }}</span><span>{{ formatShortNumber(max) }}+</span></div>
          </div>
          <div class="how">
            <span class="caption">어떻게 올렸나<template v-if="s.destroys"> · {{ restoreSummary }}</template></span>
            <ol class="path">
              <template v-for="(seg, i) in shownSegments" :key="i">
                <li v-if="seg === null" class="more">
                  <button type="button" @click="showAll = true">… 파괴 {{ hiddenDestroys }}번 더 · 전부 보기</button>
                </li>
                <li v-else class="seg" :class="seg.end">
                  <span class="climb"><span class="star">★</span>{{ seg.from }} → <span class="star">★</span>{{ seg.to }}</span>
                  <span class="tries">{{ seg.tries }}번</span>
                  <span v-if="seg.end === 'destroy'" class="boom">★{{ seg.to }}에서 파괴 → {{ restoreText(seg.restore) }}</span>
                  <span v-else-if="seg.end === 'stop'" class="edge">★{{ seg.to }}에서 멈춤</span>
                  <span v-else class="edge goal">목표 도착</span>
                </li>
              </template>
            </ol>
            <button v-if="showAll && segments.length > SEGMENTS_FOLDED" type="button" class="fold" @click="showAll = false">접기</button>
            <table class="mini">
              <thead><tr><th>구간</th><th>누름</th><th>평균</th><th>운</th></tr></thead>
              <tbody>
                <tr v-for="st in stages" :key="st.star">
                  <td>★{{ st.star }} → {{ st.star + 1 }}</td>
                  <td>{{ st.attempts }}</td>
                  <td>{{ st.mean.toFixed(1) }}</td>
                  <td :class="st.luck === 'good' ? 'gain' : st.luck === 'bad' ? 'loss' : 'muted'">{{ st.luck === 'good' ? '좋음' : st.luck === 'bad' ? '나쁨' : '보통' }}<template v-if="st.destroy"> · 파괴 {{ st.destroy }}</template></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="why">
          <span v-if="reason"><b>{{ gain! >= 0 ? '왜 이득이었나.' : '왜 손해였나.' }}</b> {{ reason }}</span>
          <span><b>계산 조건.</b> {{ conditions }}</span>
        </div>
        <div class="actions">
          <NuxtLink :to="{ path: '/calc/starforce', query: { level, from: s.from, to: s.to } }" class="act calc">같은 구간 계산기로 보기 →</NuxtLink>
          <NuxtLink :to="{ path: '/starforce', query: { ocid, item: s.item } }" class="act">이 장비 기록 전체 보기 →</NuxtLink>
          <ReviewAddToItems v-if="addDate && s.manual === null && !s.condition && s.meso + s.restoreMeso" :character="character" :item="s.item" kind="starforce" :date="addDate" :amount="s.meso + s.restoreMeso" />
        </div>
      </template>
      <div v-else class="skeleton body-skeleton" />
    </div>
  </div>
</template>

<style scoped>
.row {
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.row.open {
  border-color: var(--tip-line);
}
/* 칸 너비를 고정해 장비끼리 위아래로 줄이 맞는다 */
.head {
  display: grid;
  grid-template-columns: 14px 34px minmax(0, 1fr) 96px 96px 150px 96px;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.caret {
  color: var(--sub);
  font-size: 12px;
}
.open .caret {
  color: var(--gold);
}
.icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
  image-rendering: pixelated;
}
.nm {
  display: grid;
  min-width: 0;
  line-height: 1.35;
}
/* 썬데이·평소처럼 조건이 달라 나눈 장비의 조건 이름 */
.cond {
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid rgb(127 217 154 / 0.5);
  border-radius: 4px;
  color: var(--gain);
  font-family: var(--f-body);
  font-size: 11px;
  vertical-align: 2px;
}
.nm b {
  overflow: hidden;
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm small {
  color: var(--sub);
  font-size: 12px;
}
.star {
  color: var(--gold);
}
.cell {
  display: grid;
  color: var(--sub);
  font-size: 11px;
  line-height: 1.3;
  text-align: right;
}
.cell b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
.cell b.gain {
  color: var(--gain);
}
.cell b.loss {
  color: var(--loss);
}
.src {
  margin-left: 4px;
  padding: 0 4px;
  background: rgb(242 193 78 / 0.18);
  border-radius: 4px;
  color: var(--gold);
  font-size: 10px;
  font-weight: 800;
}
.luck {
  display: grid;
  gap: 3px;
  color: var(--sub);
  font-size: 11px;
  text-align: right;
}
.luck .bar {
  position: relative;
  height: 6px;
  background: linear-gradient(90deg, rgb(127 217 154 / 0.7), rgb(165 174 203 / 0.25) 50%, rgb(255 138 122 / 0.7));
  border-radius: 3px;
}
.luck .bar i {
  position: absolute;
  top: -3px;
  width: 3px;
  height: 12px;
  background: var(--text);
  border-radius: 2px;
  translate: -50% 0;
}
.body {
  display: grid;
  gap: 14px;
  padding: 14px 16px 16px 58px;
  border-top: 1px dashed var(--panel-line);
}
.body-skeleton {
  height: 220px;
}
.pick-level {
  display: grid;
  gap: 8px;
  color: var(--sub);
  font-size: 13px;
}
.levels {
  display: flex;
  gap: 6px;
}
.levels button {
  padding: 4px 14px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  cursor: pointer;
}
.levels button:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.nums {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.nums div {
  display: grid;
  gap: 1px;
  padding: 9px 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  font-size: 12px;
}
.nums b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
.nums small {
  color: var(--sub);
  font-size: 11.5px;
}
.two {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}
.caption {
  color: var(--sub);
  font-size: 12px;
}
.hist-wrap {
  display: grid;
  gap: 6px;
}
.hist {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 92px;
  margin-top: 34px;
  border-bottom: 1px solid var(--tip-line);
}
.hist i {
  flex: 1;
  background: rgb(183 156 255 / 0.5);
  border-radius: 3px 3px 0 0;
}
.hist i.over {
  background: rgb(255 138 122 / 0.4);
}
.mark {
  position: absolute;
  top: -8px;
  bottom: 0;
  border-left: 2px dashed var(--tip-line);
}
.mark span {
  position: absolute;
  top: -16px;
  left: 4px;
  color: var(--sub);
  font-size: 11px;
  white-space: nowrap;
}
.mark.flip span {
  right: 4px;
  left: auto;
}
.mark.me {
  border-left: 3px solid var(--gain);
}
.mark.me span {
  top: -30px;
  color: var(--gain);
  font-weight: 800;
}
.axis {
  display: flex;
  justify-content: space-between;
  color: var(--sub);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.how {
  display: grid;
  gap: 8px;
}
.path {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
}
.seg {
  display: grid;
  grid-template-columns: 110px 48px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: rgb(255 255 255 / 0.03);
  border-left: 3px solid var(--panel-line);
  border-radius: 4px;
}
.seg.destroy {
  border-left-color: var(--loss);
}
.seg.goal {
  border-left-color: var(--gold);
}
.climb {
  font-family: var(--f-title);
  font-size: 14px;
}
.tries {
  color: var(--sub);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.edge {
  color: var(--sub);
  font-size: 11.5px;
}
.edge.goal {
  color: var(--gold);
}
.boom {
  color: var(--loss);
  font-size: 12px;
}
.more button,
.fold {
  justify-self: start;
  padding: 2px 10px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.more button:hover,
.fold:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.mini {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.mini th {
  padding: 4px 8px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 11.5px;
  font-weight: 400;
  text-align: right;
}
.mini td {
  padding: 4px 8px;
  border-bottom: 1px solid rgb(58 67 102 / 0.5);
  text-align: right;
}
.mini th:first-child,
.mini td:first-child {
  text-align: left;
}
.why {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px dashed var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  font-size: 13px;
}
.why b {
  color: var(--text);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.act {
  padding: 5px 12px;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
  text-decoration: none;
}
.act:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.act.calc {
  border-color: rgb(183 156 255 / 0.55);
  color: var(--calc);
}
@media (max-width: 760px) {
  .head {
    grid-template-columns: 14px 34px minmax(0, 1fr) 80px 80px;
  }
  .head .avg,
  .head .luck {
    display: none;
  }
  .body {
    padding-left: 16px;
  }
  .nums,
  .two {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .head {
    grid-template-columns: 14px 34px minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px 10px;
    padding: 10px 12px;
  }
  .nm {
    grid-column: 3 / -1;
  }
  .head > .cell:nth-child(4) {
    grid-row: 2;
    grid-column: 3;
    text-align: left;
  }
  .head > .cell:last-child {
    grid-row: 2;
    grid-column: 4;
  }
  .body {
    padding-left: 12px;
  }
}
</style>
