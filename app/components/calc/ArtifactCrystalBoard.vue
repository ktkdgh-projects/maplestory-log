<script lang="ts">
import { ARTIFACT_CRYSTALS, ARTIFACT_EFFECTS, ARTIFACT_MAX_CRYSTAL_GRADE, type ArtifactEffectKey } from '#shared/data/artifact'
import type { ArtifactCrystal } from '#shared/types'

const GROUP_TONES = { boss: 'var(--loss)', core: 'var(--api)', hunt: 'var(--gain)', util: 'var(--calc)' }
export const effectOf = (key: ArtifactEffectKey) => ARTIFACT_EFFECTS.find(e => e.key === key)!
export const toneOf = (key: ArtifactEffectKey) => GROUP_TONES[effectOf(key).group]

export type ArtifactBoardCrystal = (typeof ARTIFACT_CRYSTALS)[number] & { owned: ArtifactCrystal | null, keys: ArtifactEffectKey[], locked: boolean }
export interface ArtifactOptionRow { key: ArtifactEffectKey, from: ArtifactEffectKey | null }
</script>

<script setup lang="ts">
defineProps<{
  board: ArtifactBoardCrystal[]
  nextCrystal: ArtifactBoardCrystal | null
  ready: boolean
  rowsOf: (name: string, keys: ArtifactEffectKey[]) => ArtifactOptionRow[]
  futureOf: (c: { name: string }) => ArtifactEffectKey[]
}>()

const ICONS = assetsByName(import.meta.glob<string>('~/assets/artifact/*.png', { eager: true, import: 'default' }))
</script>

<template>
  <ul class="board">
    <li v-for="c in board" :key="c.name" class="crystal" :class="{ locked: c.locked, next: c === nextCrystal, expired: c.owned && !c.owned.valid }">
      <div class="c-art">
        <img :src="ICONS[c.icon]" alt="">
        <span v-if="!c.owned" class="lock">Lv {{ c.unlock }}</span>
      </div>
      <div class="c-head">
        <span class="c-name">{{ c.name }}</span>
        <span v-if="c.owned" class="pips" :aria-label="`${c.owned.level}등급`"><i v-for="n in ARTIFACT_MAX_CRYSTAL_GRADE" :key="n" :class="{ on: n <= c.owned.level }" /></span>
      </div>
      <ul v-if="c.owned && ready" class="opts">
        <li v-for="(r, i) in rowsOf(c.name, c.keys)" :key="i" :class="{ change: r.from && r.from !== r.key }" :style="{ '--c': toneOf(r.key) }">
          <i class="dot" />
          <template v-if="r.from && r.from !== r.key"><s>{{ effectOf(r.from).short }}</s><span class="arrow">→</span></template>
          <span>{{ effectOf(r.key).name }}</span>
        </li>
      </ul>
      <ul v-else-if="ready && futureOf(c).length" class="opts" :class="{ later: c !== nextCrystal }">
        <li v-for="k in futureOf(c)" :key="k" class="change" :style="{ '--c': toneOf(k) }"><i class="dot" /><span>{{ effectOf(k).name }}</span></li>
      </ul>
      <p v-else class="c-empty">{{ c.locked ? '아직 안 열렸어요' : ready ? '비어 있어요' : '' }}</p>
    </li>
  </ul>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.crystal {
  position: relative;
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  column-gap: 0;
  row-gap: 4px;
  min-height: 0;
  padding: 8px 10px 8px 4px;
  overflow: hidden;
  background: radial-gradient(90px 90px at 44px 50%, rgb(140 120 255 / 0.35), transparent 70%), linear-gradient(160deg, rgb(106 79 216 / 0.3), rgb(43 35 112 / 0.2) 60%), var(--panel);
  border: 1px solid #6f66c4;
  border-radius: 14px;
}
.crystal.locked {
  background: var(--panel);
  border: 1px dashed var(--panel-line);
}
.crystal.next {
  border: 1px dashed var(--gold);
  background: radial-gradient(90px 90px at 44px 50%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 70%), var(--panel);
}
.crystal.expired {
  opacity: 0.55;
}
/* 크리스탈 그림은 크게, 옵션 줄이 그림 오른쪽 끝에 살짝 걸친다 */
.c-art {
  position: relative;
  grid-row: 1 / -1;
  display: grid;
  place-items: center;
  align-self: center;
}
.c-art img {
  width: 116px;
  height: 116px;
  max-width: none;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgb(111 214 255 / 0.55));
}
.crystal.locked .c-art img {
  filter: grayscale(1) brightness(0.55);
}
.c-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: -10px;
}
.c-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font: 16px var(--f-title);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pips {
  display: flex;
  flex: none;
  gap: 3px;
}
.pips i {
  width: 6px;
  height: 6px;
  transform: rotate(45deg);
  background: color-mix(in srgb, var(--tint) 20%, transparent);
}
.pips i.on {
  background: #fff;
  box-shadow: 0 0 4px #fff;
}
.lock {
  position: absolute;
  top: 2px;
  left: 50%;
  translate: -50% 0;
  padding: 0 7px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 11px;
  white-space: nowrap;
}
.crystal.next .lock {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
  font-weight: 800;
}
.opts {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  gap: 4px;
  margin: 0 0 0 -18px;
  padding: 0;
  list-style: none;
}
.opts li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 10px;
  background: color-mix(in srgb, var(--sunk) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--tint) 8%, transparent);
  border-radius: 999px;
  font-size: 12.5px;
  white-space: nowrap;
}
.opts li.change {
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  border: 1px dashed var(--gold);
}
.dot {
  flex: none;
  width: 7px;
  height: 7px;
  background: var(--c);
  border-radius: 2px;
}
.opts s {
  color: var(--sub);
}
.arrow {
  color: var(--gold);
}
.opts li.change span:last-child {
  color: var(--gold);
  font-weight: 700;
}
.opts.later {
  opacity: 0.55;
}
.c-empty {
  align-self: center;
  margin: 0;
  padding-left: 6px;
  color: var(--sub);
  font-size: 12px;
}
/* 낮은 화면: 크리스탈 세 줄이 잘리지 않게 칸 안을 줄인다 */
@media (max-height: 860px) {
  .board {
    gap: 6px;
  }
  .crystal {
    row-gap: 2px;
    padding: 4px 8px 4px 2px;
  }
  .c-art img {
    width: 92px;
    height: 92px;
  }
  .c-name {
    font-size: 14px;
  }
  .opts {
    gap: 2px;
  }
  .opts li {
    padding: 1px 9px;
    font-size: 12px;
  }
}
@media (max-width: 1100px) {
  .board {
    grid-auto-rows: auto;
  }
}
@media (max-width: 640px) {
  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
