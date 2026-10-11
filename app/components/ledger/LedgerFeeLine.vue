<script setup lang="ts">
import type { MeResponse } from '#shared/types'
import { hasMvpFee } from '#shared/calc/meso'
import { DEFAULT_AUCTION_FEE, MVP_FEE } from '#shared/data/auction'

// MVP 실버 이상이면 3%로 고정한다. keep(기존 기록 고치기)이면 열기만 해선 그때 고른 수수료를 바꾸지 않는다
const props = defineProps<{ keep?: boolean }>()
const fee = defineModel<number>({ required: true })

const PC_FEE = MVP_FEE
const { data: me } = useNuxtData<MeResponse>('me')
const mvp = computed(() => hasMvpFee(me.value?.user?.mvpDiscount))
watch(mvp, (value) => {
  if (value && !props.keep) fee.value = PC_FEE
}, { immediate: true })
</script>

<template>
  <span class="fee-line">
    <template v-if="mvp && fee === PC_FEE">
      <span class="rate">수수료 <b>3%</b></span>
      <NuxtLink to="/me" class="why" title="내 정보에서 MVP 등급 바꾸기">MVP 실버 이상 · 내 정보</NuxtLink>
    </template>
    <template v-else>
      <span class="rate">수수료 <b>{{ Math.round(fee * 100) }}%</b></span>
      <button type="button" class="pc" :aria-pressed="fee === PC_FEE" @click="fee = fee === PC_FEE ? DEFAULT_AUCTION_FEE : PC_FEE">PC방 3%</button>
      <NuxtLink to="/me" class="why" title="MVP 실버 이상이면 3%예요">MVP 등급 설정</NuxtLink>
    </template>
  </span>
</template>

<style scoped>
.fee-line {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 12.5px;
}
.rate {
  color: var(--sub);
  white-space: nowrap;
}
.rate b {
  color: var(--text);
}
.pc {
  padding: 3px 9px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.pc[aria-pressed="true"] {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  border-color: var(--gold);
  color: var(--gold);
}
.why {
  color: var(--api);
  font-size: 11.5px;
  text-decoration: none;
  white-space: nowrap;
}
.why:hover {
  text-decoration: underline;
}
</style>
