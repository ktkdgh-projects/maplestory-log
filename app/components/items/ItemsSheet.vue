<script setup lang="ts">
import type { ItemIcon, ItemPurchase, ItemRow, ItemSheet, MeResponse } from '#shared/types'

const props = defineProps<{ sheet: ItemSheet }>()
const emit = defineEmits<{ changed: [], removed: [] }>()

const busy = ref(false)
const failure = ref('')
const notice = ref('')
const newName = ref('')
// 자동완성에서 고른 아이템. 저장 전 임시 줄에도 아이콘·부위가 바로 보이게 한다
const picked = ref<ItemIcon | null>(null)
const renaming = ref(false)
const title = ref(props.sheet.title)

watch(() => props.sheet.id, () => {
  failure.value = ''
  notice.value = ''
  renaming.value = false
  title.value = props.sheet.title
})

let saving = 0
const rows = ref<ItemRow[]>([...props.sheet.rows])
// 저장 중에 도착한 새로고침 결과는 방금 고친 값보다 옛것일 수 있어 버린다. 저장이 다 끝나면 다시 불러온다
watch(() => props.sheet.rows, (value) => {
  if (saving > 0) return
  rows.value = [...value]
})

// 끄는 동안 화면 순서를 바로 바꾸고, 놓으면 서버에 저장한다
const dragId = ref<string | null>(null)
function dragStart(id: string, event: DragEvent) {
  dragId.value = id
  event.dataTransfer?.setData('text/plain', id)
}
function dragOver(index: number) {
  const from = rows.value.findIndex(r => r.id === dragId.value)
  if (from < 0 || from === index) return
  const [moved] = rows.value.splice(from, 1)
  rows.value.splice(index, 0, moved!)
}
function dragEnd() {
  dragId.value = null
}
function dropRow() {
  dragId.value = null
  const ids = rows.value.map(r => r.id)
  if (ids.join() === props.sheet.rows.map(r => r.id).join()) return
  run(() => $fetch(`/api/items/sheets/${props.sheet.id}/order`, { method: 'PUT', body: { rowIds: ids } }))
}

const totals = computed(() => itemTotals(rows.value))

