# PyRpg

코딩 실력이 늘어야만 앞으로 나아갈 수 있는 탐험형 도트 RPG입니다. 전투, 잠긴 문, 보스를 모두 Python 코드로 돌파하면서 코딩테스트(백준·프로그래머스 실버~골드)를 준비합니다.

- 기획서: [`docs/design.md`](docs/design.md) · 리서치: [`docs/research.md`](docs/research.md) · 진행 현황: [`docs/progress.md`](docs/progress.md)
- 현재 단계: **Phase 2(버티컬 슬라이스)** — 지역 1 '에코 마을'을 처음부터 끝까지 플레이할 수 있습니다.

## 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:5173 에서 플레이
```

배포용 빌드와 미리보기:

```bash
npm run build
npm run preview    # http://localhost:4173
```

- Python 코드는 브라우저 안의 Pyodide(Web Worker)에서 실행됩니다. 서버나 로컬 Python 설치가 필요 없습니다.
- 처음 접속할 때 Pyodide 파일(약 13 MB)을 받으므로 몇 초 걸립니다. `npm run preview`(빌드판)로 한 번 접속한 뒤에는 네트워크 없이도 실행됩니다(service worker).
- 무한루프 즉시 중단에는 COOP/COEP 헤더가 필요합니다. `vite.config.ts`가 개발·미리보기 서버에 설정합니다. 다른 서버에 배포할 때도 같은 헤더를 설정하세요.

## 조작

| 키 | 동작 |
|---|---|
| 방향키 / WASD | 이동(누르고 있으면 계속 걷기) |
| Space / Enter / Z | 바라보는 대상과 상호작용, 대사 넘기기 |
| Esc / M | 메뉴(코덱스, 저장 내보내기·불러오기, 처음부터) |
| 에디터 안 Tab | 들여쓰기 · Esc 다음 Tab으로 에디터 밖으로 이동 |

진행은 자동 저장됩니다(IndexedDB). 메뉴에서 JSON 파일로 내보내고 불러올 수 있습니다.

## 검사

```bash
npm run typecheck   # TypeScript
npm test            # 단위 테스트(Vitest)
npm run verify      # 콘텐츠 검증(모범답안·오답·비효율 답안 판정), 맵·아트 검사. Python 3.11+ 필요
npm run test:e2e    # 브라우저 E2E(Playwright). 처음이면 npx playwright install chromium
```

## 폴더

| 폴더 | 내용 |
|---|---|
| `content/` | 문제·레슨·대사·맵 데이터. 문제를 추가할 때 엔진 코드를 고치지 않습니다(design.md §11) |
| `assets/` | 도트 아트와 `manifest.json`(논리 이름 → 파일). 에셋 출처는 `assets/LICENSES.md` |
| `src/` | `contracts`(모듈 계약), `app`(게임 루프), `game`(Phaser 월드), `ui`(DOM UI), `python`(Pyodide 실행기·채점기), `systems`(진행 규칙), `state`(저장), `content`(로더) |
| `tools/` | 콘텐츠 검증기, 맵 생성기(`tools/maps`), 도트 아트 생성기(`tools/art`) |
| `tests/` | 단위 테스트와 E2E |
