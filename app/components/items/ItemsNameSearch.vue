<script setup lang="ts">
import type { ItemIcon } from '#shared/types'

// 장비 이름 칸. 치는 대로 넥슨 API에서 본 장비·펫·캐시템을 아이콘과 함께 보여주고, 고르면 그 이름으로 채운다
const name = defineModel<string>({ required: true })
const emit = defineEmits<{ pick: [item: ItemIcon] }>()
withDefaults(defineProps<{ placeholder?: string, label?: string, enter?: boolean, required?: boolean }>(), { placeholder: '장비 이름으로 추가', label: '추가할 장비 이름', enter: true, required: false })

const DEBOUNCE_MS = 200
const KIND_LABELS: Record<ItemIcon['kind'], string> = { equipment: '장비', pet: '펫', cash: '캐시', symbol: '심볼', etc: '기타' }

const results = ref<ItemIcon[]>([])
const open = ref(false)
const active = ref(-1)
let timer: ReturnType<typeof setTimeout> | undefined
let latest = 0

// v-model 값은 부모를 한 바퀴 돌아와야 바뀌어서, 방금 친 글자는 입력칸에서 바로 읽는다
function onInput(event: Event) {
  clearTimeout(timer)
  const q = (event.target as HTMLInputElement).value.trim()
  if (!q) {
    results.value = []
    return
  }
  timer = setTimeout(async () => {
    const ticket = ++latest
    const found = await $fetch<ItemIcon[]>('/api/items/icons', { query: { q } }).catch(() => [])
    // 늦게 온 옛 검색 결과가 새 결과를 덮지 않게 한다
    if (ticket !== latest) return
    results.value = found
    active.value = -1
    open.value = true
  }, DEBOUNCE_MS)
}

function pick(item: ItemIcon) {
  name.value = item.name
  emit('pick', item)
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value || !results.value.length) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    active.value = (active.value + step + results.value.length) % results.value.length
  }
  else if (event.key === 'Enter' && active.value >= 0) {
    // 목록에서 고르는 엔터는 장비 추가로 넘어가지 않게 막는다
    event.preventDefault()
    pick(results.value[active.value]!)
  }
  else if (event.key === 'Escape') open.value = false
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="name-search">
    <span class="icon" aria-hidden="true">⌕</span>
    <input
      v-model="name"
      maxlength="40"
      :placeholder="placeholder"
      :aria-label="label"
      autocomplete="off"
      :required="required"
      @input="onInput"
      @keydown="onKeydown"
      @focus="open = results.length > 0"
      @blur="open = false"
    >
    <kbd v-if="enter" aria-hidden="true">Enter</kbd>
    <ul v-if="open && results.length" class="results" role="listbox">
      <li v-for="(item, i) in results" :key="item.name" role="option" :aria-selected="i === active">
        <!-- blur보다 먼저 고르도록 mousedown에서 처리한다 -->
        <button type="button" :class="{ on: i === active }" @mousedown.prevent="pick(item)">
          <img :src="item.icon" alt="">
          <span class="ellipsis">{{ item.name }}</span>
          <small>{{ item.part || KIND_LABELS[item.kind] }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 헤더 검색칸과 같은 알약 모양, 조금 더 크게 */
.name-search {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  transition: border-color var(--fast) ease, background var(--fast) ease;
}
.name-search:focus-within {
  background: var(--panel);
  border-color: var(--gold);
}
.icon {
  padding: 0 4px 0 14px;
  color: var(--sub);
  font-size: 19px;
  pointer-events: none;
}
input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 4px;
  background: none;
  border: 0;
  outline: none;
  color: var(--text);
  font: inherit;
  font-size: 15px;
}
input::placeholder {
  color: var(--sub);
}
kbd {
  margin-right: 10px;
  padding: 2px 7px;
  border: 1px solid var(--panel-line);
  border-radius: 4px;
  color: var(--sub);
  font: 11px/1.3 var(--f-body);
}
.name-search:focus-within kbd {
  border-color: rgb(242 193 78 / 0.5);
  color: var(--gold);
}
/* 추가 칸은 화면 맨 아래라 목록을 위로 펼친다 */
.results {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  z-index: 20;
  display: grid;
  width: max(100%, 320px);
  max-height: 320px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  background: var(--win);
  border: 1px solid var(--win-line);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);
  list-style: none;
}
.results button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 8px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.results button:hover,
.results button.on {
  background: rgb(242 193 78 / 0.12);
}
.results img {
  flex: none;
  width: 28px;
  height: 28px;
  object-fit: contain;
  image-rendering: pixelated;
}
.results small {
  flex: none;
  margin-left: auto;
  color: var(--sub);
  font-size: 11px;
}
</style>
