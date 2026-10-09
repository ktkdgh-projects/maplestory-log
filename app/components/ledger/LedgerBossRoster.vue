<script setup lang="ts">
import type { BossPick, BossRosterCharacter, CharacterBrief } from '#shared/types'
import { BOSSES, BOSS_PRICE_DATE, MAX_BOSS_CHARACTERS, MAX_PARTY, WEEKLY_BOSS_LIMIT, bossOrder, crystalPrice, findBoss, type BossInfo } from '#shared/data/bosses'

const props = defineProps<{ roster: BossRosterCharacter[] }>()
const emit = defineEmits<{ saved: [] }>()

const draft = ref<BossRosterCharacter[]>(structuredClone(toRaw(props.roster)))
const activeOcid = ref(draft.value[0]?.ocid ?? null)
// 저장하면 서버가 이미지 등을 채운 목록을 다시 내려주므로 그걸 새 기준으로 삼는다
watch(() => props.roster, (roster) => {
  draft.value = structuredClone(toRaw(roster))
  if (!draft.value.some(c => c.ocid === activeOcid.value)) activeOcid.value = draft.value[0]?.ocid ?? null
})
const active = computed(() => draft.value.find(c => c.ocid === activeOcid.value) ?? null)
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.roster))

const candidates = ref<CharacterBrief[] | null>(null)
const picking = ref(false)
const busy = ref(false)
const failure = ref('')
const notice = ref('')

async function openPicker() {
  picking.value = true
  failure.value = ''
  candidates.value ??= await $fetch<CharacterBrief[]>('/api/me/characters').catch((error) => {
    failure.value = errorMessage(error)
    return null
  })
}
function addCharacter(ocid: string) {
  const c = candidates.value?.find(x => x.ocid === ocid)
  if (!c || draft.value.some(d => d.ocid === ocid)) return
  draft.value.push({ ...c, imageUrl: null, bosses: [] })
  activeOcid.value = ocid
  picking.value = false
}
function removeCharacter(ocid: string) {
  draft.value = draft.value.filter(c => c.ocid !== ocid)
  if (activeOcid.value === ocid) activeOcid.value = draft.value[0]?.ocid ?? null
}

const COLUMNS = 3
const WEEKLY = BOSSES.filter(b => b.cycle === 'weekly')
const MONTHLY = BOSSES.filter(b => b.cycle === 'monthly')

const pickOf = (bossId: string) => active.value?.bosses.find(b => b.bossId === bossId)
const weeklyCount = (bosses: BossPick[]) => bosses.filter(b => findBoss(b.bossId)?.cycle === 'weekly').length
const expected = (bosses: BossPick[]) => bosses.reduce((sum, b) => sum + (crystalPrice(b.bossId, b.difficulty, b.party) ?? 0), 0)
const full = computed(() => !!active.value && weeklyCount(active.value.bosses) >= WEEKLY_BOSS_LIMIT)
// 12개를 다 고르면 안 고른 주간 보스는 잠가서 더 못 고르게 한다
const locked = (boss: BossInfo) => boss.cycle === 'weekly' && full.value && !pickOf(boss.id)

function setDifficulty(boss: BossInfo, difficulty: string) {
  const c = active.value
  if (!c || locked(boss)) return
  const current = pickOf(boss.id)
  if (current?.difficulty === difficulty) c.bosses = c.bosses.filter(b => b.bossId !== boss.id)
  else if (current) current.difficulty = difficulty
  else c.bosses = [...c.bosses, { bossId: boss.id, difficulty, party: 1 }].sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
}
function setParty(bossId: string, delta: number) {
  const pick = pickOf(bossId)
  if (pick) pick.party = Math.min(MAX_PARTY, Math.max(1, pick.party + delta))
}
function copyTo(ocid: string) {
  const target = draft.value.find(c => c.ocid === ocid)
  if (target && active.value) target.bosses = structuredClone(toRaw(active.value.bosses))
  notice.value = `${target?.name}에 같은 세팅을 넣었어요.`
}

