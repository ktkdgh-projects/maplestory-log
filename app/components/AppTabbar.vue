<script setup lang="ts">
const route = useRoute()
const activeGroup = computed(() => navGroupOf(route.path))
const sundayBadge = useSundayBadge()
</script>

<template>
  <nav class="tabbar" aria-label="메뉴">
    <NuxtLink v-for="group in NAV_GROUPS" :key="group.key" :to="group.items[0]!.to" class="tab" :class="{ on: activeGroup?.key === group.key }">
      <svg v-if="group.key === 'character'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
      <svg v-else-if="group.key === 'ledger'" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
      <svg v-else-if="group.key === 'enhance'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z" /></svg>
      <svg v-else-if="group.key === 'calc'" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2M16 12v4" /></svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      <span>{{ group.label }}</span>
      <i v-if="group.key === 'sunday'" class="dot" :class="sundayBadge.kind" :aria-label="sundayBadge.kind === 'waiting' ? '발표 전' : '이번 주 썬데이 발표됨'" />
    </NuxtLink>
  </nav>
</template>

<style scoped>
/* 휴대폰에서만 보이는 하단 탭바 */
.tabbar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: none;
  grid-template-columns: repeat(5, 1fr);
  padding: 6px 0 calc(8px + env(safe-area-inset-bottom, 0px));
  background: rgb(14 17 28 / 0.96);
  border-top: 1px solid var(--win-line);
  backdrop-filter: blur(10px);
}
.tab {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 2px;
  color: var(--sub);
  font-size: 11px;
  text-decoration: none;
}
.tab svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tab.on {
  color: var(--gold);
}
/* 썬데이 등: 발표 전엔 꺼진 회색, 발표되면 금색(안 봤으면 깜빡), 일요일엔 초록 */
.dot {
  position: absolute;
  top: 0;
  left: calc(50% + 8px);
  width: 7px;
  height: 7px;
  background: #3a4366;
  border: 1px solid var(--tip-line);
  border-radius: 50%;
}
.dot.new,
.dot.upcoming {
  background: var(--gold);
  border-color: #ffe7a3;
  box-shadow: 0 0 6px var(--gold);
}
.dot.new {
  animation: blink 1.6s ease-in-out infinite;
}
.dot.today {
  background: var(--gain);
  border-color: #c9f5d6;
  box-shadow: 0 0 6px var(--gain);
}
@keyframes blink {
  50% { opacity: 0.4; }
}
@media (max-width: 640px) {
  .tabbar {
    display: grid;
  }
}
</style>