async function run(action: () => Promise<unknown>, done = '') {
  busy.value = true
  failure.value = ''
  notice.value = ''
  try {
    await action()
    notice.value = done
    emit('changed')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

// 고친 값은 화면에 바로 반영하고 저장은 뒤에서 한다. 실패하면 원래 값으로 되돌린다
// 연달아 고칠 때 앞선 새로고침이 옛 값을 잠깐 덮지 않도록, 저장이 다 끝난 뒤 한 번만 새로 불러온다
async function saveInBackground(save: () => Promise<unknown>, undo: () => void) {
  failure.value = ''
  saving++
  try {
    await save()
  }
  catch (error) {
    undo()
    failure.value = errorMessage(error)
  }
  finally {
    if (--saving === 0) emit('changed')
  }
}

// 새로 추가한 줄은 서버 id를 받기 전까지 임시 id라 고칠 수 없다
const PENDING_PREFIX = 'pending-'
const isPending = (row: ItemRow) => row.id.startsWith(PENDING_PREFIX)

function patchRow(row: ItemRow, changes: Partial<ItemRow>) {
  const index = rows.value.findIndex(r => r.id === row.id)
  if (index < 0 || isPending(row)) return
  const before = rows.value[index]!
  rows.value[index] = { ...before, ...changes }
  return saveInBackground(
    () => $fetch(`/api/items/rows/${row.id}`, { method: 'PATCH', body: changes }),
    () => {
      const now = rows.value.findIndex(r => r.id === row.id)
      if (now >= 0) rows.value[now] = before
    },
  )
}

type MoneyField = 'buy' | 'sell'
const today = kstToday()
// 서버와 같이, 날짜 없이 금액만 적으면 오늘 날짜로 잡는다
const saveField = (row: ItemRow, field: MoneyField, meso: number) => patchRow(row, {
  [field]: meso,
  ...(meso && !row[`${field}Date`] && { [`${field}Date`]: today }),
})
const savePurchases = (row: ItemRow, purchases: ItemPurchase[]) => patchRow(row, {
  purchases,
  buy: purchases.reduce((sum, p) => sum + p.amount, 0),
  buyDate: purchases[0]?.date ?? null,
})
// 강화 비용 내역은 서버와 같이 합계·가장 늦은 날짜로 칸 값을 맞춘다
const saveEntries = (row: ItemRow, kind: 'starforce' | 'potential', entries: ItemPurchase[]) => patchRow(row, {
  [`${kind}Entries`]: entries,
  [kind]: entries.reduce((sum, e) => sum + e.amount, 0),
  [`${kind}Date`]: entries.at(-1)?.date ?? null,
})
const saveDate = (row: ItemRow, field: MoneyField, date: string | null) => patchRow(row, { [`${field}Date`]: date })
// 내 정보의 MVP가 실버 이상이면 수수료는 3%로 정해져 누를 수 없다
const { data: me } = useNuxtData<MeResponse>('me')
const mvpFee = computed(() => hasMvpFee(me.value?.user?.mvpDiscount))
const toggleFee = (row: ItemRow) => patchRow(row, { sellFee: row.sellFee === DEFAULT_AUCTION_FEE ? AUCTION_FEES[1].rate : DEFAULT_AUCTION_FEE })
const toggleExcluded = () => run(() => $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'PATCH', body: { excluded: !props.sheet.excluded } }))
const { ask } = useConfirm()
async function removeRow(row: ItemRow) {
  if (isPending(row)) return
  if (!await ask({ title: '장비 줄 지우기', name: row.name, detail: props.sheet.title, note: '이 줄의 구매·강화·판매 금액이 가계부에서도 빠지고 되돌릴 수 없어요.' })) return
  const before = [...rows.value]
  rows.value = rows.value.filter(r => r.id !== row.id)
  saveInBackground(() => $fetch(`/api/items/rows/${row.id}`, { method: 'DELETE' }), () => {
    rows.value = before
  })
}
function addRow() {
  const name = newName.value.trim()
  if (!name) return
  const known = picked.value?.name === name ? picked.value : null
  const pendingId = `${PENDING_PREFIX}${Date.now()}`
  rows.value.push({
    id: pendingId, part: known?.part ?? '', name, icon: known?.icon ?? null, memo: null, level: null, excluded: false,
    buy: 0, buyDate: null, purchases: [], starforce: 0, starforceDate: null, potential: 0, potentialDate: null,
    sell: 0, sellDate: null, sellFee: DEFAULT_AUCTION_FEE, starforceEntries: [], potentialEntries: [],
    reference: { starforce: 0, potential: 0, shared: false, starforceDays: [], potentialDays: [] },
  })
  newName.value = ''
  picked.value = null
  saveInBackground(async () => {
    const { id } = await $fetch<{ id: string }>('/api/items/rows', { method: 'POST', body: { sheetId: props.sheet.id, name } })
    const row = rows.value.find(r => r.id === pendingId)
    if (row) row.id = id
  }, () => {
    rows.value = rows.value.filter(r => r.id !== pendingId)
    newName.value = name
  })
}
const importEquipment = () => run(async () => {
  const { added } = await $fetch<{ added: number }>(`/api/items/sheets/${props.sheet.id}/import`, { method: 'POST' })
  notice.value = added ? `장비 ${added}개를 불러왔어요.` : '새로 불러올 장비가 없어요.'
}, '')
const rename = () => run(async () => {
  await $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'PATCH', body: { title: title.value } })
  renaming.value = false
})
async function removeSheet() {
  if (!await ask({ title: '시트 삭제', name: props.sheet.title, detail: `장비 ${rows.value.length}줄`, note: '시트의 장비와 가계부에 잡힌 금액이 같이 사라지고 되돌릴 수 없어요.', action: '삭제' })) return
  await run(() => $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'DELETE' }))
  if (!failure.value) emit('removed')
}
</script>

