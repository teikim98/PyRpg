# PyRpg 리서치 (Phase 0)

> **상태: 부분 완료.** 2026-10-01에 조사를 진행하던 도중 중단했습니다. 이 문서에는 확인을 마친 내용만 옮겼고, 끝내지 못한 항목은 '미착수'로 표시했습니다. 남은 조사 범위는 [`progress.md`](./progress.md)에 정리했습니다.
>
> 표기: **미확인** = 출처에서 확인하지 못함 · **추정** = 근거가 약함(검색 요약, 커뮤니티 글 등) · **직접 측정** = 조사 중에 로컬에서 직접 확인한 값
>
> 확인 날짜: 모든 항목 2026-10-01

## 0. 설계에 영향을 주는 발견

| # | 발견 | 영향을 받는 곳 |
|---|---|---|
| 1 | **백준(BOJ)이 2026-04-28에 채점 서비스를 종료했습니다.** 2026-10-01 현재 문제 페이지를 포함한 모든 경로가 종료 안내 페이지를 보여 줍니다(직접 조회로 재확인). 서비스 재개는 보도됐지만 날짜, 도메인, 문제 번호 유지 여부는 미확인입니다. | design.md §7.7 실전 추천 문제, 백준식 문제 형식 안내 |
| 2 | 프로그래머스 고득점 Kit에서 **완전탐색과 DFS/BFS가 '출제 빈도 높음, 평균 점수 낮음'**으로 표시되어 있습니다. 반면 Kit에는 구현·시뮬레이션, 문자열, 누적합·투 포인터, 최단경로 카테고리가 없습니다. | design.md §6 커리큘럼 |
| 3 | **Pyodide는 유지보수 라인이 두 개입니다.** 314.0.7(Python 3.14.2)과 0.29.5(Python 3.13.2)입니다. 314 라인은 classic worker를 더 이상 지원하지 않으므로 module worker를 써야 합니다. 코어 파일 크기는 약 13.5 MB(gzip 약 6.3 MB)입니다. | design.md §9 기술 스택 |
| 4 | Boot.dev는 스트릭에 2단 보호 장치(자동 충전형 Ember, 구매형 Frozen Flame)를 두고, 해답을 보면 XP를 잃게 합니다. 복습은 간격 반복을 반영한 맞춤 연습(Training Grounds)으로 제공합니다. | design.md §7 진행도·보상·복습 |

---

## 1. 학습 게임의 동기부여 장치

### 1.1 Boot.dev (조사 완료)

| 항목 | 내용 | 근거 |
|---|---|---|
| XP·레벨 | 레슨(assignment)을 완료하면 XP를 얻습니다. 2024-05부터 XP 보너스가 레슨 난이도에 더 크게 좌우되도록 조정됐습니다. 레벨은 누적 XP로 자동 상승하고, 레벨이 높을수록 다음 레벨에 더 많은 XP가 필요합니다. 레벨 구간마다 이름(Sage, Archsage, Mage, Archmage 등)이 있습니다. 레벨이 열어 주는 기능은 **미확인**입니다. | [B4], [B1](추정) |
| 콘텐츠 진행 | 코스 → 챕터 → 레슨 구조입니다. 예를 들어 Python 코스는 15챕터, 168레슨, 30시간 분량입니다. 챕터·코스를 잠그는 조건은 공식 페이지에 명시되어 있지 않아 **미확인**입니다. 무료 모드에서는 읽기만 할 수 있고, 과제 제출과 퀴즈는 유료입니다. | [B7], [B8] |
| 스트릭 | 2024-03에는 **주간** 스트릭(한 주를 놓치면 초기화)이었고, 2024-11에 **일간**으로 바뀌었습니다. 레슨 완료나 GitHub 커밋이 하루 활동으로 인정됩니다. 보호 장치는 두 단계입니다: ① Ember는 그날 평소 이상으로 학습하면 1개 충전되고, 결석한 날 가장 먼저 소모됩니다. ② Frozen Flame은 젬으로 구매하며 4일을 보호하고, 가격이 비싼 편입니다. 설계 의도는 "주 5/7일이면 충분히 건강한 습관"이라고 밝히고 있습니다. | [B2], [B3], [B5], [B6] |
| 보상 | 화폐는 젬이고, 상자(loot box)가 있지만 소액결제는 없습니다. 2024-05부터 업적과 일일 퀘스트 보상을 XP·젬 대신 상자로 일원화했습니다. 상자는 일일 퀘스트, Sharpshooter spree, 보스 처치로 얻습니다. 아이템으로는 Potion(1시간 동안 XP +25%. 2024-12에 '30분 동안 +50%'에서 완화), Seer Stone, Baked Salmon, Frozen Flame이 있습니다. 그 밖에 업적, 프로필 히트맵, 코스 수료 인증서가 있습니다. | [B4], [B9], [B10], [B7] |
| 막혔을 때 | AI 튜터 Boots가 소크라테스식 질문으로 돕습니다. 해답을 보거나 Boots와 대화하면 XP 페널티가 있습니다. Seer Stone을 쓰면 해답을 봐도 XP를 잃지 않고, Baked Salmon을 쓰면 Boots와 대화해도 XP를 잃지 않습니다(공식 확인). 페널티 크기는 해답 보기가 레슨 XP의 100%, Boots 대화가 50%라는 자료가 있지만, 현재 404인 공식 위키의 검색 요약이라 **추정**입니다. | [B4], [B1] |
| 복습 | Training Grounds(2025-09)는 완료한 코스, 최근 학습 주제, 어려워한 주제, 경과 시간(spaced repetition)을 보고 맞춤 연습 문제를 만들어 줍니다. Spellbook은 완료한 레슨에 연결된 치트시트 페이지를 자동으로 열어 주고, 검색할 수 있습니다. | [B11], [B12] |
| 비판·부작용 | Boot.dev에 대한 공신력 있는 비판 자료는 **미확인**입니다. 다만 회사 스스로 Potion을 "너무 짧고 압박이 크다"는 이유로 완화했고, 보스전을 경쟁에서 협력으로 바꿨으며, 스트릭 기준을 "주 5/7일"로 완화했습니다. 이 세 가지는 압박을 줄이는 쪽으로 스스로 고친 사례입니다. | [B9], [B13], [B5] |

