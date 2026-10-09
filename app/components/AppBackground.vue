<script setup lang="ts">
const STAR_COUNT = 46
const LEAF_COUNT = 8

// 새로고침마다 별 배치가 바뀌면 서버·브라우저 렌더 결과가 달라지므로 고정된 의사난수로 흩뿌린다
const seeded = (n: number) => {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}
const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  left: `${seeded(i) * 100}%`,
  top: `${seeded(i + 100) * 62}%`,
  size: `${1 + Math.round(seeded(i + 200) * 2)}px`,
  delay: `${-seeded(i + 300) * 4}s`,
}))
const leaves = Array.from({ length: LEAF_COUNT }, (_, i) => ({
  left: `${(i * 13 + seeded(i + 400) * 10) % 100}%`,
  duration: `${16 + seeded(i + 500) * 12}s`,
  delay: `${-seeded(i + 600) * 28}s`,
  size: `${10 + Math.round(seeded(i + 700) * 8)}px`,
}))
</script>

<template>
  <div class="background" aria-hidden="true">
    <div class="moon" />
    <span v-for="(s, i) in stars" :key="`s${i}`" class="star" :style="{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }" />
    <div class="cloud c1" />
    <div class="cloud c2" />
    <div class="cloud c3" />
    <svg class="islands" viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice">
      <g class="far">
        <path d="M80 190 q60 -46 150 -40 q70 6 110 40 q-30 22 -130 24 q-100 0 -130 -24z" />
        <path d="M980 170 q70 -50 170 -42 q80 8 120 42 q-40 24 -150 26 q-110 0 -140 -26z" />
      </g>
      <g class="near">
        <path d="M-20 260 L-20 214 q120 -40 300 -30 q140 8 230 34 q120 -36 300 -28 q170 8 260 30 q130 -40 300 -32 q90 4 120 20 L1460 260z" />
        <path class="grass" d="M-20 214 q120 -40 300 -30 q140 8 230 34 q120 -36 300 -28 q170 8 260 30 q130 -40 300 -32 q90 4 120 20" />
      </g>
      <g class="platforms">
        <g transform="translate(300 60)"><rect class="dirt" width="120" height="16" rx="4" /><rect class="top" width="120" height="5" rx="2" /></g>
        <g transform="translate(620 20)"><rect class="dirt" width="90" height="14" rx="4" /><rect class="top" width="90" height="5" rx="2" /></g>
        <g transform="translate(860 80)"><rect class="dirt" width="140" height="16" rx="4" /><rect class="top" width="140" height="5" rx="2" /></g>
        <g transform="translate(80 110)"><rect class="dirt" width="80" height="14" rx="4" /><rect class="top" width="80" height="5" rx="2" /></g>
      </g>
      <g class="sign">
        <rect x="1180" y="160" width="6" height="40" />
        <rect x="1160" y="152" width="46" height="18" rx="3" />
      </g>
    </svg>
    <img v-for="(l, i) in leaves" :key="`l${i}`" src="/favicon.svg" alt="" class="leaf" :style="{ left: l.left, width: l.size, animationDuration: l.duration, animationDelay: l.delay }">
  </div>
</template>

<style scoped>
.background {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  background:
    radial-gradient(1200px 380px at 50% 100%, rgb(255 140 120 / 0.22), transparent 70%),
    radial-gradient(900px 500px at 12% 0%, rgb(78 123 203 / 0.3), transparent 70%),
    radial-gradient(800px 500px at 92% 8%, rgb(183 156 255 / 0.22), transparent 70%),
    linear-gradient(180deg, #0e1433 0%, #1b1c4a 40%, #2c2158 70%, #3b2652 100%);
  pointer-events: none;
}
.moon {
  position: absolute;
  top: 7%;
  right: 9%;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff8e0, #f5dc96 55%, #d1a854);
  box-shadow: 0 0 80px 24px rgb(245 220 150 / 0.22);
  opacity: 0.85;
}
.star {
  position: absolute;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 4px #fff;
  opacity: 0.7;
  animation: twinkle 4s ease-in-out infinite;
}
@keyframes twinkle {
  50% { opacity: 0.15; scale: 0.6; }
}
.cloud {
  position: absolute;
  height: 34px;
  background: rgb(220 228 255 / 0.12);
  border-radius: 50%;
  filter: blur(8px);
  animation: drift linear infinite;
}
.cloud::before,
.cloud::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  background: inherit;
}
.cloud::before {
  left: 15%;
  bottom: 35%;
  width: 45%;
  height: 150%;
}
.cloud::after {
  right: 15%;
  bottom: 25%;
  width: 35%;
  height: 120%;
}
.c1 { top: 16%; width: 220px; animation-duration: 140s; animation-delay: -30s; }
.c2 { top: 32%; width: 300px; animation-duration: 190s; animation-delay: -120s; }
.c3 { top: 50%; width: 180px; animation-duration: 160s; animation-delay: -80s; }
@keyframes drift {
  from { left: -320px; }
  to { left: 100%; }
}
.islands {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 36vh;
  min-height: 200px;
}
.far path {
  fill: rgb(140 110 190 / 0.22);
}
.near path {
  fill: #141832;
}
.near .grass {
  fill: none;
  stroke: rgb(110 200 120 / 0.7);
  stroke-width: 4;
}
.platforms {
  animation: float 6s ease-in-out infinite;
}
@keyframes float {
  50% { translate: 0 -6px; }
}
.platforms .dirt {
  fill: rgb(122 85 54 / 0.45);
}
.platforms .top {
  fill: rgb(110 200 120 / 0.55);
}
.sign rect {
  fill: rgb(150 105 66 / 0.55);
}
.leaf {
  position: absolute;
  top: -30px;
  opacity: 0.35;
  animation: fall linear infinite;
}
@keyframes fall {
  0% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(60px, 55vh) rotate(200deg); }
  100% { transform: translate(-20px, 110vh) rotate(400deg); }
}
</style>