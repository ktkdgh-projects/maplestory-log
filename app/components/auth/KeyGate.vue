<script setup lang="ts">
import type { KeyGateInfo } from '~/utils/keyGates'

defineProps<KeyGateInfo>()
</script>

<template>
  <GameWindow :title="title" sub="API 키를 등록하면 바로 쓸 수 있어요" :accent="accent">
    <div class="gate">
      <section class="about">
        <NpcSay>{{ lead }}</NpcSay>
        <ul class="points stagger">
          <li v-for="p in points" :key="p.title" :style="{ '--tone': `var(--${p.tone})` }"><b>{{ p.title }}</b><span>{{ p.text }}</span></li>
        </ul>
        <p class="muted small">넥슨 로그인이 아니라 넥슨 Open API에서 직접 발급한 키를 써요. 기록은 본인만 볼 수 있어요.</p>
      </section>
      <section class="form-side">
        <h3>API 키 등록</h3>
        <!-- 등록하면 이 페이지의 기록을 처음부터 받도록 같은 주소로 다시 연다 -->
        <KeyLogin reload />
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
.points {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
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
