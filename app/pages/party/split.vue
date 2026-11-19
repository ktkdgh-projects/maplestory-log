<script setup lang="ts">
import type { PartySplitInfo, PartySplitRequest } from '#shared/types'
import { PARTY_SPLIT_FEES, partySplit } from '#shared/calc/partySplit'

definePageMeta({ layout: false })
useHead({
  title: '분배금 계산 · 레다봇',
  // 주소에 개인 링크 토큰이 있어서 검색에 안 잡히고 다른 사이트로 새지 않게 한다
  meta: [{ name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }],
})

const SALE_MAX = 1e13
const FEE_LABELS: Record<number, string> = { 0.05: '5%', 0.03: '3% (MVP)', 0: '0% (직접 건넴)' }
// 큰 금액을 자릿수 세며 치지 않게, 눌러서 더하는 버튼
const SALE_STEPS = [1e9, 1e8, 1e7, 1e6]
const COST_STEPS = [1e7, 1e6, 1e5]

const token = useRoute().query.t
const { data, error } = await useFetch<PartySplitInfo>('/api/discord/split', { query: { t: token } })
const openError = computed(() => (error.value?.data as { message?: string } | undefined)?.message ?? '디스코드에서 버튼을 다시 눌러 주세요.')

const sale = ref(0)
const cost = ref(0)
const feeRate = ref(PARTY_SPLIT_FEES[0]!)
const sellerId = ref(data.value?.me ?? '')
const payerId = ref(data.value?.me ?? '')
const memberIds = ref(data.value?.members.map(m => m.id) ?? [])
const sending = ref(false)
const message = ref('')
const failed = ref(false)

const digits = (text: string) => Math.min(Number(text.replace(/\D/g, '')) || 0, SALE_MAX)
const shown = (value: number) => (value ? value.toLocaleString('ko-KR') : '')
const nameOf = (id: string) => data.value!.members.find(m => m.id === id)?.character ?? ''

function toggleMember(id: string) {
  // 판 사람과 비용 낸 사람은 뺄 수 없다
  if (id === sellerId.value || (cost.value > 0 && id === payerId.value)) return
  memberIds.value = memberIds.value.includes(id) ? memberIds.value.filter(m => m !== id) : [...memberIds.value, id]
}
function pick(target: 'seller' | 'payer', id: string) {
  if (target === 'seller') sellerId.value = id
  else payerId.value = id
  if (!memberIds.value.includes(id)) memberIds.value = [...memberIds.value, id]
}

const request = computed<PartySplitRequest>(() => ({ sale: sale.value, cost: cost.value, feeRate: feeRate.value, sellerId: sellerId.value, payerId: payerId.value, memberIds: memberIds.value }))
const result = computed(() => {
  if (!sale.value || memberIds.value.length < 2) return null
  return partySplit({
    sale: sale.value,
    saleFee: feeRate.value,
    cost: cost.value,
    sellerId: sellerId.value,
    payerId: cost.value > 0 ? payerId.value : sellerId.value,
    members: memberIds.value.map(id => ({ id, weight: 1, fee: feeRate.value })),
  })
})
const share = computed(() => result.value?.rows.find(r => r.id !== sellerId.value)?.own ?? 0)
const hint = computed(() => {
  if (!sale.value) return '판매 금액을 넣으면 바로 계산돼요'
  if (memberIds.value.length < 2) return '나눌 사람을 두 명 이상 골라 주세요'
  return result.value ? '' : '소재·유행 값이 판매 금액보다 커서 나눌 돈이 없어요'
})
// 넣은 값이 바뀌면 "올렸어요"를 지워서, 바뀐 내용은 아직 안 올라갔다는 걸 알린다
watch(request, () => {
  message.value = ''
  failed.value = false
})

