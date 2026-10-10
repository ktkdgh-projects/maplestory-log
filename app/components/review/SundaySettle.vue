<script setup lang="ts">
import type { CharacterBrief, SundayNotice } from '#shared/types'

// 썬데이 페이지의 "이번 썬데이 결산". 내 계정에서 그 썬데이에 강화한 캐릭터를 모두 더한다
const props = defineProps<{ notice: SundayNotice, live: boolean }>()
const { me } = await useMe()

const today = kstToday()
const from = computed(() => kstDateOf(props.notice.start))
const to = computed(() => (kstDateOf(props.notice.end) < today ? kstDateOf(props.notice.end) : today))
const started = computed(() => from.value <= today)

const characters = ref<CharacterBrief[] | null>(null)
onMounted(async () => {
  if (!me.value || !started.value) return
  characters.value = await $fetch<CharacterBrief[]>('/api/review/characters', { query: { from: from.value, to: to.value } }).catch(() => [])
})
const totals = ref<Record<string, { meso: number, cube: number, ready: boolean }>>({})
const onTotal = (ocid: string, total: { meso: number, cube: number, ready: boolean }) => {
  totals.value = { ...totals.value, [ocid]: total }
}
const ready = computed(() => !!characters.value && characters.value.every(c => totals.value[c.ocid]?.ready))
const sum = computed(() => Object.values(totals.value).reduce((t, v) => ({ meso: t.meso + v.meso, cube: t.cube + v.cube }), { meso: 0, cube: 0 }))
</script>

<template>
  <section class="settle">
    <h4>{{ live ? '이번 썬데이 결산' : '지난 썬데이 결산' }}<small v-if="characters?.length">캐릭터 {{ characters.length }}개</small></h4>
    <p v-if="!me" class="muted small">로그인하면 이번 썬데이에 강화로 얼마 이득 봤는지 알려 드려요.</p>
    <p v-else-if="!started" class="muted small">썬데이에 강화하면 결과가 여기 떠요.</p>
    <template v-else-if="characters">
      <p v-if="!characters.length" class="muted small">{{ live ? '아직 강화 기록이 없어요.' : '이 썬데이엔 강화 기록이 없어요.' }}</p>
      <template v-else>
        <p v-if="ready" class="big">
          {{ live ? '지금까지' : '이번 썬데이에' }} <em :class="{ loss: sum.meso < 0 }">{{ formatSigned(sum.meso, formatShortNumber) }}</em> {{ sum.meso >= 0 ? '이득' : '손해' }}
        </p>
        <span v-else class="skeleton big-skeleton" />
        <div class="lines">
          <ReviewSundayLine v-for="c in characters" :key="c.ocid" :character="c" :from="from" :to="to" :mvp="me.mvpDiscount" @total="onTotal" />
        </div>
        <NuxtLink :to="{ path: '/review', query: { mode: 'sunday', date: from } }" class="more">결산 자세히 보기 →</NuxtLink>
      </template>
    </template>
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
