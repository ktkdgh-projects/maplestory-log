<script setup lang="ts">
import type { ItemIcon, ItemPurchase, ItemRow, ItemSheet, MeResponse } from '#shared/types'
import { itemTotals } from '#shared/calc/items'
import { hasMvpFee } from '#shared/calc/meso'
import { AUCTION_FEES, DEFAULT_AUCTION_FEE, MVP_FEE } from '#shared/data/auction'

const props = defineProps<{ sheet: ItemSheet }>()
const emit = defineEmits<{ changed: [], removed: [] }>()

const busy = ref(false)
const failure = ref('')
const notice = ref('')
const newName = ref('')
// 저장 전 임시 줄에도 아이콘·부위가 바로 보이게 자동완성에서 고른 아이템을 둔다
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

async function run(action: () => Promise<unknown>) {
  busy.value = true
  failure.value = ''
  notice.value = ''
  try {
    await action()
    emit('changed')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

// 연달아 고칠 때 앞선 새로고침이 옛 값을 잠깐 덮지 않도록 저장이 다 끝난 뒤 한 번만 새로 불러온다
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
// 내 정보의 MVP가 실버 이상이면 새로 파는 장비는 3%로 정해진다. 이미 판 장비는 그때 수수료를 그대로 보여 준다
const { data: me } = useNuxtData<MeResponse>('me')
const mvpFee = computed(() => hasMvpFee(me.value?.user?.mvpDiscount))
const feeColumn = computed(() => !mvpFee.value || rows.value.some(r => r.sell && r.sellFee !== MVP_FEE))
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
})
const rename = () => run(async () => {
  await $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'PATCH', body: { title: title.value } })
  renaming.value = false
})
// 확인 창 안에서 지우므로 실패도 거기서 알리고, 끝나면 부모가 한 번만 다시 불러온다
async function removeSheet() {
  const ok = await ask({
    title: '시트 삭제',
    name: props.sheet.title,
    detail: `장비 ${rows.value.length}줄`,
    note: '시트의 장비와 가계부에 잡힌 금액이 같이 사라지고 되돌릴 수 없어요.',
    action: '삭제',
    run: () => $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'DELETE' }),
  })
  if (ok) emit('removed')
}
</script>