async function post() {
  sending.value = true
  failed.value = false
  try {
    await $fetch('/api/discord/split', { method: 'POST', body: { t: token, ...request.value } })
    message.value = '파티 채널에 올렸어요'
  }
  catch (e) {
    failed.value = true
    message.value = (e as { data?: { message?: string } }).data?.message ?? '올리지 못했어요. 다시 눌러 주세요.'
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <main class="page">
    <section v-if="!data" class="card">
      <p class="brand">레다봇</p>
      <h1>링크를 열 수 없어요</h1>
      <p class="sub">{{ openError }}</p>
    </section>

    <template v-else>
      <header class="head">
        <p class="brand">레다봇 · {{ data.partyName }}</p>
        <h1>분배금 계산</h1>
        <p class="sub">수수료와 소재·유행 값까지 똑같이 나눠요. 채널에는 결과만 올라가요.</p>
      </header>

      <section class="card form">
        <div class="field">
          <label for="split-sale">판매 금액 <small>{{ sale ? formatKoreanNumber(sale) : '숫자만' }}</small></label>
          <input id="split-sale" class="num" type="text" inputmode="numeric" placeholder="0" :value="shown(sale)" @input="sale = digits(($event.target as HTMLInputElement).value)">
          <div class="steps">
            <button v-for="step in SALE_STEPS" :key="step" type="button" class="chip" @click="sale = Math.min(sale + step, SALE_MAX)">+{{ formatKoreanNumber(step) }}</button>
            <button type="button" class="chip" :disabled="!sale" @click="sale = 0">지우기</button>
          </div>
        </div>

        <div class="field">
          <label for="split-cost">소재·유행에 쓴 돈 <small>{{ cost ? formatKoreanNumber(cost) : '없으면 비워 두기' }}</small></label>
          <input id="split-cost" class="num" type="text" inputmode="numeric" placeholder="0" :value="shown(cost)" @input="cost = digits(($event.target as HTMLInputElement).value)">
          <div class="steps">
            <button v-for="step in COST_STEPS" :key="step" type="button" class="chip" @click="cost = Math.min(cost + step, SALE_MAX)">+{{ formatKoreanNumber(step) }}</button>
            <button type="button" class="chip" :disabled="!cost" @click="cost = 0">지우기</button>
          </div>
        </div>

        <div class="field">
          <span>경매장 수수료</span>
          <div class="steps">
            <button v-for="fee in PARTY_SPLIT_FEES" :key="fee" type="button" class="chip" :class="{ on: feeRate === fee }" :aria-pressed="feeRate === fee" @click="feeRate = fee">{{ FEE_LABELS[fee] }}</button>
          </div>
        </div>

        <div class="field">
          <span>판 사람</span>
          <div class="steps">
            <button v-for="m in data.members" :key="m.id" type="button" class="chip" :class="{ on: sellerId === m.id }" :aria-pressed="sellerId === m.id" @click="pick('seller', m.id)">{{ m.character }}</button>
          </div>
        </div>

        <div class="field" :class="{ dim: !cost }">
          <span>소재·유행 낸 사람</span>
          <div class="steps">
            <button v-for="m in data.members" :key="m.id" type="button" class="chip" :class="{ on: cost > 0 && payerId === m.id }" :aria-pressed="payerId === m.id" :disabled="!cost" @click="pick('payer', m.id)">{{ m.character }}</button>
          </div>
        </div>

        <div class="field">
          <span>나눌 사람 <small>{{ memberIds.length }}명</small></span>
          <div class="steps">
            <button v-for="m in data.members" :key="m.id" type="button" class="chip" :class="{ on: memberIds.includes(m.id) }" :aria-pressed="memberIds.includes(m.id)" @click="toggleMember(m.id)">{{ m.character }}</button>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>결과</h2>
        <template v-if="result">
          <p class="share">한 사람 몫 <b>{{ share.toLocaleString('ko-KR') }}</b></p>
          <p class="sub">실수령 {{ result.net.toLocaleString('ko-KR') }} · 수수료 {{ feeRate * 100 }}%<template v-if="cost"> · 소재·유행 {{ cost.toLocaleString('ko-KR') }} ({{ nameOf(payerId) }})</template></p>
          <div class="table">
            <table>
              <thead><tr><th>파티원</th><th>경매장에 올릴 가격</th><th>받는 돈</th></tr></thead>
              <tbody>
                <tr v-for="row in result.rows" :key="row.id">
                  <td>{{ nameOf(row.id) }}<small v-if="row.id === sellerId">판매</small><small v-else-if="cost && row.id === payerId">비용 포함</small></td>
                  <td class="n">{{ row.id === sellerId ? '—' : row.send.toLocaleString('ko-KR') }}</td>
                  <td class="n">{{ row.receive.toLocaleString('ko-KR') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p v-else class="sub">{{ hint }}</p>
      </section>

      <section class="bar">
        <p class="status" :class="{ bad: failed, done: message && !failed }" role="status">{{ message || (result ? '확인했으면 채널에 올려 주세요' : hint) }}</p>
        <button type="button" class="btn" :disabled="sending || !result" @click="post">채널에 올리기</button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page {
  max-width: 560px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.brand {
  margin: 0 0 4px;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
}
h1 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
h2 {
  margin: 0 0 8px;
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.sub {
  margin: 4px 0 0;
  color: var(--sub);
  font-size: 14px;
}
.card {
  padding: 14px;
  background: var(--win);
  border: 1px solid var(--win-line);
  border-radius: 10px;
}

.form {
  display: grid;
  gap: 16px;
}
.field {
  display: grid;
  gap: 6px;
  font-size: 14px;
}
.field.dim {
  opacity: 0.55;
}
.field small {
  margin-left: 6px;
  color: var(--gold);
  font-size: 13px;
}
.field input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  background: var(--field);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font-family: inherit;
  font-size: 16px;
}
.field input.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  min-height: 34px;
  padding: 0 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.chip.on {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.chip:disabled {
  cursor: default;
  opacity: 0.45;
}

.share {
  margin: 0;
  color: var(--sub);
  font-size: 14px;
}
.share b {
  display: block;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 30px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.table {
  margin-top: 12px;
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 8px 6px;
  border-top: 1px solid var(--panel-line);
  text-align: left;
  white-space: nowrap;
}
th {
  border-top: 0;
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
}
th:not(:first-child),
td.n {
  text-align: right;
}
td small {
  margin-left: 6px;
  color: var(--gold);
  font-size: 11px;
}

.bar {
  position: sticky;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 10px 10px 14px;
  background: var(--panel);
  border: 1px solid var(--tip-line);
  border-radius: 10px;
}
.bar .btn {
  flex: none;
}
.bar .btn:disabled {
  cursor: default;
}
.status {
  margin: 0;
  color: var(--sub);
  font-size: 14px;
}
.status.done {
  color: var(--gain);
}
.status.bad {
  color: var(--loss);
}
</style>
