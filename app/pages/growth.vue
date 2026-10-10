<script setup lang="ts">
import type { SnapshotsResponse, TrackedCharacter } from '#shared/types'

const RANGES = [7, 14, 30]
const VIEWS = [{ key: 'field', label: '필드' }, { key: 'table', label: '날짜별 표' }] as const
const POLL_MS = 3000

const { me } = await useMe()
const route = useRoute()
const range = ref(14)
const view = ref<typeof VIEWS[number]['key']>('field')
const ocid = ref(me.value?.main?.ocid ?? '')

// ?name=으로 들어오면 로그인 없이 그 캐릭터를 보고, 아니면 로그인한 사람의 추적 캐릭터를 본다
const searchName = computed(() => (typeof route.query.name === 'string' ? route.query.name.trim() : ''))
const own = computed(() => !searchName.value && !!me.value?.main)

// 기록 요청을 먼저 보내 두고 캐릭터 목록을 기다려야 둘이 차례로 쌓이지 않는다
const { getCachedData, revalidate } = useRevisitCache()
const { data, error, refresh } = useFetch<SnapshotsResponse>(() => (searchName.value ? '/api/growth/search' : '/api/snapshots'), {
  query: computed(() => (searchName.value ? { name: searchName.value, days: range.value } : { days: range.value, ocid: ocid.value })),
  immediate: !!searchName.value || own.value,
  getCachedData,
})
const { data: tracked, refresh: refreshTracked } = await useFetch<TrackedCharacter[]>('/api/growth/characters', {
  default: () => [],
  immediate: !!me.value?.main,
  getCachedData,
})
revalidate(refresh, refreshTracked)

const nameInput = ref('')
const searchHint = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
// 최근에 찾아본 캐릭터는 이 브라우저에만 남겨 다시 누르기 쉽게 한다
const RECENT_KEY = 'growth-recent'
const RECENT_MAX = 6
const recent = ref<string[]>([])
onMounted(() => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    if (Array.isArray(list)) recent.value = list.filter(n => typeof n === 'string').slice(0, RECENT_MAX)
  }
  catch {}
})
function saveRecent(list: string[]) {
  recent.value = list
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  }
  catch {}
}
function searchGrowth(picked?: string) {
  const name = (picked ?? nameInput.value).trim()
  if (!name) {
    searchHint.value = '캐릭터 이름을 적어 주세요.'
    searchInput.value?.focus()
    return
  }
  saveRecent([name, ...recent.value.filter(n => n !== name)].slice(0, RECENT_MAX))
  return navigateTo({ path: '/growth', query: { name } })
}

const days = computed(() => toGrowthDays(data.value?.points ?? [], data.value?.today ?? null))
const summary = computed(() => summarizeGrowth(days.value))
// 고르지 않았으면 마지막 날. 서버 렌더링에서도 같은 값이 나오도록 watch 대신 computed로 둔다
const picked = ref<number | null>(null)
const selected = computed({
  get: () => picked.value ?? Math.max(days.value.length - 1, 0),
  set: (value) => {
    picked.value = value
  },
})
watch([range, ocid, searchName], () => {
  picked.value = null
})

// 서버가 빈 날을 나눠서 채우므로 남은 작업이 있으면 이어서 요청한다
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => data.value?.pending, (pending) => {
  clearTimeout(timer)
  if (pending) timer = setTimeout(refresh, POLL_MS)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))

useHead({ title: '성장 기록 · 메이플스토리로그' })
</script>

