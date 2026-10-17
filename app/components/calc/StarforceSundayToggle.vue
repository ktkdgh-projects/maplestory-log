<script setup lang="ts">
import type { SundayNotice } from '#shared/types'
import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

const props = defineProps<{ sunday: SundayNotice, applied: boolean }>()
defineEmits<{ toggle: [] }>()

const sundayEffects = computed(() => SUNDAY_STARFORCE_EFFECTS.filter(e => props.sunday.effects?.includes(e.key)).map(e => e.label))
const sundayDay = computed(() => formatDay(kstDateOf(props.sunday.start)))
</script>

<template>
  <HoverInfo :title="`${sundayDay} 썬데이 메이플`" align="right" class="sunday-hover">
    <button type="button" class="sunday-toggle" :class="{ on: applied }" :aria-pressed="applied" @click="$emit('toggle')">
      <span class="lamp" aria-hidden="true" />썬데이 {{ applied ? '적용 중' : '꺼짐' }}
    </button>
    <template #info>
      <ul class="sunday-effects">
        <li v-for="e in sundayEffects" :key="e">{{ e }}</li>
      </ul>
      <span class="sunday-tip">{{ applied ? '이번 주 효과를 자동으로 켜 뒀어요. 누르면 꺼요.' : '누르면 이번 주 효과를 다시 켜요.' }}</span>
    </template>
  </HoverInfo>
</template>

<style scoped>
.sunday-hover {
  margin-left: auto;
}
.sunday-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease, background var(--fast) ease;
}
.sunday-toggle:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.sunday-toggle.on {
  background: color-mix(in srgb, var(--gain) 10%, transparent);
  border-color: color-mix(in srgb, var(--gain) 50%, transparent);
  color: var(--gain);
}
.sunday-toggle .lamp {
  width: 7px;
  height: 7px;
  background: var(--panel-line);
  border-radius: 50%;
  transition: background var(--fast) ease, box-shadow var(--fast) ease;
}
.sunday-toggle.on .lamp {
  background: var(--gain);
  box-shadow: 0 0 6px var(--gain);
}
.sunday-effects {
  margin: 2px 0 0;
  padding-left: 16px;
  color: var(--text);
  font-family: var(--f-body);
}
.sunday-tip {
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
}
</style>
