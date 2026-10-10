<script setup lang="ts">
import type { Memo } from '#shared/types'

// 메모 목록 + 편집. 가계부 페이지의 메모장 버튼이 여는 모달 안에 들어간다
const { memos, state, failure, busy, load, edit, create, remove } = useMemos()
onMounted(load)

const list = computed(() => memos.value ?? [])
const activeId = ref<string | null>(null)
const active = computed(() => list.value.find(m => m.id === activeId.value) ?? list.value[0] ?? null)
const titleInput = ref<HTMLInputElement | null>(null)

async function add() {
  const memo = await create()
  if (!memo) return
  activeId.value = memo.id
  await nextTick()
  titleInput.value?.focus()
}

// 지우기 전에 한 번 더 묻는다
const removing = ref<Memo | null>(null)
const removeOpen = computed({
  get: () => !!removing.value,
  set: (value) => {
    if (!value) removing.value = null
  },
})
function askRemove(memo: Memo) {
  removing.value = memo
}
async function confirmRemove() {
  if (removing.value && await remove(removing.value)) removing.value = null
}

// 제목을 안 적었으면 본문 첫 줄을 제목처럼 보여 준다
const lines = (m: Memo) => m.body.trim().split('\n')
const titleOf = (m: Memo) => m.title || lines(m)[0]?.slice(0, 40) || '제목 없음'
const restOf = (m: Memo) => (m.title ? lines(m) : lines(m).slice(1)).join('\n').trim()
const timeOf = (iso: string) => {
  const date = kstDateOf(iso)
  const time = new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  if (date === kstToday()) return `오늘 ${time}`
  return date.slice(0, 4) === kstToday().slice(0, 4) ? `${formatMonthDay(date)} ${time}` : date.replaceAll('-', '.')
}
const stateText = computed(() => {
  if (state.value === 'pending') return '브라우저에 임시 저장됨'
  if (state.value === 'saving') return '저장하는 중…'
  if (state.value === 'saved') return '저장했어요'
  if (state.value === 'failed') return '브라우저에 보관 중'
  return active.value ? `${timeOf(active.value.updatedAt)} 고침` : ''
})
</script>

<template>
  <div class="memo">
    <aside class="list">
      <button type="button" class="btn compact" :disabled="busy || !memos" @click="add">+ 새 메모</button>
      <ul v-if="memos">
        <li v-for="m in list" :key="m.id">
          <button type="button" class="item" :aria-current="m.id === active?.id" @click="activeId = m.id">
            <b class="ellipsis" :class="{ empty: !m.title && !m.body.trim() }">{{ titleOf(m) }}</b>
            <span class="ellipsis preview">{{ restOf(m).split('\n')[0] || ' ' }}</span>
            <time>{{ timeOf(m.updatedAt) }}</time>
          </button>
        </li>
      </ul>
      <ul v-else aria-hidden="true">
        <li v-for="i in 3" :key="i" class="skeleton item-skeleton" />
      </ul>
    </aside>

    <section v-if="active" class="editor">
      <div class="editor-top">
        <input
          ref="titleInput"
          class="field-input memo-title"
          :value="active.title"
          maxlength="60"
          placeholder="제목"
          @input="edit(active, 'title', ($event.target as HTMLInputElement).value)"
        >
        <button type="button" class="btn compact danger" @click="askRemove(active)">지우기</button>
      </div>
      <textarea
        class="field-input memo-body"
        :value="active.body"
        maxlength="20000"
        placeholder="보스 파티 시간, 경매장 시세, 할 일… 아무거나 적어 두세요."
        @input="edit(active, 'body', ($event.target as HTMLTextAreaElement).value)"
      />
      <div class="editor-foot">
        <span v-if="failure" class="form-error">{{ failure }}</span>
        <span class="status" :class="state">{{ stateText }}</span>
      </div>
    </section>
    <div v-else-if="memos" class="blank">
      <img src="/favicon.svg" alt="" width="48" height="48">
      <p class="muted">시세, 할 일, 보스 파티 시간처럼 따로 둘 곳 없는 것들을 적어 두세요.</p>
      <button type="button" class="btn" :disabled="busy" @click="add">+ 첫 메모 만들기</button>
      <p v-if="failure" class="form-error">{{ failure }}</p>
    </div>
    <div v-else class="skeleton editor-skeleton" />

    <AppModal v-model="removeOpen" title="메모 지우기" :width="420">
      <div v-if="removing" class="confirm">
        <div class="confirm-memo">
          <b class="ellipsis">{{ titleOf(removing) }}</b>
          <span class="confirm-preview">{{ restOf(removing) || '본문 없음' }}</span>
        </div>
        <p class="muted small">지우면 되돌릴 수 없어요.</p>
        <div class="confirm-actions">
          <button type="button" class="btn ghost compact" @click="removeOpen = false">취소</button>
          <button type="button" class="btn danger compact" :disabled="busy" @click="confirmRemove">지우기</button>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.memo {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  flex: 1;
  gap: 14px;
  min-height: 0;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.list ul {
  display: grid;
  align-content: start;
  gap: 4px;
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 4px 0 0;
  overflow-y: auto;
  list-style: none;
}
.item {
  display: grid;
  gap: 2px;
  width: 100%;
  padding: 9px 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-left: 3px solid transparent;
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease;
}
.item:hover {
  background: var(--panel);
}
.item[aria-current="true"] {
  background: var(--panel);
  border-color: var(--tip-line);
  border-left-color: var(--loss);
}
.item b {
  font-size: 14px;
}
.item b.empty {
  color: var(--sub);
  font-weight: 400;
}
.preview,
.item time {
  color: var(--sub);
  font-size: 12px;
}
.preview {
  min-height: 1.4em;
}
.editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.editor-top {
  display: flex;
  gap: 8px;
}
.memo-title {
  font-family: var(--f-title);
  font-size: 18px;
}
.memo-body {
  flex: 1;
  min-height: 300px;
  padding: 12px;
  line-height: 1.65;
  resize: none;
}
/* 저장 상태 글자는 늘 자리를 잡아 둬서 바뀌어도 칸이 움직이지 않는다 */
.editor-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 18px;
  font-size: 12px;
}
.editor-foot .form-error {
  padding: 0;
  background: none;
  border: 0;
  font-size: 12px;
}
.status {
  margin-left: auto;
  color: var(--sub);
  white-space: nowrap;
}
.status.saved {
  color: var(--gain);
}
.blank {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  text-align: center;
}
.blank img {
  animation: bob 2.4s ease-in-out infinite;
}
.confirm {
  display: grid;
  gap: 12px;
}
.confirm-memo {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--loss);
  border-radius: 8px;
}
/* 본문은 세 줄까지만 보여 준다 */
.confirm-preview {
  display: -webkit-box;
  overflow: hidden;
  color: var(--sub);
  font-size: 13px;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.item-skeleton {
  height: 68px;
  border-radius: 8px;
}
.editor-skeleton {
  min-height: 300px;
  border-radius: 6px;
}
.small {
  font-size: 13px;
}
@media (max-width: 800px) {
  .memo {
    grid-template-columns: 1fr;
  }
  .list ul {
    max-height: 220px;
  }
}
</style>
