<script setup lang="ts">
import type { CharacterDetail } from '#shared/types'

defineProps<{ character: CharacterDetail }>()

const TABS = ['헥사', '심볼', '스탯', '유니온'] as const
const tab = ref<typeof TABS[number]>('헥사')
</script>

<template>
  <GameWindow title="상세" accent="purple" fill>
    <div class="tabs" role="tablist" aria-label="상세 탭">
      <MenuButton v-for="name in TABS" :key="name" :active="tab === name" role="tab" :aria-selected="tab === name" :aria-pressed="null" @click="tab = name">
        {{ name }}
      </MenuButton>
    </div>

    <div class="tab-body" role="tabpanel" :aria-label="tab">
      <Transition name="fade" mode="out-in">
        <CharacterHexaPanel v-if="tab === '헥사'" :cores="character.hexaCores" />
        <CharacterSymbolPanel v-else-if="tab === '심볼'" :symbols="character.symbols" />
        <CharacterStatPanel v-else-if="tab === '스탯'" :stats="character.stats" />
        <CharacterUnionPanel v-else :ocid="character.ocid" :world="character.world" :union-level="character.unionLevel" :union-grade="character.unionGrade" />
      </Transition>
    </div>

    <p class="foot">
      <SourceBadge type="api" />
      <!-- 계산 배지가 없는 탭에서도 자리를 지켜 뒤 글자가 옮겨 다니지 않게 한다 -->
      <SourceBadge type="calc" :style="{ visibility: tab === '헥사' || tab === '심볼' ? 'visible' : 'hidden' }" />
      <span>{{ formatDateTime(character.fetchedAt) }} 기준 · 1시간마다 새로 불러와요</span>
    </p>
  </GameWindow>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tab-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}
.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--sub);
  font-size: 12px;
}
</style>
