# PyRpg 작업 방식

코딩 실력이 늘어야 앞으로 나아가는 Python 코딩테스트 대비 도트 RPG입니다(Vite + TypeScript + Phaser 4 + Pyodide). 프로젝트 지시 원문은 `첫 프롬프트.md`, 기획은 `docs/design.md`에 있습니다.

## 소통

- **사용자에게 보이는 답변은 항상 한국어로** 씁니다. 진행 보고, 최종 요약, 질문 모두. 코드 식별자·명령어만 원문 그대로 둡니다.
- 사용자는 JavaScript(Vue 3, Node.js)에 익숙한 Python 초급자입니다. 설명할 때 JS와 비교하면 이해가 빠릅니다.
- 결정이 필요한 것은 추천안을 함께 제시합니다. 사용자가 "추천대로"라고 하면 그 결정을 `docs/progress.md` §4(사용자 결정)에 날짜와 함께 기록합니다.

## 작업을 시작할 때

1. `docs/progress.md`를 먼저 읽습니다. 현재 단계, 바로 다음 할 일, 알려진 한계, 사용자 결정이 모두 여기 있습니다.
2. 지금 단계의 계획(`docs/phase3/plan.md`)과 해당 지역 명세(`docs/phase3/regionNN-spec.md`)를 읽습니다.
3. 끝낼 때는 `docs/progress.md`에 이번 세션에서 한 일, 검증 결과(숫자), 다음 할 일, 새 결정 사항을 남깁니다.

## 에이전트와 스킬을 적극적으로

- **서브에이전트(Agent 도구)와 스킬(Skill 도구)을 적극적으로 씁니다.** 혼자 순서대로 하기보다, 독립적인 일은 에이전트에게 나눠 병렬로 진행합니다. 사용할 수 있는 스킬 목록에 맞는 것이 있으면 먼저 스킬을 불러 씁니다(예: 앱 실행·화면 확인은 `run`, 변경 검토는 `code-review`·`simplify`, 문서·슬라이드는 해당 스킬).
- 지역 하나를 만들 때의 기본 흐름:
  1. **명세**: 제가 직접 `docs/phase3/regionNN-spec.md`를 씁니다(design.md §6.2의 레슨·문제 수, 보스, 대사 ID, 맵 오브젝트, 아트 목록, 실전 추천). 숨겨진 길 귀띔처럼 콘텐츠와 맵이 맞아야 하는 것은 명세에서 하나로 고정합니다.
  2. **병렬 구현**: 영역마다 에이전트 하나(콘텐츠 / 맵·아트 / 시스템)가 각자의 git worktree(`isolation: "worktree"`)에서 작업합니다. 프롬프트에 맡은 범위, 고치지 말 것, 이 PC 환경(아래), 커밋 규칙, 보고 형식을 적습니다.
  3. **통합**: 제가 브랜치를 합치고, 에이전트들이 넘긴 일(Traceback 해설 규칙 추가 등)을 처리하고, typecheck·단위 테스트·`npm run verify`를 돌립니다.
  4. **검증**: 검증 에이전트가 지역 클리어 E2E(`tests/e2e/regionNN.spec.ts`, 실제 키보드)를 쓰고 전체 E2E를 통과시킵니다. 찾은 버그는 고치고 보고합니다.
  5. **기록**: `docs/progress.md` 갱신.
- 에이전트가 완전히 끝났다는 알림을 받은 뒤에만 worktree를 정리합니다. 세션이 도중에 끝나 에이전트가 멈췄으면, 각 worktree의 중간 결과를 WIP 커밋으로 보존하고 같은 worktree에서 이어서 하게 합니다(새로 시작하면 작업을 잃음).
- 에이전트의 보고는 그대로 믿지 말고, 아트 미리보기·스크린샷은 직접 열어 보고, 수치는 통합 후 다시 돌려 확인합니다.

## Git

- 작업은 단위별 브랜치(`phase3-region5` 등)에서 합니다. `main`에는 사용자가 요청할 때 머지합니다.
- 커밋 메시지는 `Phase 3 단위 3-N(영역): ...`처럼 단계명으로 시작하고 한국어로 씁니다.
- 이 PC에는 git 사용자 정보가 없어서 커밋마다 `git -c user.name=Claude -c user.email=noreply@anthropic.com commit ...`을 씁니다(기존 커밋과 같은 작성자).
- `git push`는 이 PC의 권한 설정이 막습니다. push가 필요하면 사용자에게 `! git push origin main`을 안내합니다.
- E2E는 `docs/` 아래 기존 스크린샷을 다시 찍어 덮어씁니다. 의도한 스크린샷만 커밋하고, 커밋할 파일은 경로를 지정해서 `git add` 합니다.

## 이 PC(Windows 11) 환경

- Node.js 24, Python 3.12(`C:\Users\teiki\AppData\Local\Programs\Python\Python312`). Git Bash에서 Python이 PATH에 없으면 명령 앞에 `export PATH="/c/Users/teiki/AppData/Local/Programs/Python/Python312:$PATH"`.
- 검사: `npm run typecheck`, `npx vitest run`, `npm run verify`(CPython을 스스로 찾고 UTF-8 모드로 실행), `npx playwright test`(전체 E2E 약 20분, 백그라운드로).
- 줄바꿈은 `.gitattributes`로 LF 고정. 오래된 커밋에서 만든 worktree는 `git rm -r --cached -q . && git reset -q --hard HEAD`로 다시 체크아웃해야 합니다(CRLF면 E2E가 엉뚱하게 실패).
- worktree에는 node_modules가 없습니다. 설치하지 말고 PowerShell에서 `cmd /c mklink /J node_modules C:\Users\teiki\OneDrive\Desktop\sample\PyRpg\node_modules`로 연결합니다. **worktree를 지울 때는 이 연결부터 `cmd /c rmdir`로 끊은 뒤** `git worktree remove --force`(원본 node_modules 보호).
- 여러 에이전트가 동시에 Playwright를 돌릴 때는 `PW_PORT`를 서로 다르게 줍니다. 같은 포트에 옛 빌드 서버가 살아 있으면 그 빌드를 다시 쓰니, 코드를 고친 뒤에는 서버를 끄고 다시 돌립니다.
- 시간 측정 테스트(보스 budgetUnits 보정)는 다른 E2E가 동시에 돌면 흔들립니다. 실패하면 단독으로 다시 돌려 확인합니다.
- 이 PC에서는 프로그래머스(school.programmers.co.kr)에 접속됩니다. 실전 추천 문제의 제목·레벨은 직접 확인해서 넣습니다. 백준은 서비스 중지 상태라 링크는 비활성으로 둡니다.

## 콘텐츠 규칙

- 콘텐츠(문제·레슨·대사·맵 데이터)는 `content/`에 있고, 문제를 추가할 때 엔진 코드를 고치지 않습니다(design.md §11).
- 모든 문제: 공개 1 + 숨김 3 이상, 경계값, 오답 2개 이상과 진단, 힌트 3단계, 그림자 몬스터용 변형 2개. 보스는 시간 결계(비효율 답안 `slow.py`가 확실히 TLE, 정답으로 인정하는 다른 풀이 `alt_*.py`는 3배 이상 여유, budgetUnits는 Pyodide에서 재서 정함).
- 문제 본문은 오리지널로 씁니다. 백준·프로그래머스 문제 본문을 복사하지 않습니다.
- 보조 캐릭터 누리는 반말, 명랑하고 다정한 말투. 문서는 존댓말.
- 몬스터가 요구하는 주문서의 비석은 그 몬스터보다 먼저 닿는 곳에 둡니다(`tools/maps/common.py`가 검사).
