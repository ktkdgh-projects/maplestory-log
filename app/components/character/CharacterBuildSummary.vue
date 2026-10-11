<script setup lang="ts">
import type { CharacterDetail } from '#shared/types'

const props = defineProps<{ character: CharacterDetail }>()

const tabs = computed(() => [
  { key: 'ability', label: '어빌리티', show: props.character.abilityPresets.some(p => p.length) },
  { key: 'link', label: `링크 스킬 ${props.character.linkSkills.length}`, show: props.character.linkSkills.length > 0 },
  { key: 'set', label: `세트 효과 ${props.character.setEffects.length}`, show: props.character.setEffects.length > 0 },
].filter(tab => tab.show))
const tab = ref(tabs.value[0]?.key)
const abilityPreset = ref(props.character.abilityPresetNo)
const linkPicked = ref(0)
const setPicked = ref(0)
const pickedLink = computed(() => props.character.linkSkills[linkPicked.value])
const pickedSet = computed(() => props.character.setEffects[setPicked.value])
</script>

<template>
  <div v-if="tabs.length" class="summary">
    <div class="tabs" role="tablist" aria-label="빌드 정보">
      <MenuButton v-for="t in tabs" :key="t.key" :active="tab === t.key" role="tab" :aria-selected="tab === t.key" :aria-pressed="null" @click="tab = t.key">{{ t.label }}</MenuButton>
    </div>
    <div class="body" role="tabpanel">
      <Transition name="fade" mode="out-in">
        <div v-if="tab === 'ability'" key="ability" class="ability">
          <div class="preset-tabs" role="group" aria-label="어빌리티 프리셋">
            <button
              v-for="(_, i) in character.abilityPresets"
              :key="i"
              type="button"
              :class="{ active: abilityPreset === i + 1 }"
              @click="abilityPreset = i + 1"
            >
              프리셋 {{ i + 1 }}<span v-if="i + 1 === character.abilityPresetNo" class="using">사용 중</span>
            </button>
          </div>
          <ul :key="abilityPreset" class="lines stagger">
            <li v-for="(line, k) in character.abilityPresets[abilityPreset - 1]" :key="k" :style="{ '--tone': potentialGradeColor(line.grade) ?? 'var(--tip-line)' }">
              <span class="grade">{{ line.grade }}</span>
              <span class="line-text">{{ line.value }}</span>
            </li>
            <li v-if="!character.abilityPresets[abilityPreset - 1]?.length" class="muted">비어 있어요</li>
          </ul>
        </div>

        <div v-else-if="tab === 'link'" key="link" class="pick-view">
          <ul class="links">
            <li v-for="(skill, i) in character.linkSkills" :key="skill.name">
              <button type="button" class="item" :aria-pressed="linkPicked === i" @click="linkPicked = i">
                <img :src="skill.icon" alt="">
                <span class="ellipsis">{{ skill.name }}</span>
                <b>Lv.{{ skill.level }}</b>
              </button>
            </li>
          </ul>
          <p class="detail" aria-live="polite">
            <b>{{ pickedLink?.name }}</b>
            <span>{{ pickedLink?.effect || '효과 정보가 없어요' }}</span>
          </p>
        </div>

        <div v-else key="set" class="pick-view">
          <ul class="sets">
            <li v-for="(set, i) in character.setEffects" :key="set.name">
              <button type="button" class="item" :aria-pressed="setPicked === i" @click="setPicked = i">
                <span class="ellipsis">{{ set.name }}</span>
                <span class="pips" aria-hidden="true">
                  <i v-for="n in set.max" :key="n" :class="{ on: n <= set.count }" />
                </span>
                <b>{{ set.count }}/{{ set.max }}</b>
              </button>
            </li>
          </ul>
          <p class="detail" aria-live="polite">
            <b>{{ pickedSet?.name }}</b>
            <span v-for="line in pickedSet?.active" :key="line">{{ line }}</span>
            <span v-if="!pickedSet?.active.length" class="muted">적용 중인 효과가 없어요</span>
          </p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 450px;
  min-height: 0;
  margin: 0 auto;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tabs .menu-btn {
  min-height: 34px;
  padding: 0 12px;
  font-size: 14px;
}
.body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}
/* 남는 높이를 칸들이 나눠 가져서 아래 여백 없이 채운다 */
.body > * {
  height: 100%;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.ability {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}
.preset-tabs {
  display: flex;
  gap: 4px;
}
.preset-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease;
}
.preset-tabs button.active {
  border-color: var(--gold);
  color: var(--gold);
}
.using {
  padding: 0 5px;
  background: var(--gold);
  border-radius: 999px;
  color: var(--on-gold);
  font-size: 10px;
}
.lines {
  display: grid;
  grid-auto-rows: minmax(0, 1fr);
  gap: 6px;
}
.lines li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
  font-size: 15px;
}
.grade {
  flex: none;
  padding: 1px 8px;
  background: var(--tone);
  border-radius: 4px;
  color: var(--bar);
  font-family: var(--f-title);
  font-size: 13px;
}
.links,
.sets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 6px;
}
.item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--fast) ease;
}
.links .item {
  padding: 4px 8px;
  font-size: 13px;
}
.item:hover {
  border-color: var(--tip-line);
}
.item[aria-pressed="true"] {
  border-color: var(--api);
  box-shadow: inset 0 0 0 1px var(--api);
}
.pick-view {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 8px;
}
/* 높이를 잡아 둬서 다른 칸을 눌러도 위가 들썩이지 않는다 */
.detail {
  display: grid;
  align-content: start;
  gap: 1px;
  height: 92px;
  margin: 0;
  padding: 8px 12px;
  overflow-y: auto;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.5;
  scrollbar-width: thin;
}
.detail b {
  color: var(--api);
  font-size: 14px;
}
.line-text {
  min-width: 0;
  line-height: 1.35;
}
.links img {
  flex: none;
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.links span,
.sets span:first-child {
  flex: 1;
  min-width: 0;
}
b {
  flex: none;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.pips {
  display: flex;
  flex: none;
  gap: 2px;
}
.pips i {
  width: 5px;
  height: 12px;
  background: var(--bar);
  border-radius: 1px;
}
.pips i.on {
  background: var(--api);
}
</style>
