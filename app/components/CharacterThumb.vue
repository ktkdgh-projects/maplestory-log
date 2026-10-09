<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string, height?: number }>(), { height: 104 })

// 원본 크기 그대로 두고 몸통 기준점을 틀 가운데·바닥에서 조금 띄운 자리에 맞춘다
const FOOT_MARGIN = 6

const broken = ref(false)
const top = computed(() => props.height - FOOT_MARGIN - CHARACTER_FOOT_Y)
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
