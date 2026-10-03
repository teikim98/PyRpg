# 지역 6(거울 호수) 구현 명세

> Phase 3 단위 3-6의 공통 기준입니다. 형식 규칙은 지역 1 명세([`../phase2/region1-spec.md`](../phase2/region1-spec.md)) §1, 지역 간 이동·변형 문제·마을 시설 규칙은 [`plan.md`](./plan.md) §5와 지역 2~5 명세를 따릅니다.
> 기획 근거: design.md §2.2(2막), §6.2(지역 6: 레슨 5, 일반 12, **보스 2**), §7.1(중간 보스 400 XP), §7.2(중간 보스 200골드), §7.3(메아리 고리는 지역 6 상점), §9.5(재귀 깊이 300 이하), §8(문제 품질 기준).

## 1. 지역 개요

| 항목 | 내용 |
|---|---|
| ID / 폴더 | `r06` / `content/regions/r06-mirror-lake/` |
| 이름 | 거울 호수 |
| 개념 | 함수(`def`, `return`, 기본값 인자, 지역 변수와 스코프, 도우미 함수), 언패킹(`a, *rest = …`, `print(*arr)`)과 내장함수(`enumerate`, `zip`, `map`, `sum`/`min`/`max`/`any`/`all`), `lambda`와 `sorted`/`list.sort`의 `key`·`reverse`(다중 키 튜플, 숫자 `-x` 트릭), 재귀(기저 조건, 분할), 메모이제이션(dict 메모, `functools.lru_cache(maxsize=None)`/`cache`) |
| 분위기 | 강을 거슬러 오른 곳의 넓은 산정 호수. 시간이 멈춰 수면이 거울처럼 굳었고, 굳은 수면에 하늘과 버드나무가 거꾸로 비칩니다. 호숫가에서 외친 말이 메아리로 돌아오는데, 대정지 뒤로 메아리가 끝없이 갈라지며 되돌아와 안개 속을 떠돕니다. 청록 서리 대신 은빛 거울 반사와 옅은 보랏빛 안개가 강조색입니다 |
| 이야기 | 교역항에서 사막으로 가는 배가 강을 거슬러 오르다가, 강의 수원인 거울 호수가 굳어 버린 탓에 호숫가 나루에서 멈춥니다. 늙은 호수지기가 "호수의 시계 룬을 메아리가 붙잡고 있다"고 알려 줍니다. 호수 가운데 거울 다리를 지키는 **거울 쌍둥이**(중간 보스)가 모든 것을 정해진 순서로 줄 세우고서야 길을 내주고, 호수 한가운데 섬의 **호수의 메아리**(최종 보스)를 정화하면 수면이 풀려 배가 다시 사막으로 떠납니다. 2막 '도구와 효율'의 둘째 지역이고, **할트 이름은 아직 나오지 않습니다**(지역 7). 호수지기가 "끝나지 않는 메아리를 몹시 싫어하던 누군가가 호수에 와서 한참 서 있다 갔다"고 한 줄 덧붙입니다(복선) |
| 보스 | 중간: 거울 쌍둥이(P0608, 다중 키 정렬). 최종: 호수의 메아리(P0614, 메모 없는 재귀가 같은 값을 지수적으로 다시 계산하는 풀이 → dict 메모·`lru_cache`) |

## 2. 레슨과 주문서

