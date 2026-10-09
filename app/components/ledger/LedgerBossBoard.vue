<script setup lang="ts">
import type { BossClear, BossPick, BossRosterCharacter, CharacterBrief } from '#shared/types'
import { MAX_BOSS_CHARACTERS, WEEKLY_BOSS_LIMIT, bossOrder, bossPeriod, crystalPrice, findBoss, type BossDifficulty } from '#shared/data/bosses'

const props = defineProps<{ week: string, roster: BossRosterCharacter[], clears: BossClear[], feeRate: number }>()
const emit = defineEmits<{ changed: [] }>()

const today = kstToday()
// 지난 주를 체크하면 그 주 마지막 날(수요일)에 잡은 걸로 남긴다
const clearDate = computed(() => {
  const end = addDays(props.week, 6)
  return end < today ? end : today
})
const busy = ref<string | null>(null)
const failure = ref('')

// 누르자마자 화면에 반영하고 서버 응답은 뒤에서 맞춘다. 응답을 기다리면 숫자와 칸이 한 박자 늦게 출렁인다
const clears = ref<BossClear[]>([...props.clears])
watch(() => props.clears, (value) => {
  clears.value = [...value]
})

function periodOf(bossId: string) {
  return findBoss(bossId)?.cycle === 'monthly' ? bossPeriod('monthly', clearDate.value) : props.week
}
function clearOf(ocid: string, bossId: string) {
  const period = periodOf(bossId)
  return clears.value.find(c => c.ocid === ocid && c.bossId === bossId && c.period === period)
}

const rows = computed(() => props.roster.map((character) => {
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
    expected: bosses.reduce((sum, b) => sum + (crystalPrice(b.bossId, b.difficulty, b.party) ?? 0), 0),
  }
}))
const totals = computed(() => ({
  earned: rows.value.reduce((s, r) => s + r.earned, 0),
  expected: rows.value.reduce((s, r) => s + r.expected, 0),
  complete: rows.value.length > 0 && rows.value.every(r => r.complete),
  completeCount: rows.value.filter(r => r.complete).length,
}))

// 세팅한 주간 보스 중 아직 안 잡은 것을 한 번에 체크한다. 화면에 먼저 반영하고 서버에 한 번만 보낸다
async function clearAll(characters: BossRosterCharacter[]) {
  const key = characters.length === 1 ? `all:${characters[0]!.ocid}` : 'all'
  if (busy.value) return
  busy.value = key
  failure.value = ''
  const before = clears.value
  const pending = characters.flatMap(c => c.bosses
    .filter(pick => findBoss(pick.bossId)?.cycle === 'weekly' && !clearOf(c.ocid, pick.bossId))
    .map(pick => ({ ...pick, id: `pending-${c.ocid}:${pick.bossId}`, ocid: c.ocid, name: c.name, period: props.week, date: clearDate.value, meso: crystalPrice(pick.bossId, pick.difficulty, pick.party) ?? 0, loot: [] })))
  if (!pending.length) {
    busy.value = null
    return
  }
  clears.value = [...before, ...pending]
  try {
    await $fetch('/api/ledger/clears/bulk', { method: 'POST', body: { date: clearDate.value, ...(characters.length === 1 && { ocid: characters[0]!.ocid }) } })
    emit('changed')
  }
  catch (error) {
    clears.value = before
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = null
  }
}

// 그 주 주간 보스 체크를 한 번에 푼다. 물욕템을 적어 둔 기록도 같이 지워지므로 그때만 한 번 묻는다
async function unclearAll(character: BossRosterCharacter) {
  const key = `none:${character.ocid}`
  if (busy.value) return
  const weekly = clears.value.filter(c => c.ocid === character.ocid && c.period === props.week)
  if (!weekly.length) return
  if (weekly.some(c => c.loot.length) && !confirm(`${character.name}의 이번 주 체크를 모두 풀까요? 적어 둔 물욕템 기록도 같이 지워져요.`)) return
  busy.value = key
  failure.value = ''
  const before = clears.value
  clears.value = before.filter(c => !weekly.includes(c))
  try {
    await $fetch('/api/ledger/weekly-clears', { method: 'DELETE', body: { ocid: character.ocid, week: props.week } })
    emit('changed')
  }
  catch (error) {
    clears.value = before
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = null
  }
}