**PyRpg 시사점(잠정)**: 아래 내용은 Boot.dev 한 곳만 근거로 삼은 것이므로, 나머지 서비스 조사를 마친 뒤에 확정합니다.

- 스트릭 보호 장치를 '학습을 더 하면 자동으로 충전되는 보호'와 '골드로 사는 보호' 두 단계로 나누는 방식은 PyRpg에도 그대로 적용할 수 있습니다.
- 해답을 보면 보상이 0이 되는 방식은 design.md §5.3의 '해설서'와 같은 방향입니다.
- Boot.dev가 압박을 줄이는 쪽으로 여러 번 조정했다는 점은, 하루 15~30분을 오래 지속하려는 PyRpg의 목표와도 맞습니다.

### 1.2 Codédex, CodeCombat, TwilioQuest: 미착수

조사 도중 중단해서 기록된 결과가 없습니다. Codédex는 페이지를 받아 두는 단계까지만 진행했습니다.

---

## 2. 코딩테스트 Python 출제 범위

### 2.1 백준 서비스 상태

| 항목 | 내용 | 근거(신뢰도) |
|---|---|---|
| 현재 상태 | `https://www.acmicpc.net/`과 하위 경로(`/step`, `/problem/1000`, `/help/language`)가 모두 같은 안내 페이지를 보여 줍니다. 페이지 제목은 "BOJ 서비스 종료"이고, 본문은 "BOJ 채점 서비스 준비 중 / 2010년 3월 19일 - 2026년 4월 28일 / 그동안 이용해 주셔서 정말 감사합니다. 채점 서비스와 함께 곧 다시 돌아오겠습니다."입니다. | 2026-10-01 직접 조회(공식) |
| 종료 일정 | 2026-04-15에 종료를 공지했고, 2026-04-28에 BOJ와 solved.ac의 연동이 끝났습니다. | help.solved.ac 업데이트 260415(공식) |
| solved.ac | 4/28 이후에도 문제 난이도 의견 등의 데이터를 "어떤 형태로든 계속 제공"하겠다고 밝혔습니다. 2026-10-01 현재 solved.ac API(`problem/show`, `problem/lookup`, `search/problem`)가 실제로 동작합니다. | help.solved.ac(공식) + 직접 호출 |
| 재개 계획 | 데이원컴퍼니가 BOJ를 양수해서 사내 브랜드 '제로베이스'로 다시 선보이겠다고 보도됐습니다(2026-06-11). 재개 날짜, 도메인, 문제 번호 유지 여부는 기사에 없어 **미확인**입니다. | 디지털타임스/다음 뉴스(언론) |
| 안내 문구 변경 | 2026-05-16 보도에 따르면 종료 페이지 문구가 "문제만 볼 수 있는 상태로"에서 "채점 서비스와 함께 곧 다시 돌아오겠습니다"로 바뀌었습니다. | https://kitpa.org/news/1545 (언론) |

