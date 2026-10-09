<script setup lang="ts">
const props = defineProps<{ value: number, label: string, disabled?: boolean }>()
const emit = defineEmits<{ save: [meso: number] }>()

const editing = ref(false)
const text = ref('')
const input = ref<HTMLInputElement | null>(null)

async function start() {
  if (props.disabled) return
  text.value = props.value ? String(Math.round((props.value / EOK) * 100) / 100) : ''
  editing.value = true
  await nextTick()
  input.value?.select()
}
function commit() {
  if (!editing.value) return
  editing.value = false
  const eok = Number(text.value.replace(/,/g, '') || 0)
  if (!Number.isFinite(eok) || eok < 0) return
  const meso = Math.round(eok * EOK)
  if (meso !== props.value) emit('save', meso)
}
</script>

<template>
  <input
    v-if="editing"
    ref="input"
    v-model="text"
    class="cell-input"
    inputmode="decimal"
    :aria-label="`${label} (억)`"
    @keydown.enter.prevent="commit"
    @keydown.esc="editing = false"
    @blur="commit"
  >
  <button v-else type="button" class="cell" :class="{ blank: !value }" :disabled="disabled" :title="value ? `${formatKoreanNumber(value)} 메소` : `${label} 입력`" @click="start">
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
.cell-input {
  background: var(--bar);
  border: 1px solid var(--gold);
  outline: none;
  box-shadow: var(--glow);
  color: var(--text);
}
</style>
