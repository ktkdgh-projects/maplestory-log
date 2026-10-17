<script setup lang="ts">
import type { ArtifactResponse } from '#shared/types'
import type { JobTraitRow, JobTraits, TraitFlag } from '#shared/data/jobTraits'
import { LEVEL_TEXT } from './ArtifactEffectPanel.vue'

defineProps<{ data: ArtifactResponse | null, traits: JobTraits, baseTraits: JobTraitRow }>()
defineEmits<{ save: [field: keyof JobTraits, value: string], reset: [] }>()
const open = defineModel<boolean>({ required: true })

const FLAG_TEXT: Record<TraitFlag, string> = { yes: '예', no: '아니오', unknown: '확인 중' }
const TRAIT_FIELDS = [
  { key: 'critOver', label: '크확 100% 넘어도 이득(리인포스)', options: FLAG_TEXT },
  { key: 'cooldown', label: '재사용 미적용', options: LEVEL_TEXT },
  { key: 'buff', label: '버프 지속시간', options: LEVEL_TEXT },
  { key: 'summon', label: '소환수로 딜', options: FLAG_TEXT },
  { key: 'finalAttack', label: '파이널 어택 스킬', options: FLAG_TEXT },
] as const
</script>

<template>
  <AppModal v-model="open" :title="`${data?.character.job ?? ''} 직업 특성`" :width="460">
    <div v-if="data" class="trait-edit">
      <p class="muted small">넥슨 API가 주지 않아 나무위키 직업 문서로 채운 값이에요. 다르면 고쳐 주세요. 이 직업 캐릭터 모두에 적용돼요.</p>
      <div v-for="f in TRAIT_FIELDS" :key="f.key" class="edit-row">
        <span>{{ f.label }}</span>
        <div class="mini-seg wide">
          <button v-for="(text, value) in f.options" :key="value" type="button" :aria-pressed="traits[f.key] === value" @click="$emit('save', f.key, value)">{{ text }}</button>
        </div>
      </div>
      <div class="edit-foot">
        <a v-if="baseTraits.source" :href="baseTraits.source" target="_blank" rel="noopener" class="link">출처 · {{ baseTraits.why }}</a>
        <button v-if="data.traits" type="button" class="link" @click="$emit('reset')">표 값으로 되돌리기</button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.muted {
  color: var(--sub);
}
.small {
  font-size: 12px;
}
.link {
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  text-decoration: underline dotted;
  cursor: pointer;
}
.link:hover {
  color: var(--api);
}
.mini-seg {
  display: inline-flex;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 7px;
}
.mini-seg.wide {
  display: flex;
}
.mini-seg.wide button {
  flex: 1;
}
.mini-seg button {
  padding: 3px 10px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
}
.mini-seg button:last-child {
  border-right: 0;
}
.mini-seg button[aria-pressed="true"] {
  background: var(--api);
  color: var(--bar);
  font-weight: 700;
}
.trait-edit {
  display: grid;
  gap: 10px;
}
.edit-row {
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.edit-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}
</style>