| 레슨 | 주문서 ID | 주문서 이름 | 다루는 내용 | JS 비교 포인트 |
|---|---|---|---|---|
| L6-1 | `scroll.function` | 부름의 주문서 | `def`·`return`, 반환이 없으면 `None`, 일찍 `return`, 기본값 인자, 키워드 인자, 지역 변수와 전역(함수 안에서 바깥 변수 바꾸기는 지양, `global` 소개만), 도우미 함수로 나누기 | `function f(a, b = 1) {}` ↔ `def f(a, b=1):`. `undefined` 대신 `None`. 화살표 함수는 L6-3의 `lambda` |
| L6-2 | `scroll.unpack` | 펼침의 주문서 | 언패킹 복습과 `*`(`first, *rest = arr`, `print(*arr)`, `f(*args)`), `enumerate(arr, 1)`, `zip(a, b)`(짧은 쪽에 맞춤), `map(int, …)`의 정체(지연 객체, `list()`로 펼침), `sum`/`min`/`max`/`any`/`all`과 `key=` 맛보기 | 스프레드 `...arr` ↔ `*arr`, `arr.entries()` ↔ `enumerate`, JS에는 내장 `zip`이 없음, `arr.some`/`every` ↔ `any`/`all` |
| L6-3 | `scroll.sort` | 줄 세움의 주문서 | `lambda`, `sorted(arr)`(새 리스트) vs `arr.sort()`(제자리, `None` 반환), `key=`, `reverse=True`, 다중 키 튜플 `key=lambda x: (-x[1], x[0])`, 숫자는 `-` 트릭·문자열은 안 됨(안정 정렬로 두 번 정렬하는 방법), `min`/`max`의 `key` | `arr.sort((a, b) => a - b)`의 비교 함수 대신 `key` 함수. JS `sort`는 기본이 문자열 비교라는 함정 |
| L6-4 | `scroll.recursion` | 되울림의 주문서 | 재귀 함수, 기저 조건, 팩토리얼·자릿수 합, 분할(반으로 나눠 풀기, 하노이 맛보기), 기저 조건이 없으면 `RecursionError`(`try/except`로 보여 줌), 브라우저와 실제 시험의 재귀 한도는 다름(design.md §9.5) | JS도 재귀는 같고 호출 스택 한도(`Maximum call stack size exceeded`)만 다름 |
| L6-5 | `scroll.memo` | 기억의 주문서 | 피보나치 재귀의 호출 횟수 폭발(호출 횟수 세어 보기), dict 메모(`memo = {}`), `from functools import lru_cache` / `cache`, **`@lru_cache`는 기본 `maxsize=128`이라 `@lru_cache(maxsize=None)`이나 `@cache`를 쓴다**, 메모는 '필요한 값만' 저장하므로 아주 큰 n에도 쓸 수 있음(크기 n 리스트는 못 만듦), 메아리 고리 안내(§7) | JS에서 `Map`으로 직접 메모하던 것과 같음. 데코레이터 `@`는 JS에 아직 없음(함수를 감싸는 함수로 설명) |

- 레슨마다 run 블록 2개 이상과 빈칸 연습 1개, `js compare` 블록 1개 이상(지역 1~5와 같은 형식).
- 재귀 run 블록은 깊이 300 이하만 씁니다. `lru_cache`를 쓰는 블록은 깊이 200 이하(Pyodide에서 C 코드를 거치는 재귀는 깊이 약 380에서 런타임이 죽음, design.md §9.5). `RecursionError`를 보여 주는 블록은 `try/except RecursionError`로 감싸고 Pyodide에서도 안전한지(런타임이 죽지 않는지) 콘텐츠 스모크로 확인합니다.

## 3. 문제(일반 12 + 보스 2)

