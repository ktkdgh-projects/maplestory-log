<script setup lang="ts">
import type { ItemRow, ItemSheet } from '#shared/types'

const props = defineProps<{ sheet: ItemSheet }>()
const emit = defineEmits<{ changed: [], removed: [] }>()

const busy = ref(false)
const failure = ref('')
const notice = ref('')
const newPart = ref('')
const newName = ref('')
const renaming = ref(false)
const title = ref(props.sheet.title)
const confirmDelete = ref(false)

watch(() => props.sheet.id, () => {
  failure.value = ''
  notice.value = ''
  renaming.value = false
  confirmDelete.value = false
  title.value = props.sheet.title
})

// 끄는 동안 화면 순서를 바로 바꾸고, 놓으면 서버에 저장한다
const rows = ref<ItemRow[]>([...props.sheet.rows])
watch(() => props.sheet.rows, (value) => {
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

const saveField = (row: ItemRow, field: 'buy' | 'cost' | 'sell', meso: number) => run(() => $fetch(`/api/items/rows/${row.id}`, { method: 'PATCH', body: { [field]: meso } }))
const toggleFee = (row: ItemRow) => run(() => $fetch(`/api/items/rows/${row.id}`, { method: 'PATCH', body: { sellFee: row.sellFee === DEFAULT_AUCTION_FEE ? AUCTION_FEES[1].rate : DEFAULT_AUCTION_FEE } }))
const toggleExcluded = () => run(() => $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'PATCH', body: { excluded: !props.sheet.excluded } }))
const removeRow = (row: ItemRow) => run(() => $fetch(`/api/items/rows/${row.id}`, { method: 'DELETE' }))
const addRow = () => run(async () => {
  await $fetch('/api/items/rows', { method: 'POST', body: { sheetId: props.sheet.id, part: newPart.value, name: newName.value } })
  newPart.value = ''
  newName.value = ''
})
const importEquipment = () => run(async () => {
  const { added } = await $fetch<{ added: number }>(`/api/items/sheets/${props.sheet.id}/import`, { method: 'POST' })
  notice.value = added ? `장비 ${added}개를 불러왔어요.` : '새로 불러올 장비가 없어요.'
}, '')
const toggleFold = () => run(() => $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'PATCH', body: { folded: !props.sheet.folded } }))
const rename = () => run(async () => {
  await $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'PATCH', body: { title: title.value } })
  renaming.value = false
})
async function removeSheet() {
  await run(() => $fetch(`/api/items/sheets/${props.sheet.id}`, { method: 'DELETE' }))
  if (!failure.value) emit('removed')
}
</script>

