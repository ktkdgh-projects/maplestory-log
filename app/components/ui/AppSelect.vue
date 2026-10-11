<script setup lang="ts" generic="T extends string | number">
export interface SelectOption<V> { value: V, label: string, sub?: string, disabled?: boolean }

const props = withDefaults(defineProps<{ options: SelectOption<T>[], id?: string, placeholder?: string, disabled?: boolean, label?: string }>(), { placeholder: '고르기' })
const value = defineModel<T>({ required: true })

const open = ref(false)
const active = ref(-1)
const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)
const uid = useId()
const listId = computed(() => `${props.id ?? uid}-list`)

const current = computed(() => props.options.find(o => o.value === value.value))

function show() {
  if (props.disabled) return
  open.value = true
  active.value = Math.max(0, props.options.findIndex(o => o.value === value.value))
  nextTick(scrollActive)
}
function hide() {
  open.value = false
}
function pick(option: SelectOption<T> | undefined) {
  if (!option || option.disabled) return
  value.value = option.value
  hide()
}
function scrollActive() {
  list.value?.children[active.value]?.scrollIntoView({ block: 'nearest' })
}
function move(step: number) {
  const count = props.options.length
  if (!count) return
  let next = active.value
  for (let i = 0; i < count; i++) {
    next = (next + step + count) % count
    if (!props.options[next]?.disabled) break
  }
  active.value = next
  nextTick(scrollActive)
}
function onKey(event: KeyboardEvent) {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      show()
    }
    return
  }
  if (event.key === 'ArrowDown') move(1)
  else if (event.key === 'ArrowUp') move(-1)
  else if (event.key === 'Home') active.value = 0
  else if (event.key === 'End') active.value = props.options.length - 1
  else if (event.key === 'Enter' || event.key === ' ') pick(props.options[active.value])
  else if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault()
    hide()
    return
  }
  else return
  event.preventDefault()
}
function onOutside(event: PointerEvent) {
  if (open.value && !root.value?.contains(event.target as Node)) hide()
}
onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="app-select" :class="{ open, disabled }">
    <button
      :id="id"
      type="button"
      class="trigger"
      role="combobox"
      :aria-label="label"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && active >= 0 ? `${listId}-${active}` : undefined"
      :disabled="disabled"
      @click="open ? hide() : show()"
      @keydown="onKey"
    >
      <span class="ellipsis" :class="{ placeholder: !current }">{{ current?.label ?? placeholder }}</span>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
    </button>
    <Transition name="pop">
      <ul v-if="open" :id="listId" ref="list" class="list" role="listbox" :aria-label="label">
        <li
          v-for="(o, i) in options"
          :id="`${listId}-${i}`"
          :key="String(o.value)"
          role="option"
          :aria-selected="o.value === value"
          :aria-disabled="o.disabled"
          :class="{ active: i === active, selected: o.value === value, off: o.disabled }"
          @pointerenter="active = i"
          @click="pick(o)"
        >
          <span class="ellipsis">{{ o.label }}</span>
          <small v-if="o.sub">{{ o.sub }}</small>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.app-select {
  position: relative;
  min-width: 0;
}
.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.trigger:hover:not(:disabled) {
  border-color: var(--tip-line);
}
.open .trigger,
.trigger:focus-visible {
  border-color: var(--gold);
  outline: none;
  box-shadow: var(--glow);
}
.trigger:disabled {
  cursor: default;
  opacity: 0.6;
}
.trigger svg {
  flex: none;
  width: 12px;
  height: 12px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
  transition: rotate var(--fast) ease;
}
.open .trigger svg {
  rotate: 180deg;
}
.placeholder {
  color: var(--sub);
}
.list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  z-index: 30;
  display: grid;
  gap: 1px;
  max-height: 280px;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  background: rgb(14 17 32 / 0.98);
  border: 1px solid var(--tip-line);
  border-radius: 8px;
  box-shadow: 0 14px 30px rgb(0 0 0 / 0.5);
  list-style: none;
  scrollbar-width: thin;
}
.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
.list li small {
  flex: none;
  color: var(--sub);
  font-size: 12px;
}
.list li.active {
  background: var(--panel);
}
.list li.selected {
  color: var(--gold);
}
.list li.off {
  cursor: default;
  opacity: 0.4;
}
</style>
