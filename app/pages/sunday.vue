<script setup lang="ts">
import type { SundayNotice, SundayResponse } from '#shared/types'
import { SUNDAY_STARFORCE_EFFECTS } from '#shared/data/starforce'

useHead({ title: '썬데이 메이플 · 메이플스토리로그' })

const route = useRoute()
const { data, pending, error, refresh } = await useLazyFetch<SundayResponse>('/api/sunday', { server: false })

// ?preview=waiting 이면 이번 주 공지가 없는 것처럼 발표 전 화면을 미리 본다
const preview = computed(() => route.query.preview === 'waiting')
const current = computed(() => (preview.value ? null : data.value?.current ?? null))
const history = computed(() => {
  const list = data.value?.history ?? []
  return preview.value && data.value?.current ? [data.value.current, ...list] : list
})
const lastWeek = computed(() => (current.value ? null : history.value[0] ?? null))
const olderHistory = computed(() => (current.value ? history.value : history.value.slice(1)))

watch(() => current.value?.id, (id) => {
  if (id) markSundaySeen(id)
}, { immediate: true })

// 남은 시간 표시용 시계. 발표를 기다리는 동안은 5분마다 넥슨 공지를 다시 확인한다
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => (now.value = Date.now()), 30_000)
  poll = setInterval(() => {
    if (!current.value && !preview.value) refresh()
  }, 5 * 60_000)
})
onBeforeUnmount(() => {
  clearInterval(clock)
  clearInterval(poll)
})

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
function kst(ms: number) {
  const d = new Date(ms + 9 * HOUR)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), w: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() }
}
const dayText = (iso: string | number) => {
  const p = kst(typeof iso === 'number' ? iso : Date.parse(iso))
  const year = p.y === kst(now.value).y ? '' : `${p.y}년 `
  return `${year}${p.m + 1}/${p.d} (${WEEKDAYS[p.w]})`
}
const timeText = (iso: string) => {
  const p = kst(Date.parse(iso))
  return `${dayText(iso)} ${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`
}
function leftText(ms: number) {
  if (ms <= 0) return '곧'
  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const minutes = Math.floor((ms % HOUR) / 60_000)
  if (days) return `${days}일 ${hours}시간`
  if (hours) return `${hours}시간 ${minutes}분`
  return `${minutes}분`
}

// 발표 전: 다음 일요일과, 보통 발표하는 금요일 10시
const nextSunday = computed(() => nextKstWeekday(now.value, 0, 0))
const expectedAnnounce = computed(() => nextKstWeekday(now.value, 5, 10))
const announceLate = computed(() => sundayPhase(now.value, null) === 'late')

function status(n: SundayNotice) {
  const start = Date.parse(n.start)
  const end = sundayEndsAt(n.end)
  if (start > now.value) return { label: `예정 · D-${daysUntil(now.value, n.start)}`, tone: 'soon', left: `시작까지 ${leftText(start - now.value)}` }
  if (end > now.value) return { label: '오늘 진행 중', tone: 'live', left: `끝까지 ${leftText(end - now.value)}` }
  return { label: '끝남', tone: 'done', left: '' }
}
const showLastWeek = ref(false)
</script>

