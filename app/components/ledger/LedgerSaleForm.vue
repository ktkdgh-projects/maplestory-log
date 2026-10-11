<script setup lang="ts">
import type { DropSale } from '#shared/types'
import { dropSaleNet } from '#shared/calc/meso'

const props = defineProps<{ date: string, feeRate: number, sale?: DropSale | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const count = ref<number | ''>(props.sale?.count ?? '')
const unitPrice = ref<number | null>(props.sale?.unitPrice ?? null)
const fee = ref(props.sale?.fee ?? props.feeRate)
const busy = ref(false)
const failure = ref('')
// 숫자 칸을 비우면 ''가 들어온다
const countValue = computed(() => (typeof count.value === 'number' && count.value > 0 ? Math.floor(count.value) : 0))
const net = computed(() => (countValue.value && unitPrice.value ? dropSaleNet({ count: countValue.value, unitPrice: unitPrice.value, fee: fee.value }) : 0))

async function submit() {
  if (!countValue.value || !unitPrice.value) {
    failure.value = !countValue.value ? '판 개수를 적어 주세요.' : '개당 가격을 적어 주세요.'
    return
  }
  busy.value = true
  failure.value = ''
  try {
    const body = { date: props.sale?.date ?? props.date, item: 'fragments', count: countValue.value, unitPrice: unitPrice.value, fee: fee.value }
    if (props.sale) await $fetch(`/api/ledger/sales/${props.sale.id}`, { method: 'PUT', body })
    else await $fetch('/api/ledger/sales', { method: 'POST', body })
    emit('saved')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="form" @submit.prevent="submit" novalidate>
    <div class="amounts">
      <label for="sale-count" class="field">
        <span class="label">판 개수</span>
        <input id="sale-count" v-model.number="count" type="number" min="1" inputmode="numeric" class="field-input" placeholder="0" @input="failure = ''">
      </label>
      <MesoInput id="sale-price" v-model="unitPrice" label="개당 가격" @input="failure = ''" />
    </div>
    <div class="fees">
      <LedgerFeeLine v-model="fee" :keep="!!sale" />
      <span class="net">받은 메소 <b>{{ formatKoreanNumber(net) }}</b></span>
    </div>
    <p class="hint" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>
    <div class="bottom">
      <button type="button" class="btn ghost compact" @click="emit('cancel')">취소</button>
      <button class="btn compact" :disabled="busy">{{ sale ? '고치기' : '기록하기' }}</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--bar);
  border: 1px solid var(--gain);
  border-radius: 10px;
  animation: rise-in 0.3s var(--ease-out);
}
.form :deep(.field-input) {
  min-height: 36px;
}
.amounts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  align-items: start;
  gap: 8px;
}
.field {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.field input {
  text-align: right;
}
.label {
  color: var(--sub);
  font-size: 13px;
  white-space: nowrap;
}
.label small {
  color: var(--tip-line);
  font-size: 11px;
}
.fees {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.net {
  margin-left: auto;
  color: var(--sub);
  font-size: 13px;
}
.net b {
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.hint {
  height: 18px;
  margin: 0;
  overflow: hidden;
  color: var(--loss);
  font-size: 12.5px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0;
}
.hint.show {
  opacity: 1;
}
.bottom {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
