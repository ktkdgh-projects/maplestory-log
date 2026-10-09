<script setup lang="ts">
import type { CharacterBrief } from '#shared/types'

const props = defineProps<{ characters: CharacterBrief[], currentOcid?: string | null, busy?: boolean }>()
const emit = defineEmits<{ pick: [ocid: string] }>()

const filter = ref('')
const visible = computed(() => {
  const keyword = filter.value.trim()
  return keyword ? props.characters.filter(c => c.name.includes(keyword) || c.job.includes(keyword) || c.world.includes(keyword)) : props.characters
})
</script>

<template>
  <div class="picker">
    <label class="sr-only" for="character-filter">캐릭터 찾기</label>
    <input id="character-filter" v-model="filter" class="field-input" placeholder="이름·직업·월드로 찾기" autocomplete="off">
    <ul class="list stagger">
      <li v-for="c in visible" :key="c.ocid">
        <button type="button" class="pick" :aria-pressed="c.ocid === currentOcid" :disabled="busy" @click="emit('pick', c.ocid)">
          <b>{{ c.name }}</b>
          <span>{{ c.world }} · {{ c.job }} · LV.{{ c.level }}</span>
        </button>
      </li>
      <li v-if="!visible.length" class="muted">맞는 캐릭터가 없어요.</li>
    </ul>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  gap: 8px;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px;
  max-height: 360px;
  margin: 0;
  /* 마우스를 올리면 칸이 살짝 떠오르므로 스크롤 영역 위아래에 여유를 둬야 잘리지 않는다 */
  padding: 4px 2px;
  overflow-y: auto;
  list-style: none;
}
.pick {
  display: grid;
  gap: 1px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform var(--fast) var(--ease-out), border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.pick:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: var(--tip-line);
  box-shadow: 0 6px 14px rgb(0 0 0 / 0.3);
}
.pick:disabled {
  cursor: wait;
  opacity: 0.6;
}
.pick[aria-pressed="true"] {
  border-color: var(--gold);
  box-shadow: var(--glow);
}
.pick b {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.pick span {
  color: var(--sub);
  font-size: 12px;
}
</style>
