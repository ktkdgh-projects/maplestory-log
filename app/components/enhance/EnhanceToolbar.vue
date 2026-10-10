<script setup lang="ts">
import type { CharacterBrief } from '#shared/types'

defineProps<{ characters: CharacterBrief[], syncing?: boolean, syncedFrom?: string | null }>()
const ocid = defineModel<string | null>('ocid', { required: true })
const days = defineModel<number | null>('days', { required: true })
const pickedFrom = defineModel<string>('pickedFrom', { required: true })
</script>

<template>
  <div class="toolbar">
    <slot name="lead" />
    <label class="pick">
      <span class="sr-only">캐릭터</span>
      <select v-model="ocid" class="field-input">
        <option v-for="c in characters" :key="c.ocid" :value="c.ocid">{{ c.name }} · {{ c.job }} · LV.{{ c.level }}</option>
      </select>
    </label>
    <div class="seg" role="group" aria-label="기간">
      <button v-for="p in ENHANCE_PERIODS" :key="p.label" type="button" :aria-pressed="!pickedFrom && days === p.days" @click="days = p.days">{{ p.label }}</button>
    </div>
    <!-- 기간 버튼 줄은 좁으면 옆으로 밀리게 잘라 두어서, 달력이 잘리지 않게 밖에 둔다 -->
    <DatePicker v-model="pickedFrom" class="date" min="2023-12-21" :max="kstToday()" suffix="부터" />
    <HoverInfo title="기록 안내" align="left" below class="info">
      <span class="info-i" aria-label="기록 안내">i</span>
      <template #info>
        <span>넥슨 강화 기록을 최근 6개월까지 모아요.</span>
        <span>기록에는 아이템 고유 번호가 없어서 같은 이름의 예전 장비 기록이 섞일 수 있어요.</span>
      </template>
    </HoverInfo>
    <span class="sync" :class="{ busy: syncing }">
      <i aria-hidden="true" />{{ syncing ? `넥슨 기록 모으는 중${syncedFrom ? ` · ${formatMonthDay(syncedFrom)}까지` : ''}` : '최신 기록까지 모음' }}
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
.pick .field-input {
  min-width: 240px;
  min-height: 36px;
}
@media (max-width: 640px) {
  .pick,
  .pick .field-input {
    width: 100%;
    min-width: 0;
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
