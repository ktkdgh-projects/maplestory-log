<script setup lang="ts">
// 가계부 페이지에 떠 있는 메모장 버튼. 페이지를 옮기지 않고 모달로 연다
// 본문 오른쪽 빈 곳 안에서만 끌어 옮길 수 있고, 옮긴 자리는 이 브라우저에 남긴다
const SIZE = 52
const EDGE = 12
const POS_KEY = 'memo-fab-pos'
const DRAG_THRESHOLD = 4

const open = ref(false)
const { flush } = useMemos()
watch(open, (value) => {
  if (!value) flush()
})

// 오른쪽 끝에서 떨어진 거리, 아래 끝에서 떨어진 거리
const saved = ref<{ right: number, bottom: number } | null>(null)
const pos = ref<{ left: number, top: number } | null>(null)
const button = ref<HTMLButtonElement | null>(null)

// 움직일 수 있는 칸: 가로는 본문 오른쪽 끝 ~ 화면 끝, 세로는 헤더 아래 ~ 화면 끝
function bounds() {
  const main = document.querySelector('main.wrap')?.getBoundingClientRect()
  const header = document.querySelector('.menubar')?.getBoundingClientRect()
  const minLeft = (main?.right ?? window.innerWidth) + EDGE
  const maxLeft = window.innerWidth - SIZE - EDGE
  return minLeft > maxLeft ? null : { minLeft, maxLeft, minTop: (header?.bottom ?? 0) + EDGE, maxTop: window.innerHeight - SIZE - EDGE }
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// 오른쪽 빈 곳이 없을 만큼 좁은 화면이면 기본 자리(CSS)로 둔다
function place() {
  const b = bounds()
  if (!b || !saved.value) {
    pos.value = null
    return
  }
  pos.value = {
    left: clamp(window.innerWidth - SIZE - saved.value.right, b.minLeft, b.maxLeft),
    top: clamp(window.innerHeight - SIZE - saved.value.bottom, b.minTop, b.maxTop),
  }
}

onMounted(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null')
    if (typeof raw?.right === 'number' && typeof raw?.bottom === 'number') saved.value = raw
  }
  catch {}
  place()
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => window.removeEventListener('resize', place))

let start: { x: number, y: number, left: number, top: number } | null = null
const dragging = ref(false)
function down(event: PointerEvent) {
  if (event.button !== 0 || !bounds()) return
  const rect = button.value!.getBoundingClientRect()
  start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  try {
    button.value!.setPointerCapture(event.pointerId)
  }
  catch {}
}
function move(event: PointerEvent) {
  const b = start && bounds()
  if (!start || !b) return
  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (!dragging.value && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
  dragging.value = true
  pos.value = { left: clamp(start.left + dx, b.minLeft, b.maxLeft), top: clamp(start.top + dy, b.minTop, b.maxTop) }
}
function up() {
  start = null
  if (!dragging.value || !pos.value) return
  saved.value = { right: window.innerWidth - SIZE - pos.value.left, bottom: window.innerHeight - SIZE - pos.value.top }
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(saved.value))
  }
  catch {}
}
// 끌었다 놓은 건 클릭으로 치지 않는다
function click() {
  if (dragging.value) dragging.value = false
  else open.value = true
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="fab"
    :class="{ dragging }"
    :style="pos ? { left: `${pos.left}px`, top: `${pos.top}px`, right: 'auto', bottom: 'auto' } : undefined"
    aria-label="메모장 열기"
    title="메모장 · 끌어서 옮기기"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @click="click"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 11h7M9 15h7M9 19h4" /></svg>
  </button>
  <AppModal v-model="open" title="메모장" :width="920">
    <MemoBoard class="modal-board" />
  </AppModal>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 50;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  background: var(--win);
  border: 2px solid var(--win-line);
  border-radius: 16px;
  box-shadow: 0 0 0 2px var(--bar), 0 10px 24px rgb(0 0 0 / 0.4);
  color: var(--loss);
  cursor: pointer;
  touch-action: none;
  transition: transform var(--fast) var(--ease-out), border-color var(--fast) ease;
}
.fab:hover {
  border-color: var(--loss);
  transform: translateY(-3px);
}
.fab.dragging {
  border-color: var(--loss);
  cursor: grabbing;
  transform: scale(1.06);
  transition: none;
}
.fab svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.modal-board {
  height: min(560px, calc(100dvh - 180px));
}
/* 모바일은 아래 탭바 위로 올린다 */
@media (max-width: 640px) {
  .fab {
    right: 16px;
    bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
