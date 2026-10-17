<script setup lang="ts">
import type { ItemPurchase, ItemRow } from '#shared/types'
import { itemProfit, itemSellNet, rowInvest } from '#shared/calc/items'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'

defineProps<{ row: ItemRow, index: number, ocid: string | null, feeColumn: boolean, mvpFee: boolean, busy: boolean, dragging: boolean, pending: boolean }>()
const emit = defineEmits<{
  dragover: []
  drop: []
  dragstart: [event: DragEvent]
  dragend: []
  savePurchases: [purchases: ItemPurchase[]]
  saveField: [field: 'buy' | 'sell', meso: number]
  saveDate: [field: 'buy' | 'sell', date: string | null]
  saveEntries: [kind: 'starforce' | 'potential', entries: ItemPurchase[]]
  toggleFee: []
  toggleExcluded: []
  remove: []
}>()
</script>

<template>
  <tr
    :class="{ dragging, pending }"
    @dragover.prevent="emit('dragover')"
    @drop.prevent="emit('drop')"
  >
    <td class="handle" draggable="true" title="끌어서 순서 바꾸기" @dragstart="emit('dragstart', $event)" @dragend="emit('dragend')">⠿</td>
    <td class="center sub">{{ index + 1 }}</td>
    <td class="sub ellipsis">{{ row.part || '-' }}</td>
    <td class="name-cell">
      <div class="name">
        <img v-if="row.icon" :src="row.icon" alt="">
        <span class="name-text">{{ row.name }}</span>
      </div>
    </td>
    <td class="num cell">
      <ItemsEntriesCell v-if="isMultiPurchase(row)" label="구매" :name="row.name" :entries="row.purchases" intro="살 때마다 한 건씩 적어요. 가계부에는 건마다 그 날짜로 들어가요." @save="emit('savePurchases', $event)" />
      <ItemsMoneyCell v-else :value="row.buy" :date="row.buyDate" label="구매" @save="emit('saveField', 'buy', $event)" @date="emit('saveDate', 'buy', $event)" />
    </td>
    <td class="num cell"><ItemsEntriesCell label="스타포스" intro="강화한 날마다 한 건씩 적어요. 가계부에는 건마다 그 날짜로 들어가요." :name="row.name" :entries="row.starforceEntries" :reference="row.reference.starforce" :reference-days="row.reference.starforceDays" :shared="row.reference.shared" :ocid="ocid" estimated @save="emit('saveEntries', 'starforce', $event)" /></td>
    <td class="num cell"><ItemsEntriesCell label="잠재" intro="강화한 날마다 한 건씩 적어요. 가계부에는 건마다 그 날짜로 들어가요." :name="row.name" :entries="row.potentialEntries" :reference="row.reference.potential" :reference-days="row.reference.potentialDays" :shared="row.reference.shared" :ocid="ocid" @save="emit('saveEntries', 'potential', $event)" /></td>
    <td class="num cell"><ItemsMoneyCell :value="row.sell" :date="row.sellDate" label="판매" @save="emit('saveField', 'sell', $event)" @date="emit('saveDate', 'sell', $event)" /></td>
    <td v-if="feeColumn" class="center">
      <button type="button" class="fee" :class="{ mvp: row.sellFee < DEFAULT_AUCTION_FEE, idle: !row.sell }" :disabled="busy || (mvpFee && !row.sell)" :title="row.sellFee < DEFAULT_AUCTION_FEE ? 'PC방 3% → 누르면 5%' : '5% → PC방이면 눌러서 3%'" @click="emit('toggleFee')">
        {{ Math.round(row.sellFee * 100) }}%
      </button>
    </td>
    <td class="num sell" :title="row.sell ? `${formatKoreanNumber(row.sell)} - 수수료 ${Math.round(row.sellFee * 100)}% = ${formatKoreanNumber(itemSellNet(row))}` : undefined">
      {{ row.sell ? formatEok(itemSellNet(row)) : '-' }}
    </td>
    <td class="num invest">{{ rowInvest(row) ? formatEok(rowInvest(row)) : '-' }}</td>
    <td class="num" :class="profitTone(itemProfit(row))">{{ itemProfit(row) === null ? '-' : formatEok(itemProfit(row)!) }}</td>
    <td class="center">
      <button type="button" class="exclude row-exclude" :class="{ on: row.excluded }" :aria-pressed="row.excluded" :title="row.excluded ? '누르면 합계·손익·가계부에 다시 넣어요' : '누르면 이 장비를 합계·손익·가계부에서 빼요'" @click="emit('toggleExcluded')">
        {{ row.excluded ? '제외' : '포함' }}
      </button>
    </td>
    <td class="center"><button type="button" class="icon-btn" :aria-label="`${row.name} 지우기`" :disabled="busy" @click="emit('remove')">×</button></td>
  </tr>
</template>

<style scoped>
td {
  height: 38px;
  padding: 0 10px;
  border-top: 1px solid color-mix(in srgb, var(--panel-line) 60%, transparent);
  white-space: nowrap;
  vertical-align: middle;
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
  background: color-mix(in srgb, var(--gold) 15%, transparent);
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
  background: color-mix(in srgb, var(--gain) 12%, transparent);
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
/* 긴 이름은 잘라 숨기지 않고 두 줄까지 보여 준다 */
.name-text {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.3;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
@media (max-width: 640px) {
  /* 끌어 옮기기(손가락으론 안 됨)와 부위 칸은 접어서 장비 이름과 구매 칸이 첫 화면에 보이게 한다 */
  tr > :nth-child(1),
  tr > :nth-child(3) {
    padding: 0;
    overflow: hidden;
    font-size: 0;
    visibility: hidden;
  }
  td {
    padding: 0 6px;
  }
  .name-cell {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--win);
    box-shadow: 1px 0 0 var(--panel-line);
  }
  .name-text {
    font-size: 13px;
  }
  .name img {
    width: 22px;
    height: 22px;
  }
}
</style>
