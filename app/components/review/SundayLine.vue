<script setup lang="ts">
import type { CharacterBrief, ReviewResponse } from '#shared/types'

// 썬데이 결산 카드의 캐릭터 한 줄. 그 캐릭터의 기간 결산을 받아 계산하고, 합을 카드에 올려 보낸다
const props = defineProps<{ character: CharacterBrief, from: string, to: string, mvp: number }>()
const emit = defineEmits<{ total: [ocid: string, total: { meso: number, cube: number, ready: boolean }] }>()

const data = shallowRef<ReviewResponse | null>(null)
onMounted(async () => {
  data.value = await $fetch<ReviewResponse>(`/api/review/${props.character.ocid}`, { query: { from: props.from, to: props.to } }).catch(() => null)
})
const mvp = computed(() => props.mvp)
const { starforceList, potentialList, ready, totals } = useReviewCompute(data, mvp, ref({}))
const done = computed(() => !!data.value && ready.value)
watch([done, totals], () => {
  emit('total', props.character.ocid, { meso: totals.value.meso.gain, cube: totals.value.cube.used ? totals.value.cube.gain : 0, ready: done.value })
}, { immediate: true })
const what = computed(() => [
  starforceList.value.length ? `스타포스 ${starforceList.value.length}` : '',
  potentialList.value.length ? `잠재 ${potentialList.value.length}` : '',
].filter(Boolean).join(' · '))
</script>

<template>
  <NuxtLink :to="{ path: '/review', query: { ocid: character.ocid, mode: 'sunday', date: from } }" class="line">
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
  min-height: 40px;
  padding: 6px 10px;
  background: rgb(255 255 255 / 0.03);
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
}
.line:hover {
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
.loss {
  color: var(--loss);
}
.value {
  width: 60px;
  height: 18px;
}
</style>