| ID | 제목(가제) | 형식 | 개념 | 필요 주문서 | 구역 | 필수 |
|---|---|---|---|---|---|---|
| P0601 | 나루의 뱃삯 | function | 요금 규칙을 도우미 함수로 나누기, 일찍 `return` | scroll.function | 호숫가 나루 | 필수 |
| P0602 | 물길 측량 | stdin | 점 N개를 차례로 잇는 길이: `dist(p, q)` 도우미 함수를 여러 번 호출(맨해튼 거리) | scroll.function | 호숫가 나루 | 필수 |
| P0603 | 가라앉은 징검돌 | function | `enumerate(arr, 1)`로 조건에 맞는 칸 번호(1부터) 리스트 | scroll.unpack | 버드나무 둑 | 필수 |
| P0604 | 물 위와 물속 | stdin | 두 줄을 `zip`으로 짝지어 칸마다 비교(실물과 거꾸로 비친 그림자의 차이) | scroll.unpack | 버드나무 둑 | 선택 |
| P0605 | 뱃사공 기록부 | stdin | `name, *scores = line.split()`, `map(int, …)`, `sum`/`max`, `print(*arr)` | scroll.unpack | 버드나무 둑 | 필수 |
| P0606 | 비친 글자 순서 | function | `sorted(words, key=lambda w: (w[n], w))`(프로그래머스 12915 유형의 오리지널) | scroll.sort | 거울 다리 | 필수 |
| P0607 | 물결 단어장 | stdin | 길이순, 같으면 사전순, 중복 제거(백준 1181 유형의 오리지널) | scroll.sort | 거울 다리 | 선택 |
| P0608 | [중간 보스] 거울 쌍둥이 | stdin | 다중 키 정렬(백준 10825 유형의 오리지널). §3.1 | 주문서 3개(function·unpack·sort) | 거울 다리 끝 | 필수 |
| P0609 | 갈대 마디 | function | 기본 재귀(예: 자릿수 합을 한 자리가 될 때까지, 또는 문자열 뒤집기·회문 검사 재귀). 깊이 300 이하 | scroll.recursion | 안개 갈대밭 | 필수 |
| P0610 | 안개 지도 압축 | function | 2^k × 2^k 격자를 같은 값이면 하나로 압축하는 분할 재귀, `[0의 수, 1의 수]` 반환(프로그래머스 68936 유형의 오리지널). k ≤ 6 | scroll.recursion | 안개 갈대밭 | 필수 |
| P0611 | 연잎 탑 옮기기 | stdin | 하노이: 이동 횟수와 이동 목록 출력, n ≤ 10(프로그래머스 12946 유형의 오리지널) | scroll.recursion | 안개 갈대밭 | 선택 |
| P0612 | 징검돌 건너기 | function | 한 번에 1·2·3칸 건너는 방법 수, n ≤ 200(큰 정수 그대로). 메모 없는 재귀는 숨김 테스트에서 TLE | scroll.memo | 메아리 여울 | 필수 |
| P0613 | 장애물 물길 | stdin | R×C 격자(장애물 `#`)에서 오른쪽·아래로만 가는 경로 수. R, C ≤ 60(재귀 깊이 ≤ 120). 메모 재귀와 반복문 DP 모두 정답 | scroll.memo | 메아리 여울 | 필수 |
| P0614 | [보스] 호수의 메아리 | stdin | §3.2 | 지역 6 주문서 5개 | 호수 한가운데 섬 | 필수 |

- 모든 문제는 지역 1~5의 품질 기준(공개 1 + 숨김 3 이상, 경계값, 오답 2개 이상과 진단, 힌트 3단계, 변형 2개)을 따르고 지역 1~6 개념만 씁니다. 함수 구현형은 `def solution` 틀을 미리 줍니다. 함수형과 stdin형은 대략 절반씩(위 표: 함수형 7, stdin형 7).
- 재귀가 정답 경로인 문제(P0609~P0614)는 모범답안과 정답으로 인정하는 답안의 재귀 깊이가 300 이하, `lru_cache`를 쓰는 답안은 200 이하가 되도록 입력 크기를 정합니다(design.md §9.5). Pyodide 콘텐츠 스모크에서 판정이 CPython과 같아야 합니다.
- 진단에 넣을 흔한 실수: `return`을 빠뜨려 `None`(출력이 `None`, `'NoneType' object is not …`), `arr.sort()`의 반환값을 쓰기(`None`), 문자열에 `-` 트릭(`bad operand type for unary -: 'str'`), `reverse=True`가 모든 키를 뒤집음, `map` 객체를 그대로 출력(`<map object at …>`), `zip` 결과를 두 번 쓰기, 기저 조건 누락(`RecursionError`), 같은 값을 다시 계산하는 재귀(TLE), 동률 처리 누락.
- 보상: 일반 100 XP / 50 골드, **중간 보스 400 XP / 200 골드**, 최종 보스 1000 XP / 500 골드(design.md §7.1~7.2). 지역 XP의 약 54%가 보스.

### 3.1 중간 보스 P0608 거울 쌍둥이

