<script lang="ts">
// 모든 모달이 같이 쓰는 열린 순서. Esc는 맨 위 모달만 닫고, 하나라도 열려 있으면 뒤 스크롤을 막는다
const stack: symbol[] = []
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string, width?: number, fit?: boolean }>(), { width: 560 })
const open = defineModel<boolean>({ required: true })

const self = Symbol('modal')
let returnFocus: HTMLElement | null = null
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && stack.at(-1) === self) open.value = false
}
function lockScroll() {
  document.body.style.overflow = stack.length ? 'hidden' : ''
}
function enter() {
  if (stack.includes(self)) return
  stack.push(self)
  lockScroll()
  offset.value = { x: 0, y: 0 }
  returnFocus = document.activeElement as HTMLElement | null
  window.addEventListener('keydown', onKey)
  nextTick(() => {
    if (box.value && !box.value.contains(document.activeElement)) box.value.focus({ preventScroll: true })
  })
}
function leave() {
  const i = stack.indexOf(self)
  if (i < 0) return
  stack.splice(i, 1)
  lockScroll()
  window.removeEventListener('keydown', onKey)
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
  returnFocus = null
}
watch(open, (value) => {
  if (value) enter()
  else leave()
})
onMounted(() => {
  if (open.value) enter()
})
onBeforeUnmount(leave)

const box = ref<HTMLElement | null>(null)
const offset = ref({ x: 0, y: 0 })
let drag: { x: number, y: number, base: { x: number, y: number }, rect: DOMRect } | null = null
// 끌다가 바깥에서 손을 떼면 바깥 클릭으로 닫히지 않게 한다
let justDragged = false
function startDrag(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
  drag = { x: event.clientX, y: event.clientY, base: { ...offset.value }, rect: box.value!.getBoundingClientRect() }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function moveDrag(event: PointerEvent) {
  if (!drag) return
  const EDGE = 8
  const dx = Math.min(Math.max(event.clientX - drag.x, EDGE - drag.rect.left), window.innerWidth - EDGE - drag.rect.right)
  const dy = Math.min(Math.max(event.clientY - drag.y, EDGE - drag.rect.top), window.innerHeight - EDGE - drag.rect.bottom)
  if (Math.abs(dx) + Math.abs(dy) > 3) justDragged = true
  offset.value = { x: drag.base.x + dx, y: drag.base.y + dy }
}
function endDrag() {
  drag = null
  setTimeout(() => (justDragged = false))
}
function backdropClick() {
  if (!justDragged) open.value = false
}
const sizeStyle = computed(() => (props.fit ? { width: 'fit-content', maxWidth: `min(${props.width}px, 100%)` } : { width: `min(${props.width}px, 100%)` }))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" @click.self="backdropClick">
        <section ref="box" class="modal" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" :style="{ ...sizeStyle, translate: `${offset.x}px ${offset.y}px` }">
          <header class="head" title="끌어서 옮기기" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag">
            <span class="dot" aria-hidden="true" />
            <h2>{{ title }}</h2>
            <button type="button" class="close" aria-label="닫기" @click="open = false">×</button>
          </header>
          <div class="body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(5 7 14 / 0.65);
  backdrop-filter: blur(3px);
}
.modal {
  max-height: calc(100dvh - 32px);
  overflow: hidden;
  outline: none;
  display: flex;
  flex-direction: column;
  background: var(--win);
  border: 2px solid var(--win-line);
  border-radius: 12px;
  box-shadow: 0 0 0 2px var(--bar), 0 20px 50px rgb(0 0 0 / 0.5);
}
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  padding: 9px 14px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 22%, var(--title)), var(--title) 70%);
  border-bottom: 2px solid var(--win-line);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--gold);
  box-shadow: 0 0 10px var(--gold);
}
h2 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 19px;
  font-weight: 400;
}
.close {
  margin-left: auto;
  width: 30px;
  height: 30px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font-size: 18px;
  cursor: pointer;
}
.close:hover {
  color: var(--text);
  border-color: var(--tip-line);
}
.body {
  display: grid;
  gap: 12px;
  padding: 14px;
  overflow-y: auto;
}
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--fast) ease;
}
.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--normal) var(--ease-spring);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(14px) scale(0.96);
}
</style>