async function save() {
  busy.value = true
  failure.value = ''
  notice.value = ''
  try {
    await $fetch('/api/ledger/roster', { method: 'PUT', body: { characters: draft.value } })
    notice.value = '보스 세팅을 저장했어요.'
    emit('saved')
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="editor">
    <aside class="side">
      <!-- 캐릭터가 늘어도 아래 월간 보스·저장 버튼이 밀리지 않게 목록만 따로 스크롤한다 -->
      <div class="members">
        <ul class="roster">
          <li v-for="c in draft" :key="c.ocid">
            <button type="button" class="member" :class="{ on: c.ocid === activeOcid }" @click="activeOcid = c.ocid">
              <b class="ellipsis">{{ c.name }}</b>
              <small>{{ weeklyCount(c.bosses) }}/{{ WEEKLY_BOSS_LIMIT }} · {{ formatShortNumber(expected(c.bosses)) }}</small>
            </button>
            <button type="button" class="remove" :aria-label="`${c.name} 빼기`" @click="removeCharacter(c.ocid)">×</button>
          </li>
        </ul>
        <button v-if="draft.length < MAX_BOSS_CHARACTERS" type="button" class="add" @click="picking ? (picking = false) : openPicker()">
          {{ picking ? '닫기' : `+ 캐릭터 추가 (${draft.length}/${MAX_BOSS_CHARACTERS})` }}
        </button>
      </div>
      <div class="monthly" :class="{ idle: !active || picking }">
        <h4>월간 보스 <small class="muted">12개와 따로 세요</small></h4>
        <LedgerBossPick
          v-for="boss in MONTHLY"
          :key="boss.id"
          :boss="boss"
          :pick="pickOf(boss.id)"
          :locked="!active || picking"
          @difficulty="setDifficulty(boss, $event)"
          @party="setParty(boss.id, $event)"
        />
      </div>
      <div class="save">
        <p v-if="notice" class="notice">{{ notice }}</p>
        <button type="button" class="btn" :disabled="busy || !dirty" @click="save">{{ dirty ? '세팅 저장' : '저장됨' }}</button>
      </div>
    </aside>

    <section class="main">
      <p v-if="failure" class="form-error">{{ failure }}</p>
      <div v-if="picking" class="picker">
        <p v-if="!candidates" class="muted">캐릭터 목록을 불러오는 중이에요…</p>
        <CharacterPicker v-else :characters="candidates.filter(c => !draft.some(d => d.ocid === c.ocid))" @pick="addCharacter" />
      </div>
      <template v-else-if="active">
        <div class="main-head">
          <h3>{{ active.name }}의 보스</h3>
          <span class="muted">주간 {{ weeklyCount(active.bosses) }}/{{ WEEKLY_BOSS_LIMIT }} · 다 잡으면 <b class="gold">{{ formatKoreanNumber(expected(active.bosses)) }}</b></span>
          <label v-if="draft.length > 1" class="copy">
            <span class="sr-only">세팅 복사</span>
            <select class="field-input" @change="copyTo(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
              <option value="">이 세팅 복사하기…</option>
              <option v-for="c in draft.filter(d => d.ocid !== active!.ocid)" :key="c.ocid" :value="c.ocid">{{ c.name }}에게</option>
            </select>
          </label>
        </div>
        <div class="group-head">
          <h4>주간 보스</h4>
          <span class="muted" :class="{ full }">{{ weeklyCount(active.bosses) }}/{{ WEEKLY_BOSS_LIMIT }}<template v-if="full"> · 다 골랐어요</template></span>
          <span class="footnote">결정석 가격 {{ BOSS_PRICE_DATE }} 기준 · 같은 난이도를 다시 누르면 빠져요 · 파티는 인원수로 나눠요</span>
        </div>
        <div class="cards" :style="{ '--rows': Math.ceil(WEEKLY.length / COLUMNS) }">
          <LedgerBossPick
            v-for="boss in WEEKLY"
            :key="boss.id"
            :boss="boss"
            :pick="pickOf(boss.id)"
            :locked="locked(boss)"
            @difficulty="setDifficulty(boss, $event)"
            @party="setParty(boss.id, $event)"
          />
        </div>
      </template>
      <p v-else class="muted">왼쪽에서 캐릭터를 추가해 주세요.</p>
    </section>
  </div>
</template>

<style scoped>
.editor {
  display: grid;
  flex: 1;
  grid-template-columns: 220px 1fr;
  gap: 14px;
  min-height: 0;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.members {
  display: grid;
  flex: 1;
  align-content: start;
  gap: 8px;
  min-height: 0;
  padding: 2px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}
.roster {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.roster li {
  display: flex;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.member {
  display: grid;
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  background: none;
  border: 0;
  border-left: 3px solid transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.member.on {
  background: rgb(242 193 78 / 0.1);
  border-left-color: var(--gold);
}
.member b {
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.member small {
  color: var(--sub);
  font-size: 12px;
}
.remove {
  padding: 0 10px;
  background: none;
  border: 0;
  border-left: 1px solid var(--panel-line);
  color: var(--sub);
  cursor: pointer;
}
.remove:hover {
  color: var(--loss);
}
.add {
  min-height: 40px;
  background: none;
  border: 1px dashed var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}
.add:hover {
  border-color: var(--gold);
  color: var(--gold);
}
.save {
  display: grid;
  flex: none;
  gap: 6px;
}
.notice {
  margin: 0;
  color: var(--gain);
  font-size: 13px;
}
.main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.main-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 19px;
  font-weight: 400;
}
.gold {
  color: var(--gold);
  font-weight: 400;
}
.copy {
  margin-left: auto;
}
.copy select {
  min-height: 34px;
  padding: 0 8px;
  font-size: 13px;
}
.group-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
h4 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.group-head .full {
  color: var(--gain);
}
.group-head .footnote {
  margin-left: auto;
}
/* 왼쪽 열 위에서부터 센 보스, 오른쪽 열로 넘어가며 약한 보스가 오도록 세로로 채운다 */
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(var(--rows), auto);
  grid-auto-flow: column;
  gap: 6px 10px;
}
.monthly {
  display: grid;
  flex: none;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px dashed var(--panel-line);
}
.monthly.idle {
  opacity: 0.5;
}
.monthly small {
  font-size: 12px;
}
/* 좁은 옆 칸에서는 가격·인원을 아래 줄로 내린다 */
.monthly :deep(.card) {
  flex-wrap: wrap;
}
.monthly :deep(.info) {
  display: flex;
  flex-basis: 100%;
  align-items: center;
  justify-content: space-between;
  padding-left: 46px;
}
.picker {
  min-height: 0;
  overflow-y: auto;
}
@media (max-width: 1000px) {
  .editor,
  .cards {
    grid-template-columns: 1fr;
  }
  .cards {
    grid-auto-flow: row;
    grid-template-rows: none;
  }
}
</style>
