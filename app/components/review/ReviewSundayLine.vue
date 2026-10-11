<script setup lang="ts">
import type { CharacterBrief, ReviewResponse, SundayLineTotal } from '#shared/types'

// 동시에 부르면 넥슨 호출 한도에 걸리므로 카드가 넘겨준 queue로 한 캐릭터씩 차례로 받는다
const props = defineProps<{ character: CharacterBrief, from: string, to: string, queue: <T>(job: () => Promise<T>) => Promise<T> }>()
const emit = defineEmits<{ total: [ocid: string, total: SundayLineTotal] }>()

const data = shallowRef<ReviewResponse | null>(null)
const failed = ref(false)
async function load() {
  failed.value = false
  data.value = await props.queue(() => $fetch<ReviewResponse>(`/api/review/${props.character.ocid}`, { query: { from: props.from, to: props.to } })).catch(() => {
    failed.value = true
    return null
  })
}
onMounted(load)
const { starforceList, potentialList, ready, totals } = useReviewCompute(data, ref({}))
const done = computed(() => !!data.value && ready.value)
watch([done, totals, failed], () => {
  emit('total', props.character.ocid, { meso: totals.value.meso.gain, cube: totals.value.cube.used ? totals.value.cube.gain : 0, ready: done.value || failed.value, failed: failed.value })
}, { immediate: true })
const what = computed(() => [
  starforceList.value.length ? `스타포스 ${starforceList.value.length}` : '',
  potentialList.value.length ? `잠재 ${potentialList.value.length}` : '',
].filter(Boolean).join(' · '))
</script>

<template>
  <div v-if="failed" class="line">
    <span class="who"><b>{{ character.name }}</b><small class="loss">결산을 불러오지 못했어요</small></span>
    <button type="button" class="retry" @click="load">다시 불러오기</button>
  </div>
  <NuxtLink v-else :to="{ path: '/review', query: { ocid: character.ocid, mode: 'sunday', date: from } }" class="line">
    <span class="who"><b>{{ character.name }}</b><small>{{ what || '…' }}</small></span>
    <b v-if="done" :class="totals.meso.gain >= 0 ? 'gain' : 'loss'">{{ totals.meso.expected ? formatSigned(totals.meso.gain, formatShortNumber) : totals.cube.used ? `큐브 ${totals.cube.gain >= 0 ? '+' : '−'}${Math.round(Math.abs(totals.cube.gain))}개` : '-' }}</b>
    <span v-else class="skeleton value" />
  </NuxtLink>
</template>

<style scoped>
.line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 6px 10px;
  background: rgb(255 255 255 / 0.03);
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
}
a.line:hover {
  background: rgb(255 255 255 / 0.06);
}
.who {
  display: grid;
  line-height: 1.3;
}
.who small {
  color: var(--sub);
  font-size: 11.5px;
}
b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.gain {
  color: var(--gain);
}
.who small.loss,
.loss {
  color: var(--loss);
}
.value {
  width: 60px;
  height: 18px;
}
.retry {
  min-height: 32px;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.retry:hover {
  color: var(--text);
}
</style>
