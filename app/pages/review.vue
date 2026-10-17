<script setup lang="ts">
import type { CharacterBrief, ReviewResponse, SundayNotice, SundayResponse } from '#shared/types'
import { useKstToday } from '~/composables/useEnhanceRecords'
import { starforceActual } from '#shared/calc/review'

useHead({ title: '강화 결산 · 메이플스토리로그' })

const { me } = await useMe()
const route = useRoute()
// 켜 둔 채 자정이 지나면 오늘도 바뀐다
const today = useKstToday()
type Mode = 'day' | 'sunday' | 'week'

const characters = ref<CharacterBrief[]>([])
const charactersFailed = ref(false)
const charactersLoaded = ref(false)
const ocid = ref<string | null>(queryText(route.query, 'ocid') || me.value?.main?.ocid || null)
const queryMode = queryText(route.query, 'mode')
const mode = ref<Mode>(queryMode === 'sunday' ? 'sunday' : queryMode === 'week' ? 'week' : 'day')
const date = ref(queryDate(route.query, today.value) ?? today.value)
// 날짜를 직접 골랐으면 "오늘 기록이 없으면 가장 최근 날로" 넘기지 않는다
const picked = ref(!!queryText(route.query, 'date'))
const sundays = ref<SundayNotice[]>([])

async function loadCharacters() {
  charactersFailed.value = false
  const list = await $fetch<CharacterBrief[]>('/api/me/characters').catch(() => {
    charactersFailed.value = true
    return []
  })
  characters.value = list
  charactersLoaded.value = true
  ocid.value ??= list[0]?.ocid ?? null
}
onMounted(async () => {
  if (!me.value) return
  const [, sunday] = await Promise.all([
    loadCharacters(),
    $fetch<SundayResponse>('/api/sunday').catch(() => null),
  ])
  sundays.value = [sunday?.current, ...(sunday?.history ?? [])].filter((n): n is SundayNotice => !!n)
})

// 주는 월요일부터 센다
const mondayOf = (d: string) => addDays(d, -((kstWeekday(d) + 6) % 7))
const minDate = (a: string, b: string) => (a < b ? a : b)
const sundayOn = (d: string) => sundays.value.find(n => kstDateOf(n.start) <= d && d <= kstDateOf(n.end)) ?? null
// 고른 날이 썬데이가 아니면 그 전 가장 가까운 썬데이
const sundayNear = computed(() => sundayOn(date.value) ?? sundays.value.filter(n => kstDateOf(n.start) <= date.value).sort((a, b) => b.start.localeCompare(a.start))[0] ?? null)

const range = computed(() => {
  if (mode.value === 'week') {
    const from = mondayOf(date.value)
    return { from, to: minDate(addDays(from, 6), today.value) }
  }
  if (mode.value === 'sunday' && sundayNear.value) return { from: kstDateOf(sundayNear.value.start), to: minDate(kstDateOf(sundayNear.value.end), today.value) }
  return { from: date.value, to: date.value }
})
const rangeLabel = computed(() => {
  const { from, to } = range.value
  if (from === to) return from === today.value ? '오늘' : formatDayWeek(from)
  return `${formatDay(from)} ~ ${formatDay(to)}`
})
// 여러 날 합을 한 날에 몰아넣지 않게 하루를 볼 때만 장비 결산에 넣을 수 있다
const addDate = computed(() => (range.value.from === range.value.to ? range.value.from : null))
function pickDay(d: string) {
  picked.value = true
  date.value = d
  mode.value = 'day'
}
function shiftWeek(weeks: number) {
  picked.value = true
  date.value = minDate(addDays(date.value, weeks * 7), today.value)
}

// 처음 열었을 때 오늘 기록이 없으면 가장 최근 기록 날로 넘긴다(넘기는 동안은 스켈레톤)
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
// 캐릭터를 바꾸면 오늘부터 다시 본다. 날짜가 바뀌면 그 변화로 한 번만 다시 받는다
onMounted(() => watch([ocid, range], ([id], [prevId]) => {
  if (prevId !== undefined && id !== prevId) {
    picked.value = false
    if (date.value !== today.value) {
      date.value = today.value
      return
    }
  }
  load()
}, { immediate: true }))

