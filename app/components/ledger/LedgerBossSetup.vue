<script setup lang="ts">
import type { BossPick, BossRosterCharacter } from '#shared/types'
import { BOSSES, BOSS_PRICE_DATE, MAX_PARTY, WEEKLY_BOSS_LIMIT, bossOrder, crystalPrice, findBoss, type BossInfo } from '#shared/data/bosses'

const props = defineProps<{ character: BossRosterCharacter, others: BossRosterCharacter[] }>()
const emit = defineEmits<{ save: [bosses: BossPick[]], copy: [ocid: string, bosses: BossPick[]], close: [] }>()

// 반응형 항목이 섞이면 structuredClone이 실패해 저장이 멈추므로 JSON으로 복사한다
const copyPicks = (list: BossPick[]): BossPick[] => JSON.parse(JSON.stringify(list))
const bosses = ref<BossPick[]>(copyPicks(props.character.bosses))
const SAVE_DELAY_MS = 600

// 연달아 고르면 마지막 것만 잠시 뒤 저장한다
let timer: ReturnType<typeof setTimeout> | null = null
let sent: string | null = null
function flush() {
  if (!timer) return
  clearTimeout(timer)
  timer = null
  sent = JSON.stringify(bosses.value)
  emit('save', copyPicks(bosses.value))
}
watch(bosses, () => {
  if (JSON.stringify(bosses.value) === JSON.stringify(props.character.bosses)) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, SAVE_DELAY_MS)
}, { deep: true })
// 체크할 때도 표를 새로 받으므로 세팅이 실제로 바뀐 때만 덮고, 내가 보낸 저장이 돌아온 거면 그사이 고친 걸 지키려고 덮지 않는다
watch(() => JSON.stringify(props.character.bosses), (value) => {
  if (value === sent) {
    sent = null
    return
  }
  if (!timer) bosses.value = JSON.parse(value)
})
onBeforeUnmount(flush)

const root = ref<HTMLElement | null>(null)
function outside(event: MouseEvent) {
  const target = event.target as HTMLElement
  // 캐릭터 이름 칸은 표가 열고 닫기를 직접 처리한다
  if (root.value?.contains(target) || target.closest('.modal, .backdrop, .who-main')) return
  emit('close')
}
onMounted(() => setTimeout(() => window.addEventListener('click', outside)))
onBeforeUnmount(() => window.removeEventListener('click', outside))

const COLUMNS = 3
const WEEKLY = BOSSES.filter(b => b.cycle === 'weekly')
const MONTHLY = BOSSES.filter(b => b.cycle === 'monthly')

const pickOf = (bossId: string) => bosses.value.find(b => b.bossId === bossId)
const weeklyCount = computed(() => bosses.value.filter(b => findBoss(b.bossId)?.cycle === 'weekly').length)
const expectedOf = (cycle: 'weekly' | 'monthly') => bosses.value.filter(b => findBoss(b.bossId)?.cycle === cycle).reduce((sum, b) => sum + (crystalPrice(b.bossId, b.difficulty, b.party) ?? 0), 0)
const expected = computed(() => ({ weekly: expectedOf('weekly'), monthly: expectedOf('monthly') }))
const full = computed(() => weeklyCount.value >= WEEKLY_BOSS_LIMIT)
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
const copyOpen = ref(false)
const { ask } = useConfirm()
async function resetAll() {
  if (await ask({ title: '보스 세팅 비우기', name: `${props.character.name}의 보스 세팅`, detail: `고른 보스 ${bosses.value.length}개`, note: '고른 보스를 모두 비워요. 이미 체크한 기록은 가계부에 그대로 남아요.', action: '비우기' })) bosses.value = []
}

function copyTo(ocid: string) {
  if (timer) clearTimeout(timer)
  timer = null
  emit('copy', ocid, copyPicks(bosses.value))
  copyOpen.value = false
}
function closeCopy(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('.copy')) copyOpen.value = false
}
watch(copyOpen, (open) => {
  if (open) setTimeout(() => window.addEventListener('click', closeCopy))
  else window.removeEventListener('click', closeCopy)
})
onBeforeUnmount(() => window.removeEventListener('click', closeCopy))
</script>

<template>
  <div ref="root" class="setup">
    <div class="head">
      <h3>{{ character.name }}의 보스 세팅</h3>
      <span class="muted">주간 <b :class="{ full }">{{ weeklyCount }}/{{ WEEKLY_BOSS_LIMIT }}</b> · 다 잡으면 <b class="gold">{{ formatKoreanNumber(expected.weekly) }}</b><template v-if="expected.monthly"> · 월간 <b class="gold">{{ formatKoreanNumber(expected.monthly) }}</b></template></span>
      <span class="footnote">결정석 {{ formatDay(BOSS_PRICE_DATE) }} 기준 · 고른 카드의 빈 곳을 누르면 빠져요</span>
      <div class="tools">
        <div v-if="others.length" class="copy">
          <button type="button" class="btn ghost compact" :aria-expanded="copyOpen" @click="copyOpen = !copyOpen">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>
            다른 캐릭터에 복사
          </button>
          <Transition name="fade">
            <ul v-if="copyOpen" class="copy-menu" role="menu">
              <li class="copy-title">이 세팅을 누구에게 넣을까요?</li>
              <li v-for="c in others" :key="c.ocid">
                <button type="button" role="menuitem" @click="copyTo(c.ocid)">
                  <CharacterThumb v-if="c.imageUrl" :src="c.imageUrl" :height="32" crop="head" class="copy-face" />
                  <span><b>{{ c.name }}</b><small>{{ c.job }} · 보스 {{ c.bosses.length }}개</small></span>
                </button>
              </li>
            </ul>
          </Transition>
        </div>
        <button
          type="button"
          class="reset-btn"
          :disabled="!bosses.length"
          title="고른 보스 모두 비우기"
          aria-label="고른 보스 모두 비우기"
          @click="resetAll"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5" /></svg>
        </button>
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
.tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.copy {
  position: relative;
}
.reset-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  cursor: pointer;
  transition: color var(--fast) ease, border-color var(--fast) ease, background var(--fast) ease;
}
.reset-btn svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.reset-btn:hover:not(:disabled) {
  border-color: var(--loss);
  color: var(--loss);
}
.reset-btn:disabled {
  cursor: default;
  opacity: 0.4;
}
.copy .btn svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.copy-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 20;
  display: grid;
  gap: 2px;
  min-width: 220px;
  margin: 0;
  padding: 6px;
  background: var(--win);
  border: 1px solid var(--tip-line);
  border-radius: 10px;
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.45);
  list-style: none;
}
.copy-title {
  padding: 4px 8px 6px;
  color: var(--sub);
  font-size: 12px;
}
.copy-menu button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.copy-menu button:hover {
  background: var(--panel);
}
.copy-menu span {
  display: grid;
}
.copy-menu b {
  font-size: 14px;
}
.copy-menu small {
  color: var(--sub);
  font-size: 12px;
}
.copy-face {
  width: 32px;
}
/* 왼쪽 열 위에서부터 센 보스, 오른쪽 열로 넘어가며 약한 보스가 오도록 세로로 채운다 */
.cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(var(--rows), auto);
  grid-auto-flow: column;
  gap: 3px 10px;
}
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
/* 주간 칸 하나와 같은 너비 */
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
