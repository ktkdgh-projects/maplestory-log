<script setup lang="ts">
import type { EquipmentItem } from '#shared/types'

// extras: 프리셋과 상관없이 늘 같은 칭호·안드로이드 칸
const props = defineProps<{ presets: EquipmentItem[][], presetNo: number, extras: EquipmentItem[], imageUrl: string, name: string }>()

const PLACEHOLDERS: Record<string, string> = { '안드로이드': '/android-default.svg' }

// 게임 장비창 배치. 가운데 3~5열·1~4행은 캐릭터 자리
const SLOTS: { slot: string, col: number, row: number }[] = [
  { slot: '반지1', col: 1, row: 1 }, { slot: '얼굴장식', col: 2, row: 1 }, { slot: '모자', col: 6, row: 1 }, { slot: '망토', col: 7, row: 1 },
  { slot: '반지2', col: 1, row: 2 }, { slot: '눈장식', col: 2, row: 2 }, { slot: '상의', col: 6, row: 2 }, { slot: '장갑', col: 7, row: 2 },
  { slot: '반지3', col: 1, row: 3 }, { slot: '귀고리', col: 2, row: 3 }, { slot: '하의', col: 6, row: 3 }, { slot: '신발', col: 7, row: 3 },
  { slot: '반지4', col: 1, row: 4 }, { slot: '펜던트', col: 2, row: 4 }, { slot: '어깨장식', col: 6, row: 4 }, { slot: '훈장', col: 7, row: 4 },
  { slot: '벨트', col: 1, row: 5 }, { slot: '펜던트2', col: 2, row: 5 }, { slot: '무기', col: 3, row: 5 }, { slot: '보조무기', col: 4, row: 5 },
  { slot: '엠블렘', col: 5, row: 5 }, { slot: '안드로이드', col: 6, row: 5 }, { slot: '기계 심장', col: 7, row: 5 },
  { slot: '포켓 아이템', col: 1, row: 6 }, { slot: '칭호', col: 6, row: 6 }, { slot: '뱃지', col: 7, row: 6 },
]
const CAPTIONS: Record<string, string> = {
  '포켓 아이템': 'POCKET',
  '눈장식': 'EYE',
  '얼굴장식': 'FACE',
  '어깨장식': 'SHOULDER',
  '보조무기': 'SUB',
  '기계 심장': 'HEART',
  '안드로이드': 'ANDROID',
  '반지1': 'RING',
  '반지2': 'RING',
  '반지3': 'RING',
  '반지4': 'RING',
  '펜던트': 'PENDANT',
  '펜던트2': 'PENDANT',
  '귀고리': 'EARRING',
  '훈장': 'MEDAL',
  '뱃지': 'BADGE',
  '엠블렘': 'EMBLEM',
  '칭호': 'TITLE',
}

const preset = ref(props.presetNo)
const items = computed(() => new Map([...(props.presets[preset.value - 1] ?? []), ...props.extras].map(item => [item.slot, item])))

// 툴팁은 슬롯 옆에 띄우되 화면 밖으로 나가면 반대쪽·안쪽으로 당긴다
const TIP_GAP = 10
const VIEWPORT_MARGIN = 8
const hovered = ref<{ item: EquipmentItem, rect: DOMRect } | null>(null)
const tipEl = ref<HTMLElement | null>(null)
const tipPos = ref({ left: 0, top: 0 })

async function show(slot: string, event: Event) {
  const item = items.value.get(slot)
  if (!item) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  hovered.value = { item, rect }
  tipPos.value = { left: rect.right + TIP_GAP, top: rect.top }
  await nextTick()
  const tip = tipEl.value
  if (!tip || !hovered.value) return
  const { width, height } = tip.getBoundingClientRect()
  let left = rect.right + TIP_GAP
  if (left + width > innerWidth - VIEWPORT_MARGIN) left = rect.left - width - TIP_GAP
  left = Math.min(Math.max(left, VIEWPORT_MARGIN), innerWidth - width - VIEWPORT_MARGIN)
  const top = Math.min(Math.max(rect.top, VIEWPORT_MARGIN), innerHeight - height - VIEWPORT_MARGIN)
  tipPos.value = { left, top }
}
function hide() {
  hovered.value = null
}

