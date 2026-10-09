<script setup lang="ts">
import type { SnapshotsResponse } from '#shared/types'

const RANGES = [7, 14, 30]
const POLL_MS = 3000

const { me } = await useMe()
const range = ref(14)
const { data, error, refresh } = useFetch<SnapshotsResponse>('/api/snapshots', {
  query: { days: range },
  immediate: !!me.value?.main,
})

const days = computed(() => toGrowthDays(data.value?.points ?? []))
const summary = computed(() => summarizeGrowth(days.value))
// 고르지 않았으면 마지막 날. 서버 렌더링에서도 같은 값이 나오도록 watch 대신 computed로 둔다
const picked = ref<number | null>(null)
const selected = computed({
  get: () => picked.value ?? Math.max(days.value.length - 1, 0),
  set: (value) => {
    picked.value = value
  },
})
watch(range, () => {
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
  <GameWindow v-if="!me" title="성장 기록">
    <p class="muted">성장 기록은 API 키를 등록한 캐릭터만 매일 모을 수 있어요.</p>
    <div><NuxtLink to="/login" class="btn">API 키 등록하기</NuxtLink></div>
  </GameWindow>

  <GameWindow v-else-if="!me.main" title="성장 기록">
    <p class="muted">기록할 대표 캐릭터를 먼저 골라 주세요.</p>
    <div><NuxtLink to="/me" class="btn">대표 캐릭터 고르기</NuxtLink></div>
  </GameWindow>

  <GameWindow v-else class="fit" :title="`${data?.character?.name ?? me.main.name}의 성장 기록`" accent="green" fill>
    <template #sub>
      <span v-if="data?.pending">지난 기록 채우는 중 · {{ data.pending }}일 남음</span>
    </template>

    <div class="toolbar">
      <div class="ranges" role="group" aria-label="기간">
        <MenuButton v-for="r in RANGES" :key="r" :active="range === r" @click="range = r">
          {{ r }}일
        </MenuButton>
      </div>
      <p class="sources">
        <SourceBadge type="api" /> 날짜별 스냅샷
        <SourceBadge type="calc" /> 증가량 · 예상일
      </p>
    </div>

    <p v-if="error" class="form-error">{{ errorMessage(error) }}</p>
    <p v-else-if="!days.length" class="muted">
      {{ data?.pending ? '넥슨에서 지난 기록을 불러오고 있어요. 잠시만 기다려 주세요.' : '아직 쌓인 기록이 없어요. 매일 새벽 4시에 전날 기록이 저장돼요.' }}
    </p>

    <template v-else>
      <GrowthField v-model="selected" :days="days" :image-url="data?.character?.imageUrl ?? null" />
      <GrowthExpRoad v-model="selected" :days="days" />

      <div v-if="summary" class="summary stagger">
        <div class="tile" style="--tone: var(--exp)">
          <span class="tile-label">기간 경험치</span>
          <span class="tile-value">{{ formatSigned(summary.totalPercent, n => `${n.toFixed(2)}%`) }}</span>
          <span class="tile-label">{{ formatSigned(summary.totalExp) }}</span>
        </div>
        <div class="tile" style="--tone: var(--api)">
          <span class="tile-label">다음 레벨업 예상</span>
          <span class="tile-value">{{ summary.levelUpDate ? formatMonthDay(summary.levelUpDate) : '-' }}</span>
          <span class="tile-label">최근 7일 평균 기준</span>
        </div>
        <div class="tile" style="--tone: var(--calc)">
          <span class="tile-label">최고의 날</span>
          <span class="tile-value">{{ summary.bestDay ? formatMonthDay(summary.bestDay.date) : '-' }}</span>
          <span v-if="summary.bestDay?.gainExp" class="tile-label">{{ formatSigned(summary.bestDay.gainExp) }}</span>
        </div>
        <div class="tile" style="--tone: var(--gain)">
          <span class="tile-label">전투력 변화</span>
          <span class="tile-value" :class="{ gain: (summary.combatPowerChange ?? 0) > 0, loss: (summary.combatPowerChange ?? 0) < 0 }">
            {{ summary.combatPowerChange === null ? '-' : formatSigned(summary.combatPowerChange) }}
          </span>
        </div>
      </div>

    </template>
  </GameWindow>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.ranges {
  display: flex;
  gap: 6px;
}
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}
.sources {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--sub);
  font-size: 13px;
}
.tile-value.gain {
  color: var(--gain);
}
.tile-value.loss {
  color: var(--loss);
}
</style>
