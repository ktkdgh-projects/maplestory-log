<script setup lang="ts">
import type { CharacterBrief, ReviewResponse, SundayNotice, SundayResponse } from '#shared/types'
import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

useHead({ title: '강화 결산 · 메이플스토리로그' })

const { me } = await useMe()
const route = useRoute()
const today = kstToday()
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MODES = [{ key: 'day', label: '하루' }, { key: 'sunday', label: '썬데이' }, { key: 'week', label: '이번 주' }] as const
type Mode = typeof MODES[number]['key']

const queryText = (key: string) => (typeof route.query[key] === 'string' ? route.query[key] as string : '')
const characters = ref<CharacterBrief[]>([])
const ocid = ref<string | null>(queryText('ocid') || me.value?.main?.ocid || null)
const mode = ref<Mode>(queryText('mode') === 'sunday' ? 'sunday' : queryText('mode') === 'week' ? 'week' : 'day')
const date = ref(/^\d{4}-\d{2}-\d{2}$/.test(queryText('date')) && queryText('date') <= today ? queryText('date') : today)
// 날짜를 직접 골랐으면 "오늘 기록이 없으면 가장 최근 날로" 넘기지 않는다
const picked = ref(!!queryText('date'))
const sundays = ref<SundayNotice[]>([])

onMounted(async () => {
  if (!me.value) return
  const [list, sunday] = await Promise.all([
    $fetch<CharacterBrief[]>('/api/me/characters').catch(() => []),
    $fetch<SundayResponse>('/api/sunday').catch(() => null),
  ])
  characters.value = list
  ocid.value ??= list[0]?.ocid ?? null
  sundays.value = [sunday?.current, ...(sunday?.history ?? [])].filter((n): n is SundayNotice => !!n)
})

// 날짜 다루기: 한국 날짜 문자열, 주는 월요일부터
const weekdayOf = (d: string) => new Date(`${d}T12:00:00+09:00`).getUTCDay()
const mondayOf = (d: string) => addDays(d, -((weekdayOf(d) + 6) % 7))
const minDate = (a: string, b: string) => (a < b ? a : b)
const dayLabel = (d: string) => `${formatMonthDay(d)} (${WEEKDAYS[weekdayOf(d)]})`
const sundayOn = (d: string) => sundays.value.find(n => kstDateOf(n.start) <= d && d <= kstDateOf(n.end)) ?? null
// 고른 날이 썬데이가 아니면 그 전 가장 가까운 썬데이
const sundayNear = computed(() => sundayOn(date.value) ?? sundays.value.filter(n => kstDateOf(n.start) <= date.value).sort((a, b) => b.start.localeCompare(a.start))[0] ?? null)

const range = computed(() => {
  if (mode.value === 'week') {
    const from = mondayOf(date.value)
    return { from, to: minDate(addDays(from, 6), today) }
  }
  if (mode.value === 'sunday' && sundayNear.value) return { from: kstDateOf(sundayNear.value.start), to: minDate(kstDateOf(sundayNear.value.end), today) }
  return { from: date.value, to: date.value }
})
const rangeLabel = computed(() => {
  const { from, to } = range.value
  if (from === to) return from === today ? '오늘' : dayLabel(from)
  return `${formatMonthDay(from)} ~ ${formatMonthDay(to)}`
})
const week = computed(() => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date.value), i)))
// 주가 두 달에 걸치면 "8~9월"
const weekMonth = computed(() => {
  const [a, b] = [Number(week.value[0]!.slice(5, 7)), Number(week.value[6]!.slice(5, 7))]
  return a === b ? `${a}월` : `${a}~${b}월`
})
// 달력에 초록 테두리로 짚을 썬데이 날들
const sundayDays = computed(() => sundays.value.flatMap((n) => {
  const days: string[] = []
  for (let d = kstDateOf(n.start); d <= kstDateOf(n.end); d = addDays(d, 1)) days.push(d)
  return days
}))
function pickDay(d: string) {
  picked.value = true
  date.value = d
  mode.value = 'day'
}
function shiftWeek(weeks: number) {
  picked.value = true
  date.value = minDate(addDays(date.value, weeks * 7), today)
}

