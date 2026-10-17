<script setup lang="ts">
import type { ItemSheet } from '#shared/types'

const props = defineProps<{ sheet: ItemSheet, busy: boolean, failure: string, notice: string, feeColumn: boolean }>()
const emit = defineEmits<{ rename: [], toggleExcluded: [], import: [], removeSheet: [] }>()
const renaming = defineModel<boolean>('renaming', { required: true })
const title = defineModel<string>('title', { required: true })

const helpOpen = ref(false)
// 머리글은 좁아서 설명을 못 붙이므로 모아서 모달로 보여 준다
const columnHelp = computed(() => [
  { name: '스타포스', text: '직접 적은 값이 가계부에 들어가요. 연결한 캐릭터의 강화 기록으로 센 값은 칸 아래에 참고로 보여 드려요.' },
  { name: '잠재', text: '메소 잠재 재설정 비용이에요. 강화 기록으로 센 값은 공식 비용표 기준이라 그대로 써도 돼요.' },
  ...(props.feeColumn ? [{ name: '수수료', text: '경매장 판매 수수료예요. 대금을 받을 때 MVP 실버 이상이거나 프리미엄 PC방이면 3%예요.' }] : []),
  { name: '받은 메소', text: '판매가에서 수수료를 뺀 금액이에요.' },
  { name: '손익', text: '받은 메소에서 들인 메소를 뺀 값이에요. 판매가를 적은 장비만 계산해요.' },
  { name: '합계', text: '제외한 장비는 합계·손익과 가계부에서 빠져요.' },
])
</script>

<template>
  <header class="head">
    <form v-if="renaming" class="rename" @submit.prevent="emit('rename')" novalidate>
      <input v-model="title" class="field-input" maxlength="40" aria-label="시트 이름">
      <button class="btn compact" :disabled="busy">저장</button>
      <button type="button" class="btn ghost compact" @click="renaming = false">취소</button>
    </form>
    <template v-else>
      <h3 class="ellipsis">{{ sheet.title }}</h3>
      <span v-if="sheet.characterName" class="link-tag">{{ sheet.characterName }} 연결</span>
      <button type="button" class="text-btn" @click="renaming = true">이름 바꾸기</button>
    </template>
    <div class="head-actions">
      <button type="button" class="exclude" :class="{ on: sheet.excluded }" :aria-pressed="sheet.excluded" :disabled="busy" :title="sheet.excluded ? '누르면 이 시트의 구매·강화·판매 금액을 가계부에 넣어요' : '누르면 이 시트의 금액을 가계부에서 모두 빼요'" @click="emit('toggleExcluded')">
        {{ sheet.excluded ? '가계부 미반영' : '가계부 반영' }}
      </button>
      <button v-if="sheet.ocid" type="button" class="btn ghost compact" :disabled="busy" @click="emit('import')">현재 장비 불러오기</button>
      <button type="button" class="btn ghost compact" :disabled="busy" @click="emit('removeSheet')">시트 삭제</button>
    </div>
  </header>
  <!-- 저장 실패·불러오기 결과는 늘 자리를 잡아 둔 한 줄에 보여서 표가 밀리지 않는다 -->
  <div class="status-line">
    <p class="status" :class="{ bad: failure }" role="status">
      {{ failure || notice || '금액은 억 단위 · 칸을 눌러 만 단위로 적어요' }}
    </p>
    <button type="button" class="col-help" @click="helpOpen = true">ⓘ 열 설명</button>
  </div>
  <AppModal v-model="helpOpen" title="열 설명" :width="440">
    <dl class="col-list">
      <div v-for="c in columnHelp" :key="c.name"><dt>{{ c.name }}</dt><dd>{{ c.text }}</dd></div>
    </dl>
  </AppModal>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
h3 {
  min-width: 0;
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 22px;
  font-weight: 400;
}
.link-tag {
  padding: 1px 8px;
  border: 1px solid var(--api);
  border-radius: 999px;
  color: var(--api);
  font-size: 12px;
}
.text-btn {
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
.rename {
  display: flex;
  gap: 6px;
}
.rename .field-input {
  min-height: 36px;
}
.head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.status-line {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status {
  flex: 1;
  min-width: 0;
  height: 20px;
  margin: 0;
  overflow: hidden;
  color: var(--sub);
  font-size: 12.5px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status.bad {
  color: var(--loss);
}
.col-help {
  flex: none;
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.col-help:hover {
  color: var(--text);
  border-color: var(--sub);
}
.col-list {
  display: grid;
  gap: 10px;
  margin: 0;
}
.col-list div {
  display: grid;
  gap: 2px;
}
.col-list dt {
  color: var(--gold);
  font-weight: 700;
}
.col-list dd {
  margin: 0;
  color: var(--sub);
  font-size: 13.5px;
  line-height: 1.5;
}
.exclude {
  min-height: 30px;
  padding: 2px 12px;
  background: color-mix(in srgb, var(--gain) 12%, transparent);
  border: 1px solid var(--gain);
  border-radius: 999px;
  color: var(--gain);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease;
}
.exclude.on {
  background: var(--bar);
  border-color: var(--panel-line);
  color: var(--sub);
}
@media (max-width: 640px) {
  .head-actions {
    margin-left: 0;
  }
}
</style>
