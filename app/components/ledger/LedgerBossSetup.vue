<script setup lang="ts">
import type { BossPick, BossRosterCharacter } from '#shared/types'
import { BOSSES, BOSS_PRICE_DATE, MAX_PARTY, WEEKLY_BOSS_LIMIT, bossOrder, crystalPrice, findBoss, type BossInfo } from '#shared/data/bosses'

// 주간 보스 표에서 캐릭터를 누르면 그 줄 아래로 펼쳐지는 보스 세팅
const props = defineProps<{ character: BossRosterCharacter, others: BossRosterCharacter[], busy: boolean }>()
const emit = defineEmits<{ save: [bosses: BossPick[]], copy: [ocid: string, bosses: BossPick[]], remove: [], close: [] }>()

const bosses = ref<BossPick[]>(structuredClone(toRaw(props.character.bosses)))
// 보스를 체크할 때도 표를 새로 받으므로, 저장된 세팅이 실제로 바뀐 때만 고치던 내용을 덮는다
watch(() => JSON.stringify(props.character.bosses), (value) => {
  bosses.value = JSON.parse(value)
})
const dirty = computed(() => JSON.stringify(bosses.value) !== JSON.stringify(props.character.bosses))

const COLUMNS = 3
const WEEKLY = BOSSES.filter(b => b.cycle === 'weekly')
const MONTHLY = BOSSES.filter(b => b.cycle === 'monthly')

const pickOf = (bossId: string) => bosses.value.find(b => b.bossId === bossId)
const weeklyCount = computed(() => bosses.value.filter(b => findBoss(b.bossId)?.cycle === 'weekly').length)
const expected = computed(() => bosses.value.reduce((sum, b) => sum + (crystalPrice(b.bossId, b.difficulty, b.party) ?? 0), 0))
const full = computed(() => weeklyCount.value >= WEEKLY_BOSS_LIMIT)
// 12개를 다 고르면 안 고른 주간 보스는 잠가서 더 못 고르게 한다
const locked = (boss: BossInfo) => boss.cycle === 'weekly' && full.value && !pickOf(boss.id)

function setDifficulty(boss: BossInfo, difficulty: string) {
  if (locked(boss)) return
  const current = pickOf(boss.id)
  if (current?.difficulty === difficulty) bosses.value = bosses.value.filter(b => b.bossId !== boss.id)
  else if (current) current.difficulty = difficulty
  else bosses.value = [...bosses.value, { bossId: boss.id, difficulty, party: 1 }].sort((a, b) => bossOrder(a.bossId) - bossOrder(b.bossId))
}
function setParty(bossId: string, delta: number) {
  const pick = pickOf(bossId)
  if (pick) pick.party = Math.min(MAX_PARTY, Math.max(1, pick.party + delta))
}
function copyTo(select: HTMLSelectElement) {
  if (select.value) emit('copy', select.value, structuredClone(toRaw(bosses.value)))
  select.value = ''
}
function remove() {
  if (confirm(`${props.character.name}을(를) 보스 표에서 뺄까요? 이미 체크한 기록은 가계부에 그대로 남아요.`)) emit('remove')
}
</script>

<template>
  <div class="setup">
    <div class="head">
      <h3>{{ character.name }}의 보스 세팅</h3>
      <span class="muted">주간 <b :class="{ full }">{{ weeklyCount }}/{{ WEEKLY_BOSS_LIMIT }}</b> · 다 잡으면 <b class="gold">{{ formatKoreanNumber(expected) }}</b></span>
      <span class="footnote">결정석 {{ BOSS_PRICE_DATE }} 기준 · 같은 난이도를 다시 누르면 빠져요</span>
      <div class="actions">
        <select v-if="others.length" class="field-input" aria-label="이 세팅 복사하기" :disabled="busy" @change="copyTo($event.target as HTMLSelectElement)">
          <option value="">이 세팅 복사하기…</option>
          <option v-for="c in others" :key="c.ocid" :value="c.ocid">{{ c.name }}에게</option>
        </select>
        <button type="button" class="btn ghost compact danger" :disabled="busy" @click="remove">캐릭터 빼기</button>
        <button type="button" class="btn ghost compact" @click="emit('close')">닫기</button>
        <button type="button" class="btn compact" :disabled="busy || !dirty" @click="emit('save', bosses)">{{ dirty ? '세팅 저장' : '저장됨' }}</button>
      </div>
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
    <div class="monthly">
      <div class="monthly-head">
        <h4>월간 보스</h4>
        <small class="muted">주간 12개와 따로 세요</small>
      </div>
      <LedgerBossPick
        v-for="boss in MONTHLY"
        :key="boss.id"
        :boss="boss"
        :pick="pickOf(boss.id)"
        @difficulty="setDifficulty(boss, $event)"
        @party="setParty(boss.id, $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.setup {
  display: grid;
  gap: 6px;
  padding: 10px 12px 12px;
  background: rgb(10 12 22 / 0.55);
  border: 1px solid var(--panel-line);
  border-top: 2px solid var(--gold);
  border-radius: 0 0 10px 10px;
  animation: rise-in 0.2s var(--ease-out);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
h4 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 15px;
  font-weight: 400;
}
.head b {
  font-weight: 400;
}
.full {
  color: var(--gain);
}
.gold {
  color: var(--gold);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.actions select {
  width: 170px;
  min-height: 34px;
  padding: 0 8px;
  font-size: 13px;
}
.danger:hover:not(:disabled) {
  border-color: var(--loss);
  color: var(--loss);
}
/* 왼쪽 열 위에서부터 센 보스, 오른쪽 열로 넘어가며 약한 보스가 오도록 세로로 채운다 */
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(var(--rows), auto);
  grid-auto-flow: column;
  gap: 3px 10px;
}
/* 제목 줄 아래에 카드를 두고, 카드는 주간 칸 하나와 같은 너비로 맞춘다 */
.monthly {
  display: grid;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px dashed var(--panel-line);
}
.monthly-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.monthly-head small {
  font-size: 12px;
}
.monthly > :deep(.card) {
  width: calc((100% - 20px) / 3);
}
@media (max-width: 1000px) {
  .cards {
    grid-template-columns: 1fr;
    grid-auto-flow: row;
    grid-template-rows: none;
  }
  .monthly > :deep(.card) {
    width: auto;
  }
}
</style>
