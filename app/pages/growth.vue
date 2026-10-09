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
function searchGrowth() {
  const name = nameInput.value.trim()
  if (name) navigateTo({ path: '/growth', query: { name } })
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
  <GameWindow v-if="!searchName && !me?.main" title="성장 기록" accent="green">
    <p class="muted">캐릭터 이름을 검색하면 로그인 없이 최근 성장 기록을 볼 수 있어요.</p>
    <form class="search" role="search" @submit.prevent="searchGrowth">
      <label for="growth-search" class="sr-only">캐릭터 이름</label>
      <input id="growth-search" v-model="nameInput" class="field-input" maxlength="20" placeholder="캐릭터 이름" autocomplete="off" required>
      <button class="btn">성장 기록 보기</button>
    </form>
    <p class="muted small">
      <template v-if="!me">API 키를 등록하면 캐릭터를 6명까지 골라 매일 자동으로 모아요. <NuxtLink to="/login">키 등록하기</NuxtLink></template>
      <template v-else>대표 캐릭터를 고르면 매일 자동으로 모아요. <NuxtLink to="/me">대표 캐릭터 고르기</NuxtLink></template>
    </p>
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
.search {
  display: flex;
  gap: 6px;
  max-width: 420px;
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
