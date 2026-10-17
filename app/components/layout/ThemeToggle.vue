<script setup lang="ts">
const { choice, next } = useTheme()
const LABELS = { system: '컴퓨터 설정', light: '밝은 모드', dark: '어두운 모드' } as const
</script>

<template>
  <button type="button" class="theme" :title="`화면: ${LABELS[choice]} · 눌러서 바꾸기`" :aria-label="`화면 모드 ${LABELS[choice]}, 눌러서 바꾸기`" @click="next">
    <svg v-if="choice === 'light'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    <svg v-else-if="choice === 'dark'" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg>
  </button>
</template>

<style scoped>
.theme {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: color-mix(in srgb, var(--tint) 4%, transparent);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, border-color var(--fast) ease;
}
.theme:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.theme svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
</style>