// 기록 받기. 처음 열었을 때 오늘 기록이 없으면 가장 최근 기록 날로 넘긴다(넘기는 동안은 스켈레톤)
const data = shallowRef<ReviewResponse | null>(null)
const recordDays = ref<string[]>([])
const loading = ref(false)
const failure = ref('')
let loadSeq = 0
async function load() {
  if (!ocid.value) return
  const seq = ++loadSeq
  loading.value = true
  failure.value = ''
  try {
    const result = await $fetch<ReviewResponse>(`/api/review/${ocid.value}`, { query: range.value })
    if (seq !== loadSeq) return
    recordDays.value = result.recordDays
    const empty = !result.starforce.length && !result.potential.length
    if (empty && !picked.value && mode.value === 'day' && result.recordDays[0] && result.recordDays[0] !== date.value) {
      picked.value = true
      date.value = result.recordDays[0]
      return
    }
    data.value = result
    open.value = new Set(firstKeys(result))
    tab.value = result.starforce.length ? 'starforce' : 'potential'
  }
  catch (error) {
    if (seq === loadSeq) failure.value = errorMessage(error)
  }
  finally {
    if (seq === loadSeq) loading.value = false
  }
}
onMounted(() => watch([ocid, range], load, { immediate: true }))
watch(ocid, () => {
  picked.value = false
  date.value = today
})

// 처음엔 탭마다 가장 많이 쓴 장비 하나씩 펼쳐 둔다
const sfKey = reviewStarforceKey
const potKey = reviewPotentialKey
function firstKeys(r: ReviewResponse) {
  const sf = [...r.starforce].sort((x, y) => starforceActual(y) - starforceActual(x))[0]
  const pot = [...r.potential].sort((x, y) => y.meso - x.meso)[0]
  return [sf && sfKey(sf), pot && potKey(pot)].filter((k): k is string => !!k)
}
const tab = ref<'starforce' | 'potential'>('starforce')
const open = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}

