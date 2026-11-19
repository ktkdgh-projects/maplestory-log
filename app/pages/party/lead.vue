<script setup lang="ts">
import type { PartyLeadAction, PartyLeadResponse, PartyWeekStep } from '#shared/types'

definePageMeta({ layout: false })
useHead({
  title: '파티장 화면 · 레다봇',
  meta: [{ name: 'robots', content: 'noindex' }],
})

// 채널에서 누가 투표하면 이만큼 뒤에 화면에도 보인다
const REFRESH_MS = 5000

const { partyId, data, refresh, openError } = await usePartyPage<PartyLeadResponse>('/api/discord/lead')

const busy = ref(false)
const message = ref('')
const failed = ref(false)
const picked = ref<number | null>(null)
// 이번 주만 다르게: 받을 첫 요일(목=0)과 마감. 누르면 전원에게 알림이 가므로 두 번 눌러야 시작한다
const customFromDay = ref(0)
const customDeadline = ref('')
const customArmed = ref(false)
const weekDays = computed(() => Array.from({ length: 7 }, (_, d) => ({ d, label: formatDayWeek(addDays(data.value!.week, d)) })))
async function startCustom() {
  if (!customArmed.value) {
    customArmed.value = true
    return
  }
  customArmed.value = false
  await act({ action: 'custom', fromDay: customFromDay.value, deadline: new Date(customDeadline.value).toISOString() })
}
watch([customFromDay, customDeadline], () => {
  customArmed.value = false
})

async function act(action: PartyLeadAction) {
  busy.value = true
  failed.value = false
  try {
    data.value = await $fetch<PartyLeadResponse>('/api/discord/lead', { method: 'POST', body: { p: partyId, ...action } })
    message.value = data.value.note
    picked.value = null
  }
  catch (e) {
    failed.value = true
    message.value = (e as { data?: { message?: string } }).data?.message ?? '하지 못했어요. 다시 눌러 주세요.'
  }
  finally {
    busy.value = false
  }
}
const run = (step: PartyWeekStep) => act({ action: 'run', step })

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => !busy.value && !document.hidden && refresh(), REFRESH_MS)
})
onBeforeUnmount(() => clearInterval(timer))

const submitted = computed(() => data.value!.members.filter(m => m.submitted).length)
const voted = computed(() => data.value!.members.filter(m => m.voted).length)
const noticed = computed(() => !!data.value!.steps.find(s => s.key === 'notice')?.done)
// 단계 카드의 상태: 끝남 / 지금 할 차례 / 아직
const stages = computed(() => {
  const phase = data.value!.phase
  return {
    collect: phase === 'collect' ? 'now' : 'done',
    vote: phase === 'collect' ? 'todo' : phase === 'confirmed' ? 'done' : 'now',
    notice: phase !== 'confirmed' ? 'todo' : noticed.value ? 'done' : 'now',
  }
})
const STAGE_LABELS: Record<string, string> = { done: '끝', now: '지금', todo: '대기' }

const stepTime = (key: PartyWeekStep) => {
  const step = data.value!.steps.find(s => s.key === key)!
  if (!step.at) return { ...step, text: '확정 뒤 정해져요' }
  const text = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(step.at)).replace(/[()]/g, '')
  return { ...step, text }
}
const autos = (keys: PartyWeekStep[]) => keys.map(stepTime)
</script>

