<script setup lang="ts">
import type { BossClear, DropSale, HuntEntry, ItemFlow, ItemFlowLine, MesoEntry } from '#shared/types'
import { ITEM_FLOW_LABELS } from '#shared/data/mesoEntries'
import { bossOrder } from '#shared/data/bosses'
import { mesoPerHour } from '#shared/calc/ledger'
import { dropSaleNet, mesoEntryDelta } from '#shared/calc/meso'
import { clearMeso, lootMeso } from '#shared/calc/boss'

const props = defineProps<{ date: string, hunts: HuntEntry[], clears: BossClear[], items: ItemFlow[], itemLines: ItemFlowLine[], sales: DropSale[], entries: MesoEntry[], feeRate: number, balance: number | null }>()
const emit = defineEmits<{ changed: [] }>()

// 'new'·'sale'은 새로 적기, 그 밖에는 고치는 기록의 id
const editing = ref<string | 'new' | 'sale' | null>(null)

const entryOpen = ref(false)
const editingEntry = ref<MesoEntry | null>(null)
function openEntry(entry: MesoEntry | null) {
  editingEntry.value = entry
  entryOpen.value = true
}
const entryDetail = (e: MesoEntry) => [e.item, e.cash && e.amount ? `1억당 ${Math.round(e.cash / (e.amount / 1e8)).toLocaleString('ko-KR')}원` : '', e.memo].filter(Boolean).join(' · ')

// 보스가 많으면 길게 늘어지므로 캐릭터별 한 줄로 묶는다
const openGroup = ref<string | null>(null)
const clearGroups = computed(() => {
  const groups = new Map<string, { ocid: string, name: string, clears: BossClear[], meso: number, loot: number }>()
  for (const c of props.clears) {
    const g = groups.get(c.ocid) ?? groups.set(c.ocid, { ocid: c.ocid, name: c.name, clears: [], meso: 0, loot: 0 }).get(c.ocid)!
    g.clears.push(c)
    g.meso += clearMeso(c)
    g.loot += lootMeso(c)
  }
  for (const g of groups.values()) g.clears.sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
  return [...groups.values()].sort((a, b) => b.meso - a.meso)
})

type Filter = 'all' | 'hunt' | 'sale' | 'boss' | 'item' | 'entry'
const filter = ref<Filter>('all')
const shows = (key: Filter) => filter.value === 'all' || filter.value === key
// 전체에서는 빈 종류를 제목 줄만 남겨 자리를 아끼고, 한 종류만 볼 때는 빈 안내를 띄운다
const emptyShown = (key: Filter) => filter.value === key

watch(() => props.date, () => {
  editing.value = null
  openGroup.value = null
})

// 공용 확인 모달에서 지우므로 실패하면 그 모달에 오류가 뜬다
const { ask } = useConfirm()
async function remove(path: string, name: string, amount: number) {
  const ok = await ask({ title: '기록 지우기', name, detail: formatDay(props.date), amount, note: '지우면 보유 메소와 메소 내역에서도 빠지고 되돌릴 수 없어요.', run: () => $fetch(path, { method: 'DELETE' }) })
  if (ok) emit('changed')
}
function onSaved() {
  editing.value = null
  emit('changed')
}
</script>

