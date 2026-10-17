<script setup lang="ts">
import type { MesoEntry, MesoHistoryDay, MesoHistoryKind, MesoHistoryRef, MesoHistoryRow } from '#shared/types'

const props = defineProps<{ days: MesoHistoryDay[], kinds: { key: MesoHistoryKind, label: string, color: string, icon: string }[], loading: boolean, waiting: boolean }>()
const emit = defineEmits<{ edit: [entry: MesoEntry], remove: [target: MesoHistoryRef, label: string, amount: number, date: string] }>()

const BASE_KIND = { label: '맞추기', color: 'var(--tip-line)', icon: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z' }
const kindOf = (kind: MesoHistoryKind) => props.kinds.find(k => k.key === kind) ?? BASE_KIND

// 여러 건을 묶은 줄은 눌러서 펼치고, 직접 등록은 눌러서 고친다. 나머지는 적은 화면으로 간다
const open = ref<string | null>(null)
function closeOutside(event: MouseEvent) {
  const row = (event.target as HTMLElement).closest('[data-row]')
  if (!row || row.getAttribute('data-row') !== open.value) open.value = null
}
let arming: ReturnType<typeof setTimeout> | undefined
watch(open, (value) => {
  clearTimeout(arming)
  if (value) arming = setTimeout(() => document.addEventListener('click', closeOutside))
  else document.removeEventListener('click', closeOutside)
})
onBeforeUnmount(() => {
  clearTimeout(arming)
  document.removeEventListener('click', closeOutside)
})
const openGroup = ref<string | null>(null)
function toggleGroup(key: string) {
  openGroup.value = openGroup.value === key ? null : key
}
watch(open, () => {
  openGroup.value = null
})

function pick(row: MesoHistoryRow) {
  if (row.entry) emit('edit', row.entry)
  else if (row.children.length) open.value = open.value === row.key ? null : row.key
}
</script>

<template>
  <div class="list" :class="{ loading }">
    <div v-for="d in days" :key="d.date" class="day">
      <div class="day-h">
        <b>{{ formatDayWeek(d.date) }}</b>
        <span class="muted">{{ d.rows.filter(r => r.kind !== 'base').length }}건</span>
        <span class="net" :class="d.net < 0 ? 'loss' : 'gain'">{{ d.net ? formatSigned(d.net) : '' }}</span>
        <span class="day-bal">{{ d.rows[0]?.balance == null ? '' : `끝 잔액 ${formatKoreanNumber(d.rows[0].balance)}` }}</span>
      </div>
      <LedgerHistoryRow
        v-for="r in d.rows"
        :key="r.key"
        :row="r"
        :date="d.date"
        :kind="kindOf(r.kind)"
        :open="open === r.key"
        :open-group="openGroup"
        @pick="pick(r)"
        @toggle-group="toggleGroup"
        @remove="(target, label, amount, date) => emit('remove', target, label, amount, date)"
      />
    </div>
    <div v-if="!days.length" class="empty">
      <img src="/favicon.svg" alt="" width="40" height="40">
      <p class="muted">{{ waiting ? '내역을 불러오는 중이에요…' : '이 기간엔 메소가 움직인 기록이 없어요.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.list {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 0;
  max-height: 100%;
  padding-right: 6px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  transition: opacity var(--fast) ease;
}
.list.loading {
  opacity: 0.55;
}
.day {
  display: grid;
  gap: 4px;
}
.day-h {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 2px 2px 0;
  font-size: 12.5px;
}
.day-h b {
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.day-bal {
  min-width: 120px;
  color: var(--sub);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.net {
  margin-left: auto;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.empty {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 40px 0;
  text-align: center;
}
@media (max-width: 520px) {
  .list {
    padding-right: 0;
    scrollbar-gutter: auto;
  }
}
</style>
