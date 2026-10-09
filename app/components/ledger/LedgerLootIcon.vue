<script setup lang="ts">
import { findDrop } from '#shared/data/bossDrops'

const props = withDefaults(defineProps<{ item: string, size?: number }>(), { size: 24 })

// 물욕템 아이콘(넥슨 저작물, 투명 여백을 잘라 둠). 아이콘이 없는 템은 색 상자로 그린다
const ICONS = assetsByName(import.meta.glob<string>('~/assets/loot/*.png', { eager: true, import: 'default' }))

const drop = computed(() => findDrop(props.item))
const icon = computed(() => (drop.value?.icon ? ICONS[drop.value.icon] : undefined))
const tone = computed(() => drop.value?.tone ?? (drop.value ? DROP_SET_TONES[drop.value.set] : '#f2c14e'))
</script>

<template>
  <span class="loot-icon" :style="{ width: `${size}px`, height: `${size}px`, '--tone': tone }" :title="item">
    <img v-if="icon" :src="icon" alt="">
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9h18v11H3z" fill="var(--tone)" fill-opacity="0.35" stroke="var(--tone)" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M2 6h20v4H2z" fill="var(--tone)" stroke="var(--tone)" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M12 6v14" stroke="#fff" stroke-opacity="0.8" stroke-width="1.6" />
      <path d="M12 6C10 2 6 3 7.5 5.5 M12 6c2-4 6-3 4.5-.5" fill="none" stroke="var(--tone)" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped>
.loot-icon {
  position: relative;
  display: inline-block;
  flex: none;
}
/* 테두리 없이 아이템만: 칸에 고정해 세로로 긴 아이콘도 넘치지 않게 맞추고, 얇은 그림자와 세트색 빛만 두른다 */
img,
svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter:
    drop-shadow(0 1px 1px rgb(0 0 0 / 0.8))
    drop-shadow(0 0 3px color-mix(in srgb, var(--tone) 55%, transparent));
}
</style>