**PyRpg에 주는 영향과 권고**

- 게임에서 안내하려던 백준 링크(`https://www.acmicpc.net/problem/{번호}`)는 현재 열리지 않습니다. 재개 후에도 같은 번호와 주소가 유지되는지는 **미확인**입니다.
- 권고 1: 문제 데이터에는 백준 문제 번호만 저장하고, URL은 설정값(base URL)과 조합해서 만듭니다. 재개 후 도메인이 바뀌어도 한 곳만 고치면 됩니다.
- 권고 2: 백준이 재개되기 전까지는 프로그래머스 문제의 비중을 높이거나, 백준 문제는 번호와 제목만 안내하고 링크는 비활성으로 둡니다.
- 권고 3: solved.ac 티어는 BOJ 연동이 끝난 2026-04-28 시점 이후로 갱신되지 않았을 수 있습니다(**추정**).
- 백준식 stdin/stdout 문제 형식 자체는 그대로 연습할 가치가 있습니다. 다른 채점 사이트와 기업 코딩테스트에서도 같은 형식을 쓰기 때문입니다(**추정**: 이 문장은 이번 조사에서 출처로 확인하지 않았습니다).

### 2.2 프로그래머스 '코딩테스트 고득점 Kit'

- 확인 방법: Kit 메인 페이지와 카테고리 페이지 10개를 내려받아 파싱했습니다.
- 메인 페이지 소개 문구에 따르면, 이 Kit는 프로그래머스가 자사 코딩테스트 결과를 분석해서 "자주 나오는 유형, 사람들이 많이 틀리는 유형"을 간추린 것입니다(공식).
- 문제 링크 형식: `https://school.programmers.co.kr/learn/courses/30/lessons/{문제ID}`

#### 카테고리 요약(메인 페이지 표기 그대로)

| 순서 | 카테고리 | 출제 빈도 | 평균 점수 | 문제 수 | 카테고리 링크 |
|---|---|---|---|---|---|
| 1 | 해시 | 높음 | 보통 | 5 | https://school.programmers.co.kr/learn/courses/30/parts/12077 |
| 2 | 스택/큐 | 보통 | 높음 | 6 | https://school.programmers.co.kr/learn/courses/30/parts/12081 |
| 3 | 힙(Heap) | 보통 | 높음 | 3 | https://school.programmers.co.kr/learn/courses/30/parts/12117 |
| 4 | 정렬 | 높음 | 높음 | 3 | https://school.programmers.co.kr/learn/courses/30/parts/12198 |
| 5 | 완전탐색 | 높음 | 낮음 | 7 | https://school.programmers.co.kr/learn/courses/30/parts/12230 |
| 6 | 탐욕법(Greedy) | 낮음 | 낮음 | 6 | https://school.programmers.co.kr/learn/courses/30/parts/12244 |
| 7 | 동적계획법(Dynamic Programming) | 낮음 | 낮음 | 5 | https://school.programmers.co.kr/learn/courses/30/parts/12263 |
| 8 | 깊이/너비 우선 탐색(DFS/BFS) | 높음 | 낮음 | 7 | https://school.programmers.co.kr/learn/courses/30/parts/12421 |
| 9 | 이분탐색 | 낮음 | 낮음 | 2 | https://school.programmers.co.kr/learn/courses/30/parts/12486 |
| 10 | 그래프 | 낮음 | 낮음 | 3 | https://school.programmers.co.kr/learn/courses/30/parts/14393 |

'출제 빈도 높음'이면서 '평균 점수 낮음'인 완전탐색과 DFS/BFS는, 자주 나오는데 많이 틀린다는 뜻이므로 연습에 가장 많이 투자할 만한 영역입니다.

#### 카테고리별 문제 목록

