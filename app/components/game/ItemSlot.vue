<script setup lang="ts">
const props = defineProps<{ label: string, caption?: string, icon?: string, placeholder?: string, star?: number, grade?: string | null, selected?: boolean }>()
defineEmits<{ select: [event: MouseEvent] }>()

const frame = computed(() => potentialGradeColor(props.grade) ?? 'var(--panel-line)')
</script>

<template>
  <button
    type="button"
    class="slot"
    :class="{ empty: !icon }"
    :style="{ '--frame': frame }"
    :aria-pressed="selected"
    :aria-label="`${label} 슬롯`"
    :title="label"
    :disabled="!icon"
    @click="$emit('select', $event)"
  >
    <img v-if="icon" :src="icon" alt="" loading="lazy">
    <img v-else-if="placeholder" :src="placeholder" alt="" class="placeholder">
    <span v-else class="label">{{ caption ?? label }}</span>
    <span v-if="star" class="star">★{{ star }}</span>
  </button>
</template>

<style scoped>
.slot {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  width: 100%;
  padding: 0;
  overflow: hidden;
  background: linear-gradient(180deg, var(--slot-top), var(--slot-bot));
  border: 2px solid var(--frame);
  border-radius: 6px;
  color: var(--sub);
  font-family: var(--f-body);
  cursor: pointer;
  transition: box-shadow var(--fast) ease, filter var(--fast) ease;
}
.slot:hover:not(.empty) {
  filter: brightness(1.18);
}
.slot[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--text), 0 0 14px color-mix(in srgb, var(--tint) 35%, transparent);
}
.slot.empty {
  cursor: default;
  background: var(--panel);
  border: 1px solid var(--panel-line);
}
.slot img {
  grid-area: 1 / 1;
  width: 70%;
  height: 70%;
  object-fit: contain;
  image-rendering: pixelated;
}
.slot img.placeholder {
  opacity: 0.45;
  filter: grayscale(0.6);
}
.star {
  position: absolute;
  top: 2px;
  left: 3px;
  color: var(--exp);
  font-family: var(--f-pixel);
  font-size: 9px;
  line-height: 1;
  text-shadow: 0 1px 0 #000, 1px 0 0 #000;
}
.label {
  color: var(--faint);
  font-family: var(--f-pixel);
  font-size: 9px;
  line-height: 1;
  white-space: nowrap;
}
</style>
