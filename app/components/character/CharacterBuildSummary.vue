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
</script>

<template>
  <div v-if="tabs.length" class="summary">
    <div class="tabs" role="group" aria-label="빌드 정보">
      <MenuButton v-for="t in tabs" :key="t.key" :active="tab === t.key" @click="tab = t.key">{{ t.label }}</MenuButton>
    </div>
    <div class="body">
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
              <span class="ellipsis" :title="line.value">{{ line.value }}</span>
            </li>
            <li v-if="!character.abilityPresets[abilityPreset - 1]?.length" class="muted">비어 있어요</li>
          </ul>
        </div>

        <ul v-else-if="tab === 'link'" key="link" class="links">
          <li v-for="skill in character.linkSkills" :key="skill.name" :title="skill.effect">
            <img :src="skill.icon" alt="">
            <span class="ellipsis">{{ skill.name }}</span>
            <b>Lv.{{ skill.level }}</b>
          </li>
        </ul>

        <ul v-else key="set" class="sets">
          <li v-for="set in character.setEffects" :key="set.name" :title="set.active.join('\n') || '적용 중인 효과 없음'">
            <span class="ellipsis">{{ set.name }}</span>
            <span class="pips" aria-hidden="true">
              <i v-for="n in set.max" :key="n" :class="{ on: n <= set.count }" />
            </span>
            <b>{{ set.count }}/{{ set.max }}</b>
          </li>
        </ul>
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
.links {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.links li {
  gap: 6px;
  padding: 4px 8px;
  font-size: 13px;
}
.links li,
.sets li {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  font-size: 14px;
  cursor: help;
  transition: border-color var(--fast) ease;
}
.links li:hover,
.sets li:hover {
  border-color: var(--api);
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
