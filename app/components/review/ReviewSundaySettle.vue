<script setup lang="ts">
import type { CharacterBrief, SundayLineTotal, SundayNotice } from '#shared/types'

const props = defineProps<{ notice: SundayNotice, live: boolean }>()
const { me } = await useMe()

const today = kstToday()
const from = computed(() => kstDateOf(props.notice.start))
const to = computed(() => (kstDateOf(props.notice.end) < today ? kstDateOf(props.notice.end) : today))
const started = computed(() => from.value <= today)

const characters = ref<CharacterBrief[] | null>(null)
const listFailed = ref(false)
async function loadCharacters() {
  listFailed.value = false
  characters.value = await $fetch<CharacterBrief[]>('/api/review/characters', { query: { from: from.value, to: to.value } }).catch(() => {
    listFailed.value = true
    return null
  })
}
onMounted(() => {
  if (me.value && started.value) loadCharacters()
})
const totals = ref<Record<string, SundayLineTotal>>({})
const onTotal = (ocid: string, total: SundayLineTotal) => {
  totals.value = { ...totals.value, [ocid]: total }
}
const ready = computed(() => !!characters.value && characters.value.every(c => totals.value[c.ocid]?.ready))
const meso = computed(() => Object.values(totals.value).reduce((t, v) => t + (v.failed ? 0 : v.meso), 0))
const failedCount = computed(() => Object.values(totals.value).filter(v => v.failed).length)
// 캐릭터 결산마다 넥슨을 부르므로 호출 한도에 안 걸리게 차례로 받는다
let chain: Promise<unknown> = Promise.resolve()
function queue<T>(job: () => Promise<T>): Promise<T> {
  const next = chain.then(job)
  chain = next.catch(() => {})
  return next
}
</script>

<template>
  <section class="settle">
    <h4>{{ live ? '이번 썬데이 결산' : '지난 썬데이 결산' }}<small v-if="characters?.length">캐릭터 {{ characters.length }}개</small></h4>
    <p v-if="!me" class="muted small">로그인하면 이번 썬데이에 강화로 얼마 이득 봤는지 알려 드려요.</p>
    <p v-else-if="!started" class="muted small">썬데이에 강화하면 결과가 여기 떠요.</p>
    <template v-else-if="characters">
      <p v-if="!characters.length" class="muted small">{{ live ? '아직 강화 기록이 없어요.' : '이 썬데이엔 강화 기록이 없어요.' }}</p>
      <template v-else>
        <p v-if="ready && failedCount === characters.length" class="muted small">결산을 불러오지 못했어요. 아래에서 다시 불러와 주세요.</p>
        <p v-else-if="ready" class="big">
          {{ live ? '지금까지' : '그 썬데이에' }} <em :class="{ loss: meso < 0 }">{{ formatSigned(meso, formatShortNumber) }}</em> {{ meso >= 0 ? '이득' : '손해' }}<small v-if="failedCount" class="partial">못 불러온 캐릭터 {{ failedCount }}개 빼고</small>
        </p>
        <span v-else class="skeleton big-skeleton" />
        <div class="lines">
          <ReviewSundayLine v-for="c in characters" :key="c.ocid" :character="c" :from="from" :to="to" :queue="queue" @total="onTotal" />
        </div>
        <NuxtLink :to="{ path: '/review', query: { mode: 'sunday', date: from } }" class="more">결산 자세히 보기 →</NuxtLink>
      </template>
    </template>
    <div v-else-if="listFailed" class="fail">
      <p class="muted small">강화한 캐릭터를 불러오지 못했어요.</p>
      <button type="button" class="btn ghost compact" @click="loadCharacters">다시 불러오기</button>
    </div>
    <span v-else class="skeleton big-skeleton" />
  </section>
</template>

<style scoped>
.settle {
  display: grid;
  gap: 10px;
  align-content: start;
  padding: 14px;
  background: linear-gradient(160deg, rgb(127 217 154 / 0.12), var(--panel) 60%);
  border: 1px solid rgb(127 217 154 / 0.45);
  border-radius: 12px;
}
h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
h4 small {
  margin-left: auto;
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 11.5px;
}
.small {
  margin: 0;
  font-size: 13px;
}
.big {
  margin: 0;
  font-family: var(--f-title);
  font-size: 20px;
}
.big em {
  color: var(--gain);
  font-size: 28px;
  font-style: normal;
}
.big em.loss {
  color: var(--loss);
}
.big-skeleton {
  height: 38px;
}
.partial {
  display: block;
  color: var(--sub);
  font-family: var(--f-body);
  font-size: 12px;
}
.fail {
  display: grid;
  justify-items: start;
  gap: 8px;
}
.lines {
  display: grid;
  gap: 4px;
}
.more {
  justify-self: start;
  padding: 6px 12px;
  border: 1px solid rgb(127 217 154 / 0.55);
  border-radius: 8px;
  color: var(--gain);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
</style>
