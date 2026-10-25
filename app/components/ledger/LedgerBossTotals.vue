<script setup lang="ts">
const props = defineProps<{
  characters: number
  totals: { weeklyEarned: number, weeklyExpected: number, monthlyEarned: number, monthlyExpected: number, monthlyDone: boolean, loot: number, complete: boolean, completeCount: number }
}>()
const emit = defineEmits<{ clearAll: [] }>()

const progress = computed(() => (props.totals.weeklyExpected ? Math.min(100, (props.totals.weeklyEarned / props.totals.weeklyExpected) * 100) : 0))
</script>

<template>
  <div class="totals">
    <span>이번 주 주간 결정석 <b class="earned">{{ formatKoreanNumber(totals.weeklyEarned) }}</b></span>
    <span class="muted">/ 다 잡으면 {{ formatKoreanNumber(totals.weeklyExpected) }}</span>
    <span class="monthly-tag" :class="{ off: !totals.monthlyExpected && !totals.monthlyEarned && !totals.monthlyDone }" title="월간 보스는 한 달에 한 번이라 잡은 주에만 따로 세요">
      <template v-if="!totals.monthlyEarned && totals.monthlyDone">이번 달 월간 다 잡았어요 ✓</template>
      <template v-else>이번 주 월간 <b>{{ formatKoreanNumber(totals.monthlyEarned) }}</b> / {{ formatKoreanNumber(totals.monthlyExpected) }}</template>
    </span>
    <span class="loot-tag" :class="{ off: !totals.loot }" title="물욕템을 경매장에 팔고 받은 메소(수수료 뗀 값)">물욕 판매 <b>{{ formatKoreanNumber(totals.loot) }}</b></span>
    <span v-if="characters" class="progress-tag" :class="{ all: totals.complete }">
      {{ totals.complete ? '이번 주 전부 잡았어요 ✓' : `다 잡은 캐릭터 ${totals.completeCount}/${characters}` }}
    </span>
    <!-- 다 잡으면 넓은 화면에선 버튼을 빼 완료 표시를 오른쪽 끝에 붙이고, 버튼이 한 줄을 차지하는 좁은 화면에선 자리를 남긴다 -->
    <button v-if="characters > 1" type="button" class="btn compact all-all" :class="{ off: totals.complete }" :tabindex="totals.complete ? -1 : 0" @click="emit('clearAll')">모든 캐릭터 전부 잡음</button>
    <div class="bar"><span :style="{ width: `${progress}%` }" /></div>
  </div>
</template>

<style scoped>
.totals {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 15px;
}
.earned {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
.monthly-tag {
  padding: 2px 10px;
  background: color-mix(in srgb, var(--calc) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--calc) 40%, transparent);
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
}
.monthly-tag b {
  color: var(--calc);
  font-weight: 700;
}
.loot-tag {
  padding: 2px 10px;
  background: color-mix(in srgb, var(--gold) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 40%, transparent);
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
}
.loot-tag b {
  color: var(--gold);
  font-weight: 700;
}
.bar {
  flex-basis: 100%;
  height: 8px;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 4px;
}
.bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 70%, var(--loss)), var(--gold));
  transition: width var(--normal) var(--ease-out);
}
.progress-tag {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
}
.progress-tag.all {
  border-color: var(--gain);
  color: var(--gain);
}
/* 쓸 수 없는 버튼·표시도 자리는 남긴다 */
.off {
  visibility: hidden;
}
.all-all.off {
  display: none;
}
@media (max-width: 700px) {
  .totals {
    font-size: 14px;
  }
  .earned {
    font-size: 21px;
  }
  .progress-tag {
    margin-left: 0;
  }
  .all-all.off {
    display: inline-flex;
  }
  .all-all {
    width: 100%;
  }
}
</style>