<template>
  <GameWindow title="썬데이 메이플" sub="넥슨 이벤트 공지에서 자동으로 가져와요" accent="green">
    <div class="sunday">
      <div v-if="error && !data" class="form-error retry">
        <span>{{ errorMessage(error) }}</span>
        <button type="button" class="btn ghost compact" :disabled="pending" @click="refresh()">다시 불러오기</button>
      </div>
      <!-- 브라우저에서만 받아서 처음엔 data가 비어 있다. 그동안 자리를 잡아 둔다 -->
      <div v-else-if="!data" class="skeleton hero-skel" />

      <template v-else>
        <section v-if="current" class="current">
          <header class="head">
            <span class="badge" :class="status(current).tone">{{ status(current).label }}</span>
            <h3>{{ dayText(current.start) }} {{ current.title }}</h3>
            <span class="muted small">{{ [status(current).left, `${timeText(current.publishedAt)} 발표`].filter(Boolean).join(' · ') }}</span>
            <a :href="current.url" target="_blank" rel="noopener" class="origin">공지 원문 →</a>
          </header>
          <div v-if="current.effects?.length" class="effects">
            <span class="muted small">스타포스 효과</span>
            <span v-for="key in current.effects" :key="key" class="effect">{{ SUNDAY_STARFORCE_EFFECTS.find(e => e.key === key)?.label }}</span>
            <NuxtLink to="/calc/starforce" class="origin">계산기에서 이 효과로 보기 →</NuxtLink>
          </div>
          <!-- 공지를 보고 강화한 결과를 바로 옆에서 본다 -->
          <div class="with-settle">
            <img v-if="current.image" :src="current.image" :alt="`${current.title} 이벤트 내용`" class="poster">
            <p v-else class="muted">공지에 이미지가 없어요. 원문에서 확인해 주세요.</p>
            <ReviewSundaySettle :notice="current" live class="settle-side" />
          </div>
        </section>

        <!-- 일요일이 지나고 다음 발표 전까지 -->
        <section v-else class="waiting">
          <div class="wait-card">
            <span class="sun" aria-hidden="true" />
            <div class="wait-text">
              <span class="badge soon">발표 전</span>
              <h3>{{ dayText(nextSunday) }} 썬데이 메이플을 기다리는 중</h3>
              <p v-if="!announceLate" class="muted">보통 <b>{{ dayText(expectedAnnounce) }} 오전 10시</b>에 올라와요 · <b class="gold">{{ leftText(expectedAnnounce - now) }}</b> 남음</p>
              <p v-else class="muted">발표 시각이 지났어요. <b class="gold">곧 올라와요</b> · 5분마다 확인 중</p>
              <p class="muted small">금요일이 공휴일이면 목요일, 목·금이 다 공휴일이면 수요일 오전 10시에 올라와요. 올라오면 이 화면이 바로 바뀌어요.</p>
            </div>
          </div>

          <ReviewSundaySettle v-if="lastWeek" :notice="lastWeek" :live="false" class="last-settle" />

          <div v-if="lastWeek" class="last">
            <button type="button" class="last-head" :aria-expanded="showLastWeek" @click="showLastWeek = !showLastWeek">
              <img v-if="lastWeek.image" :src="lastWeek.image" alt="" class="last-thumb">
              <span class="last-text"><small>지난주 썬데이</small><b>{{ dayText(lastWeek.start) }} {{ lastWeek.title }}</b></span>
              <span class="caret" aria-hidden="true">{{ showLastWeek ? '접기 ▴' : '펼쳐 보기 ▾' }}</span>
            </button>
            <div v-if="lastWeek.image" class="expand" :class="{ open: showLastWeek }">
              <div class="expand-in">
                <img :src="lastWeek.image" :alt="`${lastWeek.title} 이벤트 내용`" class="poster" loading="lazy">
              </div>
            </div>
          </div>
        </section>

        <section v-if="olderHistory.length" class="history">
          <h4>지난 썬데이</h4>
          <ul>
            <li v-for="n in olderHistory" :key="n.id">
              <a :href="n.url" target="_blank" rel="noopener" class="past">
                <img v-if="n.image" :src="n.image" alt="" loading="lazy">
                <span>{{ dayText(n.start) }}</span>
              </a>
            </li>
          </ul>
        </section>
        <p class="muted small note">처음 확인한 공지부터 모아요. {{ timeText(data.checkedAt) }} 확인</p>
      </template>
    </div>
  </GameWindow>
</template>