<template>
  <section class="sheet">
    <header class="head">
      <form v-if="renaming" class="rename" @submit.prevent="rename" novalidate>
        <input v-model="title" class="field-input" maxlength="40" aria-label="시트 이름">
        <button class="btn compact" :disabled="busy">저장</button>
        <button type="button" class="btn ghost compact" @click="renaming = false">취소</button>
      </form>
      <template v-else>
        <h3 class="ellipsis">{{ sheet.title }}</h3>
        <span v-if="sheet.characterName" class="link-tag">{{ sheet.characterName }} 연결</span>
        <button type="button" class="text-btn" @click="renaming = true">이름 바꾸기</button>
      </template>
      <div class="head-actions">
        <button type="button" class="exclude" :class="{ on: sheet.excluded }" :aria-pressed="sheet.excluded" :disabled="busy" :title="sheet.excluded ? '누르면 이 시트의 구매·강화·판매 금액을 가계부에 넣어요' : '누르면 이 시트의 금액을 가계부에서 모두 빼요'" @click="toggleExcluded">
          {{ sheet.excluded ? '가계부 미반영' : '가계부 반영' }}
        </button>
        <button v-if="sheet.ocid" type="button" class="btn ghost compact" :disabled="busy" @click="importEquipment">현재 장비 불러오기</button>
        <button type="button" class="btn ghost compact" :disabled="busy" @click="removeSheet">시트 삭제</button>
      </div>
    </header>
    <p v-if="failure" class="form-error">{{ failure }}</p>
    <p v-if="notice" class="notice">{{ notice }}</p>

    <div class="table-wrap">
      <table>
        <colgroup>
          <col class="c-handle">
          <col class="c-no">
          <col class="c-part">
          <col>
          <col class="c-num">
          <col class="c-num">
          <col class="c-num">
          <col class="c-num">
          <col class="c-fee">
          <col class="c-num">
          <col class="c-num">
          <col class="c-num">
          <col class="c-include">
          <col class="c-remove">
        </colgroup>
        <thead>
          <tr>
            <th />
            <th class="center">No.</th>
            <th>부위</th>
            <th>장비</th>
            <th class="num">구매</th>
            <th class="num" title="직접 적은 값이 가계부에 들어가요. 연결한 캐릭터의 강화 기록으로 센 값은 칸 아래에 참고로 보여줘요">스타포스</th>
            <th class="num" title="메소 잠재 재설정 비용. 강화 기록으로 센 값은 공식 비용표 기준이라 그대로 써도 돼요">잠재</th>
            <th class="num">판매</th>
            <th class="center" title="경매장 판매 수수료. 대금을 받을 때 MVP 실버 이상·프리미엄 PC방이면 3%">수수료</th>
            <th class="num" title="판매가에서 수수료를 뺀 금액">받은 메소</th>
            <th class="num">들인 메소</th>
            <th class="num" title="받은 메소 - 들인 메소. 판매가를 적은 장비만 계산해요">손익</th>
            <th class="center" title="제외한 장비는 합계·손익과 가계부에서 빠져요">합계</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="row.id"
            :class="{ dragging: dragId === row.id, pending: isPending(row) }"
            @dragover.prevent="dragOver(i)"
            @drop.prevent="dropRow"
          >
            <td class="handle" draggable="true" title="끌어서 순서 바꾸기" @dragstart="dragStart(row.id, $event)" @dragend="dragEnd">⠿</td>
            <td class="center sub">{{ i + 1 }}</td>
            <td class="sub ellipsis">{{ row.part || '-' }}</td>
            <td>
              <div class="name">
                <img v-if="row.icon" :src="row.icon" alt="">
                <span class="ellipsis" :title="row.name">{{ row.name }}</span>
              </div>
            </td>
            <td class="num cell">
              <ItemsPurchaseCell v-if="isMultiPurchase(row)" :name="row.name" :purchases="row.purchases" @save="savePurchases(row, $event)" />
              <ItemsMoneyCell v-else :value="row.buy" :date="row.buyDate" label="구매" @save="saveField(row, 'buy', $event)" @date="saveDate(row, 'buy', $event)" />
            </td>
            <td class="num cell"><ItemsEnhanceCell label="스타포스" :name="row.name" :entries="row.starforceEntries" :reference="row.reference.starforce" :reference-days="row.reference.starforceDays" :shared="row.reference.shared" :ocid="sheet.ocid" estimated @save="saveEntries(row, 'starforce', $event)" /></td>
            <td class="num cell"><ItemsEnhanceCell label="잠재" :name="row.name" :entries="row.potentialEntries" :reference="row.reference.potential" :reference-days="row.reference.potentialDays" :shared="row.reference.shared" :ocid="sheet.ocid" @save="saveEntries(row, 'potential', $event)" /></td>
            <td class="num cell"><ItemsMoneyCell :value="row.sell" :date="row.sellDate" label="판매" @save="saveField(row, 'sell', $event)" @date="saveDate(row, 'sell', $event)" /></td>
            <td class="center">
              <span v-if="mvpFee" class="fee mvp locked" :class="{ idle: !row.sell }" title="내 정보의 MVP 등급이 실버 이상이라 3%예요">3%</span>
              <button v-else type="button" class="fee" :class="{ mvp: row.sellFee < DEFAULT_AUCTION_FEE, idle: !row.sell }" :disabled="busy" :title="row.sellFee < DEFAULT_AUCTION_FEE ? 'PC방 3% → 누르면 5%' : '5% → PC방이면 눌러서 3%'" @click="toggleFee(row)">
                {{ Math.round(row.sellFee * 100) }}%
              </button>
            </td>
            <td class="num sell" :title="row.sell ? `${formatKoreanNumber(row.sell)} - 수수료 ${Math.round(row.sellFee * 100)}% = ${formatKoreanNumber(itemSellNet(row))}` : undefined">
              {{ row.sell ? formatEok(itemSellNet(row)) : '-' }}
            </td>
            <td class="num invest">{{ rowInvest(row) ? formatEok(rowInvest(row)) : '-' }}</td>
            <td class="num" :class="profitTone(itemProfit(row))">{{ itemProfit(row) === null ? '-' : formatEok(itemProfit(row)!) }}</td>
            <td class="center">
              <button type="button" class="exclude row-exclude" :class="{ on: row.excluded }" :aria-pressed="row.excluded" :title="row.excluded ? '누르면 합계·손익·가계부에 다시 넣어요' : '누르면 이 장비를 합계·손익·가계부에서 빼요'" @click="patchRow(row, { excluded: !row.excluded })">
                {{ row.excluded ? '제외' : '포함' }}
              </button>
            </td>
            <td class="center"><button type="button" class="icon-btn" :aria-label="`${row.name} 지우기`" :disabled="busy" @click="removeRow(row)">×</button></td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="14" class="muted empty-row">{{ sheet.ocid ? '"현재 장비 불러오기"로 장비를 채우거나 아래에서 직접 추가해 주세요.' : '아래에서 장비를 추가해 주세요.' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="sum-label">합계</td>
            <td class="num">{{ formatEok(totals.buy) }}</td>
            <td class="num">{{ formatEok(totals.starforce) }}</td>
            <td class="num">{{ formatEok(totals.potential) }}</td>
            <td class="num">{{ formatEok(totals.sellGross) }}</td>
            <td />
            <td class="num sell">{{ formatEok(totals.sell) }}</td>
            <td class="num invest">{{ formatEok(totals.invest) }}</td>
            <td class="num" :class="profitTone(totals.sold ? totals.net : null)" :title="`판매한 ${totals.sold}개 기준`">{{ totals.sold ? formatEok(totals.net) : '-' }}</td>
            <td colspan="2" />
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="bottom">
      <slot name="tabs" />
      <!-- 입력칸 하나뿐이라 엔터만 누르면 이 시트에 추가된다 -->
      <form class="add" title="금액은 억 단위로 적고, 가계부에는 칸 아래 날짜로 들어가요" @submit.prevent="busy || addRow()" novalidate>
        <ItemsNameSearch v-model="newName" class="name-input" @pick="picked = $event" />
      </form>
    </div>
  </section>
</template>

<style scoped>
.sheet {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
h3 {
  min-width: 0;
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 22px;
  font-weight: 400;
}
.link-tag {
  padding: 1px 8px;
  border: 1px solid var(--api);
  border-radius: 999px;
  color: var(--api);
  font-size: 12px;
}
.text-btn {
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
.rename {
  display: flex;
  gap: 6px;
}
.rename .field-input {
  min-height: 36px;
}
.head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.notice {
  margin: 0;
  color: var(--gain);
  font-size: 14px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  scrollbar-width: thin;
}
/* 칸 너비를 고정해야 머리글·값·합계가 같은 세로줄에 선다 */
table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 14px;
}
.c-handle { width: 28px; }
.c-no { width: 44px; }
.c-part { width: 92px; }
.c-num { width: 104px; }
.c-fee { width: 72px; }
.c-include { width: 64px; }
.c-remove { width: 40px; }
th,
td {
  padding: 0 10px;
  white-space: nowrap;
  vertical-align: middle;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  height: 36px;
  background: var(--title);
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
  text-align: left;
}
td {
  height: 38px;
  border-top: 1px solid rgb(58 67 102 / 0.6);
}
tbody tr {
  transition: background var(--fast) ease, opacity var(--fast) ease;
}
tbody tr:hover {
  background: rgb(255 255 255 / 0.03);
}
/* 저장 중인 새 줄은 서버 id를 받을 때까지 흐리게 */
tbody tr.pending {
  opacity: 0.55;
  pointer-events: none;
}
tbody tr.dragging {
  background: rgb(242 193 78 / 0.1);
  outline: 1px dashed var(--gold);
}
.center {
  text-align: center;
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
/* 금액 칸은 안의 버튼이 같은 여백을 갖고 있어 칸 여백을 비운다 */
td.cell {
  padding: 0;
}
.sub {
  color: var(--sub);
}
.handle {
  padding: 0;
  color: var(--panel-line);
  font-size: 15px;
  text-align: center;
  cursor: grab;
  user-select: none;
}
.handle:hover {
  color: var(--gold);
}
.name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.name img {
  flex: none;
  width: 26px;
  height: 26px;
  object-fit: contain;
  image-rendering: pixelated;
}
.sell {
  color: var(--gain);
}
.invest {
  color: var(--gold);
}
.fee {
  min-width: 44px;
  padding: 2px 8px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease;
}
.fee:hover:not(:disabled) {
  border-color: var(--gold);
}
.fee.mvp {
  background: rgb(242 193 78 / 0.15);
  border-color: var(--gold);
  color: var(--gold);
}
/* 아직 안 판 줄은 수수료가 의미 없어 흐리게만 둔다 */
.fee.locked {
  display: inline-block;
  text-align: center;
  cursor: default;
}
.fee.idle {
  opacity: 0.45;
}
.exclude {
  min-height: 30px;
  padding: 2px 12px;
  background: rgb(127 217 154 / 0.12);
  border: 1px solid var(--gain);
  border-radius: 999px;
  color: var(--gain);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease;
}
.row-exclude {
  min-height: 0;
  padding: 2px 10px;
}
.exclude.on {
  background: var(--bar);
  border-color: var(--panel-line);
  color: var(--sub);
}
.empty-row {
  height: 80px;
  text-align: center;
}
tfoot td {
  position: sticky;
  bottom: 0;
  height: 40px;
  background: var(--title);
  border-top: 2px solid var(--win-line);
  font-family: var(--f-title);
  font-size: 15px;
}
.sum-label {
  color: var(--sub);
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
.icon-btn:hover:not(:disabled) {
  border-color: var(--loss);
  color: var(--loss);
}
/* 엑셀처럼 시트 탭이 표 바로 아래에 붙도록 시트 사이 간격만큼 끌어올린다 */
.bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 14px;
  margin-top: -8px;
}
.add {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  margin-left: auto;
}
.add .name-input {
  width: 300px;
}
</style>
