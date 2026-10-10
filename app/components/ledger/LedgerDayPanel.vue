<script setup lang="ts">
import type { BossClear, DropSale, HuntDrops, HuntEntry, ItemFlow, MesoEntry } from '#shared/types'
import { findMesoEntryType } from '#shared/data/mesoEntries'
import { bossOrder, type BossDifficulty } from '#shared/data/bosses'

const props = defineProps<{ date: string, hunts: HuntEntry[], clears: BossClear[], items: ItemFlow[], sales: DropSale[], entries: MesoEntry[], stock: HuntDrops, feeRate: number, balance: number | null }>()
const emit = defineEmits<{ changed: [] }>()

const editing = ref<string | 'new' | 'sale' | null>(null)
const busy = ref(false)
const failure = ref('')
const summary = computed(() => summarizeLedger(props.hunts, props.clears, props.items, props.sales, props.entries).total)

// 직접 등록: 새로 적기와 고치기 모두 같은 모달
const entryOpen = ref(false)
const editingEntry = ref<MesoEntry | null>(null)
function openEntry(entry: MesoEntry | null) {
  editingEntry.value = entry
  entryOpen.value = true
}
const entryDetail = (e: MesoEntry) => [e.item, e.cash && e.amount ? `1억당 ${Math.round(e.cash / (e.amount / 1e8)).toLocaleString('ko-KR')}원` : '', e.memo].filter(Boolean).join(' · ')

// 보스가 많으면 길게 늘어지므로 캐릭터별 한 줄로 묶고, 누르면 펼친다
const openGroup = ref<string | null>(null)
const clearGroups = computed(() => {
  const groups = new Map<string, { ocid: string, name: string, clears: BossClear[], meso: number, loot: number, lootItems: string[] }>()
  for (const c of props.clears) {
    const g = groups.get(c.ocid) ?? groups.set(c.ocid, { ocid: c.ocid, name: c.name, clears: [], meso: 0, loot: 0, lootItems: [] }).get(c.ocid)!
    g.clears.push(c)
    g.meso += clearMeso(c)
    g.loot += c.loot.length
    g.lootItems.push(...c.loot.map(l => l.item))
  }
  for (const g of groups.values()) g.clears.sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
  return [...groups.values()].sort((a, b) => b.meso - a.meso)
})

watch(() => props.date, () => {
  editing.value = null
  openGroup.value = null
  failure.value = ''
})