<template>
  <section class="sheet">
    <ItemsSheetHead
      v-model:renaming="renaming"
      v-model:title="title"
      :sheet="sheet"
      :busy="busy"
      :failure="failure"
      :notice="notice"
      :fee-column="feeColumn"
      @rename="rename"
      @toggle-excluded="toggleExcluded"
      @import="importEquipment"
      @remove-sheet="removeSheet"
    />

    <div class="table-wrap">
      <table :class="{ mvp: !feeColumn }">
        <colgroup>
          <col class="c-handle">
          <col class="c-no">
          <col class="c-part">
          <col>
          <col class="c-num">
          <col class="c-num">
          <col class="c-num">
          <col class="c-num">
          <col v-if="feeColumn" class="c-fee">
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
            <th class="num">스타포스</th>
            <th class="num">잠재</th>
            <th class="num">판매</th>
            <th v-if="feeColumn" class="center">수수료</th>
            <th class="num">{{ feeColumn ? '받은 메소' : '받은 메소 · 3%' }}</th>
            <th class="num">들인 메소</th>
            <th class="num">손익</th>
            <th class="center">합계</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <ItemsSheetRow
            v-for="(row, i) in rows"
            :key="row.id"
            :row="row"
            :index="i"
            :ocid="sheet.ocid"
            :fee-column="feeColumn"
            :mvp-fee="mvpFee"
            :busy="busy"
            :dragging="dragId === row.id"
            :pending="isPending(row)"
            @dragover="dragOver(i)"
            @drop="dropRow"
            @dragstart="dragStart(row.id, $event)"
            @dragend="dragEnd"
            @save-purchases="savePurchases(row, $event)"
            @save-field="(field, meso) => saveField(row, field, meso)"
            @save-date="(field, date) => saveDate(row, field, date)"
            @save-entries="(kind, entries) => saveEntries(row, kind, entries)"
            @toggle-fee="toggleFee(row)"
            @toggle-excluded="patchRow(row, { excluded: !row.excluded })"
            @remove="removeRow(row)"
          />
          <tr v-if="!rows.length">
            <td :colspan="feeColumn ? 14 : 13" class="muted empty-row">{{ sheet.ocid ? '"현재 장비 불러오기"로 장비를 채우거나 아래에서 직접 추가해 주세요.' : '아래에서 장비를 추가해 주세요.' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="sum-label">합계</td>
            <td class="num">{{ formatEok(totals.buy) }}</td>
            <td class="num">{{ formatEok(totals.starforce) }}</td>
            <td class="num">{{ formatEok(totals.potential) }}</td>
            <td class="num">{{ formatEok(totals.sellGross) }}</td>
            <td v-if="feeColumn" />
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
      <form class="add" novalidate @submit.prevent="busy || addRow()">
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
  min-width: 1080px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 14px;
}
.c-handle { width: 28px; }
.c-no { width: 44px; }
.c-part { width: 92px; }
.c-num { width: 92px; }
.c-fee { width: 72px; }
/* 수수료 칸이 없으면 그만큼 줄여 이름 칸 너비를 같게 둔다 */
table.mvp { min-width: 1008px; }
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
  border-top: 1px solid color-mix(in srgb, var(--panel-line) 60%, transparent);
}
tbody tr {
  transition: background var(--fast) ease, opacity var(--fast) ease;
}
tbody tr:hover {
  background: color-mix(in srgb, var(--tint) 3%, transparent);
}
/* 서버 id를 받기 전엔 고칠 수 없어 흐리게 둔다 */
tbody tr.pending {
  opacity: 0.55;
  pointer-events: none;
}
tbody tr.dragging {
  background: color-mix(in srgb, var(--gold) 10%, transparent);
  outline: 1px dashed var(--gold);
}
.center {
  text-align: center;
}
.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.sell {
  color: var(--gain);
}
.invest {
  color: var(--gold);
}
.empty-row {
  height: 80px;
  text-align: center;
}
tfoot td {
  position: sticky;
  bottom: 0;
  height: 40px;
  font-weight: 700;
  background: var(--title);
  border-top: 2px solid var(--win-line);
  font-family: var(--f-title);
  font-size: 15px;
}
.sum-label {
  color: var(--sub);
  text-align: right;
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
/* 표는 옆으로 밀어 보고 장비 이름 칸은 왼쪽에 붙어 따라온다 */
@media (max-width: 640px) {
  table {
    min-width: 1030px;
  }
  /* 수수료 칸이 없으면 그만큼 줄여 이름 칸 너비를 같게 둔다 */
  table.mvp {
    min-width: 958px;
  }
  /* 끌어 옮기기(손가락으론 안 됨)와 부위 칸은 접어서 장비 이름과 구매 칸이 첫 화면에 보이게 한다 */
  .c-handle,
  .c-part { width: 0; }
  .c-no { width: 30px; }
  .c-num { width: 96px; }
  tr > :nth-child(1),
  tr > :nth-child(3) {
    padding: 0;
    overflow: hidden;
    font-size: 0;
    visibility: hidden;
  }
  tfoot tr > :nth-child(1) {
    padding: 0 6px;
    font-size: 15px;
    visibility: visible;
  }
  th,
  td {
    padding: 0 6px;
  }
  thead th:nth-child(4) {
    position: sticky;
    left: 0;
    z-index: 3;
    background: var(--title);
    box-shadow: 1px 0 0 var(--panel-line);
  }
  .add {
    flex: 1;
    margin-left: 0;
  }
  .add .name-input {
    width: 100%;
  }
}
</style>
