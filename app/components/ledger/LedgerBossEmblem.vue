<script setup lang="ts">
import { findBoss } from '#shared/data/bosses'

const props = withDefaults(defineProps<{ bossId: string, size?: number }>(), { size: 40 })

// 인게임 보스 아이콘(25px, 넥슨 저작물). 아이콘이 아직 없는 새 보스는 이름 두 글자로 대신한다
const ICON_PX = 25
const ICONS = assetsByName(import.meta.glob<string>('~/assets/bosses/*.png', { eager: true, import: 'default' }))

const hue = computed(() => BOSS_HUES[props.bossId] ?? 220)
const icon = computed(() => ICONS[props.bossId])
// 픽셀 아이콘은 정수 배율일 때만 또렷하다
const iconSize = computed(() => Math.max(1, Math.floor(props.size / ICON_PX)) * ICON_PX)
const fallback = computed(() => (findBoss(props.bossId)?.name ?? '?').replace(/\s/g, '').slice(0, 2))
</script>

<template>
  <span class="emblem" :style="{ '--hue': hue, width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.32}px` }" aria-hidden="true">
    <img v-if="icon" :src="icon" alt="" :width="iconSize" :height="iconSize">
    <template v-else>{{ fallback }}</template>
  </span>
</template>

<style scoped>
.emblem {
  display: grid;
  flex: none;
  place-items: center;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, hsl(var(--hue) 45% 30%), hsl(var(--hue) 50% 10%));
  border: 2px solid hsl(var(--hue) 70% 60%);
  border-radius: 12px;
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / 0.3), 0 0 10px hsl(var(--hue) 80% 50% / 0.3);
  color: #fff;
  font-family: var(--f-title);
}
img {
  image-rendering: pixelated;
}
</style>
