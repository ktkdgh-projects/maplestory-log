<script setup lang="ts">
// crop: body는 발끝을 바닥에 맞춰 전신, head는 얼굴을 가운데에 맞춰 작은 칸용
const props = withDefaults(defineProps<{ src: string, height?: number, crop?: 'body' | 'head' }>(), { height: 104, crop: 'body' })

const FOOT_MARGIN = 6

const broken = ref(false)
const top = computed(() => (props.crop === 'head' ? props.height / 2 - CHARACTER_HEAD_Y : props.height - FOOT_MARGIN - CHARACTER_FOOT_Y))
</script>

<template>
  <img
    v-if="!broken"
    :src="src"
    alt=""
    class="thumb"
    :style="{ height: `${height}px`, objectPosition: `50% ${top}px` }"
    loading="lazy"
    @error="broken = true"
  >
  <span v-else class="thumb missing" :style="{ height: `${height}px` }">?</span>
</template>

<style scoped>
.thumb {
  display: block;
  width: 100%;
  object-fit: none;
  image-rendering: pixelated;
}
.missing {
  display: grid;
  place-items: center;
  color: var(--sub);
  font-family: var(--f-pixel);
}
</style>
