<script setup lang="ts">
// align: 창 가장자리 칸은 카드가 잘리지 않게 그쪽 끝에 붙인다
withDefaults(defineProps<{ title: string, align?: 'left' | 'center' | 'right' }>(), { align: 'center' })
</script>

<template>
  <div class="hover-info" tabindex="0">
    <slot />
    <div class="card" :class="align" role="tooltip">
      <b>{{ title }}</b>
      <slot name="info" />
    </div>
  </div>
</template>

<style scoped>
.hover-info {
  position: relative;
  display: grid;
  outline: none;
}
.card {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  z-index: 20;
  display: grid;
  gap: 3px;
  width: max-content;
  min-width: 200px;
  max-width: 280px;
  padding: 10px 12px;
  translate: -50% 6px;
  background: rgb(10 12 22 / 0.96);
  border: 1px solid var(--tip-line);
  border-radius: 8px;
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.45);
  font-size: 13px;
  line-height: 1.5;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--fast) ease, translate var(--fast) var(--ease-out);
}
.card::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  border: 6px solid transparent;
  border-top-color: var(--tip-line);
}
.card b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.card.left {
  left: 0;
  translate: 0 6px;
}
.card.left::after {
  left: 32px;
}
.card.right {
  right: 0;
  left: auto;
  translate: 0 6px;
}
.card.right::after {
  left: auto;
  right: 26px;
  translate: 0 0;
}
.hover-info:hover .card.left,
.hover-info:hover .card.right,
.hover-info:focus-visible .card.left,
.hover-info:focus-visible .card.right {
  opacity: 1;
  translate: 0 0;
}
.hover-info:hover .card,
.hover-info:focus-visible .card {
  opacity: 1;
  translate: -50% 0;
}
</style>
