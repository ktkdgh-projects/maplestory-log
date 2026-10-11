<script setup lang="ts">
import type { EnhanceEvent, EnhanceItem, StarforceDetail, StarforceRestore, StarforceStage } from '#shared/types'
import { maxStars, starRates } from '#shared/data/starforce'
import { useEnhanceDetail, useOpenDays } from '~/composables/useEnhanceRecords'

const props = defineProps<{ ocid: string, item: EnhanceItem, from?: string }>()

// 키에 시도 수를 넣어 새 기록이 생기면 다시 받는다
const { detail, loading, failure, retry } = useEnhanceDetail<StarforceDetail>(
  'starforce-detail',
  () => (props.item.summary.starforce.attempts ? `${props.ocid}|${props.item.name}|${props.from ?? ''}|${props.item.summary.starforce.attempts}` : null),
  () => $fetch<StarforceDetail>(`/api/enhance/${props.ocid}/starforce`, { query: { item: props.item.name, level: props.item.level ?? undefined, from: props.from } }),
)

const stages = computed(() => detail.value?.stages ?? [])

// 지금 확률로 그만큼 성공하려면 평균 몇 번 눌러야 했는지. 실제가 20% 넘게 많으면 불운, 적으면 행운
function luckOf(s: StarforceStage) {
  const rate = starRates(s.star).success
  const expected = s.success / rate
  if (!s.success) return { text: `성공 전 · ${Math.round(1 / rate)}번`, tone: s.attempts > 1 / rate * 1.2 ? 'loss' : '' }
  const ratio = s.attempts / expected
  return { text: `${Math.round(expected)}번`, tone: ratio > 1.2 ? 'loss' : ratio < 0.8 ? 'gain' : '' }
}
const maxMeso = computed(() => Math.max(0, ...stages.value.map(s => s.meso)))
const firstStar = computed(() => stages.value[0]?.star ?? null)

const { open, toggle } = useOpenDays(() => detail.value?.days[0]?.date)

const resultOf = (e: EnhanceEvent) => (e.destroyed ? '파괴' : e.success ? '성공' : '실패')
const mesoText = (meso: number) => (meso ? formatShortNumber(meso) : '-')
const restoreText = (r: StarforceRestore) => `${r.to === 12 ? '12성 복구' : `★${r.to} 흔적 복구`} · 노작 ${r.copies}${r.fee ? ` · ${formatShortNumber(r.fee)}` : ''}`

// 최대 성급에 닿은 장비는 다음 단계 기대값이 없다
const canGoUp = computed(() => !props.item.level || props.item.starforce < maxStars(props.item.level))
const calcLink = computed(() => ({
  path: '/calc/starforce',
  query: { level: props.item.level ?? undefined, from: props.item.starforce, to: props.item.starforce + 1 },
}))
</script>

