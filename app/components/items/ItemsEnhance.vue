<script setup lang="ts">
import type { CharacterBrief, EnhanceEvent, EnhanceKind, EnhanceResponse } from '#shared/types'

const KIND_LABELS: Record<EnhanceKind | 'all', string> = { all: '전체', starforce: '스타포스', cube: '큐브', potential: '재설정' }
const POLL_MS = 4000

const { me } = await useMe()
const characters = ref<CharacterBrief[]>([])
const ocid = ref<string | null>(me.value?.main?.ocid ?? null)
const failure = ref('')
const selected = ref<string | null>(null)
const kind = ref<EnhanceKind | 'all'>('all')

// 모아 두는 기록이 최근 반년이라 6개월은 날짜를 걸지 않고 전부 본다
const PERIODS = [
  { label: '6개월', days: null },
  { label: '3개월', days: 90 },
  { label: '1개월', days: 30 },
  { label: '2주', days: 14 },
  { label: '1주', days: 7 },
  { label: '오늘', days: 1 },
] as const
const days = ref<number | null>(null)
const from = computed(() => (days.value ? addDays(kstToday(), -(days.value - 1)) : undefined))

onMounted(async () => {
  characters.value = await $fetch<CharacterBrief[]>('/api/me/characters').catch((error) => {
    failure.value = errorMessage(error)
    return []
  })
  ocid.value ??= characters.value[0]?.ocid ?? null
})

// 넥슨 기록을 처음 모을 땐 시간이 걸려 화면을 먼저 띄우고 뒤에서 받는다
const { data, pending, error, refresh } = useLazyFetch<EnhanceResponse>(() => `/api/enhance/${ocid.value}`, {
  query: computed(() => ({ from: from.value })),
  server: false,
  immediate: false,
  watch: false,
})
watch(ocid, (value) => {
  selected.value = null
  if (value) refresh()
}, { immediate: true })
watch(days, () => {
  if (ocid.value) refresh()
})

// 아직 모으는 중이면 이어서 모으도록 몇 초마다 다시 부른다
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => data.value?.syncing, (syncing) => {
  clearTimeout(timer)
  if (syncing) timer = setTimeout(refresh, POLL_MS)
})
onBeforeUnmount(() => clearTimeout(timer))

const item = computed(() => data.value?.items.find(i => i.name === selected.value) ?? null)
const events = computed(() => (item.value?.events ?? []).filter(e => kind.value === 'all' || e.kind === kind.value))

watch(() => data.value?.items, (items) => {
  if (items && !items.some(i => i.name === selected.value)) selected.value = items.find(i => i.events.length)?.name ?? items[0]?.name ?? null
})

const formatAt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function starText(e: EnhanceEvent) {
  if (e.destroyed) return `${e.beforeStar}성 파괴`
  if (e.beforeStar === null || e.afterStar === null) return e.success ? '성공' : '실패'
  return `${e.beforeStar}성 → ${e.afterStar}성`
}
</script>

