<script setup lang="ts">
import type { MesoEntry } from '#shared/types'
import { MESO_ENTRY_TYPES, findMesoEntryType, type MesoEntryType } from '#shared/data/mesoEntries'

// 메소 판매·경매장 구매처럼 다른 화면에서 세지 않는 지출·수입을 직접 적는다. entry가 있으면 고치기
const props = defineProps<{ entry: MesoEntry | null, date?: string, feeRate: number, balance: number | null }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()

// 종류 카드: 금액 칸 이름, 한 줄 설명, 아이콘(24칸 선 그림)
const TYPE_UI: Record<MesoEntryType, { amount: string, hint: string, icon: string }> = {
  'meso-sell': { amount: '판 메소', hint: '현금 거래로 팔았어요', icon: 'M12 20V7M6 12l6-6 6 6M5 3h14' },
  'auction-buy': { amount: '쓴 메소', hint: '주문서·소비·캐시템', icon: 'M3 4h2l2.4 11h11L21 7H6.5M9 20h.01M18 20h.01' },
  'etc-out': { amount: '나간 메소', hint: '그 밖에 쓴 메소', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
  'meso-buy': { amount: '산 메소', hint: '현금으로 샀어요', icon: 'M12 4v13M6 12l6 6 6-6M5 21h14' },
  'auction-sell': { amount: '판매가', hint: '장비 결산에 없는 물건', icon: 'M3 12V4h8l9 9-8 8-9-9ZM7.5 7.5h.01' },
  'etc-in': { amount: '들어온 메소', hint: '선물·보상 등', icon: 'M4 11h16v9H4v-9ZM3 7h18v4H3V7ZM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1' },
}

const direction = ref<'out' | 'in'>('out')
const type = ref<MesoEntryType>('meso-sell')
const date = ref(kstToday())
const amount = ref<number | null>(null)
const cash = ref<number | null>(null)
const item = ref('')
const fee = ref(props.feeRate)
const memo = ref('')
const icon = ref<string | null>(null)
let pickedName = ''
watch(item, (value) => {
  if (value !== pickedName) icon.value = null
})
watch(icon, (value) => {
  pickedName = value ? item.value : ''
})
const busy = ref(false)
const failure = ref('')
const confirming = ref(false)

watch(open, (value) => {
  if (!value) return
  const e = props.entry
  type.value = e?.type ?? 'meso-sell'
  direction.value = findMesoEntryType(type.value)!.direction
  date.value = e?.date ?? props.date ?? kstToday()
  amount.value = e?.amount ?? null
  cash.value = e?.cash ?? null
  item.value = e?.item ?? ''
  icon.value = e?.icon ?? null
  pickedName = e?.icon ? item.value : ''
  fee.value = e?.fee ?? props.feeRate
  memo.value = e?.memo ?? ''
  failure.value = ''
  confirming.value = false
})

const info = computed(() => findMesoEntryType(type.value)!)
const ui = computed(() => TYPE_UI[type.value])
const types = computed(() => MESO_ENTRY_TYPES.filter(t => t.direction === direction.value))
function pickDirection(value: 'out' | 'in') {
  if (direction.value === value) return
  direction.value = value
  type.value = types.value[0]!.key
}

// 큰 금액은 쉼표를 넣어 보여 주고 숫자만 저장한다
const digitsModel = (target: Ref<number | null>) => computed({
  get: () => (target.value === null ? '' : target.value.toLocaleString('ko-KR')),
  set: (input: string) => {
    const digits = input.replace(/\D/g, '').slice(0, 16)
    target.value = digits ? Number(digits) : null
  },
})
const amountText = computed({
  get: () => mesoToManText(amount.value),
  set: (input: string) => {
    amount.value = manTextToMeso(input)
  },
})
const cashText = digitsModel(cash)

const delta = computed(() => (amount.value ? mesoEntryDelta({ type: type.value, amount: amount.value, fee: fee.value }) : 0))
// 고칠 때는 원래 금액을 빼고 새 금액으로 바뀐 보유 메소를 보여 준다
const before = computed(() => (props.balance === null ? null : props.balance - (props.entry ? mesoEntryDelta(props.entry) : 0)))
const rate = computed(() => (info.value.cash && cash.value && amount.value ? Math.round(cash.value / (amount.value / 1e8)) : null))

async function save() {
  if (!amount.value) {
    failure.value = `${ui.value.amount}를 적어 주세요.`
    return
  }
  busy.value = true
  failure.value = ''
  const body = { type: type.value, date: date.value, amount: amount.value, cash: cash.value, item: item.value, icon: icon.value, fee: fee.value, memo: memo.value }
  try {
    if (props.entry) await $fetch(`/api/ledger/entries/${props.entry.id}`, { method: 'PUT', body })
    else await $fetch('/api/ledger/entries', { method: 'POST', body })
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

async function remove() {
  if (!props.entry) return
  busy.value = true
  try {
    await $fetch(`/api/ledger/entries/${props.entry.id}`, { method: 'DELETE' })
    emit('saved')
    open.value = false
  }
  catch (error) {
    failure.value = errorMessage(error)
    confirming.value = false
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <AppModal v-model="open" :title="entry ? '직접 등록 고치기' : '메소 직접 등록'" :width="500">
    <form class="form" :class="direction" novalidate @submit.prevent="save">
      <!-- 나간·들어온 메소 -->
      <div class="direction" role="radiogroup" aria-label="나간 메소 · 들어온 메소">
        <button type="button" role="radio" class="out" :aria-checked="direction === 'out'" @click="pickDirection('out')"><span class="sign">−</span>나간 메소</button>
        <button type="button" role="radio" class="in" :aria-checked="direction === 'in'" @click="pickDirection('in')"><span class="sign">+</span>들어온 메소</button>
      </div>

      <!-- 종류 카드 -->
      <div class="types" role="radiogroup" aria-label="종류">
        <button v-for="t in types" :key="t.key" type="button" role="radio" class="type" :aria-checked="type === t.key" @click="type = t.key">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="TYPE_UI[t.key].icon" /></svg>
          <b>{{ t.label }}</b>
          <small>{{ TYPE_UI[t.key].hint }}</small>
        </button>
      </div>

      <!-- 금액: 가장 크게 -->
      <div class="amount">
        <label for="entry-amount" class="label">{{ ui.amount }}</label>
        <span class="amount-box">
          <input id="entry-amount" v-model="amountText" inputmode="numeric" autocomplete="off" placeholder="0">
          <small>만 메소</small>
        </span>
        <!-- 수수료가 붙는 종류는 왼쪽에 수수료, 오른쪽에 실제로 들어올 금액. 줄 높이는 늘 같다 -->
        <span class="amount-foot">
          <LedgerFeeLine v-if="info.fee" v-model="fee" />
          <span class="reading">{{ amount ? (info.fee ? `받는 메소 ${formatKoreanNumber(afterFee(amount, fee))}` : formatKoreanNumber(amount)) : '만 단위로 적어요 · 1을 치면 1만 메소' }}</span>
        </span>
      </div>

      <!-- 날짜·메모는 늘 같은 줄 -->
      <div class="grid">
        <div class="field">
          <label for="entry-date" class="label">날짜</label>
          <DatePicker id="entry-date" v-model="date" :max="kstToday()" field />
        </div>
        <label for="entry-memo" class="field">
          <span class="label">메모 <small>선택</small></span>
          <input id="entry-memo" v-model="memo" class="field-input" maxlength="200" placeholder="예: 친구한테">
        </label>
      </div>

      <!-- 종류마다 다른 칸은 같은 높이의 한 줄에 바꿔 끼워, 종류를 바꿔도 아래가 움직이지 않는다 -->
      <div class="extra">
        <template v-if="info.cash">
          <label for="entry-cash" class="field">
            <span class="label">{{ direction === 'out' ? '받은 현금' : '낸 현금' }} <small>선택</small></span>
            <span class="suffix-box">
              <input id="entry-cash" v-model="cashText" class="field-input" inputmode="numeric" autocomplete="off" placeholder="0">
              <small>원</small>
            </span>
          </label>
          <span class="side chip-line">1억당 <b>{{ rate ? `${rate.toLocaleString('ko-KR')}원` : '-' }}</b></span>
        </template>
        <template v-else-if="info.item">
          <div class="field">
            <span class="label">{{ direction === 'out' ? '산 물건' : '판 물건' }} <small>선택 · 검색해서 고르면 아이콘도 남아요</small></span>
            <div class="item-pick">
              <img v-if="icon" :src="icon" alt="" class="picked-icon">
              <ItemsNameSearch v-model="item" class="item-search" placeholder="아이템 이름 검색" label="아이템 이름" :enter="false" :required="false" @pick="icon = $event.icon" />
            </div>
          </div>
        </template>
        <p v-else class="etc muted">금액·날짜·메모만 적으면 돼요.</p>
      </div>

      <!-- 바뀔 보유 메소 · 안내 · 버튼 -->
      <div class="foot">
        <div class="preview">
          <template v-if="before !== null">
            <span class="muted">보유 메소</span>
            <span class="flow"><span>{{ formatKoreanNumber(before) }}</span><span class="arrow">→</span><b :class="delta < 0 ? 'loss' : 'gain'">{{ formatKoreanNumber(before + delta) }}</b></span>
          </template>
          <span v-else class="muted">보유 메소를 맞추면 등록 뒤 금액을 보여 드려요</span>
        </div>
        <p class="hint" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>
        <div class="actions">
          <template v-if="confirming">
            <span class="confirm-text">이 기록을 지울까요?</span>
            <button type="button" class="btn ghost compact" @click="confirming = false">아니요</button>
            <button type="button" class="btn compact remove" :disabled="busy" @click="remove">지우기</button>
          </template>
          <template v-else>
            <button v-if="entry" type="button" class="text-btn" @click="confirming = true">지우기</button>
            <span class="spacer" />
            <button type="button" class="btn ghost compact" @click="open = false">취소</button>
            <button class="btn compact" :disabled="busy">{{ entry ? '고치기' : '등록' }}</button>
          </template>
        </div>
      </div>
    </form>
  </AppModal>
</template>

<style scoped>
.form {
  --dir: var(--loss);
  display: grid;
  gap: 12px;
}
.form.in {
  --dir: var(--gain);
}
.direction {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  padding: 3px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.direction button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  background: none;
  border: 0;
  border-radius: 8px;
  color: var(--sub);
  font: 15px var(--f-title);
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease;
}
.sign {
  font-size: 18px;
  line-height: 1;
}
.direction .out[aria-checked="true"] {
  background: rgb(255 138 122 / 0.16);
  color: var(--loss);
}
.direction .in[aria-checked="true"] {
  background: rgb(127 217 154 / 0.16);
  color: var(--gain);
}
.types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.type {
  display: grid;
  justify-items: start;
  gap: 2px;
  padding: 9px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--fast) ease, background var(--fast) ease;
}
.type:hover {
  border-color: var(--tip-line);
}
.type[aria-checked="true"] {
  background: color-mix(in srgb, var(--dir) 10%, var(--panel));
  border-color: var(--dir);
  box-shadow: 0 0 0 1px var(--dir);
}
.type svg {
  width: 18px;
  height: 18px;
  margin-bottom: 2px;
  fill: none;
  stroke: var(--dir);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.type b {
  font-size: 13.5px;
}
.type small {
  color: var(--sub);
  font-size: 11.5px;
  line-height: 1.35;
}
.label {
  color: var(--sub);
  font-size: 12.5px;
}
.label small {
  color: var(--tip-line);
  font-size: 11px;
}
/* 금액 */
.amount {
  display: grid;
  gap: 4px;
}
.amount-box {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  transition: border-color var(--fast) ease, box-shadow var(--fast) ease;
}
.amount-box:focus-within {
  border-color: var(--gold);
  box-shadow: var(--glow);
}
.amount-box input {
  flex: 1;
  min-width: 0;
  padding: 0;
  background: none;
  border: 0;
  outline: none;
  color: var(--text);
  font: 26px var(--f-title);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.amount-box small {
  color: var(--sub);
}
.amount-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 28px;
}
.reading {
  margin-left: auto;
  color: var(--gold);
  font-size: 12.5px;
  text-align: right;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: 10px;
}
.field {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.form :deep(.field-input) {
  min-height: 38px;
}
.suffix-box {
  position: relative;
  display: block;
}
.suffix-box input {
  padding-right: 32px;
  text-align: right;
}
.suffix-box small {
  position: absolute;
  top: 50%;
  right: 12px;
  color: var(--sub);
  transform: translateY(-50%);
}
/* 종류별 칸: 높이를 잡아 둔다 */
.extra {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  height: 64px;
}
.side {
  padding-bottom: 6px;
}
.chip-line {
  padding: 6px 10px;
  background: rgb(127 178 255 / 0.08);
  border: 1px solid rgb(127 178 255 / 0.35);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
  white-space: nowrap;
}
.chip-line b {
  color: var(--api);
}
.etc {
  grid-column: 1 / -1;
  align-self: stretch;
  display: grid;
  place-items: center;
  margin: 0;
  background: var(--panel);
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  font-size: 12.5px;
}
.item-pick {
  display: flex;
  align-items: center;
  gap: 8px;
}
.picked-icon {
  flex: none;
  width: 32px;
  height: 32px;
  object-fit: contain;
  image-rendering: pixelated;
}
.item-search {
  flex: 1;
  min-width: 0;
}
/* 아래: 바뀔 보유 메소와 버튼 */
.foot {
  display: grid;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--panel-line);
}
.preview {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 10px;
  font-size: 13px;
}
.flow {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.flow b {
  font: 18px var(--f-title);
}
.arrow {
  color: var(--sub);
}
.loss {
  color: var(--loss);
}
.gain {
  color: var(--gain);
}
.hint {
  height: 18px;
  margin: 0;
  overflow: hidden;
  color: var(--loss);
  font-size: 12.5px;
  line-height: 18px;
  opacity: 0;
}
.hint.show {
  opacity: 1;
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
}
.spacer {
  flex: 1;
}
.text-btn {
  padding: 0;
  background: none;
  border: 0;
  color: var(--loss);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.text-btn:hover {
  text-decoration: underline;
}
.confirm-text {
  flex: 1;
  color: var(--loss);
  font-size: 13px;
}
.remove {
  background: var(--loss);
  border-color: var(--loss);
  color: #2a1210;
}
@media (max-width: 480px) {
  .types {
    grid-template-columns: 1fr;
  }
  .grid,
  .extra {
    grid-template-columns: 1fr;
  }
}
</style>