<template>
  <section class="sheet" :class="{ folded: sheet.folded }">
    <header class="head">
      <form v-if="renaming" class="rename" @submit.prevent="rename">
        <input v-model="title" class="field-input" maxlength="40" aria-label="시트 이름">
        <button class="btn compact" :disabled="busy">저장</button>
        <button type="button" class="btn ghost compact" @click="renaming = false">취소</button>
      </form>
      <template v-else>
        <h3 class="ellipsis">{{ sheet.title }}</h3>
        <span v-if="sheet.characterName" class="link-tag">{{ sheet.characterName }} 연결</span>
        <span v-if="sheet.folded" class="fold-tag">접음</span>
        <button type="button" class="text-btn" @click="renaming = true">이름 바꾸기</button>
      </template>
      <div class="head-actions">
        <button type="button" class="exclude" :class="{ on: sheet.excluded }" :aria-pressed="sheet.excluded" :disabled="busy" :title="sheet.excluded ? '누르면 이 시트의 구매·강화·판매 금액을 가계부에 넣어요' : '누르면 이 시트의 금액을 가계부에서 모두 빼요 (예전에 산 장비 정리용)'" @click="toggleExcluded">
          {{ sheet.excluded ? '가계부 미반영' : '가계부 반영' }}
        </button>
        <button v-if="sheet.ocid" type="button" class="btn ghost compact" :disabled="busy" @click="importEquipment">현재 장비 불러오기</button>
        <button type="button" class="btn compact" :class="sheet.folded ? 'ghost' : 'danger'" :disabled="busy" @click="toggleFold">{{ sheet.folded ? '접음 취소' : '캐릭터 접기' }}</button>
        <button v-if="!confirmDelete" type="button" class="btn ghost compact" @click="confirmDelete = true">시트 삭제</button>
        <template v-else>
          <span class="ask">시트와 가계부에 잡힌 금액이 지워져요</span>
          <button type="button" class="btn danger compact" :disabled="busy" @click="removeSheet">삭제</button>
          <button type="button" class="btn ghost compact" @click="confirmDelete = false">취소</button>
        </template>
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
          <col class="c-fee">
          <col class="c-num">
          <col class="c-num">
          <col class="c-num">
          <col class="c-remove">
        </colgroup>
        <thead>
          <tr>
            <th />
            <th class="center">No.</th>
            <th>부위</th>
            <th>장비</th>
            <th class="num">구매</th>
            <th class="num">큐브·스타포스</th>
            <th class="num">판매</th>
            <th class="center" title="경매장 판매 수수료. 대금을 받을 때 MVP 실버 이상·프리미엄 PC방이면 3%">수수료</th>
            <th class="num" title="판매가에서 수수료를 뺀 금액">받은 메소</th>
            <th class="num">들인 메소</th>
            <th class="num" title="받은 메소 - 들인 메소. 판매가를 적은 장비만 계산해요">손익</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in rows"
            :key="row.id"
            :class="{ dragging: dragId === row.id }"
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
            <td class="num cell"><ItemsEokCell :value="row.buy" label="구매가" @save="saveField(row, 'buy', $event)" /></td>
            <td class="num cell"><ItemsEokCell :value="row.cost" label="큐브·스타포스 비용" @save="saveField(row, 'cost', $event)" /></td>
            <td class="num cell">
              <ItemsEokCell :value="row.sell" label="판매가" @save="saveField(row, 'sell', $event)" />
            </td>
            <td class="center">
              <button type="button" class="fee" :class="{ mvp: row.sellFee < DEFAULT_AUCTION_FEE, idle: !row.sell }" :disabled="busy" :title="row.sellFee < DEFAULT_AUCTION_FEE ? 'MVP 실버 이상·PC방 3% → 누르면 5%' : '일반 5% → 누르면 MVP·PC방 3%'" @click="toggleFee(row)">
                {{ Math.round(row.sellFee * 100) }}%
              </button>
            </td>
            <td class="num sell" :title="row.sell ? `${formatKoreanNumber(row.sell)} - 수수료 ${Math.round(row.sellFee * 100)}% = ${formatKoreanNumber(itemSellNet(row))}` : undefined">
              {{ row.sell ? formatEok(itemSellNet(row)) : '-' }}
            </td>
            <td class="num invest">{{ row.buy + row.cost ? formatEok(row.buy + row.cost) : '-' }}</td>
            <td class="num" :class="profitTone(itemProfit(row))">{{ itemProfit(row) === null ? '-' : formatEok(itemProfit(row)!) }}</td>
            <td class="center"><button type="button" class="icon-btn" :aria-label="`${row.name} 지우기`" :disabled="busy" @click="removeRow(row)">×</button></td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="12" class="muted empty-row">{{ sheet.ocid ? '"현재 장비 불러오기"로 장비를 채우거나 아래에서 직접 추가해 주세요.' : '아래에서 장비를 추가해 주세요.' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="sum-label">합계 (억)</td>
            <td class="num">{{ formatEok(totals.buy) }}</td>
            <td class="num">{{ formatEok(totals.cost) }}</td>
            <td class="num">{{ formatEok(totals.sellGross) }}</td>
            <td />
            <td class="num sell">{{ formatEok(totals.sell) }}</td>
            <td class="num invest">{{ formatEok(totals.invest) }}</td>
            <td class="num" :class="profitTone(totals.sold ? totals.net : null)" :title="`판매한 ${totals.sold}개 기준`">{{ totals.sold ? formatEok(totals.net) : '-' }}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
    <form class="add" @submit.prevent="addRow">
      <input v-model="newPart" class="field-input part-input" maxlength="40" placeholder="부위 (예: 반지)" aria-label="부위">
      <input v-model="newName" class="field-input" maxlength="40" placeholder="장비 이름" aria-label="장비 이름" required>
      <button class="btn compact" :disabled="busy">+ 장비 추가</button>
      <span class="muted hint">금액 칸을 눌러 억 단위로 적어요 (예: 151.03)</span>
    </form>
  </section>
</template>

<style scoped>
.sheet {
  display: flex;
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
.link-tag,
.fold-tag {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
}
.link-tag {
  border: 1px solid var(--api);
  color: var(--api);
}
.fold-tag {
  background: var(--loss);
  color: var(--bar);
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
.ask {
  color: var(--loss);
  font-size: 13px;
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
.folded .table-wrap {
  opacity: 0.7;
  filter: saturate(0.6);
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
.add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.add .field-input {
  width: 220px;
  min-height: 36px;
}
.add .part-input {
  width: 130px;
}
.hint {
  margin-left: auto;
  font-size: 13px;
}
</style>
