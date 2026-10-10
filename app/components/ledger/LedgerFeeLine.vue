<script setup lang="ts">
import type { MeResponse } from '#shared/types'

// 경매장 수수료. 내 정보의 MVP 등급이 실버 이상이면 3%로 정해지고, 아니면 5%에서 PC방일 때만 3%로 바꾼다
const fee = defineModel<number>({ required: true })

const PC_FEE = MVP_FEE
const { data: me } = useNuxtData<MeResponse>('me')
const mvp = computed(() => hasMvpFee(me.value?.user?.mvpDiscount))
watch(mvp, (value) => {
  if (value) fee.value = PC_FEE
}, { immediate: true })
</script>

<template>
  <span class="fee-line">
    <template v-if="mvp">
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
  background: rgb(242 193 78 / 0.12);
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
