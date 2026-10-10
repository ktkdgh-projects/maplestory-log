<script setup lang="ts">
const props = defineProps<{ date: string, feeRate: number }>()
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
  <form class="form" @submit.prevent="submit" novalidate>
    <div class="amounts">
      <label for="sale-count" class="field">
        <span class="label">판 개수</span>
        <input id="sale-count" v-model.number="count" type="number" class="field-input" placeholder="0">
      </label>
      <MesoInput id="sale-price" v-model="unitPrice" label="개당 가격" />
    </div>
    <div class="fees">
      <LedgerFeeLine v-model="fee" />
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
