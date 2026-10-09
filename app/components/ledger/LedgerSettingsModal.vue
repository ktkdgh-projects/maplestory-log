<script setup lang="ts">
import type { LedgerSettings } from '#shared/types'

const props = defineProps<{ settings: LedgerSettings | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

const amount = ref<number | null>(null)
const date = ref(kstToday())
const busy = ref(false)
const failure = ref('')

watch(open, (value) => {
  if (!value) return
  amount.value = props.settings?.balance?.checked ?? null
  date.value = props.settings?.balance?.checkedAt ?? kstToday()
  failure.value = ''
})

async function save(clearBalance = false) {
  if (!clearBalance && amount.value === null) {
    failure.value = '보유 메소를 적어 주세요.'
    return
  }
  busy.value = true
  failure.value = ''
  try {
    const balance = clearBalance ? null : { date: date.value, amount: amount.value }
    await $fetch('/api/ledger/settings', { method: 'PUT', body: { balance } })
    emit('saved')
    open.value = false
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
  <AppModal v-model="open" title="보유 메소 맞추기">
    <section class="block">
      <p class="muted small">기준 날짜를 시작할 때 가지고 있던 메소를 적어 주세요. 그날부터 적은 사냥·보스·물욕·장비 기록을 더하고 빼서 지금 보유 메소를 보여줘요. 틀어지면 언제든 다시 맞추면 돼요.</p>
      <div class="row">
        <MesoInput id="balance-amount" v-model="amount" label="그날 시작할 때 보유 메소" />
        <label for="balance-date" class="field">
          <span class="label">기준 날짜</span>
          <input id="balance-date" v-model="date" type="date" class="field-input" :max="kstToday()">
        </label>
      </div>
      <p v-if="settings?.balance" class="muted small">지금 기준: {{ formatMonthDay(settings.balance.checkedAt) }} 시작 {{ formatKoreanNumber(settings.balance.checked) }} → 지금 {{ formatKoreanNumber(settings.balance.current) }} <button type="button" class="text-btn" :disabled="busy" @click="save(true)">기준 지우기</button></p>
    </section>

    <p v-if="failure" class="form-error">{{ failure }}</p>
    <div class="actions">
      <button type="button" class="btn ghost" @click="open = false">취소</button>
      <button type="button" class="btn" :disabled="busy" @click="save()">저장</button>
    </div>
  </AppModal>
</template>

<style scoped>
.block {
  display: grid;
  gap: 8px;
}
.small {
  font-size: 13px;
}
.row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  align-items: start;
  gap: 10px;
}
.field {
  display: grid;
  gap: 3px;
}
.label {
  color: var(--sub);
  font-size: 13px;
}
.text-btn {
  margin-left: 6px;
  padding: 0;
  background: none;
  border: 0;
  color: var(--loss);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
