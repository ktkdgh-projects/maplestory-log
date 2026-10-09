<script setup lang="ts">
withDefaults(defineProps<{ title: string, width?: number }>(), { width: 560 })
const open = defineModel<boolean>({ required: true })

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}
watch(open, (value) => {
  if (value) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="backdrop" @click.self="open = false">
        <section class="modal" role="dialog" aria-modal="true" :aria-label="title" :style="{ width: `min(${width}px, 100%)` }">
          <header class="head">
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
  scrollbar-gutter: stable;
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