<template>
  <GameWindow v-if="!searchName && !me?.main" title="성장 기록" sub="캐릭터 이름만 있으면 로그인 없이 볼 수 있어요" accent="green">
    <div class="gate">
      <section class="about">
        <div class="npc">
          <img src="/favicon.svg" alt="" class="face">
          <p class="say">누구 기록이 궁금하세요? 이름을 알려 주시면 <b>경험치·전투력 변화</b>를 보여 드릴게요.</p>
        </div>
        <ul class="previews stagger">
          <li style="--tone: var(--exp)"><b>경험치</b><span>날마다 얻은 경험치와 레벨업한 날</span></li>
          <li style="--tone: var(--api)"><b>레벨업 예상</b><span>최근 7일 사냥량 기준 다음 레벨 날짜</span></li>
          <li style="--tone: var(--gain)"><b>전투력</b><span>기간 동안 오르내린 전투력</span></li>
        </ul>
        <p class="muted small">
          <template v-if="!me">API 키를 등록하면 내 캐릭터 6명까지 매일 새벽에 자동으로 모아 둬요. <NuxtLink to="/login">키 등록하기 →</NuxtLink></template>
          <template v-else>대표 캐릭터를 고르면 매일 새벽에 자동으로 모아 둬요. <NuxtLink to="/me">대표 캐릭터 고르기 →</NuxtLink></template>
        </p>
      </section>

      <form class="form-side" role="search" novalidate @submit.prevent="searchGrowth()">
        <div class="find-head">
          <h3>캐릭터 검색</h3>
          <span class="muted">닉네임을 정확히 적어 주세요</span>
        </div>
        <label for="growth-search" class="sr-only">캐릭터 이름</label>
        <div class="search-box" :class="{ invalid: searchHint }">
          <svg class="lens" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <input
            id="growth-search"
            ref="searchInput"
            v-model="nameInput"
            maxlength="20"
            placeholder="캐릭터 이름"
            autocomplete="off"
            :aria-invalid="!!searchHint"
            aria-describedby="growth-search-hint"
            @input="searchHint = ''"
          >
          <kbd aria-hidden="true">Enter</kbd>
          <button type="submit" class="go" aria-label="성장 기록 보기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
          </button>
        </div>
        <!-- 안내 줄은 늘 자리를 잡아 둬서 떠도 아래가 밀리지 않는다 -->
        <p id="growth-search-hint" class="hint" :class="{ show: searchHint }" role="status">{{ searchHint || ' ' }}</p>

        <div class="recent">
          <span class="recent-label">최근 찾아본 캐릭터</span>
          <div class="chips">
            <template v-if="recent.length">
              <button v-for="n in recent" :key="n" type="button" class="chip" @click="searchGrowth(n)">{{ n }}</button>
            </template>
            <span v-else class="muted chips-empty">찾아본 캐릭터가 여기 남아요</span>
          </div>
        </div>

        <!-- 장식: 오르는 경험치 그래프 -->
        <svg class="deco" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="growth-deco" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="currentColor" stop-opacity="0.28" />
              <stop offset="1" stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 52 L30 48 L60 50 L90 40 L120 42 L150 30 L180 33 L210 22 L240 24 L270 12 L300 6 L300 60 L0 60 Z" fill="url(#growth-deco)" />
          <path d="M0 52 L30 48 L60 50 L90 40 L120 42 L150 30 L180 33 L210 22 L240 24 L270 12 L300 6" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" />
        </svg>
      </form>
    </div>
  </GameWindow>

  <GameWindow v-else class="fit" :title="`${data?.character?.name ?? (searchName || me?.main?.name)}의 성장 기록`" accent="green" fill>
    <template #sub>
      <span v-if="data?.pending">지난 기록 채우는 중 · {{ data.pending }}일 남음</span>
      <span v-else-if="searchName">검색한 캐릭터 · 오늘은 실시간</span>
      <span v-else>매일 새벽 4시 저장 · 오늘은 실시간</span>
    </template>

    <GrowthCharacterBar v-if="own" v-model="ocid" :tracked="tracked" :max="MAX_TRACKED_CHARACTERS" @changed="refreshTracked" />
    <p v-else-if="me?.main" class="muted small"><NuxtLink to="/growth">← 내 캐릭터 성장 기록으로</NuxtLink></p>

    <div class="toolbar">
      <div class="group" role="group" aria-label="기간">
        <MenuButton v-for="r in RANGES" :key="r" :active="range === r" @click="range = r">{{ r }}일</MenuButton>
      </div>
      <div class="group" role="group" aria-label="보기">
        <MenuButton v-for="v in VIEWS" :key="v.key" :active="view === v.key" @click="view = v.key">{{ v.label }}</MenuButton>
      </div>
    </div>

    <p v-if="error" class="form-error">{{ errorMessage(error) }}</p>
    <p v-else-if="!days.length" class="muted">
      {{ data?.pending ? '넥슨에서 지난 기록을 불러오고 있어요. 잠시만 기다려 주세요.' : '아직 쌓인 기록이 없어요. 매일 새벽 4시에 전날 기록이 저장돼요.' }}
    </p>

    <template v-else>
      <Transition name="fade" mode="out-in">
        <div v-if="view === 'field'" key="field" class="stage">
          <GrowthField v-model="selected" :days="days" :image-url="data?.character?.imageUrl ?? null" />
          <GrowthExpRoad v-model="selected" :days="days" />
          <GrowthPowerChart v-model="selected" :days="days" />
        </div>
        <GrowthTable v-else key="table" v-model="selected" :days="days" />
      </Transition>

      <div v-if="summary" class="summary stagger">
        <HoverInfo title="기간 경험치" align="left">
          <div class="tile" style="--tone: var(--exp)">
            <span class="tile-label">기간 경험치</span>
            <span class="tile-value">{{ formatSignedPercent(summary.totalPercent) }}</span>
            <span class="tile-label">{{ formatSigned(summary.totalExp) }} · 레벨업 {{ summary.levelUpDays.length }}번</span>
          </div>
          <template #info>
            <span>하루 평균 {{ summary.averagePercent.toFixed(2) }}%</span>
            <span>경험치를 얻은 날 {{ summary.activeDays }}일 / {{ summary.trackedDays }}일</span>
            <span v-for="d in summary.levelUpDays" :key="d.date" class="gain">{{ dayLabel(d) }} LV.{{ d.level }} 달성</span>
          </template>
        </HoverInfo>
        <HoverInfo title="다음 레벨업 예상">
          <div class="tile" style="--tone: var(--api)">
            <span class="tile-label">다음 레벨업 예상</span>
            <span class="tile-value">{{ summary.levelUpDate ? formatMonthDay(summary.levelUpDate) : '-' }}</span>
            <span class="tile-label">최근 7일 평균 기준</span>
          </div>
          <template #info>
            <span>남은 경험치 {{ summary.remainingPercent.toFixed(2) }}%<template v-if="summary.remainingExp !== null"> ({{ formatKoreanNumber(summary.remainingExp) }})</template></span>
            <span>최근 7일 하루 평균 {{ summary.averageExp ? formatKoreanNumber(summary.averageExp) : '-' }}</span>
            <span class="muted">사냥량이 그대로라고 가정한 날짜예요</span>
          </template>
        </HoverInfo>
        <HoverInfo title="경험치 많이 얻은 날">
          <div class="tile" style="--tone: var(--calc)">
            <span class="tile-label">최고의 날</span>
            <span class="tile-value">{{ summary.bestDay ? formatMonthDay(summary.bestDay.date) : '-' }}</span>
            <span v-if="summary.bestDay?.gainExp" class="tile-label">{{ formatSigned(summary.bestDay.gainExp) }}</span>
          </div>
          <template #info>
            <span v-for="(d, rank) in summary.topDays" :key="d.date">{{ rank + 1 }}위 {{ formatMonthDay(d.date) }} · {{ formatSigned(d.gainExp!) }} ({{ formatSignedPercent(d.gainPercent ?? 0) }})</span>
            <span v-if="!summary.topDays.length" class="muted">아직 경험치를 얻은 날이 없어요</span>
          </template>
        </HoverInfo>
        <HoverInfo title="전투력 변화" align="right">
          <div class="tile" style="--tone: var(--gain)">
            <span class="tile-label">전투력 변화</span>
            <span class="tile-value" :class="{ gain: (summary.combatPowerChange ?? 0) > 0, loss: (summary.combatPowerChange ?? 0) < 0 }">
              {{ summary.combatPowerChange === null ? '-' : formatSigned(summary.combatPowerChange) }}
            </span>
            <span class="tile-label sources">
              <SourceBadge type="api" /><span>스냅샷</span>
              <SourceBadge type="calc" /><span>증가량·예상일</span>
            </span>
          </div>
          <template #info>
            <span v-if="summary.combatPowerFirst !== null && summary.combatPowerLast !== null">{{ formatKoreanNumber(summary.combatPowerFirst) }} → {{ formatKoreanNumber(summary.combatPowerLast) }}</span>
            <span v-if="summary.strongest">최고 {{ formatKoreanNumber(summary.strongest.combatPower) }} ({{ dayLabel(summary.strongest) }})</span>
            <span v-if="summary.weakest">최저 {{ formatKoreanNumber(summary.weakest.combatPower) }} ({{ dayLabel(summary.weakest) }})</span>
            <span class="muted">그날 장착한 세팅 기준이라 프리셋을 바꾸면 오르내려요</span>
          </template>
        </HoverInfo>
      </div>
    </template>
  </GameWindow>
</template>

<style scoped>
.gate {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
}
.about {
  display: grid;
  gap: 14px;
}
.npc {
  display: flex;
  gap: 12px;
  align-items: center;
}
.face {
  flex: none;
  width: 56px;
  height: 56px;
  padding: 6px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  animation: bob 2.4s ease-in-out infinite;
}
.say {
  position: relative;
  margin: 0;
  padding: 10px 14px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  font-size: 14.5px;
  line-height: 1.6;
  text-wrap: balance;
  animation: rise-in 0.5s var(--ease-out) 0.15s backwards;
}
/* 말풍선 꼬리 */
.say::before {
  content: "";
  position: absolute;
  top: 50%;
  left: -9px;
  width: 14px;
  height: 14px;
  background: var(--bar);
  border-bottom: 2px solid var(--tip-line);
  border-left: 2px solid var(--tip-line);
  transform: translateY(-50%) rotate(45deg);
}
.say b {
  color: var(--gain);
}
.small a {
  color: var(--api);
}
.form-side {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  padding: 16px 16px 0;
  background:
    radial-gradient(420px 160px at 100% 0, rgb(127 217 154 / 0.1), transparent 70%),
    var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.find-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
  font-size: 12.5px;
}
.find-head h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 19px;
  font-weight: 400;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 5px 5px 14px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
  transition: border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.search-box:focus-within {
  border-color: var(--gain);
  box-shadow: 0 0 0 1px var(--gain), 0 0 18px rgb(127 217 154 / 0.25);
}
.search-box.invalid {
  border-color: var(--loss);
  box-shadow: 0 0 0 1px var(--loss);
  animation: shake 0.3s ease;
}
.lens {
  flex: none;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-width: 2;
}
.search-box input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0;
  background: none;
  border: 0;
  outline: none;
  color: var(--text);
  font: inherit;
  font-size: 17px;
}
.search-box input::placeholder {
  color: var(--sub);
}
kbd {
  flex: none;
  padding: 2px 7px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 5px;
  color: var(--sub);
  font-family: inherit;
  font-size: 11.5px;
}
/* 돋보기 반대쪽 끝의 화살표 버튼. Enter와 같은 일을 한다 */
.go {
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  background: var(--gain);
  border: 0;
  border-radius: 9px;
  color: #10261a;
  cursor: pointer;
  transition: transform var(--fast) var(--ease-out), filter var(--fast) ease;
}
.go:hover {
  filter: brightness(1.08);
  transform: translateX(2px);
}
.go:active {
  transform: scale(0.95);
}
.go svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.4;
}
.recent {
  display: grid;
  gap: 6px;
}
.recent-label {
  color: var(--sub);
  font-size: 12.5px;
}
/* 칩이 없을 때도 한 줄 높이를 잡아 둔다 */
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 30px;
}
.chip {
  height: 30px;
  padding: 0 12px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease;
}
.chip:hover {
  border-color: var(--gain);
  color: var(--gain);
}
.chips-empty {
  font-size: 13px;
}
.deco {
  display: block;
  width: calc(100% + 32px);
  height: 56px;
  margin: auto -16px 0;
  padding-top: 6px;
  color: var(--gain);
  opacity: 0.7;
}
.hint {
  height: 20px;
  margin: 0;
  overflow: hidden;
  line-height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--loss);
  font-size: 13px;
  opacity: 0;
  transition: opacity var(--fast) ease;
}
.hint.show {
  opacity: 1;
}
@keyframes shake {
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
.previews {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.previews li {
  display: grid;
  gap: 3px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--tone) 6%, transparent);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}
.previews b {
  color: var(--tone);
  font-size: 14px;
}
.previews span {
  color: var(--sub);
  font-size: 12.5px;
  line-height: 1.5;
}
@media (max-width: 860px) {
  .gate {
    grid-template-columns: 1fr;
  }
}
.small {
  margin: 0;
  font-size: 13px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.group {
  display: flex;
  gap: 6px;
}
.stage {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}
.sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  line-height: 1;
}
.sources :deep(.badge) {
  height: 16px;
  padding: 0 5px;
  font-size: 10px;
}
.sources :deep(.badge.calc) {
  margin-left: 4px;
}
.tile-value.gain {
  color: var(--gain);
}
.tile-value.loss {
  color: var(--loss);
}
</style>