| 카테고리 | 제목 | 레벨 | 문제 ID |
|---|---|---|---|
| 해시 | 완주하지 못한 선수 | Lv.1 | 42576 |
| 해시 | 폰켓몬 | Lv.1 | 1845 |
| 해시 | 전화번호 목록 | Lv.2 | 42577 |
| 해시 | 의상 | Lv.2 | 42578 |
| 해시 | 베스트앨범 | Lv.3 | 42579 |
| 스택/큐 | 같은 숫자는 싫어 | Lv.1 | 12906 |
| 스택/큐 | 기능개발 | Lv.2 | 42586 |
| 스택/큐 | 올바른 괄호 | Lv.2 | 12909 |
| 스택/큐 | 프로세스 | Lv.2 | 42587 |
| 스택/큐 | 다리를 지나는 트럭 | Lv.2 | 42583 |
| 스택/큐 | 주식가격 | Lv.2 | 42584 |
| 힙 | 더 맵게 | Lv.2 | 42626 |
| 힙 | 디스크 컨트롤러 | Lv.3 | 42627 |
| 힙 | 이중우선순위큐 | Lv.3 | 42628 |
| 정렬 | K번째수 | Lv.1 | 42748 |
| 정렬 | 가장 큰 수 | Lv.2 | 42746 |
| 정렬 | H-Index | Lv.2 | 42747 |
| 완전탐색 | 최소직사각형 | Lv.1 | 86491 |
| 완전탐색 | 모의고사 | Lv.1 | 42840 |
| 완전탐색 | 소수 찾기 | Lv.2 | 42839 |
| 완전탐색 | 카펫 | Lv.2 | 42842 |
| 완전탐색 | 피로도 | Lv.2 | 87946 |
| 완전탐색 | 전력망을 둘로 나누기 | Lv.2 | 86971 |
| 완전탐색 | 모음사전 | Lv.2 | 84512 |
| 탐욕법 | 체육복 | Lv.1 | 42862 |
| 탐욕법 | 조이스틱 | Lv.2 | 42860 |
| 탐욕법 | 큰 수 만들기 | Lv.2 | 42883 |
| 탐욕법 | 구명보트 | Lv.2 | 42885 |
| 탐욕법 | 섬 연결하기 | Lv.3 | 42861 |
| 탐욕법 | 단속카메라 | Lv.3 | 42884 |
| 동적계획법 | N으로 표현 | Lv.3 | 42895 |
| 동적계획법 | 정수 삼각형 | Lv.3 | 43105 |
| 동적계획법 | 등굣길 | Lv.3 | 42898 |
| 동적계획법 | 사칙연산 | Lv.4 | 1843 |
| 동적계획법 | 도둑질 | Lv.4 | 42897 |
| DFS/BFS | 타겟 넘버 | Lv.2 | 43165 |
| DFS/BFS | 네트워크 | Lv.3 | 43162 |
| DFS/BFS | 게임 맵 최단거리 | Lv.2 | 1844 |
| DFS/BFS | 단어 변환 | Lv.3 | 43163 |
| DFS/BFS | 아이템 줍기 | Lv.3 | 87694 |
| DFS/BFS | 여행경로 | Lv.3 | 43164 |
| DFS/BFS | 퍼즐 조각 채우기 | Lv.3 | 84021 |
| 이분탐색 | 입국심사 | Lv.3 | 43238 |
| 이분탐색 | 징검다리 | Lv.4 | 43236 |
| 그래프 | 가장 먼 노드 | Lv.3 | 49189 |
| 그래프 | 순위 | Lv.3 | 49191 |
| 그래프 | 방의 개수 | Lv.5 | 49190 |

#### 커리큘럼과의 관계

- Kit에는 구현·시뮬레이션, 문자열, 누적합·투 포인터, 최단경로(다익스트라) 카테고리가 없습니다. 이 주제들은 다른 자료로 보충해야 합니다.
- Kit의 Lv.3 이상 문제(디스크 컨트롤러, 입국심사, 섬 연결하기 등)는 PyRpg 목표 난이도(실버~골드)의 상단에 해당하므로 후반 지역에 배치하는 편이 맞습니다.

### 2.3 백준 '단계별로 풀어보기': 부분 확인

원문 페이지(`https://www.acmicpc.net/step`)는 BOJ 종료로 조회할 수 없었습니다. Wayback Machine은 봇 차단(429)으로, archive.today는 CAPTCHA로 막혔습니다. 그래서 **전체 단계 목록과 정확한 순서는 미확인**입니다.

검색 엔진에 색인된 페이지 제목으로 확인한 단계 이름은 다음과 같습니다. URL의 ID는 표시 순서가 아니라 내부 ID이므로 순서의 근거로 쓰면 안 됩니다.