<template>
  <main class="page">
    <section v-if="!data" class="card">
      <p class="brand">레다봇</p>
      <h1>링크를 열 수 없어요</h1>
      <p class="sub">{{ openError }}</p>
    </section>

    <template v-else>
      <header class="head">
        <p class="brand">레다봇 · {{ data.partyName }}</p>
        <div class="title">
          <h1>파티장 화면</h1>
          <NuxtLink class="btn ghost compact" :to="{ path: '/party/time', query: { p: partyId } }">내 시간표</NuxtLink>
        </div>
        <p class="sub">{{ formatDayWeek(data.week) }} ~ {{ formatDayWeek(addDays(data.week, 6)) }} · 버튼을 누르면 파티 채널에 올라가요</p>
      </header>

      <p class="note" :class="{ bad: failed, on: message }" role="status">{{ message || '정해진 시각에 알아서 올라가요. 먼저 올리고 싶을 때만 눌러 주세요.' }}</p>

      <section class="card stage" :class="stages.collect">
        <div class="stage-head">
          <span class="no">1</span>
          <h2>시간 모으기</h2>
          <span class="pill">{{ STAGE_LABELS[stages.collect] }}</span>
        </div>
        <p class="count">제출 <b>{{ submitted }}</b> / {{ data.members.length }}</p>
        <ul class="chips">
          <li v-for="m in data.members" :key="m.character" :class="{ on: m.submitted }">{{ m.character }}</li>
        </ul>
        <div class="actions">
          <button type="button" class="btn compact" :disabled="busy" @click="run('announce')">알림 올리기</button>
          <button type="button" class="btn ghost compact" :disabled="busy || data.phase !== 'collect'" @click="run('remindSubmit')">미제출자 태그</button>
        </div>
        <ul class="autos">
          <li v-for="s in autos(['announce', 'remindSubmit'])" :key="s.key" :class="{ done: s.done }">{{ s.label }} · {{ s.text }}</li>
        </ul>
      </section>

      <section class="card stage" :class="stages.vote">
        <div class="stage-head">
          <span class="no">2</span>
          <h2>투표와 확정</h2>
          <span class="pill">{{ STAGE_LABELS[stages.vote] }}</span>
        </div>

        <template v-if="data.candidates.length">
          <p class="count">투표 <b>{{ voted }}</b> / {{ data.members.length }}</p>
          <ul class="chips">
            <li v-for="m in data.members" :key="m.character" :class="{ on: m.voted }">{{ m.character }}</li>
          </ul>
          <ol class="ranking">
            <li v-for="(c, i) in data.candidates" :key="c.slot">
              <button
                type="button"
                class="rank"
                :class="{ picked: picked === c.slot, confirmed: data.confirmed?.slot === c.slot }"
                :disabled="c.conflict"
                :aria-pressed="picked === c.slot"
                @click="picked = picked === c.slot ? null : c.slot"
              >
                <span class="place">{{ i + 1 }}위</span>
                <span class="when">{{ c.label }}<small v-if="c.conflict">파티원 일정과 겹쳐요</small><small v-else-if="c.missing">한 명 안 됨</small><small v-else-if="data.confirmed?.slot === c.slot">확정</small></span>
                <span class="bar"><i :style="{ width: `${data.members.length ? c.votes / data.members.length * 100 : 0}%` }" /></span>
                <span class="votes">{{ c.votes }}표</span>
              </button>
            </li>
          </ol>
        </template>
        <p v-else class="sub">시간 적기를 마감하면 모두 되는 시간에서 후보를 10개까지 뽑아 채널에 투표를 올려요.</p>

        <div class="actions">
          <button type="button" class="btn compact" :disabled="busy || data.phase !== 'collect'" @click="run('startVote')">마감하고 투표 시작</button>
          <button type="button" class="btn ghost compact" :disabled="busy || data.phase !== 'vote'" @click="run('askConfirm')">투표 마감</button>
          <button type="button" class="btn compact" :disabled="busy || picked === null" @click="act({ action: 'pick', slot: picked! })">{{ picked === null ? '시간을 눌러 고르기' : '이 시간으로 확정' }}</button>
        </div>
        <ul class="autos">
          <li v-for="s in autos(['startVote', 'askConfirm', 'autoConfirm'])" :key="s.key" :class="{ done: s.done }">{{ s.label }} · {{ s.text }}</li>
        </ul>
      </section>

      <section class="card stage" :class="stages.notice">
        <div class="stage-head">
          <span class="no">3</span>
          <h2>공지</h2>
          <span class="pill">{{ STAGE_LABELS[stages.notice] }}</span>
        </div>
        <p v-if="data.confirmed" class="confirmed">{{ data.confirmed.label }}</p>
        <p v-else class="sub">시간을 확정하면 여기에 보여요.</p>
        <p v-if="data.changeOpen" class="sub">일정 변경 요청이 진행 중이에요.</p>
        <div class="actions">
          <button type="button" class="btn compact" :disabled="busy || !data.confirmed" @click="run('notice')">지금 공지</button>
          <button type="button" class="btn ghost compact" :disabled="busy || !data.confirmed" @click="run('remindBoss')">30분 전 알림</button>
        </div>
        <ul class="autos">
          <li v-for="s in autos(['notice', 'remindBoss'])" :key="s.key" :class="{ done: s.done }">{{ s.label }} · {{ s.text }}</li>
        </ul>
      </section>

      <section class="card">
        <h2>이번 주만 다르게 잡기</h2>
        <p class="sub">이번 주 진행을 처음으로 되돌리고, 고른 요일과 마감으로 지금 알림을 올려요. 마감 3시간 전 미제출 태그, 마감에 투표 시작, 3시간 뒤 투표 마감, 6시간 뒤 공지예요.<template v-if="data.customFromDay !== null"> 지금은 따로 잡은 일정으로 진행 중이에요.</template></p>
        <div class="field">
          <span>이 요일부터 받기</span>
          <div class="chips">
            <button v-for="day in weekDays" :key="day.d" type="button" class="pick" :class="{ on: customFromDay === day.d }" :aria-pressed="customFromDay === day.d" @click="customFromDay = day.d">{{ day.label }}</button>
          </div>
        </div>
        <label class="field" for="lead-deadline">
          <span>시간 적기 마감</span>
          <input id="lead-deadline" v-model="customDeadline" type="datetime-local">
        </label>
        <div class="actions">
          <button type="button" class="btn compact" :class="{ ghost: !customArmed }" :disabled="busy || !customDeadline" @click="startCustom">{{ customArmed ? '한 번 더 누르면 전원에게 알림이 가요' : '이 일정으로 다시 시작' }}</button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page {
  max-width: 560px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: 20px 16px 40px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.brand {
  margin: 0 0 4px;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 15px;
}
.title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
h1 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 24px;
  font-weight: 400;
}
h2 {
  margin: 0;
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.sub {
  margin: 4px 0 0;
  color: var(--sub);
  font-size: 14px;
}
.note {
  min-height: 42px;
  margin: 0;
  padding: 10px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--sub);
  font-size: 14px;
}
.note.on {
  border-color: var(--gain);
  color: var(--text);
}
.note.bad {
  border-color: var(--loss);
  color: var(--loss);
}

