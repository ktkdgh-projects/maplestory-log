<script setup lang="ts">
import type { EnhanceItem } from '#shared/types'
import { enhanceItemKey, revealDetail, uniqueByName, useEnhanceRecords } from '~/composables/useEnhanceRecords'

useHead({ title: '스타포스 · 메이플스토리로그' })

const route = useRoute()
const router = useRouter()
const { me } = await useMe()
const { characters, charactersLoaded, loadCharacters, ocid, days, pickedFrom, from, data, pending, error, failure, refresh } = useEnhanceRecords(me, queryText(route.query, 'ocid') || null)

// 결산 등에서 짚어 넘어온 캐릭터·장비를 먼저 보여 주고, 새로고침해도 그리로 돌아가지 않게 주소에선 지운다
let wantedItem = queryText(route.query, 'item')
onMounted(() => {
  if (route.query.ocid || route.query.item) router.replace({ query: { ...route.query, ocid: undefined, item: undefined } })
})

const SORTS = [{ key: 'meso', label: '쓴 메소순' }, { key: 'slot', label: '부위순' }] as const
const sort = ref<typeof SORTS[number]['key']>('meso')
const selected = ref<string | null>(null)

const tried = (i: EnhanceItem) => i.summary.starforce.attempts > 0
const items = computed(() => {
  const list = (data.value?.items ?? []).filter(tried)
  return sort.value === 'meso' ? [...list].sort((a, b) => b.summary.meso.starforce - a.summary.meso.starforce || b.summary.starforce.attempts - a.summary.starforce.attempts) : list
})
const quiet = computed(() => (data.value?.items ?? []).filter(i => !tried(i)))
const item = computed(() => data.value?.items.find(i => enhanceItemKey(i) === selected.value) ?? null)

watch(() => data.value?.items, (list) => {
  const wanted = wantedItem ? list?.find(i => i.name === wantedItem) : null
  if (list) wantedItem = ''
  if (wanted) selected.value = enhanceItemKey(wanted)
  else if (list && !list.some(i => enhanceItemKey(i) === selected.value)) selected.value = items.value[0] ? enhanceItemKey(items.value[0]) : list[0] ? enhanceItemKey(list[0]) : null
})
watch(ocid, () => {
  selected.value = null
})
function select(key: string) {
  selected.value = key
  revealDetail()
}

