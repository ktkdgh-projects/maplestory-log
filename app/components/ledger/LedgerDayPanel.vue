<script setup lang="ts">
import type { BossClear, HuntEntry, ItemFlow } from '#shared/types'
import { bossOrder, type BossDifficulty } from '#shared/data/bosses'

const props = defineProps<{ date: string, hunts: HuntEntry[], clears: BossClear[], items: ItemFlow[] }>()
const emit = defineEmits<{ changed: [] }>()

const editing = ref<string | 'new' | null>(null)
const busy = ref(false)
const failure = ref('')
const summary = computed(() => summarizeLedger(props.hunts, props.clears, props.items).total)

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

async function remove(path: string) {
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
      <span><i class="dot dot-hunt" />사냥 {{ formatKoreanNumber(summary.huntMeso) }}</span>
      <span><i class="dot dot-boss" />보스 {{ formatKoreanNumber(summary.bossMeso) }}</span>
      <NuxtLink v-if="summary.itemSpent || summary.itemEarned" to="/items" class="item-link">
        <i class="dot dot-item" />장비 <template v-if="summary.itemSpent">-{{ formatKoreanNumber(summary.itemSpent) }}</template><template v-if="summary.itemEarned"> +{{ formatKoreanNumber(summary.itemEarned) }}</template>
      </NuxtLink>
    </div>
    <p v-if="failure" class="form-error">{{ failure }}</p>

    <section class="block">
      <div class="block-head">
        <h3>사냥</h3>
        <button v-if="editing !== 'new'" type="button" class="btn ghost compact" @click="editing = 'new'">+ 사냥 기록</button>
      </div>
      <LedgerHuntForm v-if="editing === 'new'" :key="`new-${date}`" :date="date" :entry="null" @saved="onSaved" @cancel="editing = null" />
      <ul class="list">
        <li v-for="h in hunts" :key="h.id">
          <LedgerHuntForm v-if="editing === h.id" :date="date" :entry="h" @saved="onSaved" @cancel="editing = null" />
          <div v-else class="hunt">
            <div class="hunt-main">
              <b>{{ formatKoreanNumber(h.meso) }} 메소</b>
              <small v-if="h.minutes">{{ formatHuntTime(h.minutes) }} · 시간당 {{ formatKoreanNumber(mesoPerHour(h.meso, h.minutes) ?? 0) }}</small>
              <small v-if="h.memo" class="memo">{{ h.memo }}</small>
            </div>
            <div class="drops">
              <span v-for="d in HUNT_DROPS.filter(d => h[d.key])" :key="d.key" :title="d.label"><i :style="{ background: d.color }" />{{ d.short }} {{ h[d.key].toLocaleString('ko-KR') }}</span>
            </div>
            <div class="row-actions">
              <button type="button" class="icon-btn" aria-label="고치기" @click="editing = h.id">✎</button>
              <button type="button" class="icon-btn danger" aria-label="지우기" :disabled="busy" @click="remove(`/api/ledger/hunts/${h.id}`)">×</button>
            </div>
          </div>
        </li>
        <li v-if="!hunts.length && editing !== 'new'" class="muted empty">사냥 기록이 없어요.</li>
      </ul>
    </section>

    <section class="block">
      <div class="block-head">
        <h3>보스</h3>
        <span class="muted hint">주간 보스 탭에서 체크해요</span>
      </div>
      <ul class="list">
        <li v-for="g in clearGroups" :key="g.ocid" class="group" :class="{ open: openGroup === g.ocid }">
          <button type="button" class="group-head" :aria-expanded="openGroup === g.ocid" @click="openGroup = openGroup === g.ocid ? null : g.ocid">
            <span class="who-name">{{ g.name }}</span>
            <span class="stack bosses">
              <span v-for="(c, k) in g.clears" :key="c.id" class="stack-item" :style="{ zIndex: k + 1 }" :title="bossLabel(c.bossId, c.difficulty)">
                <LedgerBossEmblem :boss-id="c.bossId" :size="26" />
              </span>
            </span>
            <span v-if="g.loot" class="stack loots">
              <span v-for="(item, k) in g.lootItems" :key="k" class="stack-item" :style="{ zIndex: k + 1 }">
                <LedgerLootIcon :item="item" :size="22" />
              </span>
            </span>
            <small class="count">{{ g.clears.length }}마리</small>
            <b class="meso">{{ formatShortNumber(g.meso) }}</b>
            <span class="caret" aria-hidden="true">▾</span>
          </button>
          <ul v-if="openGroup === g.ocid" class="detail">
            <li v-for="c in g.clears" :key="c.id">
              <i class="diff" :style="{ background: DIFFICULTY_COLORS[c.difficulty as BossDifficulty] }" />
              <span class="boss ellipsis">{{ bossLabel(c.bossId, c.difficulty) }}<template v-if="c.party > 1"> · {{ c.party }}인</template></span>
              <span v-if="c.loot.length" class="loot-names">
                <LedgerLootIcon v-for="l in c.loot" :key="l.item" :item="l.item" :size="22" />
              </span>
              <b class="meso">{{ formatShortNumber(clearMeso(c)) }}</b>
              <button type="button" class="icon-btn danger" aria-label="체크 취소" :disabled="busy" @click="remove(`/api/ledger/clears/${c.id}`)">×</button>
            </li>
          </ul>
        </li>
        <li v-if="!clears.length" class="muted empty">잡은 보스가 없어요.</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.day {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.date {
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
.income {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 24px;
}
.parts {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--sub);
  font-size: 14px;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
}
.dot-hunt {
  background: var(--api);
}
.dot-boss {
  background: var(--calc);
}
.dot-item {
  background: var(--loss);
}
.item-link {
  color: var(--sub);
  text-decoration: none;
}
.item-link:hover {
  color: var(--text);
}
.income.loss {
  color: var(--loss);
}
.block {
  display: grid;
  gap: 6px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.hint {
  font-size: 12px;
}
.list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.empty {
  padding: 8px 0;
  font-size: 14px;
}
.hunt {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  padding: 8px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--api);
  border-radius: 8px;
}
.hunt-main {
  display: grid;
  min-width: 0;
}
.hunt-main b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.hunt-main small {
  color: var(--sub);
  font-size: 12px;
}
.memo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drops {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  grid-column: 1;
  font-size: 13px;
}
.drops i {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 4px;
  border-radius: 2px;
  transform: rotate(45deg);
}
.row-actions {
  display: flex;
  grid-row: 1 / span 2;
  grid-column: 2;
  align-items: center;
  gap: 4px;
}
.group {
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--calc);
  border-radius: 8px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: none;
  border: 0;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.group-head:hover {
  background: rgb(255 255 255 / 0.03);
}
.who-name {
  flex: none;
  font-family: var(--f-title);
  font-size: 15px;
}
/* 영역에 맞춰 겹쳐 쌓는다: 칸(stack-item)은 줄어들 수 있고 그림은 제 크기로 넘쳐 그려져 다음 그림 밑에 깔린다 */
.stack {
  display: flex;
  min-width: 0;
  padding: 4px 26px 4px 0;
}
.stack.bosses {
  flex: 1;
}
.stack.loots {
  flex: 0 1 auto;
  padding-left: 6px;
  border-left: 1px solid var(--panel-line);
}
.stack-item {
  position: relative;
  flex: 0 1 28px;
  min-width: 8px;
  height: 26px;
  transition: transform var(--fast) var(--ease-spring);
}
.stack-item > * {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: -2px 0 6px rgb(0 0 0 / 0.55);
}
.loots .stack-item {
  flex-basis: 24px;
}
.loots .stack-item > * {
  top: 2px;
  box-shadow: none;
}
/* 마우스를 올린 그림은 위로 떠오르고, 그 뒤의 그림들은 비켜난다 */
.group-head:hover .stack-item:hover {
  z-index: 50 !important;
  transform: translateY(-3px) scale(1.15);
}
.group-head:hover .stack-item:hover ~ .stack-item {
  transform: translateX(14px);
}
.count {
  flex: none;
  color: var(--sub);
  font-size: 12px;
}
.caret {
  flex: none;
  color: var(--sub);
  font-size: 11px;
  transition: transform var(--fast) ease;
}
.group.open .caret {
  transform: rotate(180deg);
}
.detail {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 4px 10px 8px;
  border-top: 1px dashed var(--panel-line);
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
}
.diff {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.boss {
  flex: none;
  font-size: 14px;
}
.loot-names {
  display: flex;
  gap: 2px;
  min-width: 0;
}
.meso {
  flex: none;
  margin-left: auto;
  color: var(--gold);
  font-family: var(--f-title);
  font-weight: 400;
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font-size: 15px;
  cursor: pointer;
  transition: color var(--fast) ease, border-color var(--fast) ease;
}
.icon-btn:hover:not(:disabled) {
  border-color: var(--tip-line);
  color: var(--text);
}
.icon-btn.danger:hover:not(:disabled) {
  border-color: var(--loss);
  color: var(--loss);
}
</style>