.card {
  padding: 14px;
  background: var(--win);
  border: 1px solid var(--win-line);
  border-radius: 10px;
}
.stage.now {
  border-color: var(--gold);
}
.stage.todo {
  opacity: 0.6;
}
.stage-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.no {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 50%;
  font-family: var(--f-pixel);
  font-size: 12px;
}
.now .no {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.pill {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 12px;
}
.now .pill {
  border-color: var(--gold);
  color: var(--gold);
}
.done .pill {
  border-color: var(--gain);
  color: var(--gain);
}

.count {
  margin: 0 0 8px;
  color: var(--sub);
  font-size: 14px;
}
.count b {
  color: var(--text);
  font-size: 18px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.chips li {
  padding: 4px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font-size: 13px;
}
.chips li.on {
  border-color: var(--gain);
  color: var(--text);
}
.chips li.on::before {
  content: "✓ ";
  color: var(--gain);
}

.ranking {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
.rank {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 72px 34px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 6px 10px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.rank:disabled {
  cursor: default;
  opacity: 0.5;
}
.rank.confirmed {
  border-color: var(--gain);
}
.rank.picked {
  border-color: var(--gold);
  box-shadow: 0 0 0 1px var(--gold);
}
.place {
  color: var(--sub);
  font-size: 13px;
}
.when small {
  display: block;
  color: var(--sub);
  font-size: 11px;
}
.rank.confirmed .when small {
  color: var(--gain);
}
.bar {
  height: 8px;
  background: var(--field);
  border-radius: 999px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--gold);
  border-radius: 999px;
}
.votes {
  text-align: right;
  font-size: 13px;
}

.confirmed {
  margin: 0;
  font-family: var(--f-title);
  font-size: 26px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.field {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  font-size: 14px;
}
.field input {
  min-height: 44px;
  padding: 0 12px;
  background: var(--field);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  color: var(--text);
  font-family: inherit;
  font-size: 16px;
}
.pick {
  min-height: 34px;
  padding: 0 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.pick.on {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--on-gold);
}
.actions .btn:disabled {
  cursor: default;
}
.autos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 12px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--panel-line);
  list-style: none;
  color: var(--sub);
  font-size: 12px;
}
.autos li::before {
  content: "⏳ ";
}
.autos li.done::before {
  content: "✓ ";
  color: var(--gain);
}
</style>
