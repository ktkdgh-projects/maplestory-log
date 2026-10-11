<script setup lang="ts">
import type { ItemSheet } from '#shared/types'

const props = defineProps<{ sheets: ItemSheet[], activeId: string | null, creating: boolean }>()
const emit = defineEmits<{ select: [id: string], create: [], reorder: [ids: string[]] }>()

const list = ref<ItemSheet[]>([...props.sheets])
watch(() => props.sheets, (value) => {
  list.value = [...value]
})
const dragId = ref<string | null>(null)
function over(index: number) {
  const from = list.value.findIndex(s => s.id === dragId.value)
  if (from < 0 || from === index) return
  const [moved] = list.value.splice(from, 1)
  list.value.splice(index, 0, moved!)
}
function drop() {
  dragId.value = null
  const ids = list.value.map(s => s.id)
  if (ids.join() !== props.sheets.map(s => s.id).join()) emit('reorder', ids)
}
</script>

<template>
  <div class="sheet-tabs" role="tablist" aria-label="시트">
    <button
      v-for="(s, i) in list"
      :key="s.id"
      type="button"
      role="tab"
      class="tab"
      :class="{ dragging: dragId === s.id }"
      draggable="true"
      title="끌어서 순서 바꾸기"
      :aria-selected="s.id === activeId"
      @dragstart="dragId = s.id"
      @dragover.prevent="over(i)"
      @drop.prevent="drop"
      @dragend="dragId = null"
      @click="emit('select', s.id)"
    >
      {{ s.title }}
    </button>
    <button type="button" class="tab add" :aria-selected="creating" @click="emit('create')">+ 시트</button>
  </div>
</template>

<style scoped>
/* 엑셀 시트 탭처럼 고른 시트는 표와 같은 색으로 이어지게 위 테두리를 없앤다 */
.sheet-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  padding-left: 10px;
}
.tab {
  position: relative;
  min-width: 72px;
  height: 32px;
  margin-left: -1px;
  padding: 0 16px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-top-color: var(--panel-line);
  border-radius: 0 0 6px 6px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 15px;
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.tab:hover {
  background: var(--panel);
  color: var(--text);
}
.tab[aria-selected="true"] {
  z-index: 1;
  height: 35px;
  background: var(--panel);
  border-top-color: var(--panel);
  border-bottom: 2px solid var(--gold);
  color: var(--gold);
}
.tab.dragging {
  outline: 1px dashed var(--gold);
}
.tab.add {
  border-style: dashed;
}
</style>
