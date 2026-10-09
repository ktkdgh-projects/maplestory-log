<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string, scale?: number, flip?: boolean }>(), { scale: 2 })

// 도트 그림은 실제 화면 픽셀 기준 정수배여야 뭉개지지 않아서 화면 배율(125% 등)까지 맞춘다
const pixelRatio = ref(1)
onMounted(() => {
  pixelRatio.value = devicePixelRatio || 1
})
const crispScale = computed(() => Math.max(1, Math.round(props.scale * pixelRatio.value)) / pixelRatio.value)

const imageStyle = computed(() => ({
  width: `${CHARACTER_IMAGE_SIZE * crispScale.value}px`,
  // 발끝이 이 컴포넌트 바닥에 오도록 이미지를 내린다
  bottom: `${-(CHARACTER_IMAGE_SIZE - CHARACTER_FOOT_Y) * crispScale.value}px`,
}))
</script>

<template>
  <div class="sprite" :style="{ '--scale': crispScale }">
    <img :src="src" alt="" :style="imageStyle" :class="{ flip }" draggable="false">
    <span class="shadow" />
  </div>
</template>

<style scoped>
.sprite {
  position: relative;
  width: calc(110px * var(--scale));
  height: calc(120px * var(--scale));
  pointer-events: none;
}
img {
  position: absolute;
  left: 50%;
  max-width: none;
  translate: -50% 0;
  image-rendering: pixelated;
  animation: bob 2.4s steps(4, jump-none) infinite;
  transition: scale var(--fast) ease;
}
img.flip {
  scale: -1 1;
}
.shadow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  width: calc(34px * var(--scale));
  height: calc(6px * var(--scale));
  translate: -50% 0;
  border-radius: 50%;
  background: rgb(0 0 0 / 0.25);
  filter: blur(2px);
  animation: shadow 2.4s ease-in-out infinite;
}
@keyframes shadow {
  50% { scale: 0.85; opacity: 0.7; }
}
</style>
