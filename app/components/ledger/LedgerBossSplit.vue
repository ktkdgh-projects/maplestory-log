<script setup lang="ts">
// 보스 수입을 결정석과 물욕으로 나눈다. icons를 넣으면 '물욕' 글자 대신 템 그림, equals는 옆 합계와 '='로 잇는다
const props = withDefaults(defineProps<{ crystal: number, loot: number, short?: boolean, equals?: boolean }>(), { short: false, equals: false })
const format = (n: number) => (props.short ? formatShortNumber(n) : formatKoreanNumber(n))
</script>

<template>
  <span class="boss-split-line">
    <span>결정석 <b>{{ format(crystal) }}</b></span>
    <template v-if="loot || $slots.icons">
      <i>+</i>
      <span class="loot"><slot name="icons">물욕 </slot><b>{{ loot ? format(loot) : '안 팖' }}</b></span>
      <i v-if="equals">=</i>
    </template>
  </span>
</template>

<style scoped>
.boss-split-line {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--sub);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.boss-split-line b {
  color: var(--text);
  font-weight: 400;
}
.boss-split-line i {
  font-style: normal;
  opacity: 0.6;
}
.loot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.loot b {
  color: var(--gold);
}
</style>
