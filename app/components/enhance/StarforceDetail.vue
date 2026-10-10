<script setup lang="ts">
import type { EnhanceEvent, EnhanceItem, StarforceDetail, StarforceStage } from '#shared/types'
import { starRates } from '#shared/data/starforce'

const props = defineProps<{ ocid: string, item: EnhanceItem, from?: string }>()

// 한 번 받은 장비·기간은 다시 고를 때 바로 보여준다. 시도 수가 바뀌면(새 기록) 다시 받는다
const cache = useState<Record<string, StarforceDetail>>('starforce-detail', () => ({}))
const key = computed(() => `${props.ocid}|${props.item.name}|${props.from ?? ''}|${props.item.summary.starforce.attempts}`)
const detail = computed(() => cache.value[key.value] ?? null)
const loading = ref(false)
const failure = ref('')
watch(key, async (k) => {
  if (cache.value[k] || !props.item.summary.starforce.attempts) return
  loading.value = true
  failure.value = ''
  try {
    cache.value[k] = await $fetch<StarforceDetail>(`/api/enhance/${props.ocid}/starforce`, { query: { item: props.item.name, level: props.item.level ?? undefined, from: props.from } })
  }
  catch (e) {
    failure.value = errorMessage(e)
  }
  finally {
    loading.value = false
  }
}, { immediate: true })

const stages = computed(() => detail.value?.stages ?? [])

// 지금 확률로 그만큼 성공하려면 평균 몇 번 눌러야 했는지. 실제가 20% 넘게 많으면 불운, 적으면 행운
function luckOf(s: StarforceStage) {
  const expected = s.success / starRates(s.star).success
  if (!s.success) return { text: `성공 전 · ${Math.round(1 / starRates(s.star).success)}번`, tone: s.attempts > 1 / starRates(s.star).success * 1.2 ? 'loss' : '' }
  const ratio = s.attempts / expected
  return { text: `${Math.round(expected)}번`, tone: ratio > 1.2 ? 'loss' : ratio < 0.8 ? 'gain' : '' }
}
const maxMeso = computed(() => Math.max(0, ...stages.value.map(s => s.meso)))
const firstStar = computed(() => stages.value[0]?.star ?? null)

// 맨 위 날짜만 펼쳐 두고 나머지는 접는다
const open = ref(new Set<string>())
watch(detail, (d) => {
  open.value = new Set(d?.days[0] ? [d.days[0].date] : [])
}, { immediate: true })
function toggle(date: string) {
  const next = new Set(open.value)
  if (!next.delete(date)) next.add(date)
  open.value = next
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
// 한국 정오는 UTC로도 같은 날이라 UTC 요일이 곧 한국 요일이다
const dayLabel = (date: string) => `${formatMonthDay(date)} (${WEEKDAYS[new Date(`${date}T12:00:00+09:00`).getUTCDay()]})`
// 1초에 한 번씩 누르는 일이 흔해 초까지 보여준다
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const resultOf = (e: EnhanceEvent) => (e.destroyed ? '파괴' : e.success ? '성공' : '실패')
const mesoText = (meso: number) => (meso ? formatShortNumber(meso) : '-')

const calcLink = computed(() => ({
  path: '/calc/starforce',
  query: { level: props.item.level ?? undefined, from: props.item.starforce, to: props.item.starforce + 1 },
}))
</script>

<template>
  <section class="detail">
    <header class="head">
      <img :src="item.icon" alt="">
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
      <NuxtLink :to="calcLink" class="calc-link">★{{ item.starforce }} → {{ item.starforce + 1 }} 기대값 보기 →</NuxtLink>
    </header>

    <p v-if="failure" class="form-error">{{ failure }}</p>
    <p v-if="!item.summary.starforce.attempts" class="muted empty">이 기간엔 이 장비를 강화한 기록이 없어요.</p>
    <div v-else-if="!detail" class="skeleton block" />
    <template v-else>
      <div class="table-wrap">
        <table class="stages">
          <thead>
            <tr><th>구간</th><th>시도</th><th title="지금 확률로 이만큼 성공하려면 평균 몇 번 눌러야 하는지. 빨강은 평균보다 많이(불운), 초록은 적게(행운) 누른 것">평균이면</th><th>성공</th><th>실패</th><th>파괴</th><th title="파괴방지를 쓴 시도">방지</th><th class="meso-col">쓴 메소</th></tr>
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

      <ol class="days">
        <li v-for="d in detail.days" :key="d.date" class="day" :class="{ open: open.has(d.date) }">
          <button type="button" class="day-head" :aria-expanded="open.has(d.date)" @click="toggle(d.date)">
            <span class="caret" aria-hidden="true">▸</span>
            <b>{{ dayLabel(d.date) }}</b>
            <span class="day-what">
              <template v-if="d.fromStar !== null && d.toStar !== null"><span class="star">★</span>{{ d.fromStar }} → <span class="star">★</span>{{ d.toStar }} · </template>{{ d.attempts }}번<template v-if="d.destroy"> · <span class="loss">파괴 {{ d.destroy }}</span></template>
            </span>
            <span class="day-meso">{{ mesoText(d.meso) }}</span>
          </button>
          <ol v-if="open.has(d.date)" class="events">
            <li v-for="(e, n) in d.events" :key="n" class="event" :class="{ up: e.success, boom: e.destroyed }">
              <time>{{ timeOf(e.at) }}</time>
              <span class="what">
                <span class="star">★</span>{{ e.beforeStar }} → {{ e.beforeStar === null ? '' : e.beforeStar + 1 }}
                <span v-if="e.protect" class="tag protect">방지</span>
                <span v-if="e.eventDiscount" class="tag event">이벤트 {{ Math.round(e.eventDiscount * 100) }}%</span>
              </span>
              <span class="cost">{{ e.meso ? formatShortNumber(e.meso) : '' }}</span>
              <span class="result">{{ resultOf(e) }}</span>
            </li>
          </ol>
        </li>
      </ol>
      <p v-if="detail.truncated" class="muted note">기록이 많아 오래된 날은 잘렸어요. 기간을 줄이면 다 보여요.</p>
    </template>
    <p v-if="loading && detail" class="muted note">새 기록을 받는 중이에요…</p>
  </section>
</template>

<style scoped>
.detail {
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
.block {
  height: 180px;
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
/* 쓴 메소는 막대로 비교하고 숫자는 막대 오른쪽 끝에 */
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
  grid-template-columns: 14px 92px minmax(0, 1fr) auto;
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
/* 시각 · 구간 · 메소 · 결과. 칸을 고정해 줄마다 위치가 같게 */
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
.tag.event {
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
/* 좁은 화면은 버튼을 아래 줄로 내리고 표는 옆으로 밀어 본다 */
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
  .stages {
    min-width: 520px;
  }
  .day-head {
    grid-template-columns: 12px 72px minmax(0, 1fr) auto;
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