<template>
  <div class="enhance">
    <div class="top">
      <label class="pick">
        <span class="sr-only">캐릭터</span>
        <select v-model="ocid" class="field-input">
          <option v-for="c in characters" :key="c.ocid" :value="c.ocid">{{ c.name }} · {{ c.job }} · LV.{{ c.level }}</option>
        </select>
      </label>
      <div class="period" role="group" aria-label="기간">
        <button v-for="p in PERIODS" :key="p.label" type="button" class="kind" :aria-pressed="days === p.days" @click="days = p.days">{{ p.label }}</button>
      </div>
      <span v-if="data?.syncing" class="sync">넥슨 기록 모으는 중<template v-if="data.syncedFrom"> · {{ formatMonthDay(data.syncedFrom) }}까지</template></span>
      <span class="muted note">기록에는 아이템 고유 번호가 없어서 같은 이름의 예전 장비 기록이 섞일 수 있어요</span>
    </div>
    <p v-if="failure || error" class="form-error">{{ failure || errorMessage(error) }}</p>

    <div v-if="!data && pending" class="loading">
      <span class="skeleton" />
      <p class="muted">장비와 강화 기록을 불러오는 중이에요…</p>
    </div>

    <div v-else-if="data" class="body">
      <ul class="items">
        <li v-for="i in data.items" :key="i.slot">
          <button type="button" class="item" :class="{ on: i.name === selected, quiet: !i.events.length }" @click="selected = i.name">
            <img :src="i.icon" alt="">
            <span class="item-text">
              <b class="ellipsis">{{ i.name }}</b>
              <small class="ellipsis">{{ i.slot }}<template v-if="i.starforce"> · ★{{ i.starforce }}</template><template v-if="i.potentialGrade"> · {{ i.potentialGrade }}</template></small>
            </span>
            <span class="counts">
              <span v-if="i.summary.starforce.attempts" class="sf">★{{ i.summary.starforce.attempts }}<b v-if="i.summary.starforce.destroy" class="loss"> 파괴{{ i.summary.starforce.destroy }}</b></span>
              <span v-if="i.summary.cubes" class="cube">큐브 {{ i.summary.cubes }}</span>
              <span v-if="i.summary.resets" class="reset">재설정 {{ i.summary.resets }}</span>
            </span>
          </button>
        </li>
      </ul>

      <section v-if="item" class="detail">
        <header class="detail-head">
          <img :src="item.icon" alt="">
          <div>
            <h3>{{ item.name }}</h3>
            <small class="muted">{{ item.slot }}<template v-if="item.starforce"> · ★{{ item.starforce }}</template><template v-if="item.potentialGrade"> · 잠재 {{ item.potentialGrade }}</template><template v-if="item.additionalGrade"> · 에디 {{ item.additionalGrade }}</template></small>
          </div>
        </header>
        <div class="stats">
          <div class="tile" style="--tone: var(--gold)">
            <span class="tile-label">스타포스 시도</span>
            <span class="tile-value">{{ item.summary.starforce.attempts }}</span>
            <span class="tile-label">성공 {{ item.summary.starforce.success }} · <span class="loss">파괴 {{ item.summary.starforce.destroy }}</span></span>
          </div>
          <div class="tile" style="--tone: var(--calc)">
            <span class="tile-label">큐브</span>
            <span class="tile-value">{{ item.summary.cubes }}</span>
          </div>
          <div class="tile" style="--tone: var(--api)">
            <span class="tile-label">잠재 재설정(메소)</span>
            <span class="tile-value">{{ item.summary.resets }}</span>
          </div>
        </div>
        <div class="kinds" role="tablist" aria-label="기록 종류">
          <button v-for="(label, k) in KIND_LABELS" :key="k" type="button" role="tab" class="kind" :aria-selected="kind === k" @click="kind = k">{{ label }}</button>
        </div>
        <ol class="events">
          <li v-for="(e, n) in events" :key="n" class="event" :class="[e.kind, { up: e.success, boom: e.destroyed }]" :style="e.kind !== 'starforce' && potentialGradeColor(e.grade) ? { borderLeftColor: potentialGradeColor(e.grade) } : undefined">
            <time>{{ formatAt(e.at) }}</time>
            <template v-if="e.kind === 'starforce'">
              <span class="what">{{ starText(e) }}</span>
              <span class="result">{{ e.destroyed ? '파괴' : e.success ? '성공' : '실패' }}</span>
            </template>
            <template v-else>
              <span class="what">
                <small>{{ e.tool }}</small>
                <span v-if="e.options.length" class="opts">{{ e.options.join(' / ') }}</span>
                <span v-if="e.addOptions.length" class="opts add">{{ e.addOptions.join(' / ') }}</span>
              </span>
              <span class="result">{{ e.success ? `${e.grade} 등급 상승` : e.grade }}</span>
            </template>
          </li>
          <li v-if="!events.length" class="muted empty">{{ data.syncing ? '아직 모으는 중이에요.' : days ? '이 기간엔 이 장비의 기록이 없어요.' : '이 장비의 기록이 없어요.' }}</li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.enhance {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}
.pick .field-input {
  min-height: 38px;
  min-width: 260px;
}
.sync {
  color: var(--gold);
  font-size: 13px;
}
.note {
  margin-left: auto;
  font-size: 12px;
}
.period {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.loading {
  display: grid;
  gap: 8px;
}
.loading .skeleton {
  height: 120px;
}
.body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.4fr);
  gap: 14px;
  min-height: 0;
}
.items {
  display: grid;
  align-content: start;
  gap: 4px;
  margin: 0;
  padding: 2px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  list-style: none;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 10px 5px 6px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--fast) ease, background var(--fast) ease;
}
.item:hover {
  border-color: var(--tip-line);
}
.item.on {
  background: rgb(242 193 78 / 0.1);
  border-color: var(--gold);
}
.item.quiet {
  opacity: 0.6;
}
.item img {
  flex: none;
  width: 30px;
  height: 30px;
  object-fit: contain;
  image-rendering: pixelated;
}
.item-text {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.3;
}
.item-text b {
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.item-text small {
  color: var(--sub);
  font-size: 11px;
}
.counts {
  display: flex;
  flex: none;
  gap: 6px;
  font-size: 12px;
}
.sf {
  color: var(--gold);
}
.cube {
  color: var(--calc);
}
.reset {
  color: var(--api);
}
.counts b {
  font-weight: 400;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 12px 14px;
  background: rgb(10 12 22 / 0.5);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.detail-head img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  image-rendering: pixelated;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 20px;
  font-weight: 400;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.kinds {
  display: flex;
  gap: 4px;
}
.kind {
  padding: 4px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 13px;
  cursor: pointer;
}
.kind[aria-selected="true"],
.kind[aria-pressed="true"] {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.events {
  display: grid;
  align-content: start;
  gap: 2px;
  min-height: 0;
  margin: 0;
  padding: 0 4px 0 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  list-style: none;
}
.event {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border-left: 3px solid var(--panel-line);
  border-radius: 4px;
  font-size: 13px;
}
.event:nth-child(odd) {
  background: rgb(255 255 255 / 0.02);
}
.event.starforce {
  border-left-color: var(--gold);
}
.event.cube {
  border-left-color: var(--calc);
}
.event.potential {
  border-left-color: var(--api);
}
time {
  color: var(--sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.what {
  display: grid;
  min-width: 0;
}
.what small {
  color: var(--sub);
  font-size: 11px;
}
.opts {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opts.add {
  color: var(--sub);
}
.result {
  color: var(--sub);
  font-family: var(--f-title);
  white-space: nowrap;
}
.event.up .result {
  color: var(--gain);
}
.event.boom .result {
  color: var(--loss);
}
.empty {
  padding: 16px;
  text-align: center;
}
@media (max-width: 900px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
