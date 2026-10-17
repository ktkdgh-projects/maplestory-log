<script setup lang="ts">
import { MEISTER_MATERIALS, MEISTER_STAGES, type MeisterMaterialKey } from '#shared/data/meister'
import { remainingCrafts, stageTotal, type MeisterProgress } from '#shared/calc/meister'

const props = defineProps<{
  progress: MeisterProgress
  ready: boolean
  icons: Record<string, string>
  tones: string[]
}>()

const stageLeft = (s: number) => remainingCrafts(props.progress).filter(c => c.stage === s).reduce((n, c) => n + c.left, 0)
const stageRate = (s: number) => 1 - stageLeft(s) / stageTotal(MEISTER_STAGES[s]!)
const materialOf = (key: MeisterMaterialKey) => MEISTER_MATERIALS.find(m => m.key === key)!
</script>

<template>
  <ol class="stages">
    <li v-for="(stage, s) in MEISTER_STAGES" :key="stage.key" class="stage" :class="{ now: ready && progress.stage === s, past: ready && progress.stage > s }" :style="{ '--tone': tones[s] }">
      <div class="s-top">
        <span class="ic"><img :src="icons[stage.crafts.at(-1)!.icon]" alt=""></span>
        <div class="s-title">
          <span class="lvl">{{ s + 1 }}단계 · {{ stage.range }}</span>
          <b>{{ stage.title }}</b>
        </div>
        <span v-if="ready && progress.stage > s" class="cnt done">완료</span>
        <span v-else class="cnt">{{ ready ? stageLeft(s) : stageTotal(stage) }}<small>/{{ stageTotal(stage) }}회</small></span>
      </div>
      <ul class="crafts">
        <li v-for="c in stage.crafts" :key="c.name">
          <img :src="icons[c.icon]" alt="">
          <span class="ellipsis">{{ c.name }}</span>
          <span class="until">~{{ c.until }}</span>
          <span class="mats">
            <span v-for="m in c.materials" :key="m.key" class="mat"><img :src="icons[materialOf(m.key).icon]" :alt="materialOf(m.key).name">{{ m.each }}</span>
          </span>
          <b>×{{ c.count }}</b>
        </li>
      </ul>
      <div class="s-foot">
        <div class="s-bar"><i :style="{ width: `${ready ? stageRate(s) * 100 : 0}%` }" /></div>
        <span class="meta">피로도 {{ stage.fatigue }}씩(추정) · {{ stage.note }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
img {
  image-rendering: pixelated;
  object-fit: contain;
}
.until {
  flex: none;
  padding: 0 7px;
  background: color-mix(in srgb, var(--tone) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
  border-radius: 999px;
  color: var(--tone);
  font-size: 11px;
  font-weight: 700;
  line-height: 17px;
}

/* 단계 카드: 내용만큼 자리를 잡고 남는 높이는 세 장이 똑같이 나눠 가진다 */
.stages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  margin: 0;
  padding: 0;
  list-style: none;
}
.stage {
  display: grid;
  flex: 1 0 auto;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 6px;
  padding: 10px 14px;
  background: linear-gradient(110deg, color-mix(in srgb, var(--tone) 14%, var(--panel)), var(--panel) 55%);
  border: 1px solid color-mix(in srgb, var(--tone) 45%, var(--panel-line));
  border-radius: 12px;
  transition: box-shadow var(--normal) ease, opacity var(--normal) ease;
}
.stage.now {
  box-shadow: 0 0 0 2px var(--tone), 0 0 16px color-mix(in srgb, var(--tone) 30%, transparent);
}
.stage.past {
  opacity: 0.6;
}
.s-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ic {
  display: grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.ic img {
  width: 34px;
  height: 34px;
}
.s-title {
  display: grid;
  flex: 1;
  min-width: 0;
}
.lvl {
  color: var(--tone);
  font: 13px var(--f-title);
}
.s-title b {
  font: 18px/1.2 var(--f-title);
}
.cnt {
  color: var(--tone);
  font: 30px/1 var(--f-title);
  font-variant-numeric: tabular-nums;
}
.cnt small {
  color: var(--sub);
  font-size: 13px;
}
.cnt.done {
  color: var(--gain);
  font-size: 22px;
}
.crafts {
  display: grid;
  align-content: center;
  gap: 3px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}
.crafts li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.crafts li > img {
  width: 22px;
  height: 22px;
}
.mats {
  display: flex;
  flex: none;
  gap: 3px;
  margin-left: auto;
}
.mat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px 0 2px;
  background: var(--bar);
  border-radius: 999px;
  font-size: 11.5px;
}
.mat img {
  width: 16px;
  height: 16px;
}
.crafts b {
  flex: none;
  min-width: 34px;
  color: var(--tone);
  font: 15px var(--f-title);
  text-align: right;
}
.s-foot {
  display: grid;
  gap: 4px;
}
.s-bar {
  height: 6px;
  overflow: hidden;
  background: var(--bar);
  border-radius: 999px;
}
.s-bar i {
  display: block;
  height: 100%;
  background: var(--tone);
  transition: width var(--normal) var(--ease-out);
}
.meta {
  overflow: hidden;
  color: var(--sub);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-height: 860px) {
  .stage {
    gap: 4px;
    padding: 7px 12px;
  }
  .ic {
    width: 38px;
    height: 38px;
  }
  .ic img {
    width: 28px;
    height: 28px;
  }
  .cnt {
    font-size: 24px;
  }
}
@media (max-width: 1100px), (max-height: 700px) {
  .stages {
    overflow: visible;
  }
}
</style>
