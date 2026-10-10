<script setup lang="ts">
useHead({ title: 'API 키 발급 안내 · 메이플스토리로그' })

const { me } = await useMe()

// 넥슨 Open API 애플리케이션 등록·목록 화면. 로그인 전이면 로그인 뒤 이 화면으로 돌아온다
const CREATE_APP_URL = 'https://openapi.nexon.com/ko/my-application/create-app/'
const MY_APPS_URL = 'https://openapi.nexon.com/ko/my-application/'

const STEPS = [
  { kind: 'open', title: '애플리케이션 등록 화면 열기', text: '기록할 캐릭터가 있는 넥슨 계정으로 로그인하면 바로 등록 화면이 떠요.' },
  { kind: 'form', title: '약관 동의하고 정보 입력', text: 'Open API 서비스 이용약관에 동의하고 아래처럼 적어요. 서비스명·소개는 아무거나 적어도 돼요.' },
  { kind: 'submit', title: '애플리케이션 등록', text: '입력을 마치고 등록 버튼을 눌러요.' },
  { kind: 'key', title: 'API 키 복사', text: '애플리케이션 목록에서 방금 만든 서비스명을 누르면, 기본 정보에 API 키가 있어요.' },
  { kind: 'paste', title: '여기에 붙여넣기', text: '키 등록 칸에 붙여넣으면 끝이에요.' },
] as const

// 등록 화면에 적을 값. 복사 버튼으로 바로 붙여넣을 수 있게 한다
const SITE_URL = 'https://maplestory-log.vercel.app'
const FIELDS = [
  { label: '게임 선택', value: '메이플스토리' },
  { label: '애플리케이션 타입', value: '서비스 단계' },
  { label: '대표 언어', value: '한국어' },
  { label: '출시할 서비스명', value: '메이플스토리로그', copy: true, example: true },
  { label: '서비스 소개', value: '성장·강화 기록 보기', copy: true, example: true },
  { label: '개발 환경', value: 'WEB' },
  { label: 'URL 정보', value: SITE_URL, copy: true },
]
const copied = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | undefined
async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = value
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copied.value = null), 1500)
  }
  catch {}
}

const UNLOCKS = [
  { label: '메소 가계부', hint: '사냥·보스·판매 달력' },
  { label: '장비 결산', hint: '구매·강화·판매 시트' },
  { label: '강화 기록', hint: '스타포스·잠재 자동 수집' },
  { label: '강화 결산', hint: '그날 이득·손해와 운' },
  { label: '성장 자동 기록', hint: '캐릭터 6명 매일' },
  { label: '메모장', hint: '아무거나 적어 두기' },
]

const NOTES = [
  { tone: 'gold', title: '꼭 내 계정에서 발급', text: '스타포스·큐브 사용 기록은 키를 발급한 계정의 기록만 나와요.' },
  { tone: 'blue', title: '암호화해서 보관', text: '화면엔 끝 네 자리만 보여요. 내 정보에서 언제든 지울 수 있어요.' },
  { tone: 'red', title: '남에게 보여주지 않기', text: '새어 나갔다면 넥슨 Open API에서 다시 발급하고, 내 정보에서 새 키로 바꿔 주세요.' },
] as const
</script>