- 문제: 호숫가 사람 N명의 이름과 세 기록(예: 노 젓기 점수, 물수제비 횟수, 잠수 시간)을 받아, 첫째 기록은 내림차순, 둘째는 오름차순, 셋째는 내림차순, 모두 같으면 이름 사전순으로 이름을 한 줄에 하나씩 출력합니다(10825 유형이지만 이야기·키 구성·입출력은 오리지널).
- 1페이즈 정확성(N ≤ 1000, 동률 많은 경우 포함), 2페이즈 시간 결계 N = 100,000(`gen`, 이름은 짧은 영어 소문자, 기대 출력 1 MiB 미만).
- `slow.py`: 비교 함수를 직접 짠 선택 정렬(또는 삽입 정렬) O(N²). 모범답안: `sorted(…, key=lambda r: (-a, b, -c, name))`. 정답으로 인정하는 답안: `alt_twopass.py`(안정 정렬을 키 역순으로 여러 번), `alt_cmp.py`(`functools.cmp_to_key`, 레슨에서 다루지 않지만 실전에서 쓰는 풀이). budgetUnits는 Pyodide에서 재서 **모든 인정 답안이 3배 이상 여유**가 되게 정합니다.
- 오답 예: 내림차순 키를 오름차순으로, 이름 동률 누락, `reverse=True`로 전부 뒤집기, 이름에 `-` 적용(TypeError).
- 문제 데이터에 `"boss": true, "midBoss": true`(§7). `requires`는 그 시점까지의 주문서 3개(`scroll.function`, `scroll.unpack`, `scroll.sort`).

### 3.2 최종 보스 P0614 호수의 메아리