<style scoped>
.sunday {
  display: grid;
  gap: 20px;
}
.hero-skel {
  height: 420px;
}
.current {
  display: grid;
  justify-items: center;
  gap: 14px;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 12px;
}
h3 {
  margin: 0;
  color: var(--gain);
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
.badge {
  padding: 2px 10px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.badge.live {
  background: color-mix(in srgb, var(--gain) 15%, transparent);
  color: var(--gain);
}
.badge.soon {
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  color: var(--gold);
}
.badge.done {
  color: var(--sub);
}
.sunday .small {
  font-size: 12px;
}
.retry {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.expand {
  display: grid;
  grid-template-rows: 0fr;
  width: 100%;
  opacity: 0;
  transition: grid-template-rows var(--normal) var(--ease-out), opacity var(--normal) ease;
}
.expand.open {
  grid-template-rows: 1fr;
  opacity: 1;
}
.expand-in {
  display: grid;
  justify-items: center;
  min-height: 0;
  overflow: hidden;
}
.gold {
  color: var(--gold);
}
.origin {
  color: var(--api);
  font-size: 13px;
  text-decoration: none;
}
.origin:hover {
  text-decoration: underline;
}
.effects {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 8px;
}
.effect {
  padding: 2px 10px;
  background: color-mix(in srgb, var(--gold) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--gold) 50%, transparent);
  border-radius: 999px;
  color: var(--gold);
  font-size: 12.5px;
}
.poster {
  width: 100%;
  max-width: 876px;
  height: auto;
  border: 1px solid var(--panel-line);
  border-radius: 12px;
}
.with-settle {
  display: grid;
  grid-template-columns: minmax(0, 876px) 300px;
  justify-content: center;
  align-items: start;
  gap: 16px;
  width: 100%;
}
/* 공지 이미지가 길어서 결산 카드는 스크롤해도 옆에 붙어 있게 */
.settle-side {
  position: sticky;
  top: 0;
}
.last-settle {
  width: 100%;
  max-width: 876px;
}
@media (max-width: 1100px) {
  .with-settle {
    grid-template-columns: minmax(0, 1fr);
  }
}
.waiting {
  display: grid;
  justify-items: center;
  gap: 16px;
}
.wait-card {
  display: flex;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 876px;
  padding: 28px 32px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--gain) 10%, transparent), color-mix(in srgb, var(--gold) 6%, transparent) 60%, transparent);
  border: 1px solid color-mix(in srgb, var(--gain) 35%, transparent);
  border-radius: 16px;
}
.sun {
  flex: none;
  width: 72px;
  height: 72px;
  background: radial-gradient(circle at 50% 50%, #ffe27a 0 45%, rgb(255 226 122 / 0.25) 46% 70%, transparent 71%);
  border-radius: 50%;
  box-shadow: 0 0 30px rgb(255 214 90 / 0.35);
  animation: rise 3s ease-in-out infinite;
}
@keyframes rise {
  50% { transform: translateY(-4px); box-shadow: 0 0 40px rgb(255 214 90 / 0.5); }
}
.wait-text {
  display: grid;
  justify-items: start;
  gap: 6px;
}
.wait-text p {
  margin: 0;
}
.wait-text b {
  color: var(--text);
}
.last {
  display: grid;
  justify-items: center;
  gap: 12px;
  width: 100%;
  max-width: 876px;
}
.last-head {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 12px;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.last-head:hover {
  border-color: var(--tip-line);
}
.last-thumb {
  width: 56px;
  height: 56px;
  object-fit: cover;
  object-position: top;
  border-radius: 8px;
}
.last-text {
  display: grid;
  flex: 1;
}
.last-text small {
  color: var(--sub);
  font-size: 12px;
}
.last-text b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.caret {
  min-width: 5.5em;
  color: var(--sub);
  text-align: right;
  font-size: 13px;
}
.history {
  display: grid;
  gap: 10px;
}
h4 {
  margin: 0;
  color: var(--sub);
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.history ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.past {
  display: grid;
  gap: 4px;
  color: var(--sub);
  font-size: 13px;
  text-align: center;
  text-decoration: none;
}
.past img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  object-position: top;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  transition: border-color var(--fast) ease;
}
.past:hover img {
  border-color: var(--gain);
}
.note {
  margin: 0;
  text-align: right;
}
@media (max-width: 640px) {
  .wait-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px;
  }
  .sun {
    width: 52px;
    height: 52px;
  }
}
</style>
