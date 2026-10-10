<script setup lang="ts">
import type { EnhanceItem } from '#shared/types'

useHead({ title: '잠재능력 · 메이플스토리로그' })

const route = useRoute()
const router = useRouter()
const { me } = await useMe()
const { characters, ocid, days, pickedFrom, from, data, pending, error, failure } = useEnhanceRecords(me)

// 윗잠·에디 중 고른 쪽은 주소에 남겨 새로고침해도 유지한다
const additional = computed({
  get: () => route.query.part === 'additional',
  set: value => router.replace({ query: { ...route.query, part: value ? 'additional' : undefined } }),
})

const sideOf = (i: EnhanceItem) => (additional.value ? i.summary.additional : i.summary.potential)
const countOf = (i: EnhanceItem) => sideOf(i).cubes + sideOf(i).resets
const gradeOf = (i: EnhanceItem) => (additional.value ? i.additionalGrade : i.potentialGrade)

const selected = ref<string | null>(null)
const showQuiet = ref(false)
const items = computed(() => (data.value?.items ?? []).filter(i => countOf(i) > 0).sort((a, b) => countOf(b) - countOf(a)))
const quiet = computed(() => (data.value?.items ?? []).filter(i => !countOf(i)))
const item = computed(() => data.value?.items.find(i => i.name === selected.value) ?? null)

// 고른 장비가 이쪽 기록이 없으면 이쪽에서 가장 많이 돌린 장비로 옮긴다
watch([() => data.value?.items, additional], ([list]) => {
  if (!list) return
  if (!item.value || !countOf(item.value)) selected.value = items.value[0]?.name ?? list[0]?.name ?? null
})
watch(ocid, () => {
  selected.value = null
})

const totals = computed(() => (data.value?.items ?? []).reduce((t, i) => ({
  resets: t.resets + sideOf(i).resets,
  cubes: t.cubes + sideOf(i).cubes,
  meso: t.meso + (additional.value ? i.summary.meso.additional : i.summary.meso.potential),
  items: t.items + (countOf(i) ? 1 : 0),
}), { resets: 0, cubes: 0, meso: 0, items: 0 }))
const gradeStyle = (g: string | null) => ({ '--grade': potentialGradeColor(g) ?? 'var(--tip-line)' })
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.potential" />

  <GameWindow v-else class="fit" title="잠재능력" sub="큐브 · 메소 재설정 기록" :accent="additional ? 'purple' : 'blue'" fill>
    <EnhanceToolbar v-model:ocid="ocid" v-model:days="days" v-model:picked-from="pickedFrom" :characters="characters" :syncing="data?.syncing" :synced-from="data?.syncedFrom">
      <template #lead>
        <div class="bigseg" role="tablist" aria-label="잠재 종류">
          <button type="button" role="tab" class="top" :aria-selected="!additional" @click="additional = false">윗잠</button>
          <button type="button" role="tab" class="add" :aria-selected="additional" @click="additional = true">에디셔널</button>
        </div>
      </template>
    </EnhanceToolbar>

    <div class="strip" :class="{ add: additional }">
      <div><small>메소 재설정</small><b>{{ data ? `${totals.resets.toLocaleString('ko-KR')}번` : '-' }}</b></div>
      <div><small>재설정에 쓴 메소</small><b class="meso">{{ data ? formatKoreanNumber(totals.meso) : '-' }}</b></div>
      <div><small>큐브</small><b>{{ data ? `${totals.cubes.toLocaleString('ko-KR')}개` : '-' }}</b></div>
      <div><small>돌린 장비</small><b>{{ data ? `${totals.items}개` : '-' }}</b></div>
    </div>

    <p v-if="failure || error" class="form-error">{{ failure || errorMessage(error) }}</p>

    <div v-if="!data && pending" class="loading">
      <span class="skeleton" />
      <p class="muted">장비와 강화 기록을 불러오는 중이에요…</p>
    </div>

    <div v-else-if="data" class="body">
      <div class="list" :class="{ add: additional }">
        <div class="list-head"><span>장비 · 많이 돌린 순</span><span>지금 등급 · 횟수</span></div>
        <ul>
          <li v-for="i in items" :key="`${i.slot}:${i.name}`">
            <button type="button" class="row" :class="{ on: i.name === selected }" @click="selected = i.name">
              <img v-if="i.icon" :src="i.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
              <span class="name"><b class="ellipsis">{{ i.name }}</b><small><span v-if="!i.worn" class="unworn" title="지금은 안 낀 장비예요">안 낌</span>{{ i.slot }}</small></span>
              <span class="count"><span class="grade" :style="gradeStyle(gradeOf(i))">{{ gradeOf(i) ?? '없음' }}</span><small>{{ countOf(i) }}번</small></span>
            </button>
          </li>
          <li v-if="!items.length" class="muted none">{{ data.syncing ? '아직 기록을 모으는 중이에요.' : `이 기간엔 ${additional ? '에디셔널' : '윗잠'} 기록이 없어요.` }}</li>
        </ul>
        <button v-if="quiet.length" type="button" class="more" :aria-expanded="showQuiet" @click="showQuiet = !showQuiet">
          돌린 적 없는 장비 {{ quiet.length }}개 {{ showQuiet ? '▴' : '▾' }}
        </button>
        <ul v-if="showQuiet" class="quiet">
          <li v-for="i in quiet" :key="`${i.slot}:${i.name}`">
            <button type="button" class="row" :class="{ on: i.name === selected }" @click="selected = i.name">
              <img v-if="i.icon" :src="i.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
              <span class="name"><b class="ellipsis">{{ i.name }}</b><small><span v-if="!i.worn" class="unworn" title="지금은 안 낀 장비예요">안 낌</span>{{ i.slot }}</small></span>
              <span class="count"><span class="grade" :style="gradeStyle(gradeOf(i))">{{ gradeOf(i) ?? '없음' }}</span></span>
            </button>
          </li>
        </ul>
      </div>

      <EnhancePotentialDetail v-if="item && ocid" :key="`${item.name}|${additional}`" :ocid="ocid" :item="item" :from="from" :additional="additional" />
    </div>
  </GameWindow>
