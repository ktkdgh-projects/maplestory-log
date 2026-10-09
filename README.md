# maplestory-log

내 메이플스토리 캐릭터의 하루하루를 게임 화면 모양으로 기록하는 웹. 사용자가 자기 넥슨 Open API 키를 등록해서 쓴다.

Data based on NEXON Open API.

## 시작하기

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev            # http://localhost:3000
```

Node.js 20 이상 필요 (개발 환경: Node 24 LTS).

## 기술 스택

- Nuxt 4 (Vue 3, TypeScript), 서버는 Nitro `server/api`
  - `nuxt`는 4.5.2로 고정. 4.6.0은 렌더링 시 `Either manifest or precomputed data must be provided` 500 오류가 나서 고쳐질 때까지 올리지 않는다
- MongoDB Atlas
- Vercel 배포 + Vercel Cron (`vercel.json`, 매일 KST 04:00)

## 폴더 구조

Nuxt 4 기본 디렉터리 구조를 따른다.

```
app/                    # 브라우저에서 도는 Vue 앱
├ app.vue
├ assets/css/tokens.css # 색·폰트 토큰
├ components/           # GameWindow, ItemSlot, GameTooltip, SourceBadge, ExpBar, MenuButton, FieldScene
├ layouts/default.vue   # 메뉴 바 + 출처 표기
├ pages/                # index(캐릭터), growth, login, me, guide/api-key, terms, privacy
└ utils/format.ts       # 메소 표기
shared/                 # 앱·서버 공용 (KST 날짜, 타입)
server/
├ middleware/auth.ts    # 쿠키 → 세션 → 사용자
├ utils/                # mongo, nexon, crypto, session, userKey, rateLimit, snapshot
└ api/                  # auth, me, character, snapshots, cron
public/
```

## 환경 변수

`.env.example`에 이름만 있다. 실제 값은 `.env`(로컬)와 Vercel 환경 변수에만 두고 커밋하지 않는다.

## 커밋 규칙

`type(scope): 간단한 설명`

예: `feat(login): API 키 등록 화면 추가`, `fix(cron): KST 어제 날짜 계산 수정`