const totals = computed(() => uniqueByName(data.value?.items ?? []).reduce((t, i) => ({
  meso: t.meso + i.summary.meso.starforce,
  attempts: t.attempts + i.summary.starforce.attempts,
  success: t.success + i.summary.starforce.success,
  destroy: t.destroy + i.summary.starforce.destroy,
  protect: t.protect + i.summary.starforce.protect,
}), { meso: 0, attempts: 0, success: 0, destroy: 0, protect: 0 }))
const count = (n: number) => (data.value ? `${n.toLocaleString('ko-KR')}번` : '-')
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.starforce" />

  <GameWindow v-else class="fit" title="스타포스" sub="넥슨 강화 기록" fill>
    <EnhanceToolbar v-model:ocid="ocid" v-model:days="days" v-model:picked-from="pickedFrom" :characters="characters" :syncing="data?.syncing" :synced-from="data?.syncedFrom" />

    <div class="strip">
      <div>
        <small class="label">쓴 메소
          <HoverInfo title="쓴 메소 추정" align="left" below>
            <span class="muted est" aria-label="추정 안내">추정 ⓘ</span>
            <template #info>
              <span>스타포스 비용은 공식 발표가 없어 위키 공식으로 추정해요.</span>
              <span>이벤트·MVP 할인(내 정보에서 고른 등급)과 파괴 뒤 복구 메소를 넣었고, 노작값은 빠져 있어요.</span>
            </template>
          </HoverInfo>
        </small>
        <b class="gold">{{ data ? formatKoreanNumber(totals.meso) : '-' }}</b>
      </div>
      <div><small>시도</small><b>{{ count(totals.attempts) }}</b></div>
      <div><small>성공</small><b class="gain">{{ count(totals.success) }}</b></div>
      <div><small>파괴</small><b class="loss">{{ count(totals.destroy) }}</b></div>
      <div><small>파괴방지 쓴 시도</small><b>{{ count(totals.protect) }}</b></div>
    </div>

    <EnhanceState :characters-loaded="charactersLoaded" :has-characters="characters.length > 0" :failure="failure" :error="error" :has-data="!!data" @retry-characters="loadCharacters" @retry="refresh" />

    <div v-if="data" class="body" :class="{ busy: pending }">
      <EnhanceItemList :items="items" :quiet="quiet" :selected="selected" quiet-label="기록 없는 장비" :empty="data.syncing ? '아직 기록을 모으는 중이에요.' : '이 기간엔 스타포스 기록이 없어요.'" @select="select">
        <template #head>
          <div class="sorts" role="group" aria-label="정렬">
            <button v-for="s in SORTS" :key="s.key" type="button" :aria-pressed="sort === s.key" @click="sort = s.key">{{ s.label }}</button>
          </div>
          <span>★ · 시도</span>
        </template>
        <template #sub="{ item: i }">
          <template v-if="i.summary.meso.starforce">{{ i.slot ? ' · ' : '' }}{{ formatShortNumber(i.summary.meso.starforce) }}</template>
        </template>
        <template #count="{ item: i, quiet: q }">
          <b><span class="star">★</span>{{ i.starforce }}</b>
          <small v-if="!q">{{ i.summary.starforce.attempts }}번<template v-if="i.summary.starforce.destroy"> · <span class="loss">파괴 {{ i.summary.starforce.destroy }}</span></template></small>
        </template>
      </EnhanceItemList>

      <EnhanceStarforceDetail v-if="item && ocid" :key="enhanceItemKey(item)" :ocid="ocid" :item="item" :from="from" />
    </div>
  </GameWindow>
</template>

<style scoped>
.strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
.label {
  display: flex;
  align-items: center;
  gap: 4px;
}
.est {
  font-size: 11.5px;
  cursor: help;
}
.strip b {
  font-family: var(--f-title);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}
/* .gold는 게임 창 테두리 색 클래스와 이름이 겹쳐 요약 줄 안으로만 건다 */
.strip .gold {
  color: var(--gold);
}
.strip .gain {
  color: var(--gain);
}
.loss {
  color: var(--loss);
}
.star {
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
.sorts {
  display: flex;
  gap: 2px;
}
.sorts button {
  min-height: 28px;
  padding: 3px 8px;
  background: none;
  border: 0;
  border-radius: 6px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.sorts button[aria-pressed="true"] {
  background: rgb(242 193 78 / 0.14);
  color: var(--gold);
}
.count b {
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
}
.count small {
  color: var(--sub);
  font-size: 11.5px;
}
@media (max-width: 900px) {
  .strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .strip > div:nth-child(3) {
    border-right: 0;
  }
  .strip > div:nth-child(-n + 3) {
    border-bottom: 1px solid var(--panel-line);
  }
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 640px) {
  .strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .strip > div {
    border-bottom: 1px solid var(--panel-line);
  }
  .strip > div:first-child {
    grid-column: span 2;
    border-right: 0;
  }
  .strip > div:nth-child(3),
  .strip > div:nth-child(5) {
    border-right: 0;
  }
  .strip > div:nth-child(2),
  .strip > div:nth-child(4) {
    border-right: 1px solid var(--panel-line);
  }
  .strip > div:nth-child(4),
  .strip > div:nth-child(5) {
    border-bottom: 0;
  }
  .strip b {
    font-size: 19px;
  }
  .sorts button {
    min-height: 36px;
    padding: 4px 10px;
  }
}
</style>