const { ask } = useConfirm()
async function remove(path: string, name: string, amount: number) {
  if (!await ask({ title: '기록 지우기', name, detail: formatDay(props.date), amount, note: '지우면 보유 메소와 메소 내역에서도 빠지고 되돌릴 수 없어요.' })) return
  busy.value = true
  failure.value = ''
  try {
    await $fetch(path, { method: 'DELETE' })
    emit('changed')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}
function onSaved() {
  editing.value = null
  emit('changed')
}
</script>

<template>
  <div class="day">
    <header class="head">
      <b class="date">{{ formatMonthDay(date) }}</b>
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
    <p v-if="failure" class="form-error">{{ failure }}</p>

    <!-- 네 칸 모두 같은 틀: 제목 줄(점 · 이름 · 덧말 · 버튼) → 줄 목록 또는 빈 안내 -->
    <section class="sec" style="--c: var(--exp)">
      <header class="sec-head">
        <i class="dot" />
        <h3>사냥</h3>
        <span class="sec-note">{{ hunts.length ? `${hunts.length}번` : '' }}</span>
        <button v-if="editing !== 'new'" type="button" class="add" @click="editing = 'new'">+ 기록</button>
      </header>
      <LedgerHuntForm v-if="editing === 'new'" :key="`new-${date}`" :date="date" :entry="null" @saved="onSaved" @cancel="editing = null" />
      <ul v-if="hunts.length" class="rows">
        <li v-for="h in hunts" :key="h.id">
          <LedgerHuntForm v-if="editing === h.id" :date="date" :entry="h" @saved="onSaved" @cancel="editing = null" />
          <div v-else class="r">
            <span class="ic"><svg viewBox="0 0 24 24" class="coin" aria-hidden="true"><circle cx="12" cy="12" r="9" class="coin-face" /><circle cx="12" cy="12" r="5.5" class="coin-ring" /><path d="M9.5 14.5v-5l2.5 3 2.5-3v5" class="coin-mark" /></svg></span>
            <span class="main">
              <b>{{ h.minutes ? formatHuntTime(h.minutes) : '사냥' }}<small v-if="h.minutes"> · 시간당 {{ formatShortNumber(mesoPerHour(h.meso, h.minutes) ?? 0) }}</small></b>
              <small class="drops">
                <span v-for="d in HUNT_DROPS.filter(d => h[d.key])" :key="d.key" :title="d.label"><i :style="{ background: d.color }" />{{ d.short }} {{ h[d.key].toLocaleString('ko-KR') }}</span>
                <span v-if="h.memo" class="ellipsis">{{ h.memo }}</span>
              </small>
            </span>
            <b class="amt gain">+{{ formatKoreanNumber(h.meso) }}</b>
            <span class="acts">
              <button type="button" class="act" title="고치기" aria-label="고치기" @click="editing = h.id"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" /></svg></button>
              <button type="button" class="act del" title="지우기" aria-label="지우기" :disabled="busy" @click="remove(`/api/ledger/hunts/${h.id}`, h.minutes ? `사냥 ${formatHuntTime(h.minutes)}` : '사냥', h.meso)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
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
        <button v-if="editing !== 'sale'" type="button" class="add" @click="editing = 'sale'">+ 기록</button>
      </header>
      <LedgerSaleForm v-if="editing === 'sale'" :key="`sale-${date}`" :date="date" :fee-rate="feeRate" @saved="onSaved" @cancel="editing = null" />
      <ul v-if="sales.length" class="rows">
        <li v-for="s in sales" :key="s.id" class="r">
          <span class="ic"><img src="/icons/sol-erda-fragment.png" alt=""></span>
          <span class="main">
            <b>조각 {{ s.count.toLocaleString('ko-KR') }}개</b>
            <small>개당 {{ formatKoreanNumber(s.unitPrice) }} · 수수료 {{ Math.round(s.fee * 100) }}%</small>
          </span>
          <b class="amt gain">+{{ formatKoreanNumber(dropSaleNet(s)) }}</b>
          <span class="acts">
            <span class="act-space" />
            <button type="button" class="act del" title="지우기" aria-label="지우기" :disabled="busy" @click="remove(`/api/ledger/sales/${s.id}`, `조각 ${s.count.toLocaleString('ko-KR')}개 판매`, dropSaleNet(s))"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
          </span>
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
              <b>{{ g.name }} <small>· {{ g.clears.length }}마리</small></b>
              <span class="stack bosses">
                <span v-for="(c, k) in g.clears" :key="c.id" class="stack-item" :style="{ zIndex: k + 1 }" :title="bossLabel(c.bossId, c.difficulty)">
                  <LedgerBossEmblem :boss-id="c.bossId" :size="22" />
                </span>
              </span>
            </span>
            <b class="amt gain">+{{ formatShortNumber(g.meso) }}</b>
            <span class="acts">
              <span class="act-space" />
              <svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </button>
          <ul v-if="openGroup === g.ocid" class="detail">
            <li v-for="c in g.clears" :key="c.id">
              <i class="diff" :style="{ background: DIFFICULTY_COLORS[c.difficulty as BossDifficulty] }" />
              <span class="boss ellipsis">{{ bossLabel(c.bossId, c.difficulty) }}<template v-if="c.party > 1"> · {{ c.party }}인</template></span>
              <span v-if="c.loot.length" class="loot-names">
                <LedgerLootIcon v-for="l in c.loot" :key="l.item" :item="l.item" :size="20" />
              </span>
              <b class="d-amt">{{ formatShortNumber(clearMeso(c)) }}</b>
              <button type="button" class="act del" title="체크 취소" aria-label="체크 취소" :disabled="busy" @click="remove(`/api/ledger/clears/${c.id}`, `${g.name} · ${bossLabel(c.bossId, c.difficulty)}`, clearMeso(c))"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
            </li>
          </ul>
        </li>
      </ul>
      <p v-else class="empty">잡은 보스가 없어요</p>
    </section>

    <section class="sec" style="--c: var(--calc)">
      <header class="sec-head">
        <i class="dot" />
        <h3>직접 등록</h3>
        <span class="sec-note">{{ entries.length ? `${entries.length}건` : '' }}</span>
        <button type="button" class="add" @click="openEntry(null)">+ 등록</button>
      </header>
      <ul v-if="entries.length" class="rows">
        <li v-for="e in entries" :key="e.id">
          <div class="r">
            <span class="ic" :class="{ img: e.icon }">
              <img v-if="e.icon" :src="e.icon" alt="">
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" /></svg>
            </span>
            <span class="main">
              <b class="ellipsis">{{ findMesoEntryType(e.type)?.label ?? '직접 등록' }}<template v-if="e.item"> · {{ e.item }}</template></b>
              <small class="ellipsis">{{ entryDetail(e) || '메모 없음' }}</small>
            </span>
            <b class="amt" :class="mesoEntryDelta(e) < 0 ? 'loss' : 'gain'">{{ formatSigned(mesoEntryDelta(e)) }}</b>
            <span class="acts">
              <button type="button" class="act" title="고치기" aria-label="고치기" @click="openEntry(e)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4" /></svg></button>
              <button type="button" class="act del" title="지우기" aria-label="지우기" :disabled="busy" @click="remove(`/api/ledger/entries/${e.id}`, findMesoEntryType(e.type)?.label ?? '직접 등록', mesoEntryDelta(e))"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" /></svg></button>
            </span>
          </div>
        </li>
      </ul>
      <p v-else class="empty">메소 판매·경매장 구매 같은 지출·수입</p>
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

/* 칸 */
.sec {
  display: grid;
  gap: 6px;
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
  height: 28px;
  margin-left: auto;
  padding: 0 11px;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font: 13px var(--f-title);
  text-decoration: none;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease;
}
.add:hover {
  border-color: var(--c);
  color: var(--c);
}
.rows {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 줄: 그림 · 이름과 덧말 · 금액 · 버튼 두 칸 */
.r {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto 58px;
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
.ic svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.ic svg.coin {
  width: 20px;
  height: 20px;
}
.coin-face {
  fill: #f2c14e;
  stroke: #b98a1e;
  stroke-width: 1.4;
}
.coin-ring {
  fill: none;
  stroke: #fff2b8;
  stroke-width: 1.2;
  opacity: 0.8;
}
.coin-mark {
  fill: none;
  stroke: #8a5d10;
  stroke-width: 1.6;
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
.acts {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.act,
.act-space {
  flex: none;
  width: 28px;
  height: 28px;
}
.act {
  display: grid;
  place-items: center;
  padding: 0;
  background: none;
  border: 1px solid transparent;
  border-radius: 50%;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease, border-color var(--fast) ease;
}
.act svg,
.caret {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.act:hover:not(:disabled) {
  background: rgb(242 193 78 / 0.12);
  border-color: rgb(242 193 78 / 0.4);
  color: var(--gold);
}
.act.del:hover:not(:disabled) {
  background: rgb(255 138 122 / 0.12);
  border-color: rgb(255 138 122 / 0.4);
  color: var(--loss);
}
.caret {
  margin: 0 6px;
  color: var(--sub);
  transition: transform var(--normal) var(--ease-out);
}
.r-group.open .caret {
  transform: rotate(180deg);
}
/* 비었을 때: 줄과 같은 높이의 점선 안내 */
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

/* 보스: 캐릭터 줄을 펼치면 보스별 */
.r-group {
  overflow: hidden;
  border-radius: 8px;
}
.r-group.open .r {
  border-radius: 8px 8px 0 0;
}
/* 영역에 맞춰 겹쳐 쌓는다: 칸은 줄어들 수 있고 그림은 제 크기로 넘쳐 그려져 다음 그림 밑에 깔린다 */
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
.detail {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 4px 4px 6px 13px;
  background: rgb(10 12 22 / 0.4);
  border: 1px solid var(--panel-line);
  border-top: 1px dashed var(--panel-line);
  border-left: 3px solid var(--c);
  border-radius: 0 0 8px 8px;
  list-style: none;
  animation: fade-in 0.18s ease;
}
@keyframes fade-in {
  from { opacity: 0; }
}
.detail li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
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
</style>