| 단계 이름 | URL |
|---|---|
| 입출력과 사칙연산 | https://www.acmicpc.net/step/1 |
| 조건문 | https://www.acmicpc.net/step/4 |
| 동적 계획법 1 | https://www.acmicpc.net/step/16 |
| 그리디 알고리즘 1 | https://www.acmicpc.net/step/33 |
| 백트래킹 | https://www.acmicpc.net/step/34 |
| 동적 계획법과 최단거리 역추적 | https://www.acmicpc.net/step/41 |
| 집합과 맵 | https://www.acmicpc.net/step/49 |

앞부분 순서(**추정**, 검색 도구의 요약에만 근거): 입출력과 사칙연산 → 조건문 → 반복문 → 1차원 배열 → 문자열 → 심화 → 2차원 배열 → 일반 수학 → 시간 복잡도 → 브루트 포스 → (이후 미확인)

**PyRpg 커리큘럼과 비교한 관찰(재검증 필요)**: 조사 에이전트가 중단 직전에 "이 비교 부분에 출처 없이 기억에 기댄 문장이 섞였다"고 보고했습니다. 따라서 아래 내용은 커리큘럼 수정 후보로만 쓰고, 근거로 쓰지 않습니다.

- 기초 문법의 흐름(입출력 → 조건 → 반복 → 배열 → 문자열)은 PyRpg 초안(지역 1~4)과 거의 같습니다.
- 기초 문법을 섞어 쓰는 종합 단계('심화', **추정**)에 대응하는 지역이 PyRpg에는 없습니다. 지역 4와 5 사이에 기초 종합(구현) 보스전을 두는 안을 검토할 수 있습니다.
- 정수론 기초(소수 판정, 에라토스테네스의 체, GCD)가 PyRpg 초안에 빠져 있습니다.
- 그리디는 그래프 지식이 필요 없으므로, 그래프(지역 12)보다 앞에 두는 편이 자연스럽습니다.

### 2.4 미착수 항목

아래 항목은 조사하지 못했습니다. 범위는 [`progress.md`](./progress.md)에 적었습니다.

- 국내 코딩테스트 빈출 유형(출처 신뢰도 표시 포함)
- Python 응시 주의점(프로그래머스 Python 버전, 재귀 한도, 입출력 속도, 시간 초과·메모리 초과 원인)
- 지역별 실전 추천 문제(번호·제목·티어 확인)
- 커리큘럼 수정안

---

## 3. 기술 조사

### 3.1 Pyodide 버전과 크기(조사 완료)