</template>

<style scoped>
/* 윗잠·에디를 고르는 큰 스위치. 윗잠은 파랑, 에디는 보라 */
.bigseg {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: #11152a;
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.bigseg button {
  padding: 5px 20px;
  background: none;
  border: 0;
  border-radius: 9px;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 18px;
  cursor: pointer;
  transition: background var(--fast) ease, color var(--fast) ease;
}
.bigseg button:hover {
  color: var(--text);
}
.bigseg .top[aria-selected="true"] {
  background: rgb(127 178 255 / 0.16);
  box-shadow: inset 0 0 0 1px rgb(127 178 255 / 0.55);
  color: var(--api);
}
.bigseg .add[aria-selected="true"] {
  background: rgb(183 156 255 / 0.16);
  box-shadow: inset 0 0 0 1px rgb(183 156 255 / 0.55);
  color: var(--calc);
}
.strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.strip > div {
  display: grid;
  padding: 8px 14px;
  border-right: 1px solid var(--panel-line);
}
.strip > div:last-child {
  border-right: 0;
}
.strip small {
  color: var(--sub);
  font-size: 12px;
}
.strip b {
  font-family: var(--f-title);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
.strip .meso {
  color: var(--gold);
}
.loading {
  display: grid;
  gap: 8px;
}
.loading .skeleton {
  height: 160px;
}
.body {
  display: grid;
  flex: 1;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
}
.list {
  --side: var(--api);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.list.add {
  --side: var(--calc);
}
.list-head {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 12px;
}
.list ul {
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.list > ul:first-of-type {
  flex: 1;
}
.row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 12px;
  background: none;
  border: 0;
  border-bottom: 1px solid rgb(58 67 102 / 0.5);
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--fast) ease;
}
.row:hover {
  background: rgb(255 255 255 / 0.03);
}
.row.on {
  background: color-mix(in srgb, var(--side) 10%, transparent);
  box-shadow: inset 3px 0 0 var(--side);
}
.row img {
  width: 30px;
  height: 30px;
  object-fit: contain;
  image-rendering: pixelated;
}
/* 아이콘을 모르는 안 낀 장비는 같은 크기의 빈 칸 */
.no-icon {
  width: 30px;
  height: 30px;
  background: var(--bar);
  border: 1px dashed var(--panel-line);
  border-radius: 6px;
}
.name {
  display: grid;
  min-width: 0;
  line-height: 1.3;
}
.name b {
  font-family: var(--f-title);
  font-size: 14px;
  font-weight: 400;
}
.name small,
.count small {
  color: var(--sub);
  font-size: 11.5px;
}
.count {
  display: grid;
  justify-items: end;
  gap: 2px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.grade {
  padding: 1px 7px;
  background: var(--grade);
  border-radius: 5px;
  color: #10131f;
  font-size: 11px;
  font-weight: 800;
}
.quiet .row {
  opacity: 0.6;
}
.more {
  padding: 8px 12px;
  background: none;
  border: 0;
  border-top: 1px dashed var(--panel-line);
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.none {
  padding: 20px 12px;
  font-size: 13px;
  text-align: center;
}
@media (max-width: 900px) {
  .body {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 640px) {
  .strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .strip > div:nth-child(2) {
    border-right: 0;
  }
  .strip > div:nth-child(-n + 2) {
    border-bottom: 1px solid var(--panel-line);
  }
  .strip b {
    font-size: 19px;
  }
}
.unworn {
  margin-right: 4px;
  padding: 0 5px;
  border: 1px solid var(--panel-line);
  border-radius: 4px;
  color: var(--sub);
  font-size: 10.5px;
}
</style>
