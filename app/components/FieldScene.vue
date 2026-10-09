<script setup lang="ts">
const props = withDefaults(defineProps<{ height?: number | string, width?: string, leaves?: number }>(), { height: 130, width: '100%', leaves: 0 })

const LEAF_FALL_FALLBACK = 600
const fieldStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  width: props.width,
  '--fall': `${(typeof props.height === 'number' ? props.height : LEAF_FALL_FALLBACK) + 40}px`,
}))

// 떨어지는 잎마다 위치·속도·지연을 달리해서 같은 움직임이 반복돼 보이지 않게 한다
const leafStyle = (i: number) => ({
  left: `${(i * 37) % 100}%`,
  animationDuration: `${7 + (i % 4) * 1.7}s`,
  animationDelay: `${-i * 1.3}s`,
  width: `${12 + (i % 3) * 4}px`,
})
</script>

<template>
  <div class="field" :style="fieldStyle">
    <div class="sun" />
    <div class="cloud c1" />
    <div class="cloud c2" />
    <div class="cloud c3" />
    <div class="hill h1" />
    <div class="hill h2" />
    <img v-for="i in leaves" :key="i" src="/favicon.svg" alt="" class="leaf" :style="leafStyle(i)">
    <div class="ground" />
    <slot />
  </div>
</template>

<style scoped>
.field {
  position: relative;
  overflow: hidden;
  background: linear-gradient(#3f6fc4, #79a8e6 55%, var(--sky-bot));
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  box-shadow: inset 0 0 50px rgb(0 0 0 / 0.15);
}
.sun {
  position: absolute;
  top: -50px;
  right: 10%;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(255 236 170 / 0.8), transparent 65%);
}
.cloud {
  position: absolute;
  background: var(--cloud);
  border-radius: 30px;
  opacity: 0.85;
  animation: drift linear infinite;
}
.cloud::before,
.cloud::after {
  content: "";
  position: absolute;
  background: var(--cloud);
  border-radius: 50%;
}
.cloud::before {
  left: 15%;
  bottom: 20%;
  width: 55%;
  height: 170%;
}
.cloud::after {
  right: 12%;
  bottom: 25%;
  width: 40%;
  height: 130%;
}
.c1 { top: 16%; width: 80px; height: 22px; animation-duration: 48s; animation-delay: -10s; }
.c2 { top: 28%; width: 100px; height: 26px; animation-duration: 64s; animation-delay: -40s; }
.c3 { top: 8%; width: 60px; height: 17px; animation-duration: 38s; animation-delay: -25s; opacity: 0.7; }
@keyframes drift {
  from { left: -130px; }
  to { left: 100%; }
}
.hill {
  position: absolute;
  bottom: var(--ground-height, 30px);
  border-radius: 50% 50% 0 0;
}
.h1 { left: -6%; width: 50%; height: 34%; background: #5f9f6b; opacity: 0.8; }
.h2 { left: 46%; width: 60%; height: 46%; background: #6faf73; opacity: 0.6; }
.leaf {
  position: absolute;
  top: -20px;
  opacity: 0.85;
  animation: fall linear infinite;
  pointer-events: none;
}
@keyframes fall {
  0% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(24px, calc(var(--fall) / 2)) rotate(180deg); }
  100% { transform: translate(-12px, var(--fall)) rotate(360deg); }
}
.ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--ground-height, 30px);
  background: linear-gradient(var(--grass) 0 8px, #4ea65b 8px 10px, var(--dirt) 10px);
  border-top: 2px solid var(--dirt-dark);
}
</style>
