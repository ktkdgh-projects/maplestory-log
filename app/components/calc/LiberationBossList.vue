<script setup lang="ts">
import { DIFFICULTY_LABELS, MAX_PARTY, findBoss, type BossDifficulty } from '#shared/data/bosses'
import { traceOf, type LiberationInfo, type LiberationKind } from '#shared/data/liberation'
import type { TraceBoss } from '#shared/calc/liberation'

const props = defineProps<{
  info: LiberationInfo
  kind: LiberationKind
  passNow: boolean
  canReset: boolean
  clearedNow: (bossId: string) => boolean
}>()
const emit = defineEmits<{ reset: [] }>()
const bosses = defineModel<Omit<TraceBoss, 'cleared'>[]>('bosses', { required: true })

const addable = computed(() => Object.keys(props.info.traces).filter(id => !bosses.value.some(b => b.bossId === id)))
const adding = ref('')
watch(adding, (id) => {
  if (!id) return
  bosses.value.push({ bossId: id, difficulty: Object.keys(props.info.traces[id]!).at(-1)!, party: 1 })
  adding.value = ''
})
const difficulties = (bossId: string) => Object.keys(props.info.traces[bossId] ?? {}) as BossDifficulty[]
const difficultyOptions = (bossId: string) => difficulties(bossId).map(d => ({ value: d as string, label: DIFFICULTY_LABELS[d] }))
const PARTY_OPTIONS = Array.from({ length: MAX_PARTY }, (_, i) => ({ value: i + 1, label: `${i + 1}인` }))
const addOptions = computed(() => addable.value.map(id => ({ value: id, label: findBoss(id)?.name ?? id })))
const anyCleared = computed(() => bosses.value.some(b => props.clearedNow(b.bossId)))
const anyWiki = computed(() => bosses.value.some(b => props.info.wikiBosses?.includes(b.bossId)))
const format = (n: number) => n.toLocaleString('ko-KR')
</script>

<template>
  <section class="calc-section">
    <h3 class="calc-section-title">
      {{ info.currency }}을 주는 보스
      <button v-if="canReset" type="button" class="link" @click="emit('reset')">보스 세팅대로</button>
    </h3>
    <ul class="bosses">
      <li v-for="(b, i) in bosses" :key="b.bossId" :class="{ cleared: clearedNow(b.bossId) }">
        <span class="tick" aria-hidden="true">✓</span>
        <span class="boss-name">{{ findBoss(b.bossId)?.name }}<small v-if="findBoss(b.bossId)?.cycle === 'monthly'">월간</small><small v-if="info.wikiBosses?.includes(b.bossId)" class="wiki">위키</small><span v-if="clearedNow(b.bossId)" class="sr-only"> · 이번 주기에 잡음</span></span>
        <AppSelect v-model="b.difficulty" class="mini" :options="difficultyOptions(b.bossId)" :label="`${findBoss(b.bossId)?.name} 난이도`" />
        <AppSelect v-model="b.party" class="mini" :options="PARTY_OPTIONS" :label="`${findBoss(b.bossId)?.name} 파티 인원`" />
        <b class="trace" :class="{ boosted: passNow }">{{ format(traceOf(kind, b.bossId, b.difficulty, b.party, passNow)) }}</b>
        <button type="button" class="remove" :aria-label="`${findBoss(b.bossId)?.name} 빼기`" @click="bosses.splice(i, 1)">×</button>
      </li>
      <li v-if="!bosses.length" class="none">아래에서 {{ info.currency }}을 주는 보스를 더해 주세요.</li>
    </ul>
    <p v-if="anyCleared || anyWiki" class="calc-hint">
      <template v-if="anyCleared"><b class="tick-note">✓</b> 가계부에 이번 주기에 잡았다고 체크한 보스예요. 그 {{ info.currency }}은 모은 양에 들어 있다고 봐요.</template>
      <template v-if="anyWiki"> '위키'는 공식 공지에 획득량이 없어 위키 기준인 보스예요.</template>
    </p>
    <AppSelect v-if="addable.length" v-model="adding" :options="addOptions" placeholder="+ 보스 더하기" label="보스 더하기" />
  </section>
</template>

<style scoped>
.tick-note {
  color: var(--gain);
}
.link {
  margin-left: auto;
  padding: 0;
  background: none;
  border: 0;
  color: var(--calc);
  font: inherit;
  font-family: var(--f-body);
  font-size: 12px;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.bosses {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* 모든 줄이 같은 칸 너비를 써서 숫자·버튼이 세로로 줄 맞춰 선다 */
.bosses li {
  display: grid;
  grid-template-columns: 14px minmax(0, 1fr) 78px 54px 42px 24px;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 8px;
  background: color-mix(in srgb, var(--tint) 2%, transparent);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  font-size: 13px;
}
.bosses li.cleared {
  background: color-mix(in srgb, var(--gain) 5%, transparent);
  border-color: color-mix(in srgb, var(--gain) 40%, transparent);
}
.tick {
  visibility: hidden;
  color: var(--gain);
  font-size: 12px;
  font-weight: 700;
}
.cleared .tick {
  visibility: visible;
}
.boss-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.boss-name small.wiki {
  color: var(--sub);
}
.boss-name small {
  margin-left: 4px;
  color: var(--calc);
  font-size: 11px;
}
.mini :deep(.trigger) {
  min-height: 30px;
  padding: 0 6px;
  font-size: 12px;
}
.mini :deep(.list li) {
  min-height: 32px;
  padding: 2px 6px;
  font-size: 12.5px;
}
.trace {
  color: var(--text);
  font-family: var(--f-title);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
  text-align: right;
}
.trace.boosted {
  color: var(--gold);
}
.remove {
  height: 30px;
  padding: 0;
  background: none;
  border: 0;
  color: var(--sub);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.remove:hover {
  color: var(--loss);
}
.bosses .none {
  display: block;
  padding: 12px;
  color: var(--sub);
  font-size: 12.5px;
  text-align: center;
}
/* 휴대폰: 보스 이름이 잘리지 않게 이름 줄과 난이도·인원 줄로 나눈다 */
@media (max-width: 480px) {
  .bosses li {
    grid-template-columns: 14px minmax(0, 1fr) minmax(0, 1fr) 42px 30px;
    grid-template-areas:
      'tick name name trace remove'
      '. diff party . .';
    row-gap: 4px;
    padding: 6px 8px;
  }
  .bosses .tick { grid-area: tick; }
  .bosses .boss-name { grid-area: name; }
  .bosses .mini:nth-of-type(1) { grid-area: diff; }
  .bosses .mini:nth-of-type(2) { grid-area: party; }
  .bosses .trace { grid-area: trace; }
  .bosses .remove { grid-area: remove; }
}
</style>
