<script setup lang="ts">
import type { CharacterBrief } from '#shared/types'
import { ENHANCE_HISTORY_DAYS } from '#shared/data/enhance'
import { ENHANCE_PERIODS, useKstToday } from '~/composables/useEnhanceRecords'

defineProps<{ characters: CharacterBrief[], syncing?: boolean, syncedFrom?: string | null }>()
const ocid = defineModel<string | null>('ocid', { required: true })
const days = defineModel<number | null>('days', { required: true })
const pickedFrom = defineModel<string>('pickedFrom', { required: true })
const today = useKstToday()
// 서버가 모아 두는 기록보다 이전 날짜는 고를 수 없다
const minDate = computed(() => addDays(today.value, -ENHANCE_HISTORY_DAYS))
</script>

<template>
  <div class="toolbar">
    <slot name="lead" />
    <div class="pick">
      <CharacterSearch v-model="ocid" :characters="characters" />
    </div>
    <div class="seg" role="group" aria-label="기간">
      <button v-for="p in ENHANCE_PERIODS" :key="p.label" type="button" :aria-pressed="!pickedFrom && days === p.days" @click="days = p.days">{{ p.label }}</button>
    </div>
    <!-- 기간 버튼 줄은 좁으면 넘친 부분을 잘라 두므로 달력이 잘리지 않게 밖에 둔다 -->
    <DatePicker v-model="pickedFrom" class="date" :min="minDate" :max="today" suffix="부터" />
    <HoverInfo title="기록 안내" align="left" below class="info">
      <span class="info-i" aria-label="기록 안내">i</span>
      <template #info>
        <span>넥슨 강화 기록을 최근 6개월까지 모아요.</span>
        <span>기록에는 아이템 고유 번호가 없어서 같은 이름의 예전 장비 기록이 섞일 수 있어요.</span>
      </template>
    </HoverInfo>
    <span class="sync" :class="{ busy: syncing }">
      <i aria-hidden="true" />{{ syncing ? `넥슨 기록 모으는 중${syncedFrom ? ` · ${formatDay(syncedFrom)}까지` : ''}` : '최신 기록까지 모음' }}
    </span>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}
@media (max-width: 640px) {
  .pick {
    width: 100%;
  }
  .seg {
    display: flex;
    width: 100%;
  }
  .seg button {
    flex: 1;
    min-height: 38px;
    padding: 6px 4px;
  }
  .sync {
    font-size: 12px;
  }
}
.seg {
  display: inline-flex;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.seg button {
  padding: 6px 11px;
  background: none;
  border: 0;
  border-right: 1px solid var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.seg button:last-child {
  border-right: 0;
}
.seg button:hover {
  color: var(--text);
}
.seg button[aria-pressed="true"] {
  background: var(--gold);
  color: var(--on-gold);
  font-weight: 700;
}
.date {
  overflow: visible;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.date :deep(.trigger) {
  border-radius: 7px;
}
.info-i {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--tip-line);
  border-radius: 50%;
  color: var(--sub);
  font-size: 12px;
  cursor: help;
}
.sync {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--sub);
  font-size: 13px;
}
.sync i {
  width: 7px;
  height: 7px;
  background: var(--gain);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--gain);
}
.sync.busy {
  color: var(--gold);
}
.sync.busy i {
  background: var(--gold);
  box-shadow: 0 0 6px var(--gold);
  animation: blink 1s ease-in-out infinite;
}
@keyframes blink {
  50% { opacity: 0.3; }
}
</style>
