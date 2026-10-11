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

const putBalance = (balance: { date: string, amount: number } | null) => $fetch('/api/ledger/settings', { method: 'PUT', body: { balance } })

async function save() {
  if (amount.value === null) {
    failure.value = '보유 메소를 적어 주세요.'
    return
  }
  busy.value = true
  failure.value = ''
  try {
    await putBalance({ date: date.value, amount: amount.value })
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

const { ask } = useConfirm()
async function clearBalance() {
  const balance = props.settings?.balance
  if (!balance) return
  const ok = await ask({
    title: '보유 메소 기준 지우기',
    name: `${formatDay(balance.checkedAt)} 시작 ${formatKoreanNumber(balance.checked)}`,
    detail: `지금 ${formatKoreanNumber(balance.current)}`,
    note: '기준을 지우면 보유 메소와 잔액 그래프가 사라져요. 적어 둔 기록은 그대로 남아요.',
    run: () => putBalance(null),
  })
  if (!ok) return
  emit('saved')
  open.value = false
}
</script>

<template>
  <AppModal v-model="open" title="보유 메소 맞추기" :width="480" fit>
    <form class="block" novalidate @submit.prevent="save">
      <p class="muted small">기준 날짜를 시작할 때 가지고 있던 메소를 적어 주세요. 그날부터 적은 사냥·보스·장비·직접 등록 기록을 더하고 빼서 지금 보유 메소를 보여 드려요. 틀어지면 언제든 다시 맞추면 돼요.</p>
      <div class="row">
        <MesoInput id="balance-amount" v-model="amount" label="그날 시작할 때 보유 메소" />
        <div class="field">
          <label for="balance-date" class="label">기준 날짜</label>
          <DatePicker id="balance-date" v-model="date" :max="kstToday()" field />
        </div>
      </div>
      <p v-if="settings?.balance" class="current muted small">
        <span class="nowrap">지금 기준: {{ formatDay(settings.balance.checkedAt) }} 시작 {{ formatKoreanNumber(settings.balance.checked) }}</span>
        <span class="nowrap">→ 지금 {{ formatKoreanNumber(settings.balance.current) }}</span>
        <button type="button" class="text-btn" :disabled="busy" @click="clearBalance">기준 지우기</button>
      </p>
      <p class="hint" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>
      <div class="actions">
        <button type="button" class="btn ghost compact" @click="open = false">취소</button>
        <button class="btn compact" :disabled="busy">저장</button>
      </div>
    </form>
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
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}
.field {
  display: grid;
  gap: 3px;
}
.row :deep(.field-input) {
  min-height: 38px;
}
.label {
  color: var(--sub);
  font-size: 13px;
}
.current {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}
.nowrap {
  white-space: nowrap;
}
.text-btn {
  padding: 0;
  background: none;
  border: 0;
  color: var(--loss);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.hint {
  contain: inline-size;
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
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 480px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
