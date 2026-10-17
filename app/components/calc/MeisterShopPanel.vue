<script setup lang="ts">
import { MEISTER_MATERIALS, type MeisterMaterialKey } from '#shared/data/meister'
import { remainingMaterials, type MeisterProgress } from '#shared/calc/meister'

const props = defineProps<{
  progress: MeisterProgress
  ready: boolean
  icons: Record<string, string>
}>()
const emit = defineEmits<{ toggle: [key: MeisterMaterialKey] }>()

const need = computed(() => remainingMaterials(props.progress))
// 재료 10종을 늘 같은 자리에 두고 더 안 드는 재료는 다 쓴 것으로 체크한다
const items = computed(() => MEISTER_MATERIALS.map(m => ({ ...m, count: need.value.get(m.key) ?? 0 })))
</script>

<template>
  <section class="panel shop">
    <div class="p-head">
      <h3>장보기</h3>
      <small class="muted">남은 제작에 드는 재료 · 산 건 눌러서 체크</small>
    </div>
    <div class="items" :style="{ '--rows': Math.ceil(MEISTER_MATERIALS.length / 3) }">
      <template v-if="ready">
        <button
          v-for="m in items"
          :key="m.key"
          type="button"
          class="item"
          :class="{ got: progress.have.includes(m.key) || !m.count, used: !m.count }"
          :aria-pressed="progress.have.includes(m.key) || !m.count"
          :disabled="!m.count"
          @click="emit('toggle', m.key)"
        >
          <span class="mic"><img :src="icons[m.icon]" alt=""><i class="chk" aria-hidden="true" /></span>
          <span class="ellipsis">{{ m.name }}<small v-if="m.source === 'shop'" class="npc-tag">NPC</small></span>
          <b>{{ m.count ? m.count.toLocaleString('ko-KR') : '다 씀' }}</b>
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.muted {
  color: var(--sub);
}
img {
  image-rendering: pixelated;
  object-fit: contain;
}
.panel {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  padding: 12px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.p-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.p-head h3 {
  margin: 0;
  font: 16px var(--f-title);
}
.p-head small {
  font-size: 12px;
}
.shop {
  overflow: visible;
}
.items {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 32px;
  align-content: start;
  gap: 6px;
  height: calc(var(--rows) * 32px + (var(--rows) - 1) * 6px);
}
.item {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 4px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: opacity var(--fast) ease, border-color var(--fast) ease;
}
.item:hover {
  border-color: var(--tip-line);
}
/* 산(다 쓴) 재료는 그림 위에 체크를 얹는다 */
.chk {
  position: absolute;
  right: -3px;
  bottom: -3px;
  display: none;
  width: 13px;
  height: 13px;
  background: var(--gain);
  border: 2px solid var(--bar);
  border-radius: 50%;
}
.item.got {
  opacity: 0.5;
}
.item.used {
  cursor: default;
}
.item.used b {
  color: var(--gain);
  font-size: 13px;
}
.item.used .ellipsis {
  text-decoration: line-through;
}
.item.got .chk {
  display: block;
}
.mic {
  position: relative;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  background: var(--panel);
  border-radius: 6px;
}
.mic img {
  max-width: 22px;
  max-height: 22px;
}
.item b {
  color: var(--gold);
  font: 16px var(--f-title);
  font-variant-numeric: tabular-nums;
}
.npc-tag {
  margin-left: 6px;
  padding: 0 5px;
  background: color-mix(in srgb, var(--gain) 15%, transparent);
  border-radius: 4px;
  color: var(--gain);
  font-size: 10.5px;
  font-weight: 700;
}
@media (max-height: 860px) {
  .panel {
    gap: 4px;
    padding: 8px 12px;
  }
}
@media (max-width: 1100px), (max-height: 700px) {
  .items,
  .panel {
    overflow: visible;
  }
}
</style>
