<script setup lang="ts">
import type { AdminOverview } from '#shared/types'

const { me } = await useMe()
if (!me.value?.isAdmin) throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없어요.' })

const { data, error, refresh } = await useFetch<AdminOverview>('/api/admin/overview')
const busy = ref(false)
const failure = ref('')

async function setPaused(paused: boolean) {
  busy.value = true
  failure.value = ''
  try {
    await $fetch('/api/admin/pause', { method: 'PUT', body: { paused } })
    await refresh()
  }
  catch (e) {
    failure.value = errorMessage(e)
  }
  finally {
    busy.value = false
  }
}

const KEY_LABELS = { valid: '정상', rate_limited: '한도 초과', invalid: '무효', deleted: '삭제' } as const

useHead({ title: '운영 · 메이플스토리로그' })
</script>

<template>
  <GameWindow class="fit" title="운영" sub="관리자만 볼 수 있어요" accent="purple" fill>
    <p v-if="error || failure" class="form-error">{{ failure || errorMessage(error) }}</p>
    <template v-if="data">
      <div class="pause" :class="{ on: data.paused }">
        <div>
          <b>{{ data.paused ? '수집 멈춤' : '수집 중' }}</b>
          <small class="muted">{{ data.paused ? `${formatDateTime(data.pausedAt!)}부터 Cron·접속 시 채우기·강화 기록 모으기를 모두 멈췄어요` : '넥슨 점검 때는 멈춰 두면 실패 기록이 쌓이지 않아요' }}</small>
        </div>
        <button type="button" class="btn" :class="data.paused ? '' : 'danger'" :disabled="busy" @click="setPaused(!data.paused)">{{ data.paused ? '수집 다시 시작' : '수집 멈추기' }}</button>
      </div>

      <div class="tiles stagger">
        <div class="tile" style="--tone: var(--gold)">
          <span class="tile-label">전체 사용자</span>
          <span class="tile-value">{{ data.users.total }}</span>
          <span class="tile-label">30일 안에 접속 {{ data.users.active30d }}</span>
        </div>
        <div class="tile" style="--tone: var(--api)">
          <span class="tile-label">키 상태</span>
          <span class="keys">
            <span v-for="(label, status) in KEY_LABELS" :key="status">{{ label }} <b>{{ data.users.byKeyStatus[status] }}</b></span>
          </span>
        </div>
        <div class="tile" style="--tone: var(--gain)">
          <span class="tile-label">오늘 수집</span>
          <span class="tile-value">{{ data.today.ok }}</span>
          <span class="tile-label">빈 날 {{ data.today.empty }} · <span :class="{ loss: data.today.failed }">실패 {{ data.today.failed }}</span></span>
        </div>
        <div class="tile" style="--tone: var(--calc)">
          <span class="tile-label">남은 수집 작업</span>
          <span class="tile-value">{{ data.jobs.pending + data.jobs.running }}</span>
          <span class="tile-label">진행 중 {{ data.jobs.running }} · <span :class="{ loss: data.jobs.failed }">실패로 멈춤 {{ data.jobs.failed }}</span></span>
        </div>
      </div>

      <div class="logs-head">
        <h3>최근 수집 로그</h3>
        <button type="button" class="btn ghost compact" @click="refresh()">새로고침</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>시각</th><th>사용자</th><th>캐릭터</th><th>날짜</th><th>결과</th><th class="num">걸린 시간</th></tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in data.logs" :key="i">
              <td>{{ formatDateTime(l.at) }}</td>
              <td class="mono">…{{ l.user }}</td>
              <td class="mono">{{ l.ocid }}…</td>
              <td>{{ l.date }}</td>
              <td :class="l.result === 'ok' ? 'gain' : l.result === 'empty' ? 'sub' : 'loss'">{{ l.result }}</td>
              <td class="num">{{ l.ms }}ms</td>
            </tr>
            <tr v-if="!data.logs.length"><td colspan="6" class="muted empty">로그가 없어요.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
  </GameWindow>
</template>

<style scoped>
.pause {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: rgb(127 217 154 / 0.08);
  border: 1px solid var(--gain);
  border-radius: 10px;
}
.pause.on {
  background: rgb(255 138 122 / 0.08);
  border-color: var(--loss);
}
.pause > div {
  display: grid;
}
.pause b {
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  padding-top: 4px;
  font-size: 14px;
}
.keys b {
  font-family: var(--f-title);
  font-weight: 400;
}
.logs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h3 {
  margin: 0;
  color: var(--gold);
  font-family: var(--f-title);
  font-size: 18px;
  font-weight: 400;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th {
  position: sticky;
  top: 0;
  padding: 7px 10px;
  background: var(--title);
  color: var(--sub);
  font-family: var(--f-title);
  font-weight: 400;
  text-align: left;
}
td {
  padding: 5px 10px;
  border-top: 1px solid rgb(58 67 102 / 0.6);
  white-space: nowrap;
}
.num {
  text-align: right;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
}
.sub {
  color: var(--sub);
}
.empty {
  padding: 16px;
  text-align: center;
}
@media (max-width: 900px) {
  .tiles {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
