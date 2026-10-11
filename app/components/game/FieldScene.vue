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
    <svg class="scenery" viewBox="0 0 800 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <pattern id="field-fence" width="34" height="40" patternUnits="userSpaceOnUse">
          <rect x="4" y="6" width="6" height="34" rx="2" fill="#9b6b43" />
          <rect x="0" y="14" width="34" height="5" fill="#b07c4f" />
          <rect x="0" y="27" width="34" height="5" fill="#b07c4f" />
        </pattern>
      </defs>
      <path class="mountain" d="M0 170 L90 90 L150 135 L240 60 L330 140 L420 80 L520 150 L610 70 L700 130 L800 85 L800 240 L0 240Z" />
      <path class="hill far" d="M-20 240 Q120 120 300 170 Q420 200 520 150 Q660 90 820 160 L820 240Z" />
      <g>
        <g transform="translate(110 150)"><rect x="-4" y="0" width="8" height="34" fill="#7a5536" /><circle r="26" cy="-6" fill="#4e9a5a" /><circle r="18" cx="-16" cy="6" fill="#5aa866" /><circle r="16" cx="16" cy="4" fill="#3f8a4d" /></g>
        <g transform="translate(560 140)"><rect x="-4" y="0" width="8" height="38" fill="#7a5536" /><circle r="30" cy="-8" fill="#4e9a5a" /><circle r="20" cx="-20" cy="6" fill="#5aa866" /><circle r="18" cx="20" cy="4" fill="#3f8a4d" /></g>
        <g transform="translate(700 168) scale(0.7)"><rect x="-4" y="0" width="8" height="34" fill="#7a5536" /><circle r="26" cy="-6" fill="#5aa866" /><circle r="16" cx="16" cy="4" fill="#3f8a4d" /></g>
      </g>
      <path class="hill near" d="M-20 240 Q160 160 360 200 Q520 230 640 190 Q740 160 820 190 L820 240Z" />
      <rect class="fence" x="0" y="200" width="800" height="40" fill="url(#field-fence)" />
    </svg>
    <img v-for="i in leaves" :key="i" src="/favicon.svg" alt="" class="leaf" :style="leafStyle(i)">
    <div class="ground"><span class="flowers" /></div>
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
.scenery {
  position: absolute;
  bottom: calc(var(--ground-height, 30px) - 2px);
  left: 0;
  width: 100%;
  height: 72%;
}
.mountain {
  fill: #8fb3e3;
  opacity: 0.55;
}
.hill.far {
  fill: #74b97c;
  opacity: 0.85;
}
.hill.near {
  fill: #5fa968;
}
.fence {
  opacity: 0.9;
}
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
  background:
    radial-gradient(circle at 20% 70%, rgb(0 0 0 / 0.18) 0 3px, transparent 4px) 0 0 / 46px 22px,
    radial-gradient(circle at 70% 40%, rgb(255 255 255 / 0.08) 0 2px, transparent 3px) 0 0 / 30px 18px,
    linear-gradient(var(--grass) 0 8px, #4ea65b 8px 10px, var(--dirt) 10px);
  border-top: 2px solid #3f8a4d;
}
.flowers {
  position: absolute;
  top: -5px;
  left: 0;
  right: 0;
  height: 8px;
  background:
    radial-gradient(circle, #ff9ec4 0 2px, transparent 3px) 12px 0 / 70px 8px,
    radial-gradient(circle, #ffe08a 0 2px, transparent 3px) 44px 2px / 90px 8px,
    radial-gradient(circle, #ffffff 0 1.5px, transparent 2.5px) 30px 1px / 55px 8px;
}
</style>