const lootOpen = ref(false)
const lootClear = ref<BossClear | null>(null)
function openLoot(clear: BossClear) {
  lootClear.value = clear
  lootOpen.value = true
}

async function toggle(character: BossRosterCharacter, pick: { bossId: string, difficulty: string, party: number }) {
  const key = `${character.ocid}:${pick.bossId}`
  if (busy.value === key) return
  busy.value = key
  failure.value = ''
  const before = clears.value
  const clear = clearOf(character.ocid, pick.bossId)
  try {
    if (clear) {
      clears.value = before.filter(c => c.id !== clear.id)
      await $fetch(`/api/ledger/clears/${clear.id}`, { method: 'DELETE' })
    }
    else {
      const meso = crystalPrice(pick.bossId, pick.difficulty, pick.party) ?? 0
      clears.value = [...before, { ...pick, id: `pending-${key}`, ocid: character.ocid, name: character.name, period: periodOf(pick.bossId), date: clearDate.value, meso, loot: [] }]
      await $fetch('/api/ledger/clears', { method: 'POST', body: { ocid: character.ocid, bossId: pick.bossId, date: clearDate.value } })
    }
    emit('changed')
  }
  catch (error) {
    clears.value = before
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = null
  }
}

// 캐릭터를 누르면 그 줄 아래로 보스 세팅이 펼쳐진다. 고친 목록은 통째로 저장한다
const openOcid = ref<string | null>(null)
const toggleSetup = (ocid: string) => {
  openOcid.value = openOcid.value === ocid ? null : ocid
}
async function saveRoster(characters: BossRosterCharacter[]) {
  busy.value = 'roster'
  failure.value = ''
  try {
    await $fetch('/api/ledger/roster', { method: 'PUT', body: { characters } })
    emit('changed')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = null
  }
}
const setBosses = (ocid: string, bosses: BossPick[]) => saveRoster(props.roster.map(c => (c.ocid === ocid ? { ...c, bosses } : c)))
// 복사할 땐 보고 있던 캐릭터의 고친 세팅도 같이 저장해야 다시 불러올 때 사라지지 않는다
const copyBosses = (from: string, to: string, bosses: BossPick[]) => saveRoster(props.roster.map(c => (c.ocid === from || c.ocid === to ? { ...c, bosses: structuredClone(bosses) } : c)))
async function removeCharacter(ocid: string) {
  openOcid.value = null
  await saveRoster(props.roster.filter(c => c.ocid !== ocid))
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
async function addCharacter(ocid: string) {
  const c = candidates.value?.find(x => x.ocid === ocid)
  if (!c || props.roster.some(r => r.ocid === ocid)) return
  pickerOpen.value = false
  await saveRoster([...props.roster, { ...c, imageUrl: null, bosses: [] }])
  // 막 추가한 캐릭터는 바로 보스를 고르게 펼쳐 둔다
  openOcid.value = ocid
}
</script>

<template>
  <div class="board">
    <div class="totals">
      <span>이번 주 보스 수입 <b class="earned">{{ formatKoreanNumber(totals.earned) }}</b></span>
      <span class="muted">/ 세팅대로 다 잡으면 {{ formatKoreanNumber(totals.expected) }}</span>
      <span v-if="roster.length" class="progress-tag" :class="{ all: totals.complete }">
        {{ totals.complete ? '이번 주 전부 잡았어요 ✓' : `다 잡은 캐릭터 ${totals.completeCount}/${roster.length}` }}
      </span>
      <button v-if="roster.length > 1 && !totals.complete" type="button" class="btn compact" :disabled="!!busy" @click="clearAll(roster)">모든 캐릭터 전부 잡음</button>
      <div class="bar"><span :style="{ width: `${totals.expected ? (totals.earned / totals.expected) * 100 : 0}%` }" /></div>
    </div>
    <p v-if="failure" class="form-error">{{ failure }}</p>

    <div v-if="!roster.length" class="empty">
      <img src="/favicon.svg" alt="" width="44" height="44">
      <p class="muted">주간 보스를 도는 캐릭터를 추가하고, 캐릭터를 눌러 보스를 골라 주세요.</p>
      <button type="button" class="btn" :disabled="!!busy" @click="openPicker">+ 캐릭터 추가</button>
    </div>

    <ul v-else class="rows stagger">
      <li v-if="roster.length < MAX_BOSS_CHARACTERS" class="add-row">
        <button type="button" class="add" :disabled="!!busy" @click="openPicker">+ 캐릭터 추가 ({{ roster.length }}/{{ MAX_BOSS_CHARACTERS }})</button>
      </li>
      <li v-for="r in rows" :key="r.character.ocid" class="row" :class="{ complete: r.complete, open: openOcid === r.character.ocid }">
        <div class="who">
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
              <small><span :class="{ full: r.weeklyDone >= WEEKLY_BOSS_LIMIT }">{{ r.weeklyDone }}/{{ r.weeklyTotal }}</span> · <span class="gold">{{ formatShortNumber(r.earned) }}</span></small>
            </span>
          </button>
          <!-- 잡음·취소를 캐릭터 칸에 세로로 쌓아 보스 칸 너비를 줄이지 않는다 -->
          <div v-if="r.weeklyTotal" class="acts">
            <span v-if="r.complete" class="done-stamp">다 잡음</span>
            <button v-else type="button" class="all-btn" :disabled="!!busy" :title="`${r.character.name}의 남은 주간 보스 ${r.weeklyTotal - r.weeklyDone}개를 한 번에 체크`" @click="clearAll([r.character])">
              전부 잡음
            </button>
            <button
              v-if="r.weeklyDone"
              type="button"
              class="none-btn"
              :disabled="!!busy"
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
            :class="{ done: b.clear, monthly: b.boss.cycle === 'monthly' }"
            :style="{ '--diff': DIFFICULTY_COLORS[b.difficulty as BossDifficulty] }"
          >
            <button
              type="button"
              class="toggle"
              :aria-pressed="!!b.clear"
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
              <template v-else>+물욕</template>
            </button>
          </div>
          <button v-if="!r.bosses.length && openOcid !== r.character.ocid" type="button" class="hint" @click="toggleSetup(r.character.ocid)">보스를 아직 안 골랐어요 · 눌러서 고르기</button>
        </div>
        <LedgerBossSetup
          v-if="openOcid === r.character.ocid"
          class="setup"
          :character="r.character"
          :others="roster.filter(c => c.ocid !== r.character.ocid)"
          :busy="!!busy"
          @save="setBosses(r.character.ocid, $event)"
          @copy="(to, bosses) => copyBosses(r.character.ocid, to, bosses)"
          @remove="removeCharacter(r.character.ocid)"
          @close="openOcid = null"
        />
      </li>
    </ul>
    <LedgerLootModal v-model="lootOpen" :clear="lootClear" :fee-rate="feeRate" @saved="emit('changed')" />
    <AppModal v-model="pickerOpen" title="보스 도는 캐릭터 추가">
      <p v-if="!candidates" class="muted">캐릭터 목록을 불러오는 중이에요…</p>
      <CharacterPicker v-else :characters="candidates.filter(c => !roster.some(r => r.ocid === c.ocid))" :busy="!!busy" @pick="addCharacter" />
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
  background: linear-gradient(90deg, #ffb347, var(--gold));
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
  background: rgb(242 193 78 / 0.08);
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
.toggle:disabled {
  cursor: wait;
  opacity: 0.6;
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
  color: #ffd36b;
}
.loot.hidden {
  visibility: hidden;
}
.row.complete {
  border-color: var(--gain);
  box-shadow: inset 4px 0 0 var(--gain), 0 0 14px rgb(127 217 154 / 0.15);
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
  background: rgb(127 217 154 / 0.12);
  border: 1px solid var(--gain);
  border-radius: 6px;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--fast) ease, transform var(--fast) var(--ease-out);
}
.acts {
  display: grid;
  flex: none;
  justify-items: stretch;
  gap: 4px;
  margin-left: auto;
  text-align: center;
}
.none-btn {
  padding: 3px 10px;
  background: rgb(255 138 122 / 0.08);
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
  background: rgb(255 138 122 / 0.2);
  transform: translateY(-1px);
}
.none-btn:disabled {
  cursor: wait;
  opacity: 0.5;
}
.all-btn:hover:not(:disabled) {
  background: rgb(127 217 154 / 0.25);
  transform: translateY(-1px);
}
.all-btn:disabled {
  cursor: wait;
  opacity: 0.5;
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
@media (max-width: 700px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
