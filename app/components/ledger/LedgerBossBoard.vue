<script setup lang="ts">
import type { BossClear, BossPick, BossRosterCharacter, CharacterBrief } from '#shared/types'
import { MAX_BOSS_CHARACTERS, WEEKLY_BOSS_LIMIT, bossOrder, bossPeriod, crystalPrice, findBoss, type BossDifficulty } from '#shared/data/bosses'
import { clearMeso } from '#shared/calc/boss'

const props = defineProps<{ week: string, roster: BossRosterCharacter[], clears: BossClear[], feeRate: number }>()
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

function periodOf(bossId: string) {
  return findBoss(bossId)?.cycle === 'monthly' ? bossPeriod('monthly', clearDate.value) : props.week
}
function clearOf(ocid: string, bossId: string) {
  const period = periodOf(bossId)
  return clears.value.find(c => c.ocid === ocid && c.bossId === bossId && c.period === period)
}
const keyOf = (ocid: string, bossId: string) => `${ocid}:${bossId}`
const pendingClear = (c: BossRosterCharacter, pick: BossPick): BossClear => ({ bossId: pick.bossId, difficulty: pick.difficulty, party: pick.party, id: `pending-${keyOf(c.ocid, pick.bossId)}`, ocid: c.ocid, name: c.name, period: periodOf(pick.bossId), date: clearDate.value, meso: crystalPrice(pick.bossId, pick.difficulty, pick.party) ?? 0, loot: [] })

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
const sumMeso = (list: { boss: { cycle: Cycle }, clear?: BossClear }[], cycle: Cycle) => list.filter(b => b.boss.cycle === cycle).reduce((sum, b) => sum + clearMeso(b.clear!), 0)
const sumPrice = (list: (BossPick & { boss: { cycle: Cycle } })[], cycle: Cycle) => list.filter(b => b.boss.cycle === cycle).reduce((sum, b) => sum + (crystalPrice(b.bossId, b.difficulty, b.party) ?? 0), 0)

