<script setup lang="ts">
// 키가 필요한 페이지에 로그아웃 상태로 왔을 때: 이 페이지가 뭘 하는지 보여 주고 그 자리에서 바로 키를 등록한다
import type { KeyGateInfo } from '~/utils/keyGates'

defineProps<KeyGateInfo>()

// 등록하면 이 페이지의 기록을 처음부터 받도록 같은 주소로 다시 연다
const route = useRoute()
function done() {
  reloadNuxtApp({ path: route.fullPath })
}
</script>

<template>
  <GameWindow :title="title" sub="API 키를 등록하면 바로 쓸 수 있어요" :accent="accent">
    <div class="gate">
      <section class="about">
        <div class="npc">
          <img src="/favicon.svg" alt="" class="face">
          <p class="say">{{ lead }}</p>
        </div>
        <ul class="points stagger">
          <li v-for="p in points" :key="p.title" :style="{ '--tone': `var(--${p.tone})` }"><b>{{ p.title }}</b><span>{{ p.text }}</span></li>
        </ul>
        <p class="muted small">넥슨 로그인이 아니라 넥슨 Open API에서 직접 발급한 키를 써요. 기록은 본인만 볼 수 있어요.</p>
      </section>
      <section class="form-side">
        <h3>API 키 등록</h3>
        <KeyLogin @done="done" />
      </section>
    </div>
  </GameWindow>
</template>

<style scoped>
.gate {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
}
.about {
  display: grid;
  gap: 14px;
}
.npc {
  display: flex;
  gap: 12px;
  align-items: center;
}
.face {
  flex: none;
  width: 56px;
  height: 56px;
  padding: 6px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  animation: bob 2.4s ease-in-out infinite;
}
.say {
  position: relative;
  margin: 0;
  padding: 10px 14px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  font-size: 14.5px;
  line-height: 1.6;
  text-wrap: balance;
  animation: rise-in 0.5s var(--ease-out) 0.15s backwards;
}
/* 말풍선 꼬리 */
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
.points {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 성장 기록 소개와 같은 색 막대 카드 */
.points li {
  display: grid;
  gap: 3px;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--tone) 6%, transparent);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}
.points b {
  color: var(--tone);
  font-size: 14px;
}
.points span {
  color: var(--sub);
  font-size: 12.5px;
  line-height: 1.5;
}
.small {
  font-size: 13px;
}
.form-side {
  display: grid;
  gap: 10px;
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 19px;
  font-weight: 400;
}
@media (max-width: 860px) {
  .gate {
    grid-template-columns: 1fr;
  }
}
</style>