<template>
  <div class="page fit guide">
    <GameWindow title="API 키 발급 안내" sub="넥슨 로그인이 아니에요 · 5분이면 끝나요">
      <div class="hero">
        <div class="npc">
          <img src="/favicon.svg" alt="" class="face">
          <p class="say">
            넥슨 비밀번호 없이, 직접 발급한 <b>API 키</b>만으로 내 캐릭터 기록을 모아 드려요.
          </p>
        </div>
        <div class="hero-actions">
          <a :href="CREATE_APP_URL" target="_blank" rel="noopener" class="btn ghost">애플리케이션 등록 열기 ↗</a>
          <NuxtLink v-if="!me" to="/login" class="btn"><svg class="key-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l3 3M14 9l2 2" /></svg>키 등록하러 가기</NuxtLink>
          <NuxtLink v-else to="/me" class="btn ghost">내 키 관리 →</NuxtLink>
        </div>
      </div>
    </GameWindow>

    <div class="cols">
      <GameWindow class="steps-win" title="발급 순서" :sub="`${STEPS.length}단계`" accent="blue" fill>
        <ol class="steps stagger">
          <li v-for="(s, i) in STEPS" :key="s.title" class="step">
            <span class="num">{{ i + 1 }}</span>
            <div class="step-body">
              <b>{{ s.title }}</b>
              <p>{{ s.text }}</p>
              <a v-if="s.kind === 'open'" :href="CREATE_APP_URL" target="_blank" rel="noopener" class="btn compact open">애플리케이션 등록 열기 ↗</a>
              <dl v-if="s.kind === 'form'" class="fields">
                <template v-for="f in FIELDS" :key="f.label">
                  <dt>{{ f.label }}</dt>
                  <dd>
                    <span class="value">{{ f.value }}</span>
                    <small v-if="f.example" class="muted">예시</small>
                    <button v-if="f.copy" type="button" class="copy" :class="{ done: copied === f.value }" :aria-label="`${f.label} 복사`" :title="copied === f.value ? '복사했어요' : '복사'" @click="copy(f.value)">
                      <svg v-if="copied === f.value" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></svg>
                    </button>
                  </dd>
                </template>
              </dl>
              <template v-if="s.kind === 'key'">
                <a :href="MY_APPS_URL" target="_blank" rel="noopener" class="step-link">애플리케이션 목록 열기 ↗</a>
                <span class="key-sample" aria-label="키 예시">
                  <code>live_</code><i>또는</i><code>test_</code><span class="muted">로 시작해요</span>
                </span>
              </template>
              <template v-if="s.kind === 'paste'">
                <NuxtLink v-if="!me" to="/login" class="step-link">키 등록 칸으로 →</NuxtLink>
                <span v-else class="done">이미 등록했어요 ✓</span>
              </template>
            </div>
          </li>
        </ol>
      </GameWindow>

      <div class="side">
        <GameWindow title="알아두세요" accent="red" fill>
          <ul class="notes stagger">
            <li v-for="n in NOTES" :key="n.title" class="note" :class="n.tone">
              <b>{{ n.title }}</b>
              <p>{{ n.text }}</p>
            </li>
          </ul>
        </GameWindow>

        <GameWindow title="키를 넣으면 열려요" accent="green" fill>
          <ul class="unlocks stagger">
            <li v-for="u in UNLOCKS" :key="u.label">
              <b>{{ u.label }}</b>
              <span>{{ u.hint }}</span>
            </li>
          </ul>
          <p class="muted small">캐릭터 검색, 계산기, 썬데이는 키 없이도 쓸 수 있어요.</p>
        </GameWindow>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.npc {
  display: flex;
  flex: 1 1 420px;
  gap: 14px;
  align-items: center;
}
.face {
  flex: none;
  width: 54px;
  height: 54px;
  padding: 7px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  animation: bob 2.4s ease-in-out infinite;
}
.say {
  position: relative;
  margin: 0;
  padding: 9px 16px;
  background: var(--bar);
  border: 2px solid var(--tip-line);
  border-radius: 10px;
  font-size: 15px;
  line-height: 1.6;
  animation: rise-in 0.5s var(--ease-out) 0.15s backwards;
}
/* 말풍선 꼬리 */
.say::before {
  content: "";
  position: absolute;
  top: 50%;
  left: -9px;
  width: 14px;
  height: 14px;
  background: var(--bar);
  border-bottom: 2px solid var(--tip-line);
  border-left: 2px solid var(--tip-line);
  transform: translateY(-50%) rotate(45deg);
}
.say b {
  color: var(--gold);
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.side {
  display: grid;
  gap: 16px;
}

/* 발급 순서: 번호 원을 세로 선으로 잇는다 */
.steps {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}
.step {
  position: relative;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 14px;
  padding-bottom: 18px;
}
.step:last-child {
  padding-bottom: 0;
}
.step:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 38px;
  bottom: 2px;
  left: 17px;
  width: 2px;
  background: linear-gradient(var(--api), var(--panel-line));
  opacity: 0.5;
}
.num {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  background: var(--bar);
  border: 2px solid var(--api);
  border-radius: 50%;
  box-shadow: 0 0 12px rgb(127 178 255 / 0.25);
  color: var(--api);
  font-family: var(--f-title);
  font-size: 18px;
}
.step:last-child .num {
  border-color: var(--gold);
  box-shadow: 0 0 12px rgb(242 193 78 / 0.3);
  color: var(--gold);
}
.step-body {
  display: grid;
  justify-items: start;
  gap: 4px;
  padding: 8px 14px 12px;
  background: rgb(255 255 255 / 0.02);
  border: 1px solid var(--panel-line);
  border-radius: 10px;
}
.step-body b {
  font-family: var(--f-title);
  font-size: 17px;
  font-weight: 400;
}
.step-body p {
  margin: 0;
  color: var(--sub);
  font-size: 14px;
  line-height: 1.55;
}
.step-link {
  color: var(--api);
  font-size: 13px;
  text-decoration: none;
}
.step-link:hover {
  text-decoration: underline;
}
.open {
  margin-top: 4px;
}
/* 등록 화면 입력값: 왼쪽 항목, 오른쪽 값 */
.fields {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  width: 100%;
  margin: 6px 0 0;
  overflow: hidden;
  border: 1px solid var(--panel-line);
  border-radius: 8px;
  font-size: 13.5px;
}
.fields dt,
.fields dd {
  margin: 0;
  padding: 7px 12px;
  border-bottom: 1px solid var(--panel-line);
}
.fields dt:last-of-type,
.fields dd:last-of-type {
  border-bottom: 0;
}
.fields dt {
  background: var(--bar);
  color: var(--sub);
}
.fields dd {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.value {
  overflow: hidden;
  color: var(--text);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fields small {
  font-size: 11.5px;
}
.copy {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 26px;
  margin-left: auto;
  padding: 0;
  background: var(--bar);
  border: 1px solid var(--panel-line);
  border-radius: 5px;
  color: var(--sub);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.copy:hover {
  border-color: var(--tip-line);
  color: var(--text);
}
.copy svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.copy.done {
  border-color: var(--gain);
  color: var(--gain);
}
.key-sample {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 13px;
}
.key-sample code {
  padding: 2px 8px;
  background: var(--bar);
  border: 1px solid var(--tip-line);
  border-radius: 5px;
  color: var(--gold);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
}
.key-sample i {
  color: var(--sub);
  font-style: normal;
}
.done {
  color: var(--gain);
  font-size: 13px;
}

/* 알아두세요: 색 막대로 성격을 나눈다 */
.notes {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.note {
  --tone: var(--gold);
  display: grid;
  gap: 2px;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--tone) 6%, transparent);
  border: 1px solid var(--panel-line);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
}
.note.blue {
  --tone: var(--api);
}
.note.red {
  --tone: var(--loss);
}
.note b {
  color: var(--tone);
  font-size: 14px;
}
.note p {
  margin: 0;
  color: var(--sub);
  font-size: 13px;
  line-height: 1.55;
}

.unlocks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.unlocks li {
  display: grid;
  gap: 1px;
  padding: 7px 12px;
  background: rgb(127 217 154 / 0.05);
  border: 1px solid var(--panel-line);
  border-radius: 8px;
}
.unlocks b {
  font-size: 14px;
}
.unlocks span {
  color: var(--sub);
  font-size: 12px;
}
.small {
  font-size: 13px;
}
/* 넓은 화면은 한 화면에 맞추고 발급 순서만 안에서 스크롤한다 */
@media (min-width: 1100px) and (min-height: 700px) {
  /* 아주 큰 화면에서 오른쪽 칸이 휑하게 늘어나지 않게 높이에 상한을 둔다 */
  .guide {
    grid-template-rows: auto minmax(0, 1fr);
    max-height: 860px;
  }
  .cols {
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
    min-height: 0;
  }
  .steps-win,
  .side {
    min-height: 0;
  }
  .side {
    grid-template-rows: minmax(min-content, 1fr) minmax(min-content, 1fr);
  }
  .side > * {
    min-height: 0;
  }
  /* 칸이 창 높이를 나눠 채운다 */
  .notes,
  .unlocks {
    flex: 1;
    grid-auto-rows: 1fr;
    min-height: 0;
  }
  .note,
  .unlocks li {
    align-content: center;
  }
  .steps {
    flex: 1;
    min-height: 0;
    margin-right: -8px;
    padding-right: 8px;
    overflow-y: auto;
  }
}
@media (max-width: 900px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  /* 좁은 화면은 항목 이름 아래에 값을 둔다 */
  .fields {
    grid-template-columns: 1fr;
  }
  .fields dt {
    padding: 5px 12px;
    border-bottom: 0;
    font-size: 12px;
  }
  .unlocks {
    grid-template-columns: 1fr;
  }
  .hero-actions .btn {
    flex: 1;
  }
}
</style>
