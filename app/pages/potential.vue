<script setup lang="ts">
import type { EnhanceItem } from '#shared/types'
import { enhanceItemKey, revealDetail, uniqueByName, useEnhanceRecords } from '~/composables/useEnhanceRecords'

useHead({ title: '잠재능력 · 메이플스토리로그' })

const route = useRoute()
const router = useRouter()
const { me } = await useMe()
const { characters, charactersLoaded, loadCharacters, ocid, days, pickedFrom, from, data, pending, error, failure, refresh } = useEnhanceRecords(me, queryText(route.query, 'ocid') || null)

// 결산 등에서 짚어 넘어온 캐릭터·장비를 먼저 보여 주고, 새로고침해도 그리로 돌아가지 않게 주소에선 지운다
let wantedItem = queryText(route.query, 'item')
onMounted(() => {
  if (route.query.ocid || route.query.item) router.replace({ query: { ...route.query, ocid: undefined, item: undefined } })
})

// 윗잠·에디 중 고른 쪽은 주소에 남겨 새로고침해도 유지한다
const additional = computed({
  get: () => route.query.part === 'additional',
  set: value => router.replace({ query: { ...route.query, part: value ? 'additional' : undefined } }),
})

const sideOf = (i: EnhanceItem) => (additional.value ? i.summary.additional : i.summary.potential)
const countOf = (i: EnhanceItem) => sideOf(i).cubes + sideOf(i).resets
const gradeOf = (i: EnhanceItem) => (additional.value ? i.additionalGrade : i.potentialGrade)
// 안 낀 장비는 기록에도 다른 프리셋에도 등급이 없으면 모르는 것이다
const gradeText = (i: EnhanceItem) => gradeOf(i) ?? (i.worn ? '없음' : '알 수 없음')

const selected = ref<string | null>(null)
const items = computed(() => (data.value?.items ?? []).filter(i => countOf(i) > 0).sort((a, b) => countOf(b) - countOf(a)))
const quiet = computed(() => (data.value?.items ?? []).filter(i => !countOf(i)))
const item = computed(() => data.value?.items.find(i => enhanceItemKey(i) === selected.value) ?? null)

// 고른 장비가 이쪽 기록이 없으면 이쪽에서 가장 많이 돌린 장비로 옮긴다
watch([() => data.value?.items, additional], ([list]) => {
  if (!list) return
  const wanted = wantedItem ? list.find(i => i.name === wantedItem) : null
  wantedItem = ''
  if (wanted) selected.value = enhanceItemKey(wanted)
  else if (!item.value || !countOf(item.value)) selected.value = items.value[0] ? enhanceItemKey(items.value[0]) : list[0] ? enhanceItemKey(list[0]) : null
})
watch(ocid, () => {
  selected.value = null
})
function select(key: string) {
  selected.value = key
  revealDetail()
}

const totals = computed(() => uniqueByName(data.value?.items ?? []).reduce((t, i) => ({
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

    <div class="strip">
      <div><small>메소 재설정</small><b>{{ data ? `${totals.resets.toLocaleString('ko-KR')}번` : '-' }}</b></div>
      <div><small>재설정에 쓴 메소</small><b class="meso">{{ data ? formatKoreanNumber(totals.meso) : '-' }}</b></div>
      <div><small>큐브</small><b>{{ data ? `${totals.cubes.toLocaleString('ko-KR')}개` : '-' }}</b></div>
      <div><small>돌린 장비</small><b>{{ data ? `${totals.items}개` : '-' }}</b></div>
    </div>

    <EnhanceState :characters-loaded="charactersLoaded" :has-characters="characters.length > 0" :failure="failure" :error="error" :has-data="!!data" @retry-characters="loadCharacters" @retry="refresh" />

    <div v-if="data" class="body" :class="{ busy: pending }">
      <EnhanceItemList
        :class="{ add: additional }"
        :items="items"
        :quiet="quiet"
        :selected="selected"
        quiet-label="돌린 적 없는 장비"
        :empty="data.syncing ? '아직 기록을 모으는 중이에요.' : `이 기간엔 ${additional ? '에디셔널' : '윗잠'} 기록이 없어요.`"
        @select="select"
      >
        <template #head><span>장비 · 많이 돌린 순</span><span>지금 등급 · 횟수</span></template>
        <template #count="{ item: i, quiet: q }">
          <span class="grade" :class="{ unknown: !gradeOf(i) }" :style="gradeStyle(gradeOf(i))">{{ gradeText(i) }}</span>
          <small v-if="!q">{{ countOf(i) }}번</small>
        </template>
      </EnhanceItemList>

      <EnhancePotentialDetail v-if="item && ocid" :key="`${enhanceItemKey(item)}|${additional}`" :ocid="ocid" :item="item" :from="from" :additional="additional" />
    </div>
  </GameWindow>
</template>

<style scoped>
.bigseg {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: #11152a;
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.bigseg button {
  min-height: 36px;
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
  min-width: 0;
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
.body {
  display: grid;
  flex: 1;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  transition: opacity var(--fast) ease;
}
/* 기간·캐릭터를 바꿔 새로 받는 동안 이전 결과는 흐리게 둔다 */
.body.busy {
  opacity: 0.55;
}
.body > .list {
  --side: var(--api);
}
.body > .list.add {
  --side: var(--calc);
}
.grade {
  padding: 1px 7px;
  background: var(--grade);
  border-radius: 5px;
  color: #10131f;
  font-size: 11px;
  font-weight: 800;
}
.grade.unknown {
  background: none;
  border: 1px dashed var(--tip-line);
  color: var(--sub);
  font-weight: 400;
}
.count small {
  color: var(--sub);
  font-size: 11.5px;
}
@media (max-width: 900px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .bigseg {
    display: flex;
    width: 100%;
  }
  .bigseg button {
    flex: 1;
  }
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
</style>