- npm dist-tags(https://registry.npmjs.org/pyodide 조회): `latest` = **314.0.7**(2026-09-14), `stable-0.29` = **0.29.5**(2026-09-16), `stable-0.27` = 0.27.8, `next` = 315.0.0-alpha.2입니다. 즉 **유지보수 중인 라인이 두 개**입니다.
- 버전 번호 체계가 바뀌었습니다. 0.29.x 다음 버전이 314.0.0(2026-06-09)이며, 314.0.0의 changelog에는 "Upgraded to Python 3.14.2"와 "ABI Break Upgraded Emscripten to 5.0.3"이 적혀 있습니다. (https://pyodide.org/en/stable/project/changelog.html)
- 라인별 CPython 버전(npm tarball 안 `pyodide-lock.json`의 `info.python` 값으로 확인):
  - 314.0.7 → Python 3.14.2, Emscripten 5.0.3
  - 0.29.5 → Python 3.13.2, Emscripten 4.0.9
- 314.0.0의 주요 breaking change(changelog 원문 기준):
  - `pyodide.asm.js`의 이름이 `pyodide.asm.mjs`로 바뀌었고, "Classic (non-module) workers: No longer supported"라고 명시되어 있습니다. 따라서 Web Worker를 module worker로 만들어야 하고, 번들러 설정도 새 파일명을 참조해야 합니다.
  - 표준 라이브러리 분리 배포(unvendor)를 중단해서 `sqlite3`, `lzma`가 기본 포함됩니다. `ssl`은 stub이 되었고, OpenSSL 기반 `hashlib` 해시가 제거되었습니다.
  - `pyodide.ffi.JsBigInt`가 추가되었습니다. JS와 Python 사이의 큰 정수 변환 규칙은 아직 조사하지 못했습니다(**미확인**).
- 코어 다운로드 크기(**직접 측정**: npm tarball의 파일 크기와 `gzip -9` 결과):

  | 파일 | 314.0.7 원본 | 314.0.7 gzip | 0.29.5 원본 | 0.29.5 gzip |
  |---|---|---|---|---|
  | pyodide.asm.wasm | 9.60 MB | 3.54 MB | 8.65 MB | 2.83 MB |
  | pyodide.asm.mjs(0.29는 .js) | 1.25 MB | 0.26 MB | 1.07 MB | 0.22 MB |
  | python_stdlib.zip | 2.55 MB | 2.50 MB | 2.42 MB | 2.38 MB |
  | pyodide.mjs + pyodide-lock.json | 0.14 MB | 0.03 MB | 0.14 MB | 0.03 MB |
  | **합계(코어)** | **약 13.5 MB** | **약 6.3 MB** | **약 12.3 MB** | **약 5.5 MB** |

  `python_stdlib.zip`은 이미 압축된 파일이라 gzip으로 거의 줄지 않습니다.
- 공식 문서에 따르면 전체 배포판은 "200+ megabytes"이고, 최소 실행 파일 묶음인 pyodide-core는 "npm install pyodide를 했을 때 설치되는 파일과 같은 묶음"입니다. (https://pyodide.org/en/stable/usage/downloading-and-deploying.html)

**버전 선택 검토 포인트(미결정)**: 0.29 라인은 Python 3.13이라서, 샘플 문제를 검증한 로컬 CPython 3.13.3과 minor 버전이 같습니다. 314 라인은 최신이지만 큰 breaking change를 막 겪은 버전입니다. '안정성 우선' 원칙에 비춰 보면 0.29 라인이 유력하지만, 0.29 라인의 지원 종료 시점을 확인한 뒤에 design.md §9에서 결정합니다.

### 3.2 미착수 항목

- Pyodide: Vite 로컬 번들 방법, Web Worker 패턴, `setStdin`·`setStdout` 시그니처, 무한루프 처리(`worker.terminate()`와 interrupt buffer 비교, COOP/COEP 헤더), CPython 대비 속도, 재귀 깊이 한계, 메모리와 큰 정수, 테스트별 전역 상태 격리, JS↔Python 큰 정수 변환
- 게임 엔진(Phaser 3/4 상태와 대안), CodeMirror 6(한글 IME 포함), 저장 방식, Tiled/LDtk, CC0 에셋과 한국어 픽셀 폰트, Electron/Tauri 제약, Playwright로 canvas 게임 테스트

---

## 출처 목록(확인 날짜 2026-10-01)

### Boot.dev

- [B1] https://blog.boot.dev/wiki/the-game/ (현재 404. 검색 색인 요약만 확인했으므로 추정)
- [B2] https://www.boot.dev/blog/news/bootdev-beat-2024-03
- [B3] https://boot.dev/blog/news/bootdev-beat-2024-11
- [B4] https://www.boot.dev/blog/news/bootdev-beat-2024-05
- [B5] https://www.boot.dev/blog/news/bootdev-beat-2025-01
- [B6] https://www.boot.dev/blog/news/bootdev-beat-2024-12
- [B7] https://www.boot.dev/courses/learn-code-python
- [B8] https://www.boot.dev/faq
- [B9] https://www.boot.dev/blog/news/bootdev-beat-2024-12
- [B10] https://www.boot.dev/blog/news/bootdev-beat-2024-06
- [B11] https://www.boot.dev/blog/news/bootdev-beat-2025-09
- [B12] https://www.boot.dev/blog/news/bootdev-beat-2026-01
- [B13] https://boot.dev/blog/news/bootdev-beat-2024-04

### 코딩테스트

- 백준 종료 안내: https://www.acmicpc.net/ (직접 조회)
- solved.ac 업데이트 공지 260415: help.solved.ac (정확한 URL은 기록되지 않음)
- 제로베이스 재개 보도: 디지털타임스/다음 뉴스, 2026-06-11 (정확한 URL은 기록되지 않음)
- 종료 페이지 문구 변경 보도: https://kitpa.org/news/1545
- 프로그래머스 고득점 Kit: 카테고리 페이지 10개의 링크는 2.2 표에 있습니다(메인 페이지의 정확한 URL은 기록되지 않음).

### 기술

- https://registry.npmjs.org/pyodide
- https://pyodide.org/en/stable/project/changelog.html
- https://pyodide.org/en/stable/usage/downloading-and-deploying.html