<template>
  <section class="detail enhance-detail">
    <header class="head">
      <img v-if="item.icon" :src="item.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
      <div class="title">
        <h3>{{ item.name }}</h3>
        <p>
          {{ item.slot }}<template v-if="item.level"> · Lv.{{ item.level }}</template>
          <template v-if="firstStar !== null"> · <span class="star">★</span>{{ firstStar }} → <span class="star">★</span>{{ item.starforce }}</template>
          <template v-else> · <span class="star">★</span>{{ item.starforce }}</template>
          <template v-if="item.summary.meso.starforce"> · 약 {{ formatKoreanNumber(item.summary.meso.starforce) }}</template>
          <template v-if="item.summary.starforce.destroy"> · <span class="loss">파괴 {{ item.summary.starforce.destroy }}번</span></template>
        </p>
      </div>
      <NuxtLink v-if="canGoUp" :to="calcLink" class="calc-link">★{{ item.starforce }} → {{ item.starforce + 1 }} 기대값 보기 →</NuxtLink>
    </header>

    <p v-if="!item.summary.starforce.attempts" class="muted empty">이 기간엔 이 장비를 강화한 기록이 없어요.</p>
    <div v-else-if="!detail && failure" class="fail">
      <p class="form-error">{{ failure }}</p>
      <button type="button" class="btn ghost compact" @click="retry">다시 불러오기</button>
    </div>
    <div v-else-if="!detail" class="skeleton block" />
    <div v-else class="content" :class="{ busy: loading }">
      <div class="table-wrap">
        <table class="stages">
          <thead>
            <tr><th>구간</th><th>시도</th><th>평균이면</th><th>성공</th><th>실패</th><th>파괴</th><th>방지</th><th class="meso-col">쓴 메소</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in stages" :key="s.star" :class="{ hot: stages.length > 1 && s.meso === maxMeso && maxMeso > 0 }">
              <td class="stage"><span class="star">★</span>{{ s.star }} → {{ s.star + 1 }}</td>
              <td :class="luckOf(s).tone">{{ s.attempts }}</td>
              <td class="dim small">{{ luckOf(s).text }}</td>
              <td class="gain">{{ s.success || '·' }}</td>
              <td>{{ s.fail || '·' }}</td>
              <td :class="s.destroy ? 'loss' : 'dim'">{{ s.destroy || '·' }}</td>
              <td :class="s.protect ? '' : 'dim'">{{ s.protect || '·' }}</td>
              <td class="meso-col">
                <span class="bar" :style="{ width: `${maxMeso ? (s.meso / maxMeso) * 100 : 0}%` }" />
                <span class="meso">{{ mesoText(s.meso) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted legend">평균이면: 지금 확률로 그만큼 성공하려면 평균 몇 번 눌러야 하는지예요. 시도가 <span class="loss">빨강</span>이면 평균보다 많이(불운), <span class="gain">초록</span>이면 적게(행운) 누른 거예요. 방지는 파괴방지를 쓴 시도예요.</p>

      <ol class="days">
        <li v-for="d in detail.days" :key="d.date" class="day" :class="{ open: open.has(d.date) }">
          <button type="button" class="day-head" :aria-expanded="open.has(d.date)" @click="toggle(d.date)">
            <span class="caret" aria-hidden="true">▸</span>
            <b>{{ formatDayWeek(d.date) }}</b>
            <span class="day-what">
              <template v-if="d.fromStar !== null && d.toStar !== null"><span class="star">★</span>{{ d.fromStar }} → <span class="star">★</span>{{ d.toStar }} · </template>{{ d.attempts }}번<template v-if="d.destroy"> · <span class="loss">파괴 {{ d.destroy }}</span></template>
            </span>
            <span class="day-meso">{{ mesoText(d.meso) }}</span>
          </button>
          <ol v-if="open.has(d.date)" class="events">
            <li v-for="(e, n) in d.events" :key="n" class="event" :class="{ up: e.success, boom: e.destroyed }">
              <time>{{ kstTime(e.at) }}</time>
              <span class="what">
                <span class="star">★</span>{{ e.beforeStar }} → {{ e.beforeStar === null ? '' : e.beforeStar + 1 }}
                <span v-if="e.protect" class="tag protect">방지</span>
                <span v-if="e.eventDiscount" class="tag sale">이벤트 {{ Math.round(e.eventDiscount * 100) }}%</span>
                <span v-if="e.restore" class="tag restore">{{ restoreText(e.restore) }}</span>
              </span>
              <span class="cost">{{ e.meso ? formatShortNumber(e.meso) : '' }}</span>
              <span class="result">{{ resultOf(e) }}</span>
            </li>
          </ol>
        </li>
      </ol>
      <p v-if="detail.truncated" class="muted note">기록이 많아 오래된 날은 잘렸어요. 기간을 줄이면 다 보여요.</p>
    </div>
  </section>
</template>

<style scoped>
.detail {
  /* 장비를 눌러 상세로 내려갈 때 위 고정 머리줄에 가리지 않게 */
  scroll-margin-top: 108px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 14px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: rgb(10 12 22 / 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.head img {
  flex: none;
  width: 44px;
  height: 44px;
  object-fit: contain;
  image-rendering: pixelated;
}
.title {
  min-width: 0;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 21px;
  font-weight: 400;
}
.title p {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.calc-link {
  flex: none;
  margin-left: auto;
  padding: 7px 12px;
  background: rgb(183 156 255 / 0.12);
  border: 1px solid rgb(183 156 255 / 0.55);
  border-radius: 8px;
  color: var(--calc);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--fast) ease;
}
.calc-link:hover {
  background: rgb(183 156 255 / 0.22);
}
.star {
  color: var(--gold);
}
/* 아이콘을 모르는 안 낀 장비는 같은 크기의 빈 칸 */
.no-icon {
  flex: none;
  width: 44px;
  height: 44px;
  background: var(--bar);
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
}
.block {
  flex: none;
  height: 180px;
}
.fail {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: opacity var(--fast) ease;
}
.content.busy {
  opacity: 0.55;
}
.legend {
  margin: -4px 0 0;
  font-size: 12px;
  line-height: 1.5;
}
.table-wrap {
  flex: none;
  overflow-x: auto;
}
.stages {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.stages th {
  padding: 6px 8px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
  text-align: right;
  white-space: nowrap;
}
.stages td {
  padding: 6px 8px;
  border-bottom: 1px solid rgb(58 67 102 / 0.5);
  text-align: right;
}
.stages th:first-child,
.stages td:first-child {
  text-align: left;
}
.stage {
  white-space: nowrap;
}
.meso-col {
  width: 36%;
}
td.meso-col {
  position: relative;
}
.bar {
  position: absolute;
  top: 50%;
  left: 8px;
  max-width: calc(100% - 90px);
  height: 7px;
  background: var(--gold);
  border-radius: 4px;
  opacity: 0.7;
  translate: 0 -50%;
}
.meso {
  position: relative;
}
tr.hot td {
  background: rgb(242 193 78 / 0.09);
}
tr.hot td:first-child {
  box-shadow: inset 3px 0 0 var(--gold);
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.dim {
  color: var(--tip-line);
}
td.small {
  font-size: 12px;
  white-space: nowrap;
}
.days {
  display: grid;
  align-content: start;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.day {
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  background: rgb(255 255 255 / 0.02);
}
.day.open {
  border-color: var(--tip-line);
}
.day-head {
  display: grid;
  grid-template-columns: 14px minmax(92px, max-content) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.caret {
  color: var(--sub);
  transition: rotate var(--fast) ease;
}
.day.open .caret {
  rotate: 90deg;
}
.day-head b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.day-what {
  color: var(--sub);
}
.day-meso {
  color: var(--gold);
  font-variant-numeric: tabular-nums;
}
.events {
  display: grid;
  margin: 0 10px 8px 34px;
  padding: 0;
  border-left: 2px solid var(--panel-line);
  list-style: none;
}
/* 칸을 고정해 줄마다 위치가 같게 */
.event {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 70px 40px;
  align-items: center;
  gap: 10px;
  padding: 4px 12px;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.event time {
  color: var(--sub);
}
.tag {
  margin-left: 4px;
  padding: 0 6px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 11px;
}
.tag.protect {
  border-color: rgb(127 178 255 / 0.5);
  color: var(--api);
}
.tag.restore {
  border-color: rgb(255 138 122 / 0.5);
  color: var(--loss);
}
.tag.sale {
  border-color: rgb(242 193 78 / 0.5);
  color: var(--gold);
}
.cost {
  color: var(--tip-line);
  text-align: right;
}
.result {
  color: var(--sub);
  font-family: var(--f-title);
  text-align: right;
}
.event.up .result {
  color: var(--gain);
}
.event.boom .result {
  color: var(--loss);
}
.empty,
.note {
  margin: 0;
  font-size: 13px;
}
.empty {
  padding: 24px;
  text-align: center;
}
@media (max-width: 640px) {
  .head {
    flex-wrap: wrap;
  }
  .title {
    flex: 1;
  }
  .calc-link {
    width: 100%;
    margin-left: 0;
    text-align: center;
  }
  /* 실패 칸과 메소 막대를 빼서 표가 한 화면에 들어오게 */
  .stages {
    font-size: 12.5px;
  }
  .stages th,
  .stages td {
    padding: 6px 4px;
  }
  .stages th:nth-child(5),
  .stages td:nth-child(5),
  .bar {
    display: none;
  }
  .meso-col {
    width: auto;
  }
  td.small {
    font-size: 11px;
  }
  .day-head {
    grid-template-columns: 12px minmax(72px, max-content) minmax(0, 1fr) auto;
    min-height: 40px;
    gap: 6px;
    font-size: 12px;
  }
  .events {
    margin-left: 12px;
  }
  .event {
    grid-template-columns: 58px minmax(0, 1fr) 54px 32px;
    gap: 6px;
    padding: 4px 8px;
  }
}
</style>