- 문제: 세기 n의 외침은 호수에서 세기 `n // 2`와 `n // 3`인 두 메아리로 갈라져 돌아오고, 세기 0이 된 메아리는 더 갈라지지 않고 '한 번' 울립니다. 세기 n의 외침이 결국 몇 번 울리는지 E(n)을 구합니다. E(0) = 1, n ≥ 1이면 E(n) = E(n // 2) + E(n // 3). 질문 Q개(한 줄에 n 하나)마다 E(n)을 출력합니다.
- 1페이즈 정확성(0 ≤ n ≤ 10,000, Q ≤ 20, n = 0·1·2·3 같은 경계 포함). 메모 없는 재귀도 1페이즈는 통과합니다.
- 2페이즈 시간 결계: n은 10^15 ~ 10^18, Q ≤ 100. 메모 없는 재귀는 호출이 대략 n^0.79번이라 끝나지 않고, dict 메모는 n마다 서로 다른 값 수천 개만 계산합니다. 재귀 깊이는 log2(n) ≈ 60(design.md §9.5의 300 이하).
- `slow.py`: 메모 없는 재귀. 모범답안: dict 메모(질문 사이에 메모를 함께 써도, 질문마다 새로 만들어도 됨). 정답으로 인정하는 답안: `alt_lru.py`(`@lru_cache(maxsize=None)` 또는 `@cache`). 시간 결계 테스트가 모두 같은 생성기·같은 크기면 `phases[2].stopOnTle`.
- 오답 예: 크기 n+1짜리 리스트로 아래에서부터 채우기(아주 큰 n에서 `MemoryError`/`OverflowError` → 진단 "n이 10^18이라 크기 n 리스트는 못 만들어. 필요한 값만 dict에 저장해"), 기저 조건을 `n == 1`로 잘못 둠, 질문마다 출력하지 않고 합만 출력.
- `@lru_cache`(기본 `maxsize=128`) 풀이를 Pyodide에서 재서 기록합니다. 2페이즈에서 TLE면 `wrong_lru128.py`로 두고 TLE 진단과 힌트에 "`maxsize=None`"을 넣고, 통과하면 `alt_*`로 인정합니다(어느 쪽이든 명세 수치와 함께 보고).

## 4. 맵 구역과 오브젝트

교역항의 `warp_east`(지금은 `to_be_continued`)에 `target=r06`, `targetSpawn=spawn_west`를 더합니다. **`openDialogue=to_be_continued`는 그대로 둡니다**(지역 4·5 방식: 처음 한 번 연결 대사가 나오고 넘어감). 교역항 `to_be_continued` 대사에서 "준비 중" 문구는 빼고, 배를 타고 강을 거슬러 오르다 거울 호수 나루에서 멈추는 대사로 바꿉니다(콘텐츠 담당). 호수는 서 → 동으로 이어지고, 각 구역 출구는 필수 몬스터가 한 칸짜리 길목을 막습니다. 크기는 지역 3~5와 비슷하게(가로 100 안팎 × 세로 24~30).

| 구역 | 오브젝트 ID | 종류 | props |
|---|---|---|---|
| 1 호숫가 나루 | `spawn_west` | spawn | |
| | `warp_west` | warp | `target=r05`, `targetSpawn=warp_east` |
| | `t_lake_intro` | trigger | `dialogue=lake_intro`, `once=true` (spawn 바로 옆, 피할 수 없음) |
| | `rune_L6-1` | rune | `lesson=L6-1` |
| | `shop_lake` | shop | (호수 상점. 메아리 고리를 여기서 처음 팜, §7) |
| | `npc_lake_merchant` | npc | `dialogue=npc_lake_merchant`, `sprite=npc_merchant` (지역 1 상인 스프라이트 재사용) |
| | `campfire_ferry` | campfire | |
| | `m_P0601` | monster | `problem=P0601` (길목) |
| | `m_P0602` | monster | `problem=P0602` (구역 출구) |
| 2 버드나무 둑 | `rune_L6-2` | rune | `lesson=L6-2` |
| | `npc_lake_keeper` | npc | `dialogue=npc_lake_keeper`, `sprite=npc_lake_keeper` (이야기 진행, 숨겨진 길 귀띔) |
| | `board_shadow_r06` | board | |
| | `m_P0603` | monster | `problem=P0603` (길목) |
| | `m_P0604` | monster | `problem=P0604` (선택) |
| | `m_P0605` | monster | `problem=P0605` (구역 출구) |
| 3 거울 다리 | `rune_L6-3` | rune | `lesson=L6-3` |
| | `sign_mirror_bridge` | sign | `dialogue=sign_mirror_bridge` (쌍둥이의 '줄 세우기 규칙' 예고) |
| | `campfire_bridge` | campfire | (중간 보스 전 회복) |
| | `m_P0606` | monster | `problem=P0606` (길목) |
| | `m_P0607` | monster | `problem=P0607` (선택) |
| | `t_midboss_intro` | trigger | `dialogue=midboss_intro`, `once=true` (중간 보스 두 칸 앞, 피할 수 없음) |
| | `m_P0608` | monster | `problem=P0608` (**중간 보스**, 다리 끝 한 칸 길목. 구역 3과 4를 가름) |
| 4 안개 갈대밭 | `rune_L6-4` | rune | `lesson=L6-4` |
| | `sign_reeds` | sign | `dialogue=sign_reeds` (숨겨진 길 귀띔) |
| | `chest_hidden_reeds` | chest | `gold=80`, `dialogue=chest_hidden_reeds` (숨겨진 길: 갈대 벽의 빈틈 `reed_gap`) |
| | `m_P0609` | monster | `problem=P0609` (길목) |
| | `m_P0611` | monster | `problem=P0611` (선택) |
| | `m_P0610` | monster | `problem=P0610` (구역 출구) |
| 5 메아리 여울 | `rune_L6-5` | rune | `lesson=L6-5` |
| | `sign_echo_shoal` | sign | `dialogue=sign_echo_shoal` (갈라지는 메아리 이야기. 보스 문제의 복선) |
| | `campfire_shoal` | campfire | (보스 전 마지막 회복) |
| | `m_P0612` | monster | `problem=P0612` (길목) |
| | `m_P0613` | monster | `problem=P0613` (구역 출구) |
| | `t_boss_intro` | trigger | `dialogue=boss_intro`, `once=true` (보스 두 칸 앞, 피할 수 없음) |
| 6 호수 한가운데 섬 | `m_P0614` | monster | `problem=P0614` (최종 보스) |
| | `warp_east` | warp | `requires=problem:P0614`, `lockedDialogue=east_gate_locked`, `openDialogue=to_be_continued` |

- 몬스터가 요구하는 주문서의 비석은 그 몬스터보다 앞(치우기 전에 닿는 곳)에 둡니다(`tools/maps/common.py`의 공통 검사). 중간 보스 P0608은 비석 L6-1~L6-3 뒤, 최종 보스 P0614는 비석 L6-1~L6-5 뒤.
- **숨겨진 길**: 안개 갈대밭의 갈대 벽(`lake_reed`) 가운데 지나갈 수 있는 빈틈 한 칸(새 타일 `reed_gap`, 지역 1~5와 같은 방식). 표지는 이 명세로 고정합니다: **"조약돌 더미 바로 북쪽의 갈대"**. 맵 담당은 맵 전체에서 조약돌 더미(`pebble_cairn`, 밟을 수 있음)를 숨겨진 칸 바로 남쪽 한 곳에만 두고 `build_r06.py`가 이를 검사하게 하며, 콘텐츠 담당은 귀띔 대사(`npc_lake_keeper`, `sign_reeds`)에 이 문구를 그대로 씁니다(`tools/verify_content.py`의 `REQUIRED_DIALOGUE_PHRASES`가 검사).
- 상점 `shop_lake`: 지역 1 `shop_echo`, 지역 5 `shop_port`와 같은 종류(`shop`). 파는 물건은 지금 상점 + 메아리 고리(§7).

## 5. 대사 ID 목록

`region_intro`, `lake_intro`, `npc_lake_merchant`, `npc_lake_keeper`, `sign_mirror_bridge`, `midboss_intro`, `midboss_defeated`, `sign_reeds`, `chest_hidden_reeds`, `sign_echo_shoal`, `boss_intro`, `boss_defeated`, `east_gate_locked`, `to_be_continued`, `region_clear`, 레슨마다 `lesson_L6-N_intro`, `lesson_L6-N_done`.

- `midboss_defeated`: 중간 보스를 처음 이겼을 때 보상 창 뒤에 나옵니다(§7). 다리 너머 안개 갈대밭으로 길이 열렸다는 내용.
- `to_be_continued`: 지역 7이 아직 없으므로 지역 5 이전과 같은 '준비 중' 안내(마지막 지역).

## 6. 아트(새로 필요한 것)

| 논리 이름 | 크기 | 내용 |
|---|---|---|
| `monster_call_frog` | 16×16 × 2 | 혀를 길게 뻗었다가 되감는 개구리(함수 호출과 `return`) |
| `monster_zip_eel` | 16×16 × 2 | 두 마리가 지퍼처럼 맞물려 헤엄치는 장어(`zip`) |
| `monster_lambda_heron` | 16×16 × 2 | 다리와 부리가 λ 모양으로 꺾인 왜가리(`lambda`·정렬) |
| `monster_nesting_lily` | 16×16 × 2 | 연꽃 안에 작은 연꽃, 그 안에 더 작은 연꽃이 든 정령(재귀) |
| `monster_memo_moth` | 16×16 × 2 | 날개에 쪽지 무늬가 붙은 나방(메모) |
| `boss_mirror_twins` | 32×32 × 2 | 좌우가 반전된 쌍둥이 물의 정령, 가운데에 세로 거울 금. 중간 보스 |
| `boss_lake_echo` | 32×32 × 2 | 동심원 물결이 겹친 거대한 메아리 정령, 가운데에 시계 룬, 물결이 둘·셋으로 갈라지는 무늬 |
| `npc_lake_keeper` | 128×16 걷기 시트 | 늙은 호수지기(밀짚모자, 긴 삿대, 흰 수염) |
| 호수 타일(타일셋 끝에 추가) | 16×16 | `lake_shore`, `lake_water`, `mirror_water`, `lake_reed`, `reed_gap`, `pebble_cairn`, `lake_stepping_stone`(지역 2 `stepping_stone`과 겹쳐서 바꿈), `lake_bridge`, `bridge_rail`, `willow_tree`, `lily_pad`, `mist_grass`, `echo_rock`, `island_grass`(지역 1~5와 이름이 겹치지 않게) |

- 충돌 타일: `lake_water`, `mirror_water`, `lake_reed`, `bridge_rail`, `willow_tree`, `lily_pad`, `echo_rock`. 지나갈 수 있는 타일: `lake_shore`, `reed_gap`, `pebble_cairn`, `lake_stepping_stone`(지역 2 `stepping_stone`과 겹쳐서 바꿈), `lake_bridge`, `mist_grass`, `island_grass`. `reed_gap`은 `lake_reed`와 거의 같아 보이되 자세히 보면 줄기 사이가 살짝 벌어져 있게.
- 화풍은 지역 1~5와 누리의 팔레트(색 윤곽선, 단계 음영)를 맞춥니다. 굳은 거울 수면(`mirror_water`)은 하늘색 반사와 은빛 하이라이트로 흐르는 물(`lake_water`)과 확실히 구별되게. 지역 1~5 몬스터와 실루엣이 겹치지 않게(특히 지역 5 `monster_twin_fish`와 `monster_zip_eel`, 지역 3 `monster_mirror_slime`과 `boss_mirror_twins`).

## 7. 함께 하는 시스템 작업

### 7.1 중간 보스(`midBoss`)

- 데이터: `problem.json`에 `"boss": true, "midBoss": true`. 로더가 `Problem.midBoss`로 넘깁니다(단위 3-6 시작 때 계약·로더·검증기에 먼저 넣음).
- 검증기(`tools/verify_content.py`): 지역마다 **최종 보스(`boss`이고 `midBoss`가 아님)는 정확히 1개**, 중간 보스는 0~1개. 최종 보스 `requires`는 지역 주문서 전부, 중간 보스 `requires`는 지역 주문서의 일부. 보상은 최종 1000/500, 중간 400/200. 중간 보스도 보스 규칙(페이즈, `slow.py`, budgetUnits)을 그대로 따릅니다.
- 게임(시스템 담당): 지역 클리어(`clearRegion`, 다시 열었을 때 클리어 연출 이어 보이기)는 **최종 보스**로만. 중간 보스를 처음 이기면 보상 창 뒤 지역 대사 `midboss_defeated`(있으면). 전투 화면·보상 창 문구는 "중간 보스"(예: "중간 보스 격파!"), 보스와 같은 판정 공개 방식(verdictOnly)과 시간 결계. 칭호 '시간을 돌린 자'는 중간 보스로도 얻을 수 있음(design.md §7.4 "보스의 시간 결계"). 그림자 게시판은 지금처럼 1페이즈만.

### 7.2 메아리 고리(design.md §7.3)

- `content/items.json`의 `echo-ring`: `pending` 제거, `price` 200, 새 필드 `"shopFromRegion": 6`(지역 순서가 6 이상인 지역의 상점에서만 목록에 나옴. 앞 지역 상점에는 실루엣도 없음). 상점 화면은 지금 서 있는 지역의 순서를 알아야 합니다.
- 효과: 장착하고 전투에서 [예제 실행]을 누르면, 사용자 코드의 **줄마다 실행 횟수**(공개 예제 전체 합계)를 에디터 줄 번호 옆(거터)에 `×N`으로 보여 줍니다. 코드를 고치면 지웁니다. 큰 수는 줄여서(예: `×1.2만`, `×99만+`). [시전(제출)]과 채점에는 영향 없음. 레슨 run 블록에는 붙이지 않습니다.
- 구현: 워커에서 예제 실행에만 `sys.monitoring`(Pyodide 314의 Python 3.14에 있음, design.md §9.6에서 동작 확인, 약 3.5배 느려짐)으로 사용자 코드 파일의 LINE 이벤트를 셉니다. 느려지는 만큼 예제 실행의 시간 상한을 늘립니다. CPython 단위 테스트(`judge.py`)와 브라우저 E2E로 확인합니다.
- 지역 6 레슨 L6-5와 상점 대사에서 "재귀가 몇 번 불리는지 보려면 메아리 고리"를 안내합니다(콘텐츠 담당).

## 8. 실전 추천

이 PC에서 프로그래머스에 접속해 제목·레벨을 확인한 뒤 확정합니다(콘텐츠 담당). 후보: 프로그래머스 12915 문자열 내 마음대로 정렬하기, 68936 쿼드압축 후 개수 세기, 12946 하노이의 탑, 12945 피보나치 수를 먼저, 이어서 백준 10870 피보나치 수 5, 1181 단어 정렬, 10825 국영수(백준은 서비스 중지로 링크 비활성).

## 9. 검증(이 지역의 완료 기준)

- `npm run verify` 통과(콘텐츠, 변형, `build_r06.py --check`, 아트 검사), 단위 테스트, 콘텐츠 스모크 r06(Pyodide와 CPython 판정 일치, 재귀 문제 fatal 없음), 두 보스의 budgetUnits 측정 결과 기록.
- 지역 6 클리어 E2E: 실제 키보드로 교역항 동쪽 문 → 거울 호수 → 레슨 5 → 필수 몬스터 → 상점에서 메아리 고리 구매·장착·예제 실행에서 줄별 횟수 확인 → 숨겨진 길 → 중간 보스 1·2페이즈(지역 클리어가 일어나지 않는 것) → 최종 보스 1·2페이즈 → 클리어 창(실전 추천) → `to_be_continued`.
- 전체 E2E 통과.
