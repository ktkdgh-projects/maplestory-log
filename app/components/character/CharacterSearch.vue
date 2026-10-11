<script setup lang="ts">
import type { CharacterBrief } from '#shared/types'

// allLabel을 주면 맨 위에 '전체'(값 'all')가 생긴다
const props = defineProps<{ characters: CharacterBrief[], allLabel?: string, placeholder?: string }>()
const ocid = defineModel<string | null>({ required: true })
const listId = useId()

const ALL = 'all'
const query = ref('')
const open = ref(false)
const active = ref(0)
const field = ref<HTMLInputElement | null>(null)

const current = computed(() => props.characters.find(c => c.ocid === ocid.value) ?? null)
const currentLabel = computed(() => (ocid.value === ALL && props.allLabel) ? props.allLabel : current.value ? `${current.value.name} · ${current.value.job} · LV.${current.value.level}` : '')

interface Option { value: string, name: string, sub: string }
const options = computed<Option[]>(() => {
  const keyword = query.value.trim()
  const matched = keyword ? props.characters.filter(c => matchCharacter(c, keyword)) : props.characters
  const list = matched.map(c => ({ value: c.ocid, name: c.name, sub: `${c.world} · ${c.job} · LV.${c.level}` }))
  return props.allLabel && !keyword ? [{ value: ALL, name: props.allLabel, sub: `캐릭터 ${props.characters.length}개 합쳐 보기` }, ...list] : list
})

function show() {
  query.value = ''
  open.value = true
  active.value = Math.max(0, options.value.findIndex(o => o.value === ocid.value))
}
function pick(option: Option | undefined) {
  if (!option) return
  ocid.value = option.value
  open.value = false
  field.value?.blur()
}
function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault()
      show()
    }
    return
  }
  const count = options.value.length
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && count) {
    event.preventDefault()
    active.value = (active.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    pick(options.value[active.value])
  }
  else if (event.key === 'Escape') {
    open.value = false
    field.value?.blur()
  }
}
watch(query, () => {
  active.value = 0
})
</script>

<template>
  <div class="char-search" :class="{ open }">
    <span class="icon" aria-hidden="true">⌕</span>
    <input
      ref="field"
      :value="open ? query : currentLabel"
      :placeholder="open && currentLabel ? currentLabel : (placeholder ?? '이름·직업·월드로 캐릭터 찾기')"
      aria-label="캐릭터 찾기"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && options.length ? `${listId}-${active}` : undefined"
      @focus="show"
      @blur="open = false"
      @input="query = ($event.target as HTMLInputElement).value"
      @keydown="onKeydown"
    >
    <ul v-if="open" :id="listId" class="results" role="listbox" aria-label="캐릭터">
      <li v-for="(o, i) in options" :id="`${listId}-${i}`" :key="o.value" role="option" :aria-selected="o.value === ocid">
        <!-- blur보다 먼저 고르도록 mousedown에서 처리한다 -->
        <button type="button" tabindex="-1" :class="{ on: i === active, all: o.value === ALL, picked: o.value === ocid }" @mousedown.prevent="pick(o)" @pointerenter="active = i">
          <b class="ellipsis">{{ o.name }}</b>
          <small class="ellipsis">{{ o.sub }}</small>
        </button>
      </li>
      <li v-if="!options.length" class="none">맞는 캐릭터가 없어요.</li>
    </ul>
  </div>
</template>

<style scoped>
.char-search {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
  max-width: 100%;
  height: 38px;
  background: rgb(255 255 255 / 0.04);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  transition: border-color var(--fast) ease, background var(--fast) ease;
}
.char-search:hover {
  border-color: var(--tip-line);
}
.char-search.open,
.char-search:focus-within {
  background: var(--panel);
  border-color: var(--gold);
}
.icon {
  padding: 0 4px 0 13px;
  color: var(--sub);
  font-size: 18px;
  pointer-events: none;
}
input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 14px 0 4px;
  background: none;
  border: 0;
  outline: none;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-overflow: ellipsis;
}
input::placeholder {
  color: var(--sub);
}
.results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 1px;
  width: max(100%, 300px);
  max-height: 320px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  background: var(--win);
  border: 1px solid var(--win-line);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.5);
  list-style: none;
  scrollbar-width: thin;
}
.results button {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 4px 10px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.results button.on {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
}
.results button.picked b {
  color: var(--gold);
}
.results button.all {
  border-bottom: 1px solid var(--panel-line);
  border-radius: 6px 6px 0 0;
}
.results b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.results small {
  color: var(--sub);
  font-size: 12px;
  text-align: right;
}
.none {
  padding: 8px 10px;
  color: var(--sub);
  font-size: 13px;
}
@media (max-width: 640px) {
  .char-search {
    width: 100%;
  }
}
</style>
