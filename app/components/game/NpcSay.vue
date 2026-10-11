<script setup lang="ts">
// 강조할 말은 <b>로 감싸면 tone 색으로 보인다
withDefaults(defineProps<{ tone?: string }>(), { tone: 'var(--gold)' })
</script>

<template>
  <div class="npc" :style="{ '--npc-tone': tone }">
    <img src="/favicon.svg" alt="" class="face">
    <p class="say"><slot /></p>
  </div>
</template>

<style scoped>
.npc {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}
.face {
  flex: none;
  width: 54px;
  height: 54px;
  padding: 7px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  animation: bob 2.4s ease-in-out infinite;
}
.say {
  position: relative;
  min-width: 0;
  margin: 0;
  padding: 9px 14px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  font-size: 14.5px;
  line-height: 1.6;
  text-wrap: balance;
  animation: rise-in 0.5s var(--ease-out) 0.15s backwards;
}
.say::before {
  content: "";
  position: absolute;
  top: 50%;
  left: -9px;
  width: 14px;
  height: 14px;
  background: var(--bar);
  border-bottom: 2px solid var(--tip-line);
  border-left: 2px solid var(--tip-line);
  transform: translateY(-50%) rotate(45deg);
}
.say :deep(b) {
  color: var(--npc-tone);
}
@media (max-width: 480px) {
  .face {
    width: 44px;
    height: 44px;
    padding: 5px;
  }
  .say {
    font-size: 14px;
  }
}
</style>
