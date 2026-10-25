<script setup lang="ts">
import { bossPeriod } from '#shared/data/bosses'

const props = defineProps<{ week: string, sum: number }>()

// 이번 주를 볼 때만 다음 목요일 0시(KST) 초기화까지 남은 시간을 보여 준다. 화면에 붙은 뒤에만 재서 서버 렌더와 어긋나지 않게 한다
const now = ref<number | null>(null)
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = Date.now()
  clock = setInterval(() => (now.value = Date.now()), 60_000)
})
onBeforeUnmount(() => clearInterval(clock))
const resetLeft = computed(() => {
  if (now.value === null || props.week !== bossPeriod('weekly', kstToday())) return null
  const hours = (kstDayStart(addDays(props.week, 7)).getTime() - now.value) / 3_600_000
  return hours >= 24 ? `${Math.floor(hours / 24)}일 ${Math.floor(hours % 24)}시간` : `${Math.max(0, Math.floor(hours))}시간 ${Math.max(0, Math.floor((hours % 1) * 60))}분`
})
</script>

<template>
  <span class="sum" title="주간 결정석 + 월간 결정석 + 물욕 판매">이번 주 합계 <b>{{ formatKoreanNumber(sum) }}</b></span>
  <span class="reset" :class="{ off: !resetLeft }">초기화까지 <b>{{ resetLeft ?? '-' }}</b></span>
</template>

<style scoped>
.sum {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  margin-left: 8px;
  padding: 4px 12px;
  background: color-mix(in srgb, var(--gain) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--gain) 45%, transparent);
  border-radius: 8px;
  color: var(--sub);
  font-size: 13px;
}
.sum b {
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.reset {
  color: var(--sub);
  font-size: 13px;
}
.reset b {
  color: var(--text);
}
.off {
  visibility: hidden;
}
</style>
