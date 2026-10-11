<script setup lang="ts">
import type { BossClear, DropSale, HuntDrops, HuntEntry, ItemFlow, MesoEntry } from '#shared/types'
import { bossOrder, type BossDifficulty } from '#shared/data/bosses'
import { dayNet, mesoPerHour, summarizeLedger } from '#shared/calc/ledger'
import { dropSaleNet, mesoEntryDelta } from '#shared/calc/meso'
import { clearMeso } from '#shared/calc/boss'

const props = defineProps<{ date: string, hunts: HuntEntry[], clears: BossClear[], items: ItemFlow[], sales: DropSale[], entries: MesoEntry[], stock: HuntDrops, feeRate: number, balance: number | null }>()
const emit = defineEmits<{ changed: [] }>()

// 'new'·'sale'은 새로 적기, 그 밖에는 고치는 기록의 id
const editing = ref<string | 'new' | 'sale' | null>(null)
const summary = computed(() => summarizeLedger(props.hunts, props.clears, props.items, props.sales, props.entries).total)

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
  const groups = new Map<string, { ocid: string, name: string, clears: BossClear[], meso: number }>()
  for (const c of props.clears) {
    const g = groups.get(c.ocid) ?? groups.set(c.ocid, { ocid: c.ocid, name: c.name, clears: [], meso: 0 }).get(c.ocid)!
    g.clears.push(c)
    g.meso += clearMeso(c)
  }
  for (const g of groups.values()) g.clears.sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
  return [...groups.values()].sort((a, b) => b.meso - a.meso)
})

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
    <header class="head">
      <b class="date">{{ formatDay(date) }}</b>
      <span class="income" :class="{ loss: dayNet(summary) < 0 }">{{ formatSigned(dayNet(summary)) }}</span>
    </header>
    <div class="parts">
      <span><i class="dot" style="--c: var(--exp)" />사냥 {{ formatKoreanNumber(summary.huntMeso) }}</span>
      <span><i class="dot" style="--c: var(--api)" />보스 {{ formatKoreanNumber(summary.bossMeso) }}</span>
      <span v-if="summary.saleMeso"><i class="dot" style="--c: var(--gain)" />조각 판매 {{ formatKoreanNumber(summary.saleMeso) }}</span>
      <span v-if="summary.entryIn || summary.entryOut"><i class="dot" style="--c: var(--calc)" />직접 등록<template v-if="summary.entryIn"> +{{ formatKoreanNumber(summary.entryIn) }}</template><template v-if="summary.entryOut"> -{{ formatKoreanNumber(summary.entryOut) }}</template></span>
      <NuxtLink v-if="summary.itemSpent || summary.itemEarned" to="/items" class="item-link">
        <i class="dot" style="--c: var(--loss)" />장비<template v-if="summary.itemBought"> 구매 -{{ formatKoreanNumber(summary.itemBought) }}</template><template v-if="summary.itemEnhanced"> 강화 -{{ formatKoreanNumber(summary.itemEnhanced) }}</template><template v-if="summary.itemEarned"> 판매 +{{ formatKoreanNumber(summary.itemEarned) }}</template>
      </NuxtLink>
    </div>

    <section class="sec" style="--c: var(--exp)">
      <header class="sec-head">
        <i class="dot" />
        <h3>사냥</h3>
        <span class="sec-note">{{ hunts.length ? `${hunts.length}번` : '' }}</span>
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
      <p v-else-if="editing !== 'new'" class="empty">사냥 기록이 없어요</p>
    </section>

    <section class="sec" style="--c: var(--gain)">
      <header class="sec-head">
        <i class="dot" />
        <h3>조각 판매</h3>
        <span class="sec-note">보유 {{ Math.max(0, stock.fragments).toLocaleString('ko-KR') }}개</span>
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
      <p v-else-if="editing !== 'sale'" class="empty">판 조각이 없어요</p>
    </section>

    <section class="sec" style="--c: var(--api)">
      <header class="sec-head">
        <i class="dot" />
        <h3>보스</h3>
        <span class="sec-note">{{ clears.length ? `${clears.length}마리` : '' }}</span>
        <NuxtLink :to="{ path: '/ledger/bosses', query: { date } }" class="add">체크하기 →</NuxtLink>
      </header>
      <ul v-if="clears.length" class="rows">
        <li v-for="g in clearGroups" :key="g.ocid" class="r-group" :class="{ open: openGroup === g.ocid }">
          <button type="button" class="r r-btn" :aria-expanded="openGroup === g.ocid" @click="openGroup = openGroup === g.ocid ? null : g.ocid">
            <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" /></svg></span>
            <span class="main">
              <b class="ellipsis">{{ g.name }} <small>· {{ g.clears.length }}마리</small></b>
              <span class="stack">
                <span v-for="(c, k) in g.clears" :key="c.id" class="stack-item" :style="{ zIndex: k + 1 }" :title="bossLabel(c.bossId, c.difficulty)">
                  <LedgerBossEmblem :boss-id="c.bossId" :size="22" />
                </span>
              </span>
            </span>
            <b class="amt gain">+{{ formatKoreanNumber(g.meso) }}</b>
            <span class="acts">
              <svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>
          <!-- 높이를 0fr ↔ 1fr로 옮겨 메소 내역처럼 부드럽게 펼친다 -->
          <div class="detail-wrap">
            <ul class="detail" :inert="openGroup !== g.ocid">
              <li v-for="c in g.clears" :key="c.id">
                <i class="diff" :style="{ background: DIFFICULTY_COLORS[c.difficulty as BossDifficulty] }" />
                <span class="boss ellipsis">{{ bossLabel(c.bossId, c.difficulty) }}<template v-if="c.party > 1"> · {{ c.party }}인</template></span>
                <span v-if="c.loot.length" class="loot-names">
                  <LedgerLootIcon v-for="l in c.loot" :key="l.item" :item="l.item" :size="20" />
                </span>
                <b class="d-amt">{{ formatKoreanNumber(clearMeso(c)) }}</b>
                <LedgerAct kind="del" label="체크 취소" @click="remove(`/api/ledger/clears/${c.id}`, `${g.name} · ${bossLabel(c.bossId, c.difficulty)}`, clearMeso(c))" />
              </li>
            </ul>
          </div>
        </li>
      </ul>
      <p v-else class="empty">잡은 보스가 없어요</p>
    </section>

    <section class="sec" style="--c: var(--calc)">
      <header class="sec-head">
        <i class="dot" />
        <h3>직접 등록</h3>
        <span class="sec-note">{{ entries.length ? `${entries.length}건` : '' }}</span>
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
      <p v-else class="empty">직접 등록한 기록이 없어요</p>
    </section>
    <LedgerEntryModal v-model="entryOpen" :entry="editingEntry" :date="date" :fee-rate="feeRate" :balance="balance" @saved="emit('changed')" />
  </div>
