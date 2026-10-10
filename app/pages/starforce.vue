<script setup lang="ts">
import type { EnhanceItem } from '#shared/types'

useHead({ title: '스타포스 · 메이플스토리로그' })

const { me } = await useMe()
const { characters, ocid, days, pickedFrom, from, data, pending, error, failure } = useEnhanceRecords(me)

const SORTS = [{ key: 'meso', label: '쓴 메소순' }, { key: 'slot', label: '부위순' }] as const
const sort = ref<typeof SORTS[number]['key']>('meso')
const selected = ref<string | null>(null)
const showQuiet = ref(false)

const tried = (i: EnhanceItem) => i.summary.starforce.attempts > 0
const items = computed(() => {
  const list = (data.value?.items ?? []).filter(tried)
  return sort.value === 'meso' ? [...list].sort((a, b) => b.summary.meso.starforce - a.summary.meso.starforce || b.summary.starforce.attempts - a.summary.starforce.attempts) : list
})
const quiet = computed(() => (data.value?.items ?? []).filter(i => !tried(i)))
const item = computed(() => data.value?.items.find(i => i.name === selected.value) ?? null)

watch(() => data.value?.items, (list) => {
  if (list && !list.some(i => i.name === selected.value)) selected.value = items.value[0]?.name ?? list[0]?.name ?? null
})
watch(ocid, () => {
  selected.value = null
})

const totals = computed(() => (data.value?.items ?? []).reduce((t, i) => ({
  meso: t.meso + i.summary.meso.starforce,
  attempts: t.attempts + i.summary.starforce.attempts,
  success: t.success + i.summary.starforce.success,
  destroy: t.destroy + i.summary.starforce.destroy,
  protect: t.protect + i.summary.starforce.protect,
}), { meso: 0, attempts: 0, success: 0, destroy: 0, protect: 0 }))
</script>

<template>
  <KeyGate v-if="!me" v-bind="KEY_GATES.starforce" />

  <GameWindow v-else class="fit" title="스타포스" sub="넥슨 강화 기록" fill>
    <EnhanceToolbar v-model:ocid="ocid" v-model:days="days" v-model:picked-from="pickedFrom" :characters="characters" :syncing="data?.syncing" :synced-from="data?.syncedFrom" />

    <div class="strip">
      <div title="스타포스 비용은 공식 발표가 없어 위키 공식으로 추정해요. 이벤트·MVP 할인(내 정보에서 고른 등급)과 파괴 뒤 복구 메소를 넣었고, 노작값은 빠져 있어요">
        <small>쓴 메소 <span class="muted">추정</span></small><b class="gold">{{ data ? formatKoreanNumber(totals.meso) : '-' }}</b>
      </div>
      <div><small>시도</small><b>{{ data ? `${totals.attempts.toLocaleString('ko-KR')}번` : '-' }}</b></div>
      <div><small>성공</small><b class="gain">{{ data ? `${totals.success.toLocaleString('ko-KR')}번` : '-' }}</b></div>
      <div><small>파괴</small><b class="loss">{{ data ? `${totals.destroy.toLocaleString('ko-KR')}번` : '-' }}</b></div>
      <div><small>파괴방지 쓴 시도</small><b>{{ data ? `${totals.protect.toLocaleString('ko-KR')}번` : '-' }}</b></div>
    </div>

    <p v-if="failure || error" class="form-error">{{ failure || errorMessage(error) }}</p>

    <div v-if="!data && pending" class="loading">
      <span class="skeleton" />
      <p class="muted">장비와 강화 기록을 불러오는 중이에요…</p>
    </div>

    <div v-else-if="data" class="body">
      <div class="list">
        <div class="list-head">
          <div class="sorts" role="group" aria-label="정렬">
            <button v-for="s in SORTS" :key="s.key" type="button" :aria-pressed="sort === s.key" @click="sort = s.key">{{ s.label }}</button>
          </div>
          <span>★ · 시도</span>
        </div>
        <ul>
          <li v-for="i in items" :key="`${i.slot}:${i.name}`">
            <button type="button" class="row" :class="{ on: i.name === selected }" @click="selected = i.name">
              <img v-if="i.icon" :src="i.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
              <span class="name"><b class="ellipsis">{{ i.name }}</b><small><span v-if="!i.worn" class="unworn" title="지금은 안 낀 장비예요">안 낌</span>{{ i.slot }}<template v-if="i.summary.meso.starforce">{{ i.slot ? ' · ' : '' }}{{ formatShortNumber(i.summary.meso.starforce) }}</template></small></span>
              <span class="count"><b><span class="star">★</span>{{ i.starforce }}</b><small>{{ i.summary.starforce.attempts }}번<template v-if="i.summary.starforce.destroy"> · <span class="loss">파괴 {{ i.summary.starforce.destroy }}</span></template></small></span>
            </button>
          </li>
          <li v-if="!items.length" class="muted none">{{ data.syncing ? '아직 기록을 모으는 중이에요.' : '이 기간엔 스타포스 기록이 없어요.' }}</li>
        </ul>
        <button v-if="quiet.length" type="button" class="more" :aria-expanded="showQuiet" @click="showQuiet = !showQuiet">
          기록 없는 장비 {{ quiet.length }}개 {{ showQuiet ? '▴' : '▾' }}
        </button>
        <ul v-if="showQuiet" class="quiet">
          <li v-for="i in quiet" :key="`${i.slot}:${i.name}`">
            <button type="button" class="row" :class="{ on: i.name === selected }" @click="selected = i.name">
              <img v-if="i.icon" :src="i.icon" alt=""><span v-else class="no-icon" aria-hidden="true" />
              <span class="name"><b class="ellipsis">{{ i.name }}</b><small><span v-if="!i.worn" class="unworn" title="지금은 안 낀 장비예요">안 낌</span>{{ i.slot }}</small></span>
              <span class="count"><b><span class="star">★</span>{{ i.starforce }}</b></span>
            </button>
          </li>
        </ul>
      </div>

      <EnhanceStarforceDetail v-if="item && ocid" :key="item.name" :ocid="ocid" :item="item" :from="from" />
    </div>
  </GameWindow>
</template>

<style scoped>
.strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
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
/* .gold는 게임 창 테두리 색 클래스와 이름이 같아 창 전체가 금색이 되지 않게 요약 줄 안으로만 */
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid var(--panel-line);
  color: var(--sub);
  font-size: 12px;
}
.sorts {
  display: flex;
  gap: 2px;
}
.sorts button {
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
  background: rgb(242 193 78 / 0.1);
  box-shadow: inset 3px 0 0 var(--gold);
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
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.count b {
  font-family: var(--f-title);
  font-size: 16px;
  font-weight: 400;
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
  .strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .strip > div:nth-child(3) {
    border-right: 0;
  }
  .body {
    grid-template-columns: 1fr;
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
