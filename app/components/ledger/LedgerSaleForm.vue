<script setup lang="ts">
const props = defineProps<{ date: string, feeRate: number, stock: number }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const count = ref<number | null>(null)
const unitPrice = ref<number | null>(null)
const fee = ref(props.feeRate)
const busy = ref(false)
const failure = ref('')
const net = computed(() => (count.value && unitPrice.value ? dropSaleNet({ count: count.value, unitPrice: unitPrice.value, fee: fee.value }) : 0))

async function submit() {
  busy.value = true
  failure.value = ''
  try {
    await $fetch('/api/ledger/sales', { method: 'POST', body: { date: props.date, item: 'fragments', count: count.value, unitPrice: unitPrice.value, fee: fee.value } })
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
  <form class="form" @submit.prevent="submit">
    <div class="amounts">
      <label for="sale-count" class="field">
        <span class="label">판 개수</span>
        <input id="sale-count" v-model.number="count" type="number" min="1" :max="stock > 0 ? stock : undefined" class="field-input" placeholder="0" required>
      </label>
      <MesoInput id="sale-price" v-model="unitPrice" label="개당 가격" required />
    </div>
    <div class="fees" role="radiogroup" aria-label="경매장 수수료">
      <button v-for="f in AUCTION_FEES" :key="f.rate" type="button" role="radio" class="fee" :class="{ on: fee === f.rate }" :aria-checked="fee === f.rate" @click="fee = f.rate">{{ f.label }}</button>
      <span class="net">받은 메소 <b>{{ formatKoreanNumber(net) }}</b></span>
    </div>
    <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>
    <div class="bottom">
      <button type="button" class="btn ghost compact" @click="emit('cancel')">취소</button>
      <button class="btn compact" :disabled="busy">기록하기</button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--bar);
  border: 1px solid var(--calc);
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
.fee {
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 12px;
  cursor: pointer;
}
.fee.on {
  background: rgb(242 193 78 / 0.15);
  border-color: var(--gold);
  color: var(--gold);
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
.bottom {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
