<script setup lang="ts">
// 이용약관·개인정보처리방침 공용 화면: 위에 한눈에 보기, 아래에 번호 붙은 조항 카드
export interface LegalItem {
  label?: string
  text: string
}
export interface LegalSection {
  title: string
  text?: string
  items?: LegalItem[]
}

defineProps<{ title: string, date: string, summary: string[], sections: LegalSection[] }>()
</script>

<template>
  <GameWindow :title="title" :sub="`${date} 시행`">
    <div class="doc">
      <aside class="summary">
        <b>한눈에 보기</b>
        <ul>
          <li v-for="s in summary" :key="s">{{ s }}</li>
        </ul>
      </aside>

      <nav class="toc" aria-label="목차">
        <a v-for="(s, i) in sections" :key="s.title" :href="`#sec-${i + 1}`">{{ i + 1 }}. {{ s.title }}</a>
      </nav>

      <section v-for="(s, i) in sections" :id="`sec-${i + 1}`" :key="s.title" class="sec">
        <h2><span class="num">{{ i + 1 }}</span>{{ s.title }}</h2>
        <p v-if="s.text">{{ s.text }}</p>
        <ul v-if="s.items">
          <li v-for="item in s.items" :key="item.text">
            <b v-if="item.label">{{ item.label }}</b>
            <span>{{ item.text }}</span>
          </li>
        </ul>
      </section>

      <p class="muted small">문의나 삭제 요청은 내 정보 화면의 기능을 먼저 이용해 주시고, 그 밖의 요청은 운영자에게 알려 주세요.</p>
    </div>
  </GameWindow>
</template>

<style scoped>
.doc {
  display: grid;
  gap: 12px;
}
.summary {
  display: grid;
  gap: 6px;
  padding: 12px 16px;
  background: rgb(242 193 78 / 0.06);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--gold);
  border-radius: 10px;
}
.summary b {
  color: var(--gold);
  font-size: 14px;
}
.summary ul {
  display: grid;
  gap: 3px;
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
}
.toc {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.toc a {
  padding: 4px 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 12.5px;
  text-decoration: none;
  transition: color var(--fast) ease, border-color var(--fast) ease;
}
.toc a:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.sec {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  scroll-margin-top: 16px;
}
h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--text);
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.num {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  background: var(--bar);
  border: 1px solid var(--gold);
  border-radius: 50%;
  color: var(--gold);
  font-size: 14px;
}
.sec p {
  margin: 0;
  color: var(--sub);
  font-size: 14px;
  line-height: 1.65;
}
.sec ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sec li {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 12px;
  padding: 7px 0;
  border-top: 1px dashed var(--panel-line);
  font-size: 14px;
  line-height: 1.6;
}
.sec li:first-child {
  border-top: 0;
  padding-top: 0;
}
/* 이름표 없는 줄은 한 칸을 다 쓴다 */
.sec li span:only-child {
  grid-column: 1 / -1;
}
.sec li b {
  color: var(--text);
}
.sec li span {
  color: var(--sub);
}
.small {
  font-size: 13px;
}
@media (max-width: 640px) {
  .sec li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
</style>
