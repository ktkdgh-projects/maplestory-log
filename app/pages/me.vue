<script setup lang="ts">
import type { CharacterBrief, SessionInfo } from '#shared/types'
import { MVP_DISCOUNTS } from '#shared/data/starforce'

const { me, refresh } = await useMe()
if (!me.value) await navigateTo('/login')

const KEY_STATUS = {
  valid: { label: '정상', tone: 'gain' },
  invalid: { label: '무효', tone: 'loss' },
  rate_limited: { label: '호출 한도 초과', tone: 'warn' },
  deleted: { label: '삭제됨', tone: 'muted' },
} as const

const { data: sessions, refresh: refreshSessions } = await useFetch<SessionInfo[]>('/api/me/sessions', {
  default: () => [],
  immediate: !!me.value,
})

const busy = ref(false)
const message = ref('')
const failure = ref('')

async function run(action: () => Promise<unknown>, done: string) {
  busy.value = true
  failure.value = ''
  message.value = ''
  try {
    await action()
    message.value = done
  }
  catch (error) {
    failure.value = errorMessage(error)
  }
  finally {
    busy.value = false
  }
}

// 목록을 창 안에 펼치면 옆·아래 창이 눌려서 모달로 띄운다
const characters = ref<CharacterBrief[] | null>(null)
const pickerOpen = ref(false)
const openPicker = () => run(async () => {
  characters.value ??= await $fetch<CharacterBrief[]>('/api/me/characters')
  pickerOpen.value = true
}, '')
const pickMain = (ocid: string) => run(async () => {
  await $fetch('/api/me/main', { method: 'PUT', body: { ocid } })
  pickerOpen.value = false
  await refresh()
}, '대표 캐릭터를 바꿨어요. 지난 기록을 채우기 시작해요.')

// 누르는 즉시 칩을 바꾸고 저장한다. 실패하면 원래대로
const mvp = ref(me.value?.mvpDiscount ?? 0)
async function pickMvp(rate: number) {
  const before = mvp.value
  mvp.value = rate
  failure.value = ''
  try {
    await $fetch('/api/me/mvp', { method: 'PUT', body: { rate } })
    await refresh()
  }
  catch (error) {
    mvp.value = before
    failure.value = errorMessage(error)
  }
}

const newKey = ref('')
const replaceKey = () => run(async () => {
  await $fetch('/api/me/key', { method: 'PUT', body: { apiKey: newKey.value } })
  newKey.value = ''
  await Promise.all([refresh(), refreshSessions()])
}, '키를 바꿨어요. 다른 기기는 모두 로그아웃됐어요.')

const logoutDevice = (id: string) => run(async () => {
  await $fetch(`/api/me/sessions/${id}`, { method: 'DELETE' })
  await refreshSessions()
}, '그 기기에서 로그아웃했어요.')

async function leave(path: string, body?: object) {
  await run(async () => {
    await $fetch(path, { method: 'DELETE', body })
    await refresh()
    await navigateTo('/')
  }, '')
}