const sfKey = reviewStarforceKey
const potKey = reviewPotentialKey
// 처음엔 탭마다 가장 많이 쓴 장비 하나씩 펼쳐 둔다
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

const levelPick = ref<Record<string, number>>({})
const { starforceList, potentialList, levelOf, plans, potReviews, potLoading, ready, totals } = useReviewCompute(data, levelPick)
const hasStarforce = computed(() => starforceList.value.length > 0)
const hasPotential = computed(() => potentialList.value.length > 0)
const empty = computed(() => !!data.value && !hasStarforce.value && !hasPotential.value)
// 캐릭터가 없거나 받기에 실패해 결과를 기다릴 게 없는 상태
const noCharacter = computed(() => charactersLoaded.value && !ocid.value)
const stuck = computed(() => noCharacter.value || (!!failure.value && !loading.value))
// 메소로 견줄 수 있으면 메소로, 큐브만 썼으면 큐브 개수로 이득·손해를 가린다
const lost = computed(() => ready.value && (totals.value.meso.expected ? totals.value.meso.gain < 0 : totals.value.cube.used && totals.value.cube.gain < 0))
// 기록 없는 날이면 앞뒤로 가장 가까운 기록 날
const nearestDay = computed(() => {
  const gap = (d: string) => Math.abs(Date.parse(d) - Date.parse(range.value.from))
  return [...recordDays.value].sort((a, b) => gap(a) - gap(b))[0] ?? null
})
const sundayInRange = computed(() => sundays.value.find(n => kstDateOf(n.start) <= range.value.to && kstDateOf(n.end) >= range.value.from) ?? null)
const verdictState = computed(() => {
  if (charactersFailed.value && !ocid.value) return 'charactersFailed'
  if (noCharacter.value) return 'noCharacter'
  if (failure.value && !loading.value) return 'failure'
  if (data.value && !loading.value && empty.value) return 'empty'
  if (data.value && !loading.value && ready.value) return 'ready'
  return 'loading'
})
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.review" />

  <GameWindow v-else title="강화 결산" sub="기록과 기대값 비교" accent="green" class="review-win">
    <div class="review">
      <ReviewToolbar
        v-model:ocid="ocid"
        v-model:mode="mode"
        :characters="characters"
        :date="date"
        :today="today"
        :record-days="recordDays"
        :sundays="sundays"
        :range="range"
        :can-sunday="!!sundayNear"
        @pick="pickDay"
        @shift="shiftWeek"
      />

      <ReviewVerdict
        :state="verdictState"
        :failure="failure"
        :range-label="rangeLabel"
        :nearest-day="nearestDay"
        :sunday-in-range="sundayInRange"
        :totals="totals"
        :starforce-count="starforceList.length"
        :potential-count="potentialList.length"
        :lost="lost"
        :stuck="stuck"
        @reload-characters="loadCharacters"
        @reload="load"
        @pick="pickDay"
      />

      <p v-if="data?.equipmentMissing && !loading && !stuck" class="muted note">넥슨 장비 정보를 받지 못해 부위·레벨을 모르는 장비가 있어요. 스타포스는 레벨을 골라 주면 계산해요.</p>

      <template v-if="data && !loading && !empty && !stuck">
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
            :character="s.character.name"
            :show-owner="!data.character"
            :ocid="s.character.ocid"
            :add-date="addDate"
            @toggle="toggle(sfKey(s))"
            @level="(l: number) => (levelPick = { ...levelPick, [reviewLevelKey(s)]: l })"
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
            :character="p.character.name"
            :show-owner="!data.character"
            :ocid="p.character.ocid"
            :add-date="addDate"
            @toggle="toggle(potKey(p))"
          />
        </div>
      </template>
      <div v-else-if="!empty && !stuck" class="list">
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
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
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
.note {
  margin: 0;
  font-size: 12.5px;
}
</style>