const rows = computed(() => ordered.value.map((character) => {
  const bosses = [...character.bosses]
    .sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
    .map(pick => ({ ...pick, boss: findBoss(pick.bossId)!, clear: clearOf(character.ocid, pick.bossId) }))
  const done = bosses.filter(b => b.clear)
  const weekly = bosses.filter(b => b.boss.cycle === 'weekly')
  const weeklyDone = done.filter(b => b.boss.cycle === 'weekly').length
  return {
    character,
    bosses,
    weeklyDone,
    weeklyTotal: weekly.length,
    // 월간 보스는 매주 잡는 게 아니라 주간 세팅을 다 잡았는지만 본다
    complete: weekly.length > 0 && weeklyDone === weekly.length,
    earned: done.reduce((sum, b) => sum + clearMeso(b.clear!), 0),
    // 주간은 매주, 월간은 한 달에 한 번이라 합계를 따로 낸다
    weeklyEarned: sumMeso(done, 'weekly'),
    monthlyEarned: sumMeso(done, 'monthly'),
    weeklyExpected: sumPrice(bosses, 'weekly'),
    monthlyExpected: sumPrice(bosses, 'monthly'),
  }
}))
const sumRows = (key: 'weeklyEarned' | 'weeklyExpected' | 'monthlyEarned' | 'monthlyExpected') => rows.value.reduce((s, r) => s + r[key], 0)
const totals = computed(() => ({
  weeklyEarned: sumRows('weeklyEarned'),
  weeklyExpected: sumRows('weeklyExpected'),
  monthlyEarned: sumRows('monthlyEarned'),
  monthlyExpected: sumRows('monthlyExpected'),
  complete: rows.value.length > 0 && rows.value.every(r => r.complete),
  completeCount: rows.value.filter(r => r.complete).length,
}))
// 물욕템을 판 금액이 더해지면 예상보다 많이 벌 수 있어 막대는 끝에서 멈춘다
const progress = computed(() => (totals.value.weeklyExpected ? Math.min(100, (totals.value.weeklyEarned / totals.value.weeklyExpected) * 100) : 0))

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
  if (inflight.value.has(key)) return
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
    <div class="totals">
      <span>이번 주 주간 보스 <b class="earned">{{ formatKoreanNumber(totals.weeklyEarned) }}</b></span>
      <span class="muted">/ 다 잡으면 {{ formatKoreanNumber(totals.weeklyExpected) }}</span>
      <span class="monthly-tag" :class="{ off: !totals.monthlyExpected }" title="월간 보스는 한 달에 한 번이라 주간과 따로 세요">
        {{ Number(clearDate.slice(5, 7)) }}월 월간 <b>{{ formatKoreanNumber(totals.monthlyEarned) }}</b> / {{ formatKoreanNumber(totals.monthlyExpected) }}
      </span>
      <span v-if="roster.length" class="progress-tag" :class="{ all: totals.complete }">
        {{ totals.complete ? '이번 주 전부 잡았어요 ✓' : `다 잡은 캐릭터 ${totals.completeCount}/${roster.length}` }}
      </span>
      <!-- 다 잡아도 자리는 남겨 옆 글자가 밀리지 않게 한다 -->
      <button v-if="roster.length > 1" type="button" class="btn compact all-all" :class="{ off: totals.complete }" :tabindex="totals.complete ? -1 : 0" @click="clearAll(roster)">모든 캐릭터 전부 잡음</button>
      <div class="bar"><span :style="{ width: `${progress}%` }" /></div>
    </div>
    <p class="hint-line" :class="{ show: failure }" role="alert">{{ failure || ' ' }}</p>

    <div v-if="!roster.length" class="empty">
      <img src="/favicon.svg" alt="" width="44" height="44">
      <p class="muted">주간 보스를 도는 캐릭터를 추가하고, 캐릭터를 눌러 보스를 골라 주세요.</p>
      <button type="button" class="btn" @click="openPicker">+ 캐릭터 추가</button>
    </div>

    <ul v-else class="rows stagger">
      <li v-if="roster.length < MAX_BOSS_CHARACTERS" class="add-row">
        <button type="button" class="add" @click="openPicker">+ 캐릭터 추가 ({{ roster.length }}/{{ MAX_BOSS_CHARACTERS }})</button>
      </li>
      <li
        v-for="r in rows"
        :key="r.character.ocid"
        class="row"
        :class="{ complete: r.complete, open: openOcid === r.character.ocid, dragging: dragOcid === r.character.ocid }"
        @dragover.prevent="dragOver(r.character.ocid)"
        @drop.prevent="endDrag"
      >
        <div class="who">
          <button
            v-if="roster.length > 1"
            type="button"
            class="grip"
            draggable="true"
            title="끌어서 순서 바꾸기 · 위아래 화살표로도 옮겨요"
            :aria-label="`${r.character.name} 순서 바꾸기 (위아래 화살표)`"
            @dragstart="startDrag($event, r.character.ocid)"
            @dragend="endDrag"
            @keydown.up.prevent="moveBy(r.character.ocid, -1, $event)"
            @keydown.down.prevent="moveBy(r.character.ocid, 1, $event)"
          >⠿</button>
          <!-- 터치 화면은 끌기가 안 되므로 위아래 버튼으로 옮긴다 -->
          <span v-if="roster.length > 1" class="nudge">
            <button type="button" :aria-label="`${r.character.name} 위로`" :disabled="order.indexOf(r.character.ocid) === 0" @click="moveBy(r.character.ocid, -1, $event)">▲</button>
            <button type="button" :aria-label="`${r.character.name} 아래로`" :disabled="order.indexOf(r.character.ocid) === order.length - 1" @click="moveBy(r.character.ocid, 1, $event)">▼</button>
          </span>
          <button
            type="button"
            class="who-main"
            :aria-expanded="openOcid === r.character.ocid"
            :title="`${r.character.name}의 보스 세팅 ${openOcid === r.character.ocid ? '접기' : '열기'}`"
            @click="toggleSetup(r.character.ocid)"
          >
            <CharacterThumb v-if="r.character.imageUrl" :src="r.character.imageUrl" :height="56" crop="head" class="face" />
            <span class="who-text">
              <b class="ellipsis">{{ r.character.name }} <span class="caret" aria-hidden="true">▾</span></b>
              <small class="ellipsis">{{ r.character.job }} · LV.{{ r.character.level }}</small>
              <small><span :class="{ full: r.weeklyDone >= WEEKLY_BOSS_LIMIT }">{{ r.weeklyDone }}/{{ r.weeklyTotal }}</span> · <span class="gold">{{ formatKoreanNumber(r.earned) }}</span></small>
            </span>
          </button>
          <!-- 잡음·취소를 캐릭터 칸에 세로로 쌓아 보스 칸 너비를 줄이지 않는다 -->
          <div class="acts">
            <button type="button" class="out-btn" :title="`${r.character.name}을(를) 보스 표에서 빼기`" @click="removeCharacter(r.character)">빼기</button>
            <!-- 세 칸 모두 늘 자리를 잡아 두고, 쓸 수 없을 땐 숨기기만 한다 -->
            <span v-if="r.weeklyTotal && r.complete" class="done-stamp">다 잡음</span>
            <button v-else type="button" class="all-btn" :class="{ off: !r.weeklyTotal }" :tabindex="r.weeklyTotal ? 0 : -1" :title="`${r.character.name}의 남은 주간 보스 ${r.weeklyTotal - r.weeklyDone}개를 한 번에 체크`" @click="clearAll([r.character])">
              전부 잡음
            </button>
            <button
              type="button"
              class="none-btn"
              :class="{ off: !r.weeklyDone }"
              :tabindex="r.weeklyDone ? 0 : -1"
              :title="`${r.character.name}의 이번 주 주간 보스 체크 ${r.weeklyDone}개를 한 번에 풀기`"
              @click="unclearAll(r.character)"
            >
              전부 취소
            </button>
          </div>
        </div>
        <div class="chips">
          <div
            v-for="b in r.bosses"
            :key="b.bossId"
            class="chip"
            :class="{ done: b.clear }"
            :style="{ '--diff': DIFFICULTY_COLORS[b.difficulty as BossDifficulty] }"
          >
            <button
              type="button"
              class="toggle"
              :aria-pressed="!!b.clear"
              :aria-busy="inflight.has(keyOf(r.character.ocid, b.bossId))"
              :title="`${bossLabel(b.bossId, b.difficulty)} · ${b.party}인 · ${formatKoreanNumber(crystalPrice(b.bossId, b.difficulty, b.party) ?? 0)}`"
              @click="toggle(r.character, b)"
            >
              <span class="mark">
                <LedgerBossEmblem :boss-id="b.bossId" :size="30" />
                <span class="check" aria-hidden="true">{{ b.clear ? '✓' : '' }}</span>
              </span>
              <span class="name">{{ bossLabel(b.bossId, b.difficulty) }}</span>
              <small class="price">{{ formatShortNumber(crystalPrice(b.bossId, b.difficulty, b.party) ?? 0) }}<template v-if="b.party > 1"> · {{ b.party }}인</template><template v-if="b.boss.cycle === 'monthly'"> · 월간</template></small>
            </button>
            <!-- 안 잡은 칸도 자리를 비워 두어야 체크할 때 칸 너비가 바뀌지 않는다 -->
            <button
              type="button"
              class="loot"
              :class="{ has: b.clear?.loot.length, hidden: !b.clear || b.clear.id.startsWith('pending-') }"
              :tabindex="b.clear ? 0 : -1"
              :title="b.clear?.loot.length ? b.clear.loot.map(l => l.item).join(', ') : '물욕템 기록'"
              :aria-label="`${bossLabel(b.bossId, b.difficulty)} 물욕템 기록`"
              @click="b.clear && openLoot(b.clear)"
            >
              <template v-if="b.clear?.loot.length">
                <LedgerLootIcon :item="b.clear.loot[0]!.item" :size="20" />
                <template v-if="b.clear.loot.length > 1">+{{ b.clear.loot.length - 1 }}</template>
              </template>
              <template v-else>+<span class="loot-word">물욕</span></template>
            </button>
          </div>
          <button v-if="!r.bosses.length && openOcid !== r.character.ocid" type="button" class="hint" @click="toggleSetup(r.character.ocid)">보스를 아직 안 골랐어요 · 눌러서 고르기</button>
        </div>
        <LedgerBossSetup
          v-if="openOcid === r.character.ocid"
          class="setup"
          :character="r.character"
          :others="roster.filter(c => c.ocid !== r.character.ocid)"
          @save="setBosses(r.character.ocid, $event)"
          @copy="(to, bosses) => copyBosses(r.character.ocid, to, bosses)"
          @close="openOcid = null"
        />
      </li>
    </ul>
    <LedgerLootModal v-model="lootOpen" :clear="lootClear" :fee-rate="feeRate" @saved="emit('changed')" />
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
.totals {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 15px;
}
.earned {
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
.monthly-tag {
  padding: 2px 10px;
  background: color-mix(in srgb, var(--calc) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--calc) 40%, transparent);
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
}
.monthly-tag b {
  color: var(--calc);
  font-weight: 700;
}
.bar {
  flex-basis: 100%;
  height: 8px;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 4px;
}
.bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 70%, var(--loss)), var(--gold));
  transition: width var(--normal) var(--ease-out);
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
.row {
  display: grid;
  grid-template-columns: 240px 1fr;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
  transition: border-color var(--normal) ease, box-shadow var(--normal) ease;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.grip {
  flex: none;
  margin: 0 -2px 0 -4px;
  padding: 6px 2px;
  background: none;
  border: 0;
  border-radius: 4px;
  font-family: inherit;
  color: var(--sub);
  font-size: 16px;
  line-height: 1;
  cursor: grab;
  opacity: 0.5;
  transition: opacity var(--fast) ease;
}
.row:hover .grip,
.grip:focus-visible {
  opacity: 1;
}
.row.dragging {
  opacity: 0.5;
}
.who-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: -4px;
  padding: 4px;
  background: none;
  border: 0;
  border-radius: 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--fast) ease;
}
.who-main:hover,
.row.open .who-main {
  background: color-mix(in srgb, var(--gold) 8%, transparent);
}
.caret {
  display: inline-block;
  color: var(--sub);
  font-size: 12px;
  transition: transform var(--fast) var(--ease-out), color var(--fast) ease;
}
.who-main:hover .caret {
  color: var(--gold);
}
.row.open .caret {
  color: var(--gold);
  transform: rotate(180deg);
}
.setup {
  grid-column: 1 / -1;
  margin: 2px -12px -8px;
}
.row.open {
  border-color: var(--gold);
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
.hint {
  padding: 6px 10px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.hint:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.face {
  flex: none;
  width: 56px;
  background: var(--bar);
  border-radius: 8px;
}
.who-text {
  display: grid;
  min-width: 0;
  line-height: 1.35;
}
.who-text b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.who-text small {
  color: var(--sub);
  font-size: 12px;
}
.full {
  color: var(--gain);
}
.gold {
  color: var(--gold);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: flex;
  align-items: stretch;
  min-width: 112px;
  overflow: hidden;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--diff);
  border-radius: 8px;
  color: var(--sub);
  transition: transform var(--fast) var(--ease-spring), background var(--fast) ease, border-color var(--fast) ease, color var(--fast) ease;
}
.chip:hover {
  transform: translateY(-2px);
  border-color: var(--tip-line);
  border-left-color: var(--diff);
}
.chip.done {
  background: color-mix(in srgb, var(--diff) 18%, var(--bar));
  border-color: var(--diff);
  color: var(--text);
}
.toggle {
  display: grid;
  flex: 1;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 6px;
  padding: 4px 10px 4px 6px;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.toggle[aria-busy="true"] {
  cursor: progress;
}
.loot {
  padding: 0 8px;
  background: rgb(0 0 0 / 0.2);
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--diff) 40%, transparent);
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--fast) ease, background var(--fast) ease;
}
.loot:hover {
  background: rgb(0 0 0 / 0.35);
  color: var(--text);
}
.loot.has {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--gold);
}
.loot.hidden {
  visibility: hidden;
}
.row.complete {
  border-color: var(--gain);
  box-shadow: inset 4px 0 0 var(--gain), 0 0 14px color-mix(in srgb, var(--gain) 15%, transparent);
}
.done-stamp {
  white-space: nowrap;
  padding: 2px 8px;
  border: 2px solid var(--gain);
  border-radius: 6px;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 13px;
  transform: rotate(-8deg);
  animation: stamp 0.35s var(--ease-spring);
}
@keyframes stamp {
  from { opacity: 0; transform: rotate(-8deg) scale(1.8); }
}
.all-btn {
  padding: 4px 10px;
  background: color-mix(in srgb, var(--gain) 12%, transparent);
  border: 1px solid var(--gain);
  border-radius: 6px;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--fast) ease, transform var(--fast) var(--ease-out);
}
/* 캐릭터마다 버튼 수가 달라도 빼기 크기가 같게 칸 너비를 고정한다 */
.acts {
  display: grid;
  flex: none;
  width: 68px;
  justify-items: stretch;
  gap: 4px;
  margin-left: auto;
  text-align: center;
}
.out-btn {
  padding: 2px 10px;
  background: none;
  border: 1px solid var(--panel-line);
  border-radius: 6px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--fast) ease, border-color var(--fast) ease;
}
.out-btn:hover:not(:disabled) {
  border-color: var(--loss);
  color: var(--loss);
}
.none-btn {
  padding: 3px 10px;
  background: color-mix(in srgb, var(--loss) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--loss) 60%, transparent);
  border-radius: 6px;
  color: var(--loss);
  font-family: var(--f-title);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--fast) ease, transform var(--fast) var(--ease-out);
}
.none-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--loss) 20%, transparent);
  transform: translateY(-1px);
}
.all-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--gain) 25%, transparent);
  transform: translateY(-1px);
}
.progress-tag {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
}
.progress-tag.all {
  border-color: var(--gain);
  color: var(--gain);
}
.mark {
  position: relative;
  grid-row: span 2;
}
.chip:not(.done) .mark {
  opacity: 0.55;
  filter: grayscale(0.6);
}
.check {
  position: absolute;
  right: -5px;
  bottom: -4px;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: var(--bar);
  font-size: 11px;
  font-weight: 700;
}
.chip.done .check {
  background: var(--diff);
  box-shadow: 0 0 0 2px var(--bar);
  animation: pop 0.3s var(--ease-spring);
}
@keyframes pop {
  from { transform: scale(0.4); }
}
.name {
  font-family: var(--f-title);
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
}
.price {
  font-size: 11px;
  line-height: 1.2;
}
.chip.done .price {
  color: var(--gold);
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
  animation: bob 2.4s ease-in-out infinite;
}
/* 쓸 수 없는 버튼·표시도 자리는 남긴다 */
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
@media (max-width: 700px) {
  .row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 8px 10px;
  }
  .setup {
    margin: 2px -10px -8px;
  }
  .face {
    width: 44px;
  }
  .who-text b {
    font-size: 16px;
  }
  .chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }
  .chip {
    min-width: 0;
  }
  .chip:hover {
    transform: none;
  }
  .toggle {
    min-width: 0;
    padding: 4px 6px 4px 5px;
    column-gap: 5px;
  }
  .name,
  .price {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    font-size: 13px;
  }
  /* 물욕 칸은 + 만 남겨 보스 이름 자리를 넓힌다 */
  .loot {
    min-width: 26px;
    padding: 0 4px;
    font-size: 13px;
  }
  .loot-word {
    display: none;
  }
  .hint {
    grid-column: 1 / -1;
  }
  .totals {
    font-size: 14px;
  }
  .earned {
    font-size: 21px;
  }
  .progress-tag {
    margin-left: 0;
  }
  .all-all {
    width: 100%;
  }
}
.nudge {
  display: none;
}
@media (pointer: coarse) {
  .grip {
    display: none;
  }
  .nudge {
    display: grid;
    flex: none;
    gap: 4px;
  }
  .nudge button {
    width: 30px;
    height: 26px;
    padding: 0;
    background: var(--bar);
    border: 1px solid var(--panel-line);
    border-radius: 6px;
    color: var(--sub);
    font-size: 11px;
    cursor: pointer;
  }
  .nudge button:disabled {
    opacity: 0.3;
    cursor: default;
  }
}
</style>