const EXPORTS = [
  { label: '전체 JSON', format: 'json', table: null },
  { label: '사냥 CSV', format: 'csv', table: 'hunts' },
  { label: '조각 판매 CSV', format: 'csv', table: 'sales' },
  { label: '보스 CSV', format: 'csv', table: 'clears' },
  { label: '장비 결산 CSV', format: 'csv', table: 'items' },
  { label: '강화 기록 CSV', format: 'csv', table: 'enhance' },
] as const
const exportKey = ref('')
const download = (item: typeof EXPORTS[number]) => run(async () => {
  const blob = await $fetch<Blob>('/api/me/export', { method: 'POST', body: { apiKey: exportKey.value, format: item.format, table: item.table }, responseType: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `maplelog-${item.table ?? 'all'}-${kstToday()}.${item.format}`
  a.click()
  URL.revokeObjectURL(a.href)
}, '내려받았어요.')

const confirmTarget = ref<'key' | 'account' | null>(null)
const confirmKey = ref('')
const confirmLabels = { key: '키 삭제', account: '탈퇴' }
function confirmDanger() {
  const path = confirmTarget.value === 'key' ? '/api/me/key' : '/api/me'
  return leave(path, { apiKey: confirmKey.value })
}

useHead({ title: '내 정보 · 메이플스토리로그' })
</script>

<template>
  <div v-if="me" class="page fit">
    <Transition name="fade">
      <p v-if="message" class="notice" role="status">{{ message }}</p>
    </Transition>
    <p v-if="failure" class="form-error" role="alert">{{ failure }}</p>

    <div class="board">
      <GameWindow title="대표 캐릭터" accent="green">
        <div v-if="me.main" class="main">
          <div class="portrait">
            <CharacterSprite v-if="me.main.imageUrl" :src="me.main.imageUrl" :scale="0.9" />
          </div>
          <div class="main-info">
            <b class="name">{{ me.main.name }}</b>
            <div class="muted small">{{ me.main.world }} · {{ me.main.job }} · LV.{{ me.main.level }}</div>
          </div>
          <button class="btn ghost" :disabled="busy" @click="openPicker">바꾸기</button>
        </div>
        <template v-else>
          <p class="muted">아직 고르지 않았어요.</p>
          <div><button class="btn" :disabled="busy" @click="openPicker">고르기</button></div>
        </template>
        <div class="mvp">
          <span class="mvp-label">MVP 등급 <small>스타포스 비용 할인(강화 기록·계산기)과 경매장 수수료(실버 이상 3%)에 써요</small></span>
          <div class="mvp-chips" role="group" aria-label="MVP 등급">
            <button v-for="d in MVP_DISCOUNTS" :key="d.label" type="button" :aria-pressed="mvp === d.rate" :disabled="busy" @click="pickMvp(d.rate)">{{ d.label }}</button>
          </div>
        </div>
      </GameWindow>
      <AppModal v-model="pickerOpen" title="대표 캐릭터 고르기">
        <CharacterPicker v-if="characters" :characters="characters" :current-ocid="me.main?.ocid" :busy="busy" @pick="pickMain" />
      </AppModal>

      <GameWindow title="API 키">
        <dl class="kv">
          <div><dt>등록된 키</dt><dd class="mono">{{ me.keyLast4 ? `••••${me.keyLast4}` : '없음' }}</dd></div>
          <div><dt>상태</dt><dd :class="KEY_STATUS[me.keyStatus].tone">{{ KEY_STATUS[me.keyStatus].label }}</dd></div>
          <div><dt>마지막 확인</dt><dd>{{ me.keyCheckedAt ? formatDateTime(me.keyCheckedAt) : '-' }}</dd></div>
        </dl>
        <form class="row" @submit.prevent="replaceKey" novalidate>
          <label class="sr-only" for="new-key">새 API 키</label>
          <input id="new-key" v-model="newKey" class="field-input" type="password" autocomplete="off" placeholder="새 키로 바꾸기">
          <button class="btn" :disabled="busy">교체</button>
        </form>
        <p class="muted small">같은 넥슨 계정에서 발급한 키만 바꿀 수 있어요. 기록은 그대로 이어져요.</p>
      </GameWindow>

      <GameWindow title="로그인된 기기" :sub="`${sessions.length}대`" accent="blue" fill>
        <TransitionGroup tag="ul" name="fade" class="devices">
          <li v-for="s in sessions" :key="s.id">
            <div class="device">
              <div class="device-name">
                <b class="ellipsis">{{ s.device }}</b>
                <span v-if="s.current" class="tag">지금 기기</span>
              </div>
              <div class="muted small ellipsis">{{ formatDateTime(s.lastUsedAt) }} · {{ s.remember ? '로그인 유지' : '브라우저 닫으면 종료' }}</div>
            </div>
            <button class="btn ghost compact" :disabled="busy" @click="s.current ? leave(`/api/me/sessions/${s.id}`) : logoutDevice(s.id)">로그아웃</button>
          </li>
        </TransitionGroup>
        <div><button class="btn ghost" :disabled="busy" @click="leave('/api/me/sessions')">모든 기기에서 로그아웃</button></div>
      </GameWindow>

      <GameWindow title="내 권리" accent="red">
        <dl class="kv">
          <div><dt>가입</dt><dd>{{ formatDateTime(me.createdAt) }}</dd></div>
          <div><dt>수집 동의</dt><dd>{{ formatDateTime(me.consentAt) }}</dd></div>
        </dl>
        <div class="export">
          <label for="export-key">내 기록 내려받기 (가계부·장비 결산·강화 기록) — 지금 등록된 API 키를 다시 입력해 주세요</label>
          <input id="export-key" v-model="exportKey" class="field-input" type="password" autocomplete="off">
          <div class="row">
            <button v-for="item in EXPORTS" :key="item.label" type="button" class="btn ghost compact" :disabled="busy || !exportKey" @click="download(item)">{{ item.label }}</button>
          </div>
        </div>

        <div v-if="!confirmTarget" class="row">
          <button class="btn danger" :disabled="!me.keyLast4" @click="confirmTarget = 'key'">키만 삭제</button>
          <button class="btn danger" @click="confirmTarget = 'account'">탈퇴</button>
        </div>
        <form v-else class="confirm" @submit.prevent="confirmDanger" novalidate>
          <p v-if="confirmTarget === 'key'">키를 지우면 자동 수집이 멈추고 모든 기기에서 로그아웃돼요. 지금까지의 기록은 남아요.</p>
          <p v-else>키와 계정 정보, 로그인 기기가 바로 지워지고 되돌릴 수 없어요.</p>
          <label for="confirm-key">확인을 위해 지금 등록된 API 키를 다시 입력해 주세요</label>
          <input id="confirm-key" v-model="confirmKey" class="field-input" type="password" autocomplete="off">
          <div class="row">
            <button class="btn danger" :disabled="busy">{{ confirmLabels[confirmTarget] }}</button>
            <button type="button" class="btn ghost" @click="confirmTarget = null; confirmKey = ''">취소</button>
          </div>
        </form>
      </GameWindow>
    </div>
  </div>
</template>

<style scoped>
.page.fit {
  display: flex;
  flex-direction: column;
}
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: start;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.row .field-input {
  flex: 1;
  width: auto;
}
.small {
  font-size: 13px;
}
.main {
  display: flex;
  align-items: center;
  gap: 14px;
}
.portrait {
  position: relative;
  flex: none;
  width: 96px;
  height: 104px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 60%, rgb(127 209 154 / 0.3), transparent 70%), var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
/* 캐릭터 틀(110×120)이 칸보다 커서 칸 안 가운데 바닥에 발을 맞춰 세운다 */
.portrait :deep(.sprite) {
  position: absolute;
  bottom: 10px;
  left: 50%;
  translate: -50% 0;
}
.mvp {
  display: grid;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px dashed var(--panel-line);
}
.mvp-label {
  font-size: 13px;
}
.mvp-label small {
  margin-left: 4px;
  color: var(--sub);
  font-size: 11.5px;
}
.mvp-chips {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.mvp-chips button {
  height: 32px;
  padding: 0 6px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 999px;
  color: var(--sub);
  font: inherit;
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--fast) ease, color var(--fast) ease;
}
.mvp-chips button:hover:not(:disabled) {
  border-color: var(--tip-line);
  color: var(--text);
}
.mvp-chips button[aria-pressed="true"] {
  background: rgb(242 193 78 / 0.12);
  border-color: var(--gold);
  color: var(--gold);
}
.main-info {
  flex: 1;
  min-width: 0;
}
.name {
  font-family: var(--f-title);
  font-size: 26px;
  font-weight: 400;
}
.devices {
  display: grid;
  align-content: start;
  gap: 8px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  list-style: none;
}
.devices li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--panel);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.device {
  flex: 1;
  min-width: 0;
}
.device-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tag {
  flex: none;
  padding: 1px 6px;
  border: 1px solid var(--gold);
  border-radius: 4px;
  color: var(--gold);
  font-size: 11px;
}
.notice {
  margin: 0;
  padding: 8px 12px;
  background: var(--bar);
  border: 1px solid var(--gain);
  border-radius: 6px;
  color: var(--gain);
}
.export {
  display: grid;
  gap: 6px;
}
.export label {
  color: var(--sub);
  font-size: 13px;
}
.confirm {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px dashed var(--loss);
  border-radius: 6px;
}
.confirm p {
  margin: 0;
}
.confirm label {
  color: var(--sub);
  font-size: 13px;
}
@media (min-width: 1100px) and (min-height: 700px) {
  .board {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto minmax(0, 1fr);
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }
  .devices {
    flex: 1;
    min-height: 0;
  }
}
</style>
