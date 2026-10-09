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

Nuxt 4 기본 디렉터리 구조를 따른다. 컴포넌트 파일 이름은 자동 등록되는 이름과 같게 짓는다(`character/CharacterProfile.vue` → `<CharacterProfile>`).

```
app/
├ assets/css/           # tokens.css(색·폰트·모션), base.css(공통 스타일)
├ components/           # 게임 창·슬롯·툴팁 등 공용 UI
│ ├ character/          # 캐릭터 화면
│ └ growth/             # 성장 화면
├ composables/useMe.ts  # 로그인 상태
├ layouts/default.vue   # 메뉴 바 + 검색 + 출처 표기
├ pages/                # index(캐릭터), growth, login, me, guide/api-key, terms, privacy
└ utils/                # 숫자 표기, 성장 계산, 프리셋 조합 추정, 장비 등급 색
shared/
├ data/                 # 헥사·심볼 강화 비용표 (출처 주석)
├ types/                # 앱·서버 공용 타입
└ utils/kst.ts          # 한국시간 날짜
server/
├ middleware/auth.ts    # CSRF 확인, 쿠키 → 세션 → 사용자
├ utils/                # mongo(컬렉션·캐시), nexon, crypto, session, userKey, rateLimit, snapshot, character
└ api/                  # auth, me, character, snapshots, union, cron
```

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
