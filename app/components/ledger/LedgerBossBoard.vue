<script setup lang="ts">
import type { BossClear, BossPick, BossRosterCharacter, CharacterBrief, LedgerSettings } from '#shared/types'
import { MAX_BOSS_CHARACTERS, bossOrder, bossPeriod, bossPriceDate, crystalPrice, findBoss } from '#shared/data/bosses'
import { DEFAULT_AUCTION_FEE } from '#shared/data/auction'
import { clearMeso, lootMeso } from '#shared/calc/boss'

const props = defineProps<{ week: string, roster: BossRosterCharacter[], clears: BossClear[], settings: LedgerSettings | null, editable: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const today = kstToday()
// 지난 주를 체크하면 그 주 마지막 날(수요일)에 잡은 걸로 남긴다
const clearDate = computed(() => {
  const end = addDays(props.week, 6)
  return end < today ? end : today
})
const failure = ref('')

// 화면에 먼저 반영하고 저장은 차례로 보낸다. 다 끝난 뒤 한 번만 새로 받아 숫자가 중간에 출렁이지 않게 한다
const clears = ref<BossClear[]>([...props.clears])
const roster = ref<BossRosterCharacter[]>([...props.roster])
let pendingOps = 0
let chain: Promise<unknown> = Promise.resolve()
// 저장 중인 칸(캐릭터:보스)을 또 누르면 무시한다
const inflight = ref(new Set<string>())
function enqueue(keys: string[], op: () => Promise<unknown>) {
  pendingOps++
  inflight.value = new Set([...inflight.value, ...keys])
  chain = chain.then(op).catch((error) => {
    failure.value = errorMessage(error)
  }).finally(() => {
    const next = new Set(inflight.value)
    keys.forEach(k => next.delete(k))
    inflight.value = next
    if (--pendingOps === 0) emit('changed')
  })
}
watch(() => props.clears, (value) => {
  if (!pendingOps) clears.value = [...value]
})
watch(() => props.roster, (value) => {
  if (!pendingOps) roster.value = [...value]
})

const isMonthly = (bossId: string) => findBoss(bossId)?.cycle === 'monthly'
const periodOf = (bossId: string) => (isMonthly(bossId) ? bossPeriod('monthly', clearDate.value) : props.week)
const inWeek = (date: string) => date >= props.week && date <= addDays(props.week, 6)
const periodClear = (ocid: string, bossId: string) => {
  const period = periodOf(bossId)
  return clears.value.find(c => c.ocid === ocid && c.bossId === bossId && c.period === period)
}
// 월간 보스는 이 주에 잡았을 때만 이 주 칸에 체크로 보인다
function clearOf(ocid: string, bossId: string) {
  const clear = periodClear(ocid, bossId)
  return clear && (!isMonthly(bossId) || inWeek(clear.date)) ? clear : undefined
}
// 이번 달 다른 주에 이미 잡았으면 그날. 이 주엔 다시 잡을 수 없고 결정석도 세지 않는다
function takenOn(ocid: string, bossId: string) {
  const clear = isMonthly(bossId) ? periodClear(ocid, bossId) : undefined
  return clear && !inWeek(clear.date) ? clear.date : undefined
}
const keyOf = (ocid: string, bossId: string) => `${ocid}:${bossId}`
const pendingClear = (c: BossRosterCharacter, pick: BossPick): BossClear => ({ bossId: pick.bossId, difficulty: pick.difficulty, party: pick.party, id: `pending-${keyOf(c.ocid, pick.bossId)}`, ocid: c.ocid, name: c.name, period: periodOf(pick.bossId), date: clearDate.value, meso: crystalPrice(pick.bossId, pick.difficulty, pick.party, clearDate.value) ?? 0, loot: [] })

// 끄는 동안은 화면에서만 옮기고 놓을 때 저장한다
const order = ref(roster.value.map(c => c.ocid))
watch(roster, (value) => {
  order.value = value.map(c => c.ocid)
})
const ordered = computed(() => [...roster.value].sort((a, b) => order.value.indexOf(a.ocid) - order.value.indexOf(b.ocid)))
const dragOcid = ref<string | null>(null)
function startDrag(event: DragEvent, ocid: string) {
  dragOcid.value = ocid
  event.dataTransfer?.setData('text/plain', ocid)
  // 손잡이만이 아니라 줄 전체가 끌려가는 것처럼 보이게 한다
  const row = (event.target as HTMLElement).closest('li')
  if (row) event.dataTransfer?.setDragImage(row, 24, 24)
}
function dragOver(ocid: string) {
  if (!dragOcid.value || dragOcid.value === ocid) return
  const list = order.value.filter(o => o !== dragOcid.value)
  list.splice(order.value.indexOf(ocid), 0, dragOcid.value)
  order.value = list
}
function endDrag() {
  if (!dragOcid.value) return
  dragOcid.value = null
  if (order.value.join() !== roster.value.map(c => c.ocid).join()) saveRoster(ordered.value)
}
function moveBy(ocid: string, delta: number, event: Event) {
  const i = order.value.indexOf(ocid)
  const j = i + delta
  if (j < 0 || j >= order.value.length) return
  const list = [...order.value]
  list.splice(i, 1)
  list.splice(j, 0, ocid)
  order.value = list
  saveRoster(ordered.value)
  // 옮긴 줄의 버튼에 포커스를 남겨 이어서 옮길 수 있게 한다
  const button = event.currentTarget as HTMLElement
  nextTick(() => button.focus())
}

type Cycle = 'weekly' | 'monthly'
// 예상 금액과 견주는 건 결정석뿐이고, 물욕템을 판 금액은 따로 센다
const sumMeso = (list: BossClear[]) => list.reduce((sum, c) => sum + c.meso, 0)
const sumPrice = (list: (BossPick & { boss: { cycle: Cycle } })[], cycle: Cycle) => list.filter(b => b.boss.cycle === cycle).reduce((sum, b) => sum + (crystalPrice(b.bossId, b.difficulty, b.party) ?? 0), 0)

const rows = computed(() => ordered.value.map((character) => {
  const bosses = [...character.bosses]
    .sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
    .map(pick => ({ ...pick, boss: findBoss(pick.bossId)!, clear: clearOf(character.ocid, pick.bossId), takenOn: takenOn(character.ocid, pick.bossId) }))
  const weekly = bosses.filter(b => b.boss.cycle === 'weekly')
  const weeklyClears = weekly.flatMap(b => b.clear ?? [])
  // 월간 결정석은 잡은 날이 이 주인 것만 센다. 주가 두 달에 걸치면 칸이 이번 달로 넘어간 지난달 기록도 센다
  const monthlyClears = clears.value.filter(c => c.ocid === character.ocid && isMonthly(c.bossId) && inWeek(c.date) && bosses.some(b => b.bossId === c.bossId))
  const counted = [...weeklyClears, ...monthlyClears]
  return {
    character,
    bosses,
    weeklyDone: weeklyClears.length,
    weeklyTotal: weekly.length,
    // 월간 보스는 매주 잡는 게 아니라 주간 세팅을 다 잡았는지만 본다
    complete: weekly.length > 0 && weeklyClears.length === weekly.length,
    crystal: sumMeso(counted),
    loot: counted.reduce((sum, c) => sum + lootMeso(c), 0),
    // 주간은 매주, 월간은 한 달에 한 번이라 합계를 따로 낸다
    weeklyEarned: sumMeso(weeklyClears),
    monthlyEarned: sumMeso(monthlyClears),
    weeklyExpected: sumPrice(bosses, 'weekly'),
    monthlyExpected: sumPrice(bosses.filter(b => !b.takenOn), 'monthly'),
    monthly: bosses.filter(b => b.boss.cycle === 'monthly'),
  }
}))
const sumRows = (key: 'weeklyEarned' | 'weeklyExpected' | 'monthlyEarned' | 'monthlyExpected' | 'loot') => rows.value.reduce((s, r) => s + r[key], 0)
const totals = computed(() => ({
  weeklyEarned: sumRows('weeklyEarned'),
  weeklyExpected: sumRows('weeklyExpected'),
  monthlyEarned: sumRows('monthlyEarned'),
  monthlyExpected: sumRows('monthlyExpected'),
  // 세팅한 월간 보스를 이번 달에 전부 잡았는지(이 주든 다른 주든)
  monthlyDone: rows.value.some(r => r.monthly.length) && rows.value.every(r => r.monthly.every(b => b.clear || b.takenOn)),
  loot: sumRows('loot'),
  complete: rows.value.length > 0 && rows.value.every(r => r.complete),
  completeCount: rows.value.filter(r => r.complete).length,
}))

// 남은 주간 보스를 화면에 먼저 체크하고 서버에는 한 번에 보낸다
function clearAll(characters: BossRosterCharacter[]) {
  failure.value = ''
  const pending = characters.flatMap(c => c.bosses
    .filter(pick => findBoss(pick.bossId)?.cycle === 'weekly' && !clearOf(c.ocid, pick.bossId))
    .map(pick => pendingClear(c, pick)))
  if (!pending.length) return
  clears.value = [...clears.value, ...pending]
  const date = clearDate.value
  const ocid = characters.length === 1 ? characters[0]!.ocid : undefined
  enqueue(pending.map(p => keyOf(p.ocid, p.bossId)), () => $fetch('/api/ledger/clears/bulk', { method: 'POST', body: { date, ...(ocid && { ocid }) } }))
}

// 적어 둔 물욕템 기록도 같이 지워지므로 늘 한 번 묻는다
const { ask } = useConfirm()
async function unclearAll(character: BossRosterCharacter) {
  const weekly = clears.value.filter(c => c.ocid === character.ocid && c.period === props.week)
  if (!weekly.length) return
  const loot = weekly.some(c => c.loot.length)
  if (!await ask({ title: '이번 주 체크 모두 풀기', name: `${character.name} · 주간 보스 ${weekly.length}개`, amount: weekly.reduce((n, c) => n + clearMeso(c), 0), note: loot ? '적어 둔 물욕템 기록도 같이 지워지고 되돌릴 수 없어요.' : '보유 메소와 메소 내역에서도 빠져요.', action: '모두 풀기' })) return
  failure.value = ''
  clears.value = clears.value.filter(c => !weekly.includes(c))
  const week = props.week
  enqueue(weekly.map(c => keyOf(c.ocid, c.bossId)), () => $fetch('/api/ledger/weekly-clears', { method: 'DELETE', body: { ocid: character.ocid, week } }))
}

const lootOpen = ref(false)
const lootClear = ref<BossClear | null>(null)
function openLoot(clear: BossClear) {
  lootClear.value = clear
  lootOpen.value = true
}

async function toggle(character: BossRosterCharacter, pick: BossPick) {
  const key = keyOf(character.ocid, pick.bossId)
  if (inflight.value.has(key) || takenOn(character.ocid, pick.bossId)) return
  failure.value = ''
  const clear = clearOf(character.ocid, pick.bossId)
  if (clear) {
    // 적어 둔 물욕템이 있으면 같이 지워지므로 한 번 묻는다
    if (clear.loot.length && !await ask({ title: '보스 체크 풀기', name: `${character.name} · ${bossLabel(pick.bossId, pick.difficulty)}`, detail: `물욕템 ${clear.loot.map(l => l.item).join(', ')}`, amount: clearMeso(clear), note: '적어 둔 물욕템 기록도 같이 지워지고 되돌릴 수 없어요.', action: '체크 풀기' })) return
    if (inflight.value.has(key) || !clears.value.includes(clear)) return
    clears.value = clears.value.filter(c => c.id !== clear.id)
    enqueue([key], () => $fetch(`/api/ledger/clears/${clear.id}`, { method: 'DELETE' }))
  }
  else {
    const date = clearDate.value
    clears.value = [...clears.value, pendingClear(character, pick)]
    enqueue([key], () => $fetch('/api/ledger/clears', { method: 'POST', body: { ocid: character.ocid, bossId: pick.bossId, date } }))
  }
}

const openOcid = ref<string | null>(null)
// 지난 주로 넘어가면 열어 둔 세팅을 닫는다(닫히면서 고친 게 이번 주 명단으로 저장된다)
watch(() => props.editable, (value) => {
  if (!value) openOcid.value = null
})
const toggleSetup = (ocid: string) => {
  openOcid.value = openOcid.value === ocid ? null : ocid
}
// 그때의 명단을 떠서 차례로 보내므로 저장이 겹쳐도 마지막에 고친 명단이 남는다
function saveRoster(characters: BossRosterCharacter[]) {
  failure.value = ''
  roster.value = characters
  const snapshot = JSON.parse(JSON.stringify(characters)) as BossRosterCharacter[]
  enqueue(['roster'], () => $fetch('/api/ledger/roster', { method: 'PUT', body: { characters: snapshot } }))
}
const setBosses = (ocid: string, bosses: BossPick[]) => saveRoster(roster.value.map(c => (c.ocid === ocid ? { ...c, bosses } : c)))
// 복사할 땐 보고 있던 캐릭터의 고친 세팅도 같이 저장해야 다시 불러올 때 사라지지 않는다
const copyBosses = (from: string, to: string, bosses: BossPick[]) => saveRoster(roster.value.map(c => (c.ocid === from || c.ocid === to ? { ...c, bosses: JSON.parse(JSON.stringify(bosses)) } : c)))
async function removeCharacter(character: BossRosterCharacter) {
  if (!await ask({ title: '캐릭터 빼기', name: character.name, detail: `${character.job} · LV.${character.level} · 보스 ${character.bosses.length}개`, note: '보스 표에서 빼요. 이미 체크한 기록은 가계부에 그대로 남아요.', action: '빼기' })) return
  // 세팅을 열어 두었으면 먼저 닫아 아직 안 보낸 고침을 내보낸 뒤 뺀다
  if (openOcid.value === character.ocid) {
    openOcid.value = null
    await nextTick()
  }
  saveRoster(roster.value.filter(c => c.ocid !== character.ocid))
}

const pickerOpen = ref(false)
const candidates = ref<CharacterBrief[] | null>(null)
async function openPicker() {
  pickerOpen.value = true
  failure.value = ''
  candidates.value ??= await $fetch<CharacterBrief[]>('/api/me/characters').catch((error) => {
    failure.value = errorMessage(error)
    pickerOpen.value = false
    return null
  })
}
function addCharacter(ocid: string) {
  const c = candidates.value?.find(x => x.ocid === ocid)
  if (!c || roster.value.some(r => r.ocid === ocid)) return
  pickerOpen.value = false
  saveRoster([...roster.value, { ...c, imageUrl: null, bosses: [] }])
  openOcid.value = ocid
}
</script>

<template>
  <div class="board">
    <LedgerWallet :settings="settings" @changed="emit('changed')">
      <SourceBadge type="calc" /> 결정석 {{ formatDay(bossPriceDate(clearDate)) }} 기준
      <LedgerBossSum :week="week" :sum="totals.weeklyEarned + totals.monthlyEarned + totals.loot" />
    </LedgerWallet>
    <slot />
    <LedgerBossTotals :characters="roster.length" :totals="totals" @clear-all="clearAll(roster)" />
    <p class="hint-line" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>

    <div v-if="!roster.length" class="empty">
      <img src="/favicon.svg" alt="" width="44" height="44" class="deco">
      <p class="muted">{{ editable ? '주간 보스를 도는 캐릭터를 추가하고, 캐릭터를 눌러 보스를 골라 주세요.' : '이 주에는 보스 세팅도 잡은 기록도 없어요.' }}</p>
      <button type="button" class="btn" :class="{ off: !editable }" :tabindex="editable ? 0 : -1" @click="openPicker">+ 캐릭터 추가</button>
    </div>

    <ul v-else class="rows stagger">
      <!-- 같은 높이로 바꿔 끼워 주를 넘겨도 아래 줄이 움직이지 않는다 -->
      <li v-if="!editable" class="add-row">
        <p class="past">지난 주는 그 주 세팅과 잡은 기록대로 보여요. 세팅은 이번 주에서 바꿀 수 있어요.</p>
      </li>
      <li v-else-if="roster.length < MAX_BOSS_CHARACTERS" class="add-row">
        <button type="button" class="add" @click="openPicker">+ 캐릭터 추가 ({{ roster.length }}/{{ MAX_BOSS_CHARACTERS }})</button>
      </li>
      <LedgerBossRow
        v-for="r in rows"
        :key="r.character.ocid"
        :row="r"
        :characters="roster.length"
        :editable="editable"
        :first="order.indexOf(r.character.ocid) === 0"
        :last="order.indexOf(r.character.ocid) === order.length - 1"
        :open="openOcid === r.character.ocid"
        :dragging="dragOcid === r.character.ocid"
        :inflight="inflight"
        :others="roster.filter(c => c.ocid !== r.character.ocid)"
        @drag-start="startDrag($event, r.character.ocid)"
        @drag-over="dragOver(r.character.ocid)"
        @drag-drop="endDrag"
        @drag-end="endDrag"
        @move="(delta, event) => moveBy(r.character.ocid, delta, event)"
        @toggle-setup="toggleSetup(r.character.ocid)"
        @remove="removeCharacter(r.character)"
        @clear-all="clearAll([r.character])"
        @unclear-all="unclearAll(r.character)"
        @toggle="toggle(r.character, $event)"
        @loot="openLoot"
        @save="setBosses(r.character.ocid, $event)"
        @copy="(to, bosses) => copyBosses(r.character.ocid, to, bosses)"
        @close="openOcid = null"
      />
    </ul>
    <LedgerLootModal v-model="lootOpen" :clear="lootClear" :fee-rate="settings?.feeRate ?? DEFAULT_AUCTION_FEE" @saved="emit('changed')" />
    <AppModal v-model="pickerOpen" title="보스 도는 캐릭터 추가">
      <p v-if="!candidates" class="muted">캐릭터 목록을 불러오는 중이에요…</p>
      <CharacterPicker v-else :characters="candidates.filter(c => !roster.some(r => r.ocid === c.ocid))" :busy="false" @pick="addCharacter" />
    </AppModal>

  </div>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.rows {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  margin: 0;
  padding: 4px 2px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  list-style: none;
  scrollbar-width: thin;
}
.add-row {
  display: grid;
}
.add {
  min-height: 38px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease;
}
.add:hover:not(:disabled) {
  border-color: var(--gold);
  color: var(--gold);
}
.past {
  display: grid;
  place-items: center;
  min-height: 38px;
  margin: 0;
  border: 1px dashed var(--panel-line);
  border-radius: 10px;
  color: var(--sub);
  font-size: 13px;
  text-align: center;
}
.empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px 20px;
  background: var(--panel);
  border: 1px dashed var(--panel-line);
  border-radius: 10px;
  text-align: center;
}
.empty img {
  animation: bob 2s ease-in-out 1;
}
.off {
  visibility: hidden;
}
.hint-line {
  height: 18px;
  margin: -4px 0 -4px;
  overflow: hidden;
  color: var(--loss);
  font-size: 13px;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0;
}
.hint-line.show {
  opacity: 1;
}
</style>