const mvp = computed(() => me.value?.mvpDiscount ?? 0)
const levelPick = ref<Record<string, number>>({})
const { starforceList, potentialList, levelOf, plans, potReviews, potLoading, ready, totals } = useReviewCompute(data, mvp, levelPick)
const hasStarforce = computed(() => starforceList.value.length > 0)
const hasPotential = computed(() => potentialList.value.length > 0)
const empty = computed(() => !!data.value && !hasStarforce.value && !hasPotential.value)
// 기록 없는 날이면 앞뒤로 가장 가까운 기록 날
const nearestDay = computed(() => {
  const gap = (d: string) => Math.abs(Date.parse(d) - Date.parse(range.value.from))
  return [...recordDays.value].sort((a, b) => gap(a) - gap(b))[0] ?? null
})
const sundayInRange = computed(() => sundays.value.find(n => kstDateOf(n.start) <= range.value.to && kstDateOf(n.end) >= range.value.from) ?? null)
const sundayEffectText = computed(() => (sundayInRange.value?.effects ?? []).map(e => SUNDAY_STARFORCE_EFFECTS.find(x => x.key === e)?.label ?? e).join(' · '))
const cubeText = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}개`
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.review" />

  <GameWindow v-else title="강화 결산" sub="기록과 기대값 비교" accent="green" class="review-win">
    <div class="review">
      <div class="toolbar">
        <label class="pick">
          <span class="sr-only">캐릭터</span>
          <select v-model="ocid" class="field-input">
            <option v-for="c in characters" :key="c.ocid" :value="c.ocid">{{ c.name }} · {{ c.job }} · LV.{{ c.level }}</option>
          </select>
        </label>
        <!-- 한 주를 한 줄 달력으로. 고른 기간(이번 주·썬데이)에 드는 날은 옅게 이어 칠한다 -->
        <div class="week" role="group" aria-label="날짜">
          <button type="button" class="nav" aria-label="지난주" @click="shiftWeek(-1)">‹</button>
          <span class="month">{{ weekMonth }}</span>
          <div class="days">
            <button
              v-for="d in week"
              :key="d"
              type="button"
              class="day"
              :class="{ has: recordDays.includes(d), sun: !!sundayOn(d), today: d === today, inrange: mode !== 'day' && d >= range.from && d <= range.to, weekend: [0, 6].includes(weekdayOf(d)) }"
              :aria-pressed="mode === 'day' && date === d"
              :disabled="d > today"
              :title="`${dayLabel(d)}${recordDays.includes(d) ? ' · 강화 기록 있음' : ''}${sundayOn(d) ? ' · 썬데이' : ''}`"
              @click="pickDay(d)"
            >
              <small>{{ d === today ? '오늘' : WEEKDAYS[weekdayOf(d)] }}</small>
              <b>{{ Number(d.slice(8)) }}</b>
              <i aria-hidden="true" />
            </button>
          </div>
          <button type="button" class="nav" aria-label="다음 주" :disabled="mondayOf(date) >= mondayOf(today)" @click="shiftWeek(1)">›</button>
          <DatePicker :model-value="date" class="other" :max="today" :marks="recordDays" :accents="sundayDays" placeholder="달력" quiet @update:model-value="(d: string) => d && pickDay(d)" />
        </div>
        <div class="seg" role="group" aria-label="기간">
          <button v-for="m in MODES" :key="m.key" type="button" :aria-pressed="mode === m.key" :disabled="m.key === 'sunday' && !sundayNear" @click="mode = m.key">{{ m.label }}</button>
        </div>
      </div>

      <p v-if="failure" class="form-error">{{ failure }}</p>

      <!-- 종합: 탭을 바꾸거나 장비를 펼쳐도 그대로 -->
      <section class="verdict" :class="{ loss: totals.meso.gain < 0 && ready }">
        <template v-if="data && !loading && empty">
          <p class="say">{{ rangeLabel }}은 강화 기록이 없어요.</p>
          <div class="side">
            <button v-if="nearestDay" type="button" class="near" @click="pickDay(nearestDay)">가장 가까운 기록 · {{ dayLabel(nearestDay) }} →</button>
          </div>
        </template>
        <template v-else-if="data && !loading && ready">
          <p class="say">
            <template v-if="totals.meso.expected">
              {{ rangeLabel }} 강화로 <em>{{ formatShortNumber(Math.abs(totals.meso.gain)) }} {{ totals.meso.gain >= 0 ? '이득' : '손해' }}</em> 봤어요.<br>
              <span class="s2">평균이면 <b>{{ formatShortNumber(totals.meso.expected) }}</b> 들 강화를 <b>{{ formatShortNumber(totals.meso.actual) }}</b>에 끝냈어요.<template v-if="totals.cube.used"> 큐브는 평균보다 <b>{{ cubeText(totals.cube.gain) }}</b> {{ totals.cube.gain >= 0 ? '덜' : '더' }} 썼어요.</template></span>
            </template>
            <template v-else-if="totals.cube.used">
              {{ rangeLabel }} 큐브를 평균보다 <em>{{ cubeText(totals.cube.gain) }} {{ totals.cube.gain >= 0 ? '덜' : '더' }}</em> 썼어요.
            </template>
            <template v-else>
              {{ rangeLabel }} 강화 기록이에요.<br><span class="s2">비교할 수 있는 결과가 없어 쓴 만큼만 보여 드려요.</span>
            </template>
          </p>
          <div class="side">
            <span v-if="sundayInRange" class="sunday"><i aria-hidden="true" />{{ formatMonthDay(kstDateOf(sundayInRange.start)) }} 썬데이{{ sundayEffectText ? ` · ${sundayEffectText}` : '' }}</span>
            <div class="splits">
              <span v-if="hasStarforce">스타포스 {{ starforceList.length }}부위<b :class="totals.sf.gain >= 0 ? 'gain' : 'loss'">{{ totals.sf.count ? formatSigned(totals.sf.gain, formatShortNumber) : '-' }}</b></span>
              <span v-if="hasPotential">잠재 {{ potentialList.length }}부위<b :class="(totals.pot.expected ? totals.pot.gain : totals.cube.gain) >= 0 ? 'gain' : 'loss'">{{ totals.pot.expected ? formatSigned(totals.pot.gain, formatShortNumber) : totals.cube.used ? `${totals.cube.gain >= 0 ? '+' : '−'}${cubeText(totals.cube.gain)}` : '-' }}</b></span>
            </div>
          </div>
        </template>
        <template v-else>
          <span class="skeleton say-skeleton" />
          <span class="skeleton side-skeleton" />
        </template>
      </section>

      <template v-if="data && !loading && !empty">
        <div v-if="hasStarforce && hasPotential" class="tabs" role="tablist">
          <button type="button" role="tab" class="tab" :aria-selected="tab === 'starforce'" @click="tab = 'starforce'">
            스타포스 <small>{{ starforceList.length }}부위<template v-if="totals.sf.count"> · <span :class="totals.sf.gain >= 0 ? 'gain' : 'loss'">{{ formatSigned(totals.sf.gain, formatShortNumber) }}</span></template></small>
          </button>
          <button type="button" role="tab" class="tab" :aria-selected="tab === 'potential'" @click="tab = 'potential'">
            잠재 <small>{{ potentialList.length }}부위<template v-if="totals.pot.expected"> · <span :class="totals.pot.gain >= 0 ? 'gain' : 'loss'">{{ formatSigned(totals.pot.gain, formatShortNumber) }}</span></template></small>
          </button>
        </div>

        <div v-if="hasStarforce && (tab === 'starforce' || !hasPotential)" class="list">
          <ReviewStarforceRow
            v-for="s in starforceList"
            :key="sfKey(s)"
            :s="s"
            :plan="plans[sfKey(s)] ?? null"
            :level="levelOf(s)"
            :open="open.has(sfKey(s))"
            :character="data.character.name"
            @toggle="toggle(sfKey(s))"
            @level="(l: number) => (levelPick = { ...levelPick, [s.item]: l })"
          />
        </div>
        <div v-if="hasPotential && (tab === 'potential' || !hasStarforce)" class="list">
          <ReviewPotentialRow
            v-for="p in potentialList"
            :key="potKey(p)"
            :p="p"
            :review="potReviews[potKey(p)] ?? null"
            :loading="potLoading"
            :open="open.has(potKey(p))"
            :character="data.character.name"
            @toggle="toggle(potKey(p))"
          />
        </div>
      </template>
      <div v-else-if="!empty" class="list">
        <span v-for="n in 3" :key="n" class="skeleton row-skeleton" />
      </div>

      <p class="foot muted">스타포스는 계산기와 같은 확률·비용(위키 비용식 포함)으로 1만 번 해 본 결과와 비교해요. 쓴 메소는 이벤트·MVP 할인과 파괴 뒤 복구 메소를 넣고, 노작값은 빼요. 장비 결산에 그 날짜로 적은 값이 있으면 그 값(수기)으로 비교해요.</p>
    </div>
  </GameWindow>
</template>

<style scoped>
/* 달력 팝업이 창 밖으로 나와도 잘리지 않게 */
.review-win {
  overflow: visible;
}
.review-win :deep(.win-t) {
  border-radius: 10px 10px 0 0;
}
.review {
  display: grid;
  gap: 14px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.pick .field-input {
  min-height: 38px;
  width: 240px;
}
/* 한 줄 주간 달력: [‹ 8월 | 월 화 수 목 금 토 일 | › 달력]. 칸 사이 선으로 이어 한 덩어리로 보이게 */
.week {
  display: flex;
  align-items: stretch;
  height: 44px;
  overflow: visible;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.nav {
  width: 28px;
  background: none;
  border: 0;
  color: var(--sub);
  font-size: 18px;
  cursor: pointer;
}
.nav:hover:not(:disabled) {
  color: var(--gold);
}
.nav:disabled {
  opacity: 0.3;
  cursor: default;
}
.month {
  display: grid;
  place-items: center;
  min-width: 44px;
  padding: 0 4px;
  border-right: 1px solid var(--panel-line);
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  white-space: nowrap;
}
.days {
  display: grid;
  grid-template-columns: repeat(7, 40px);
}
.day {
  position: relative;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 1px;
  padding: 0;
  background: none;
  border: 0;
  border-right: 1px solid rgb(58 67 102 / 0.6);
  color: var(--sub);
  font: inherit;
  line-height: 1.1;
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease;
}
.day small {
  font-size: 10.5px;
}
.day.weekend small {
  color: var(--api);
}
.day.today small {
  color: var(--gold);
  font-weight: 700;
}
.day b {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
/* 기록 있는 날 점 */
.day i {
  width: 4px;
  height: 4px;
  background: transparent;
  border-radius: 50%;
}
.day.has i {
  background: var(--gold);
}
/* 썬데이 날은 위에 초록 띠 */
.day.sun::before {
  content: "";
  position: absolute;
  top: 0;
  left: 6px;
  right: 6px;
  height: 2px;
  background: var(--gain);
  border-radius: 0 0 2px 2px;
  box-shadow: 0 0 6px var(--gain);
}
.day.inrange {
  background: rgb(242 193 78 / 0.07);
}
.day:hover:not(:disabled) {
  background: rgb(255 255 255 / 0.05);
}
.day[aria-pressed="true"] {
  background: var(--gold);
}
.day[aria-pressed="true"] small,
.day[aria-pressed="true"] b {
  color: var(--on-gold);
}
.day[aria-pressed="true"] i {
  background: var(--on-gold);
}
.day:disabled {
  cursor: default;
}
.day:disabled b,
.day:disabled small {
  opacity: 0.3;
}
.other {
  border-left: 1px solid var(--panel-line);
}
.other :deep(.trigger) {
  height: 100%;
  border-radius: 0 9px 9px 0;
}
.seg {
  display: inline-flex;
  margin-left: auto;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.seg button {
  padding: 8px 12px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.seg button:last-child {
  border-right: 0;
}
.seg button[aria-pressed="true"] {
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.seg button:disabled {
  opacity: 0.35;
  cursor: default;
}
/* 종합 한 문장. 높이를 잡아 둬서 계산이 끝나도 아래가 밀리지 않는다 */
.verdict {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px 24px;
  min-height: 112px;
  padding: 16px 20px;
  background: linear-gradient(100deg, rgb(127 217 154 / 0.12), var(--panel) 55%);
  border: 1px solid rgb(127 217 154 / 0.45);
  border-radius: 12px;
}
.verdict.loss {
  background: linear-gradient(100deg, rgb(255 138 122 / 0.12), var(--panel) 55%);
  border-color: rgb(255 138 122 / 0.45);
}
.say {
  margin: 0;
  font-family: var(--f-title);
  font-size: 23px;
  line-height: 1.45;
}
.say em {
  color: var(--gain);
  font-size: 32px;
  font-style: normal;
}
.verdict.loss .say em {
  color: var(--loss);
}
.s2 {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 14px;
}
.s2 b {
  color: var(--text);
}
.side {
  display: grid;
  justify-items: end;
  gap: 8px;
}
.sunday {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid rgb(127 217 154 / 0.5);
  border-radius: 999px;
  color: var(--gain);
  font-size: 12px;
  white-space: nowrap;
}
.sunday i {
  width: 7px;
  height: 7px;
  background: var(--gain);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--gain);
}
.splits {
  display: flex;
  gap: 8px;
}
.splits span {
  display: grid;
  padding: 4px 12px;
  background: rgb(255 255 255 / 0.03);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 11.5px;
  text-align: right;
}
.splits b {
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.near {
  padding: 6px 12px;
  background: none;
  border: 1px solid rgb(127 217 154 / 0.55);
  border-radius: 8px;
  color: var(--gain);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.say-skeleton {
  height: 60px;
}
.side-skeleton {
  width: 220px;
  height: 52px;
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--panel-line);
}
.tab {
  margin-bottom: -1px;
  padding: 8px 16px;
  background: none;
  border: 1px solid transparent;
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 17px;
  cursor: pointer;
}
.tab small {
  margin-left: 6px;
  font-family: var(--f-body);
  font-size: 12px;
}
.tab[aria-selected="true"] {
  background: var(--panel);
  border-color: var(--panel-line);
  color: var(--text);
}
.list {
  display: grid;
  gap: 8px;
}
.row-skeleton {
  height: 58px;
  border-radius: 12px;
}
.foot {
  margin: 0;
  font-size: 12px;
}
@media (max-width: 760px) {
  .verdict {
    grid-template-columns: 1fr;
  }
  .side {
    justify-items: start;
  }
  .seg {
    margin-left: 0;
  }
  .pick .field-input {
    width: 100%;
  }
}
</style>
