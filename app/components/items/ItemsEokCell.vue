<script setup lang="ts">
// 보기는 억 단위지만 입력은 다른 메소 칸처럼 만 단위(1 → 1만 메소)다
const props = defineProps<{ value: number, label: string, disabled?: boolean }>()
const emit = defineEmits<{ save: [meso: number] }>()

const editing = ref(false)
const text = ref('')
const input = ref<HTMLInputElement | null>(null)

async function start() {
  if (props.disabled) return
  text.value = props.value ? mesoToManText(props.value) : ''
  editing.value = true
  await nextTick()
  input.value?.select()
}
// 예전처럼 억 단위 소수(1.5)를 치면 저장하지 않고 칸 아래에 알려 준다
const invalid = computed(() => /[^\d,\s]/.test(text.value))
const preview = computed(() => {
  if (invalid.value) return '숫자만 만 단위로 적어 주세요 (1 = 1만)'
  const meso = manTextToMeso(text.value)
  return meso ? `${formatKoreanNumber(meso)} 메소` : '비우면 0이에요'
})
function onInput() {
  if (!invalid.value) text.value = mesoToManText(manTextToMeso(text.value))
}
// 엔터로 저장하면 같은 열의 아래 줄(Shift면 위 줄) 칸을 바로 입력 상태로 연다
async function commitAndMove(event: KeyboardEvent) {
  if (invalid.value) return
  const td = input.value?.closest('td')
  const tr = td?.parentElement
  commit()
  if (!td || !tr) return
  const next = (event.shiftKey ? tr.previousElementSibling : tr.nextElementSibling) as HTMLTableRowElement | null
  await nextTick()
  next?.cells[td.cellIndex]?.querySelector<HTMLButtonElement>('button.cell')?.click()
}
function commit() {
  if (!editing.value) return
  // 잘못 적은 채로 벗어나면 안내를 이미 봤으므로 저장 없이 원래 값으로 둔다
  editing.value = false
  if (invalid.value) return
  const meso = manTextToMeso(text.value) ?? 0
  if (meso !== props.value) emit('save', meso)
}
</script>

<template>
  <div v-if="editing" class="edit">
    <input
      ref="input"
      v-model="text"
      class="cell-input"
      :class="{ bad: invalid }"
      inputmode="numeric"
      autocomplete="off"
      :aria-label="`${label} (만 단위)`"
      :aria-invalid="invalid"
      @input="onInput"
      @keydown.enter.prevent="commitAndMove"
      @keydown.esc="editing = false"
      @blur="commit"
    >
    <span class="unit" aria-hidden="true">만</span>
    <!-- 표 위에 겹쳐 띄워 줄 높이가 바뀌지 않는다 -->
    <span class="preview" :class="{ bad: invalid }" role="status">{{ preview }}</span>
  </div>
  <button v-else type="button" class="cell" :class="{ blank: !value }" :disabled="disabled" :aria-label="value ? `${label} ${formatKoreanNumber(value)} 메소, 고치기` : `${label} 입력`" @click="start">
    {{ value ? formatEok(value) : '-' }}
  </button>
</template>

<style scoped>
/* 표의 다른 칸과 오른쪽 끝이 맞도록 좌우 여백을 칸 여백(10px)과 같게 둔다 */
.cell,
.cell-input {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border-radius: 5px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.cell {
  background: transparent;
  border: 1px solid transparent;
  color: inherit;
  cursor: text;
  transition: border-color var(--fast) ease, background var(--fast) ease;
}
.cell:hover:not(:disabled) {
  background: var(--bar);
  border-color: var(--panel-line);
}
.cell:disabled {
  cursor: default;
}
.cell.blank {
  color: var(--panel-line);
}
.edit {
  position: relative;
}
.cell-input {
  padding-right: 24px;
  background: var(--bar);
  border: 1px solid var(--gold);
  outline: none;
  box-shadow: var(--glow);
  color: var(--text);
}
.cell-input.bad {
  border-color: var(--loss);
  box-shadow: 0 0 0 1px var(--loss);
}
.unit {
  position: absolute;
  top: 16px;
  right: 9px;
  color: var(--sub);
  font-size: 11px;
  translate: 0 -50%;
  pointer-events: none;
}
.preview {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 3;
  padding: 3px 8px;
  background: rgb(10 12 22 / 0.96);
  border: 1px solid var(--tip-line);
  border-radius: 6px;
  color: var(--gold);
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
}
.preview.bad {
  border-color: var(--loss);
  color: var(--loss);
}
</style>
