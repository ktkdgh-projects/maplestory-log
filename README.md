# 메이플스토리로그

내 메이플스토리 캐릭터의 하루하루를 게임 화면 모양으로 기록하는 웹. 사용자가 자기 넥슨 Open API 키를 등록해서 쓴다.

Data based on NEXON Open API. 넥슨의 공식 서비스가 아니다.

## 시작하기

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev            # http://localhost:3000
npm run typecheck
```

Node.js 20 이상 필요 (개발 환경: Node 24 LTS).

## 기능 (1단계)

- **키 로그인** `/login`: 넥슨 Open API 키를 등록하면 계정이 된다. 키는 AES-256-GCM으로 암호화해 서버에만 두고, 브라우저에는 `httpOnly` 자동 로그인 쿠키(`ml_session`)만 남긴다.
- **캐릭터** `/`: 대표 캐릭터 또는 닉네임 검색(상단 검색창).
  - 캐릭터 정보, 주요 능력치, 장비·어빌리티 프리셋 중 가장 센 조합 안내
  - 게임 장비창 배치(프리셋 1~3, 칭호·안드로이드 포함), 마우스를 올리면 아이템 툴팁
  - 어빌리티 프리셋 · 링크 스킬 · 세트 효과
  - 헥사(구간별 솔 에르다·조각), 심볼(구간별 메소·심볼 개수), 스탯, 유니온(월드별 캐릭터 목록)
- **성장** `/growth`: 날짜 발판 필드(발판 높이 = 그날 경험치), EXP ROAD, 기간 요약. 스냅샷은 매일 Cron이 모으고 빈 날은 접속할 때 채운다.
- **내 정보** `/me`: 대표 캐릭터 변경, 키 교체·삭제, 로그인 기기 관리, 탈퇴.

데스크톱(1100px 이상)은 한 화면에 들어오게, 모바일은 세로로 쌓이게 배치한다.

## 기술 스택

- Nuxt 4 (Vue 3, TypeScript), 서버는 Nitro `server/api`
  - `nuxt`는 4.5.2로 고정. 4.6.0은 렌더링 시 `Either manifest or precomputed data must be provided` 500 오류가 나서 고쳐질 때까지 올리지 않는다
- MongoDB Atlas (컬렉션 인덱스는 서버가 처음 DB에 붙을 때 만든다)
- Vercel 배포 + Vercel Cron (`vercel.json`, 매일 KST 04:00)

## 폴더 구조

Nuxt 4 기본 디렉터리 구조를 따른다.

- **컴포넌트**: 폴더는 묶음용이라 태그 이름에 폴더가 붙지 않는다(`nuxt.config`의 `pathPrefix: false`). 파일 이름이 곧 태그 이름이고(`ui/AppModal.vue` → `<AppModal>`), 기능 폴더 안 파일은 기능 이름으로 시작한다(`review/ReviewStarforceRow.vue`). 같은 파일 이름을 두 폴더에 두지 않는다.
- **계산식**: 순수 계산(Vue·DB·fetch 없음)은 `shared/calc`에 모아 화면·서버·Worker가 같이 쓴다. 자동 import 대상이 아니라 `import { planStarforce } from '#shared/calc/starforce'`처럼 직접 가져온다. 공식 비용표·확률표와 그 표를 찾는 함수는 `shared/data`에 출처와 함께 둔다.
- **자동 import**: `app/utils`, `app/composables`, `shared/utils`, `shared/types`, `server/utils`(최상위 파일만)는 Nuxt·Nitro가 자동으로 가져온다.

```
app/
├ assets/               # css(tokens·base·calc), 보스·물욕템 아이콘
├ components/
│ ├ ui/                 # 공용 입력·모달·선택·툴팁 (AppModal, AppSelect, DatePicker, MesoInput, ConfirmHost …)
│ ├ game/               # 게임 화면 모양 조각 (GameWindow, GameTooltip, ItemSlot, ExpBar, NpcSay, FieldScene)
│ ├ layout/             # 헤더·탭바·배경·검색
│ ├ auth/               # 키 등록 안내(KeyGate)·키 로그인
│ ├ admin/ legal/       # 관리자 썬데이 효과, 약관·개인정보 문서
│ ├ character/          # 캐릭터 화면 + 캐릭터 고르기·스프라이트·썸네일
│ └ growth/ ledger/ items/ enhance/ review/ memo/   # 페이지별 화면 조각
├ composables/          # useMe, useMemos, useEnhanceRecords, useReviewCompute, useStarforceWorker …
├ layouts/default.vue   # 메뉴 바 + 검색 + 출처 표기
├ pages/                # index(캐릭터), growth, ledger/*, items, starforce, potential, review, calc/*, sunday, me, login …
├ utils/                # 화면 도우미: 숫자·날짜 표기(format), 메뉴(nav), 키 안내(keyGates), 가계부 색·달력(ledger) …
└ workers/              # 스타포스 계산 Worker
shared/
├ calc/                 # 계산식 (아래 표)
├ data/                 # 공식 비용표·확률표·보스·해방·경매장 수수료 (출처 주석)
├ types/                # 앱·서버 공용 타입. 도메인별 파일, index.ts가 모두 다시 내보낸다
└ utils/                # 한국시간 날짜(kst), 큰 수 표기(number), 만 단위 메소 입력(meso), 썬데이 일정 …
server/
├ middleware/auth.ts    # CSRF 확인, 쿠키 → 세션 → 사용자
├ utils/                # mongo(컬렉션·캐시), nexon, crypto, session, 강화 기록·가계부·장비 결산 DB 처리
└ api/                  # auth, me, character, growth, ledger, items, enhance, review, sunday, memos, admin, cron …
```

| `shared/calc` | 계산 |
| --- | --- |
| `starforce.ts` | 한 번 누르는 비용, 흔적 복구 메소, 목표까지 기대값·분포 |
| `potential.ts` | 옵션 목표·조합 확률, 이룬 목표, 등급·옵션 모의 실험 |
| `liberation.ts` | 해방 단계별 끝나는 주 |
| `review.ts` | 강화 결산: 실제 비용을 기대값과 견준 운 |
| `combatPower.ts` | 프리셋 조합별 전투력 추정 |
| `growth.ts` | 날마다 얻은 경험치, 기간 요약·레벨업 예상일 |
| `ledger.ts` | 가계부 날짜별 수입·지출 합계, 시간당 메소 |
| `items.ts` | 장비 결산 판매 실수령·손익·합계 |
| `meso.ts` | 경매장 수수료, 조각 판매·직접 등록 금액 |
| `boss.ts` | 보스 수익(결정석 + 판 물욕템) |
| `random.ts` | 시드 고정 난수 |

## 환경 변수

`.env.example`에 이름만 있다. 실제 값은 `.env`(로컬)와 Vercel 환경 변수에만 두고 커밋하지 않는다. 로컬과 운영은 DB 이름과 암호화 시크릿을 다르게 쓴다.

## 데이터 출처

- 캐릭터·장비·유니온 등: 넥슨 Open API
- 헥사 강화 비용: 나무위키 「HEXA 매트릭스」 (2026-10-05 기준)
- 심볼 강화 비용: devcomma 아케인 심볼 계산기, 나무위키 「어센틱포스」 (2026-09-26 기준)
- 프리셋 조합 전투력: 넥슨이 주는 현재 전투력에서 비율로 추정한 값

## 커밋 규칙

`type(scope): 간단한 설명`

예: `feat(login): API 키 등록 화면 추가`, `fix(cron): KST 어제 날짜 계산 수정`
