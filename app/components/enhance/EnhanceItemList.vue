<script setup lang="ts">
import type { EnhanceItem } from '#shared/types'
import { enhanceItemKey } from '~/composables/useEnhanceRecords'

defineProps<{ items: EnhanceItem[], quiet: EnhanceItem[], selected: string | null, quietLabel: string, empty: string }>()
const emit = defineEmits<{ select: [key: string] }>()
defineSlots<{
  head: () => unknown
  count: (props: { item: EnhanceItem, quiet: boolean }) => unknown
  sub?: (props: { item: EnhanceItem }) => unknown
}>()
const showQuiet = ref(false)
</script>

<template>
  <div class="list">
    <div class="list-head"><slot name="head" /></div>
    <ul class="main">
      <li v-for="i in items" :key="enhanceItemKey(i)">
        <button type="button" class="row" :class="{ on: enhanceItemKey(i) === selected }" :aria-pressed="enhanceItemKey(i) === selected" @click="emit('select', enhanceItemKey(i))">
          <img v-if="i.icon" :src="i.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
          <span class="name"><b class="ellipsis">{{ i.name }}</b><small><span v-if="!i.worn" class="unworn">안 낌</span>{{ i.slot }}<slot name="sub" :item="i" /></small></span>
          <span class="count"><slot name="count" :item="i" :quiet="false" /></span>
        </button>
      </li>
      <li v-if="!items.length" class="muted none">{{ empty }}</li>
    </ul>
    <button v-if="quiet.length" type="button" class="more" :aria-expanded="showQuiet" @click="showQuiet = !showQuiet">
      {{ quietLabel }} {{ quiet.length }}개 {{ showQuiet ? '▴' : '▾' }}
    </button>
    <ul v-if="showQuiet" class="quiet">
      <li v-for="i in quiet" :key="enhanceItemKey(i)">
        <button type="button" class="row" :class="{ on: enhanceItemKey(i) === selected }" :aria-pressed="enhanceItemKey(i) === selected" @click="emit('select', enhanceItemKey(i))">
          <img v-if="i.icon" :src="i.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
          <span class="name"><b class="ellipsis">{{ i.name }}</b><small><span v-if="!i.worn" class="unworn">안 낌</span>{{ i.slot }}</small></span>
          <span class="count"><slot name="count" :item="i" :quiet="true" /></span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.list {
  --side: var(--gold);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  padding: 4px 10px 4px 12px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 12px;
}
ul {
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.main {
  flex: 1;
}
.row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: 0;
  border-bottom: 1px solid rgb(58 67 102 / 0.5);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--fast) ease;
}
.row:hover {
  background: rgb(255 255 255 / 0.03);
}
.row.on {
  background: color-mix(in srgb, var(--side) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--side);
}
.row img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  image-rendering: pixelated;
}
/* 아이콘을 모르는 안 낀 장비는 같은 크기의 빈 칸 */
.no-icon {
  width: 30px;
  height: 30px;
  background: var(--bar);
  border: 1px dashed var(--panel-line);
  border-radius: 6px;
}
.name {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}
.name b {
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.name small {
  overflow: hidden;
  color: var(--sub);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  display: grid;
  justify-items: end;
  gap: 2px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.unworn {
  margin-right: 4px;
  padding: 0 5px;
  border: 1px solid var(--panel-line);
  border-radius: 4px;
  color: var(--sub);
  font-size: 10.5px;
}
.quiet .row {
  opacity: 0.6;
}
.more {
  min-height: 40px;
  padding: 8px 12px;
  background: none;
  border: 0;
  border-top: 1px dashed var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.none {
  padding: 20px 12px;
  font-size: 13px;
  text-align: center;
}
/* 위아래로 쌓이는 좁은 화면에선 목록이 상세를 너무 밀어내지 않게 높이를 묶고 안에서 넘긴다 */
@media (max-width: 900px) {
  .list {
    max-height: min(420px, 55vh);
  }
}
</style>
