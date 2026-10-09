<script setup lang="ts">
import type { ItemPurchase } from '#shared/types'

// 조각·심볼처럼 여러 번 나눠 사는 줄의 구매 칸. 칸에는 합계와 건수, 누르면 내역 창에서 한 건씩 적는다
const props = defineProps<{ name: string, purchases: ItemPurchase[] }>()
const emit = defineEmits<{ save: [purchases: ItemPurchase[]] }>()

const open = ref(false)
const today = kstToday()
const date = ref(today)
const eok = ref('')
const total = computed(() => props.purchases.reduce((sum, p) => sum + p.amount, 0))

function add() {
  const amount = Math.round(Number(eok.value.replace(/,/g, '')) * EOK)
  if (!Number.isFinite(amount) || amount <= 0) return
  emit('save', [...props.purchases, { date: date.value || today, amount }].sort((a, b) => a.date.localeCompare(b.date)))
  eok.value = ''
}
function remove(index: number) {
  emit('save', props.purchases.filter((_, i) => i !== index))
}
</script>

<template>
  <div class="purchase">
    <button type="button" class="total" :class="{ blank: !total }" :title="`${name} 구매 내역`" @click="open = true">
      {{ total ? formatEok(total) : '-' }}
    </button>
    <div class="sub-line">
      <button type="button" class="count" @click="open = true">{{ purchases.length ? `${purchases.length}건` : '+ 내역' }}</button>
    </div>

    <AppModal v-model="open" :title="`${name} 구매 내역`" :width="400">
      <p class="muted small">살 때마다 한 건씩 적어요. 가계부에는 건마다 그 날짜로 들어가요.</p>
      <ol v-if="purchases.length" class="list">
        <li v-for="(p, i) in purchases" :key="`${p.date}-${i}`">
          <span class="date">{{ formatShortDate(p.date) }}</span>
          <b>{{ formatEok(p.amount) }}억</b>
          <small class="muted">{{ formatKoreanNumber(p.amount) }}</small>
          <button type="button" class="icon-btn" :aria-label="`${formatShortDate(p.date)} 내역 지우기`" @click="remove(i)">×</button>
        </li>
      </ol>
      <p v-else class="muted small">아직 적은 내역이 없어요.</p>
      <form class="add" @submit.prevent="add">
        <input v-model="date" type="date" class="field-input" :max="today" aria-label="산 날" required>
        <input v-model="eok" class="field-input amount" inputmode="decimal" placeholder="억 단위 금액" aria-label="금액 (억)" required>
        <button class="btn compact">+ 추가</button>
      </form>
      <p class="sum">합계 <b>{{ formatKoreanNumber(total) }}</b></p>
    </AppModal>
  </div>
</template>

<style scoped>
.purchase {
  display: grid;
  padding: 3px 0;
}
.total {
  display: block;
  width: 100%;
  height: 32px;
  padding: 0 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
  text-align: right;
  cursor: pointer;
}
.total:hover {
  background: var(--bar);
  border-color: var(--panel-line);
}
.total.blank {
  color: var(--panel-line);
}
.sub-line {
  display: flex;
  justify-content: flex-end;
  min-height: 15px;
  padding: 0 9px;
  font-size: 11px;
  line-height: 15px;
}
.count {
  padding: 0;
  background: none;
  border: 0;
  color: var(--api);
  font: inherit;
  cursor: pointer;
}
.small {
  margin: 0;
  font-size: 13px;
}
.list {
  display: grid;
  gap: 4px;
  max-height: 300px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.list li {
  display: grid;
  grid-template-columns: 64px 76px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--panel);
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
.date {
  color: var(--sub);
}
.list b {
  color: var(--gold);
  font-family: var(--f-title);
  font-weight: 400;
  text-align: right;
}
.icon-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--sub);
  cursor: pointer;
}
.icon-btn:hover {
  border-color: var(--loss);
  color: var(--loss);
}
/* 날짜 칸은 폭을 고정하고 금액 칸이 남은 폭을 다 쓴다 */
.add {
  display: grid;
  grid-template-columns: 140px 130px auto;
  gap: 6px;
}
.add .field-input {
  width: 100%;
  min-height: 40px;
  color-scheme: dark;
}
.add .amount {
  text-align: right;
}
.sum {
  margin: 0;
  color: var(--sub);
  text-align: right;
}
.sum b {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
</style>