</template>

<style scoped>
.day {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.date,
.income {
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
.income {
  color: var(--gold);
  white-space: nowrap;
}
.income.loss {
  color: var(--loss);
}
.parts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  color: var(--sub);
  font-size: 13px;
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
.item-link {
  color: var(--sub);
  text-decoration: none;
}
.item-link:hover {
  color: var(--text);
}

.sec {
  display: grid;
  gap: 6px;
}
.sec-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
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
  min-height: 50px;
  padding: 6px 4px 6px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 8px;
}
.r-btn {
  width: 100%;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.r-btn:hover {
  background: color-mix(in srgb, var(--c) 6%, var(--panel));
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
.caret {
  width: 15px;
  height: 15px;
  margin: 0 8px;
  fill: none;
  stroke: var(--sub);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  transition: transform var(--normal) var(--ease-out);
}
.r-group.open .caret {
  transform: rotate(180deg);
}
.empty {
  display: grid;
  place-items: center;
  min-height: 42px;
  margin: 0;
  background: rgb(255 255 255 / 0.015);
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 12.5px;
}

.r-group {
  overflow: hidden;
  border-radius: 8px;
}
.r-group.open .r {
  border-radius: 8px 8px 0 0;
}
/* 칸은 줄어들 수 있고 그림은 제 크기로 넘쳐 다음 그림 밑에 깔린다 */
.stack {
  display: flex;
  min-width: 0;
  padding: 2px 22px 0 0;
}
.stack-item {
  position: relative;
  flex: 0 1 24px;
  min-width: 8px;
  height: 22px;
}
.stack-item > * {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: -2px 0 6px rgb(0 0 0 / 0.55);
}
.detail-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--normal) var(--ease-out);
}
.r-group.open .detail-wrap {
  grid-template-rows: 1fr;
}
.detail {
  display: grid;
  gap: 2px;
  min-height: 0;
  margin: 0;
  padding: 0 4px 0 13px;
  overflow: hidden;
  background: rgb(10 12 22 / 0.4);
  border: 0 solid var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 0 0 8px 8px;
  list-style: none;
  opacity: 0;
  transition: opacity var(--normal) ease, padding var(--normal) var(--ease-out);
}
.r-group.open .detail {
  padding-block: 4px 6px;
  border-width: 0 1px 1px 3px;
  opacity: 1;
}
.detail li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  font-size: 13px;
}
.diff {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.boss {
  flex: 1;
  min-width: 0;
}
.loot-names {
  display: flex;
  gap: 2px;
}
.d-amt {
  color: var(--gain);
  font-family: var(--f-title);
  font-weight: 400;
  white-space: nowrap;
}
@media (max-width: 520px) {
  .date,
  .income {
    font-size: 21px;
  }
  .parts {
    gap: 2px 12px;
    font-size: 12.5px;
  }
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