<template>
  <div class="day">
    <LedgerDaySummary v-model:filter="filter" :date="date" :hunts="hunts" :clears="clears" :items="items" :item-lines="itemLines" :sales="sales" :entries="entries" />

    <div class="list">
    <section v-show="shows('hunt')" class="sec" style="--c: var(--exp)">
      <header class="sec-head">
        <i class="dot" />
        <h3>사냥</h3>
        <span class="sec-note">{{ hunts.length ? `${hunts.length}번` : '없음' }}</span>
        <button type="button" class="add" :class="{ off: editing === 'new' }" :tabindex="editing === 'new' ? -1 : 0" @click="editing = 'new'">+ 기록</button>
      </header>
      <LedgerHuntForm v-if="editing === 'new'" :key="`new-${date}`" :date="date" :entry="null" @saved="onSaved" @cancel="editing = null" />
      <ul v-if="hunts.length" class="rows">
        <li v-for="h in hunts" :key="h.id">
          <LedgerHuntForm v-if="editing === h.id" :date="date" :entry="h" @saved="onSaved" @cancel="editing = null" />
          <div v-else class="r">
            <span class="ic"><LedgerCoinIcon /></span>
            <span class="main">
              <b class="ellipsis">{{ h.minutes ? formatHuntTime(h.minutes) : '사냥' }}<small v-if="h.minutes"> · 시간당 {{ formatKoreanNumber(mesoPerHour(h.meso, h.minutes) ?? 0) }}</small></b>
              <small class="drops">
                <span v-for="d in HUNT_DROPS.filter(d => h[d.key])" :key="d.key" :title="d.label"><i :style="{ background: d.color }" />{{ d.short }} {{ h[d.key].toLocaleString('ko-KR') }}</span>
                <span v-if="h.memo" class="ellipsis">{{ h.memo }}</span>
              </small>
            </span>
            <b class="amt gain">+{{ formatKoreanNumber(h.meso) }}</b>
            <span class="acts">
              <LedgerAct kind="edit" label="고치기" @click="editing = h.id" />
              <LedgerAct kind="del" label="지우기" @click="remove(`/api/ledger/hunts/${h.id}`, h.minutes ? `사냥 ${formatHuntTime(h.minutes)}` : '사냥', h.meso)" />
            </span>
          </div>
        </li>
      </ul>
      <p v-else-if="editing !== 'new' && emptyShown('hunt')" class="empty">사냥 기록이 없어요</p>
    </section>

    <section v-show="shows('sale')" class="sec" style="--c: var(--gain)">
      <header class="sec-head">
        <i class="dot" />
        <h3>조각 판매</h3>
        <span class="sec-note">{{ sales.length ? `${sales.length}건` : '없음' }}</span>
        <button type="button" class="add" :class="{ off: editing === 'sale' }" :tabindex="editing === 'sale' ? -1 : 0" @click="editing = 'sale'">+ 기록</button>
      </header>
      <LedgerSaleForm v-if="editing === 'sale'" :key="`sale-${date}`" :date="date" :fee-rate="feeRate" @saved="onSaved" @cancel="editing = null" />
      <ul v-if="sales.length" class="rows">
        <li v-for="s in sales" :key="s.id">
          <LedgerSaleForm v-if="editing === s.id" :date="date" :fee-rate="feeRate" :sale="s" @saved="onSaved" @cancel="editing = null" />
          <div v-else class="r">
            <span class="ic img"><img src="/icons/sol-erda-fragment.png" alt=""></span>
            <span class="main">
              <b>조각 {{ s.count.toLocaleString('ko-KR') }}개</b>
              <small class="ellipsis">개당 {{ formatKoreanNumber(s.unitPrice) }} · 수수료 {{ Math.round(s.fee * 100) }}%</small>
            </span>
            <b class="amt gain">+{{ formatKoreanNumber(dropSaleNet(s)) }}</b>
            <span class="acts">
              <LedgerAct kind="edit" label="고치기" @click="editing = s.id" />
              <LedgerAct kind="del" label="지우기" @click="remove(`/api/ledger/sales/${s.id}`, `조각 ${s.count.toLocaleString('ko-KR')}개 판매`, dropSaleNet(s))" />
            </span>
          </div>
        </li>
      </ul>
      <p v-else-if="editing !== 'sale' && emptyShown('sale')" class="empty">판 조각이 없어요</p>
    </section>

    <section v-show="shows('boss')" class="sec" style="--c: var(--api)">
      <header class="sec-head">
        <i class="dot" />
        <h3>보스</h3>
        <span class="sec-note">{{ clears.length ? `${clears.length}마리` : '없음' }}</span>
        <NuxtLink :to="{ path: '/ledger/bosses', query: { date } }" class="add">체크하기 →</NuxtLink>
      </header>
      <ul v-if="clears.length" class="rows">
        <LedgerDayBossGroup v-for="g in clearGroups" :key="g.ocid" :group="g" :open="openGroup === g.ocid" @toggle="openGroup = openGroup === g.ocid ? null : g.ocid" @remove="remove" />
      </ul>
      <p v-else-if="emptyShown('boss')" class="empty">잡은 보스가 없어요</p>
    </section>

    <section v-show="shows('item')" class="sec" style="--c: var(--loss)">
      <header class="sec-head">
        <i class="dot" />
        <h3>장비</h3>
        <span class="sec-note">{{ itemLines.length ? `${itemLines.length}건` : '없음' }}</span>
        <NuxtLink to="/items" class="add">장비 결산 →</NuxtLink>
      </header>
      <ul v-if="itemLines.length" class="rows">
        <li v-for="(l, k) in itemLines" :key="k">
          <div class="r">
            <span class="ic" :class="{ img: l.icon }">
              <img v-if="l.icon" :src="l.icon" alt="">
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM9 7V4h6v3" /></svg>
            </span>
            <span class="main">
              <b class="ellipsis">{{ l.name }}</b>
              <small class="ellipsis">{{ ITEM_FLOW_LABELS[l.kind] }}</small>
            </span>
            <b class="amt" :class="l.amount < 0 ? 'loss' : 'gain'">{{ formatSigned(l.amount) }}</b>
            <span class="acts" />
          </div>
        </li>
      </ul>
      <p v-else-if="emptyShown('item')" class="empty">장비 결산에 적은 금액이 없어요</p>
    </section>

    <section v-show="shows('entry')" class="sec" style="--c: var(--calc)">
      <header class="sec-head">
        <i class="dot" />
        <h3>직접 등록</h3>
        <span class="sec-note">{{ entries.length ? `${entries.length}건` : '없음' }}</span>
        <button type="button" class="add" @click="openEntry(null)">+ 기록</button>
      </header>
      <ul v-if="entries.length" class="rows">
        <li v-for="e in entries" :key="e.id">
          <div class="r">
            <span class="ic" :class="{ img: e.icon }">
              <img v-if="e.icon" :src="e.icon" alt="">
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" /></svg>
            </span>
            <span class="main">
              <b class="ellipsis">{{ mesoEntryLabel(e.type) }}</b>
              <small class="ellipsis">{{ entryDetail(e) || '메모 없음' }}</small>
            </span>
            <b class="amt" :class="mesoEntryDelta(e) < 0 ? 'loss' : 'gain'">{{ formatSigned(mesoEntryDelta(e)) }}</b>
            <span class="acts">
              <LedgerAct kind="edit" label="고치기" @click="openEntry(e)" />
              <LedgerAct kind="del" label="지우기" @click="remove(`/api/ledger/entries/${e.id}`, mesoEntryLabel(e.type), mesoEntryDelta(e))" />
            </span>
          </div>
        </li>
      </ul>
      <p v-else-if="emptyShown('entry')" class="empty">직접 등록한 기록이 없어요</p>
    </section>
    </div>
    <LedgerEntryModal v-model="entryOpen" :entry="editingEntry" :date="date" :fee-rate="feeRate" :balance="balance" @saved="emit('changed')" />
  </div>