watch(preset, hide)
onMounted(() => {
  addEventListener('scroll', hide, true)
  addEventListener('resize', hide)
})
onBeforeUnmount(() => {
  removeEventListener('scroll', hide, true)
  removeEventListener('resize', hide)
})
</script>

<template>
  <GameWindow title="EQUIPMENT" accent="blue" fill>
    <template #sub>장비 · PRESET {{ preset }}</template>
    <div :key="preset" class="inventory" @mouseleave="hide">
      <div class="portrait">
        <div class="magic" />
        <CharacterSprite class="sprite" :src="imageUrl" :scale="2" />
        <span class="name">{{ name }}</span>
      </div>
      <ItemSlot
        v-for="(s, i) in SLOTS"
        :key="s.slot"
        :label="s.slot"
        :caption="CAPTIONS[s.slot]"
        :icon="items.get(s.slot)?.icon"
        :placeholder="PLACEHOLDERS[s.slot]"
        :star="items.get(s.slot)?.starforce"
        :grade="items.get(s.slot)?.potentialGrade"
        :selected="hovered?.item.slot === s.slot"
        :style="{ gridColumn: s.col, gridRow: s.row, animationDelay: `${i * 15}ms` }"
        @mouseenter="show(s.slot, $event)"
        @focus="show(s.slot, $event)"
        @blur="hide"
        @select="hovered?.item.slot === s.slot ? hide() : show(s.slot, $event)"
      />
    </div>
    <div class="presets" role="group" aria-label="프리셋">
      <span>PRESETS</span>
      <MenuButton
        v-for="no in 3"
        :key="no"
        :active="preset === no"
        :disabled="!presets[no - 1]?.length"
        @click="preset = no"
      >
        {{ no }}
      </MenuButton>
    </div>
    <slot />

    <Teleport to="#teleports">
      <Transition name="fade">
        <div v-if="hovered" ref="tipEl" class="floating" :style="{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }">
          <GameTooltip :item="hovered.item" />
        </div>
      </Transition>
    </Teleport>
  </GameWindow>
</template>

<style scoped>
.inventory {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
  width: 100%;
  max-width: 450px;
  margin: 0 auto;
}
.inventory > :not(.portrait) {
  animation: rise-in 0.4s var(--ease-out) backwards;
}
.portrait {
  position: relative;
  grid-column: 3 / 6;
  grid-row: 1 / 5;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 58%, color-mix(in srgb, var(--api) 40%, transparent), transparent 60%),
    linear-gradient(180deg, #1b2a52, #101a36);
  border: 2px solid #3b5aa0;
  border-radius: 8px;
  box-shadow: inset 0 0 24px color-mix(in srgb, var(--api) 25%, transparent);
}
.magic {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 140%;
  aspect-ratio: 1;
  translate: -50% -45%;
  border-radius: 50%;
  background:
    radial-gradient(circle, transparent 38%, color-mix(in srgb, var(--api) 35%, transparent) 39%, transparent 41%),
    radial-gradient(circle, transparent 52%, color-mix(in srgb, var(--calc) 30%, transparent) 53%, transparent 55%),
    repeating-conic-gradient(color-mix(in srgb, var(--api) 18%, transparent) 0 4deg, transparent 4deg 22.5deg);
  mask: radial-gradient(circle, #000 30%, transparent 70%);
  animation: spin 40s linear infinite;
}
@keyframes spin {
  to { rotate: 360deg; }
}
.sprite {
  position: absolute;
  bottom: 34px;
  left: 50%;
  translate: -50% 0;
}
.name {
  position: absolute;
  bottom: 6px;
  left: 50%;
  translate: -50% 0;
  padding: 1px 10px;
  background: rgb(14 17 28 / 0.85);
  border: 1px solid var(--api);
  border-radius: 6px;
  font-family: var(--f-title);
  font-size: 15px;
  white-space: nowrap;
}
.presets {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: 450px;
  margin: 0 auto;
  padding: 6px 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
}
.presets span {
  margin-right: auto;
  color: var(--sub);
  font-family: var(--f-pixel);
  font-size: 11px;
  letter-spacing: 0.1em;
}
.presets .menu-btn {
  min-width: 36px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
}
.floating {
  position: fixed;
  z-index: 100;
  pointer-events: none;
}
</style>