</template>

<style scoped>
.day {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}
.list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  margin-right: -8px;
  padding-right: 8px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}
.dot {
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  background: var(--c);
  border-radius: 50%;
}
.sec {
  display: grid;
  flex: none;
  gap: 4px;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
}
.sec-head .dot {
  margin-right: 2px;
}
h3 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.sec-note {
  color: var(--sub);
  font-size: 12px;
}
.add {
  display: inline-flex;
  align-items: center;
  height: 30px;
  margin-left: auto;
  padding: 0 12px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font: 13px var(--f-title);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease;
}
.add:hover {
  border-color: var(--c);
  color: var(--c);
}
/* 적는 칸이 열려 있는 동안에도 자리는 남겨 제목 줄이 흔들리지 않게 한다 */
.add.off {
  visibility: hidden;
}
.rows {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.r {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 6px 4px 6px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 8px;
}
.ic {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: color-mix(in srgb, var(--c) 14%, var(--bar));
  border-radius: 7px;
  color: var(--c);
}
.ic.img {
  background: none;
}
.ic img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  image-rendering: pixelated;
}
.ic svg:not(.coin) {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.main {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.main b {
  font-size: 14px;
}
.main b small,
.main > small {
  color: var(--sub);
  font-size: 12px;
  font-weight: 400;
}
.drops {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
}
.drops i {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 4px;
  border-radius: 2px;
  transform: rotate(45deg);
}
.amt {
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
/* 버튼이 하나뿐인 줄도 두 칸 자리를 잡아 금액이 한 줄로 맞는다 */
.acts {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  min-width: 62px;
}
.empty {
  display: grid;
  place-items: center;
  min-height: 42px;
  margin: 0;
  background: color-mix(in srgb, var(--tint) 1.5%, transparent);
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
}
@media (max-width: 520px) {
  /* 좁으면 이름 줄을 통째로 쓰고, 금액은 덧말 줄 오른쪽으로 내린다 */
  .r {
    grid-template-columns: 28px minmax(0, 1fr) auto auto;
    grid-template-areas: "ic title title acts" "ic sub amt acts";
    column-gap: 8px;
    row-gap: 1px;
    padding: 6px 2px 6px 8px;
  }
  .r > .ic {
    grid-area: ic;
  }
  .r > .main {
    display: contents;
  }
  .main > :first-child {
    grid-area: title;
    min-width: 0;
  }
  .main > :nth-child(2) {
    grid-area: sub;
    align-self: center;
    min-width: 0;
  }
  .r > .amt {
    grid-area: amt;
    font-size: 14px;
  }
  .r > .acts {
    grid-area: acts;
    min-width: 0;
  }
  .drops {
    flex-wrap: nowrap;
    overflow: hidden;
    white-space: nowrap;
  }
  .main b {
    font-size: 13.5px;
  }
}
</style>