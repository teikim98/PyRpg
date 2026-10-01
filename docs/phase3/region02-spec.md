# 지역 2(갈림길 숲) 구현 명세

> Phase 3 단위 3-2의 공통 기준입니다. 콘텐츠·맵·아트·연결 작업이 이 문서의 ID를 그대로 씁니다. 형식 규칙은 지역 1 명세([`../phase2/region1-spec.md`](../phase2/region1-spec.md)) §1과 같습니다.
> 기획 근거: design.md §2.2(1막), §6.2(지역 2: 레슨 4, 일반 9, 보스 1), §7.1(보상), §8(문제 품질 기준).

## 1. 지역 개요

| 항목 | 내용 |
|---|---|
| ID / 폴더 | `r02` / `content/regions/r02-crossroad-forest/` |
| 이름 | 갈림길 숲 |
| 개념 | 조건문(`if`/`elif`/`else`, 비교·논리 연산자), 반복문(`for`, `range`, `while`), `break`/`continue`, 반복으로 여러 줄 입력 받기 |
| 분위기 | 길이 끝없이 갈라지는 숲. 시간이 멈춰 같은 갈림길이 되풀이되고, 올바른 조건을 고른 사람만 앞으로 나아갑니다. 낙엽이 공중에 멈춰 있습니다 |
| 이야기 | 에코 마을 동쪽 문을 지나 들어옵니다. 누리의 지도에서 이 숲은 같은 길이 반복되는 '고리 모양'으로 그려져 있습니다. 반복문이 왜 필요한지를 숲의 구조로 체감합니다 |
| 보스 | 갈림길 수호목(P0210): 약수를 1~N까지 세는 O(N) 풀이를 시간 결계로 막고, √N까지만 세는 풀이를 통과시킵니다(design.md §6.2) |

## 2. 레슨과 주문서

| 레슨 | 주문서 ID | 주문서 이름 | 다루는 내용 | JS 비교 포인트 |
|---|---|---|---|---|
| L2-1 | `scroll.branch` | 갈림길의 주문서 | `if`/`elif`/`else`, 들여쓰기 블록, 비교 연산자 연쇄(`0 < x < 10`), `and`/`or`/`not` | `{}` 대신 들여쓰기, `else if` → `elif`, `&&`/`||`/`!` → `and`/`or`/`not`, `===`가 없음 |
| L2-2 | `scroll.loop` | 되풀이의 주문서 | `for`와 `range(start, stop, step)`, 끝 값 미포함, 역순 | `for (let i = 0; i < n; i++)` ↔ `for i in range(n)` |
| L2-3 | `scroll.while` | 멈춤의 주문서 | `while`, `break`, `continue`, 무한루프 주의(게임의 시간 결계와 연결) | JS와 거의 같음. `do-while`이 없음 |
| L2-4 | `scroll.gather` | 모음의 주문서 | 반복으로 N줄 입력 받기(`for _ in range(n): input()`), 누적합·최댓값 패턴, `_` 변수 관례 | `readline` 반복이 백준식 입력의 기본 |

## 3. 문제(일반 9 + 보스 1)

| ID | 제목(가제) | 형식 | 개념 | 필요 주문서 | 구역 | 필수 | 스프라이트 |
|---|---|---|---|---|---|---|---|
| P0201 | 짝과 홀의 갈림길 | stdin | `if`/`else`, `%` | scroll.branch | 숲 입구 | 필수 | monster_fork_sprout |
| P0202 | 이정표의 등급 | function | `elif` 사슬 | scroll.branch | 숲 입구 | 선택 | monster_fork_sprout |
| P0203 | 윤년 나무 | stdin | `and`/`or` 결합 조건 | scroll.branch | 숲 입구 | 필수 | monster_leap_owl |
| P0204 | 메아리 구구단 | stdin | `for`·`range`, f-string 출력 | scroll.loop | 고리 길 | 필수 | monster_loop_snake |
| P0205 | 거꾸로 세는 버섯 | stdin | `range` 역순·간격 | scroll.loop | 고리 길 | 선택 | monster_count_shroom |
| P0206 | 별빛 계단 | stdin | 반복 + 문자열 곱으로 도형 출력 | scroll.loop | 고리 길 | 필수 | monster_loop_snake |
| P0207 | 우박 수열 | function | `while`로 조건 반복(콜라츠 단계 수) | scroll.while | 멈춘 개울 | 필수 | monster_hail_wisp |
| P0208 | 첫 번째 열쇠 | stdin | `break`로 처음 만족하는 값 찾기 | scroll.while | 멈춘 개울 | 선택 | monster_hail_wisp |
| P0209 | 가장 무거운 도토리 | stdin | N줄 입력 반복, 최댓값과 위치(1부터) | scroll.gather | 수호목 앞 | 필수 | monster_acorn_mite |
| P0210 | [보스] 갈림길 수호목 | stdin | 약수 개수: 1페이즈 정확성, 2페이즈 N ≤ 10^12 시간 결계(√N) | 지역 2 주문서 4개 | 수호목의 공터 | 필수 | boss_crossroad_tree |

- P0201~P0210 모두 지역 1의 품질 기준을 따릅니다: 공개 1 이상 + 숨김 3 이상, 경계값, 모범답안, 오답 2개와 진단, 힌트 3단계(방향 → 핵심 아이디어 → 부분 코드, 여러 줄 코드는 ```python 블록), 보스는 `slow.py`와 `budgetUnits`.
- 지역 2 문제는 **지역 1~2 개념만** 씁니다(list·함수 정의 문법 없이. 함수 구현형은 지역 1처럼 `def solution` 틀을 미리 줍니다).
- 보스 P0210: 1페이즈는 N ≤ 1000(반복문 1~N 풀이도 통과), 2페이즈는 N ≤ 10^12(1~N 풀이는 TLE, `i * i <= n`까지 세는 풀이는 통과). 완전제곱수(예: 36, 10^12)에서 √N을 두 번 세는 실수를 잡는 테스트와 진단을 넣습니다.
- 보상: 일반 100 XP / 50 골드, 보스 1000 XP / 500 골드(§7.1~7.2).

## 4. 맵 구역과 오브젝트

에코 마을의 `warp_east`를 지나면 갈림길 숲 서쪽 끝 `spawn_west`에 도착합니다. 구역은 서 → 동으로 이어지고, 각 구역 출구는 필수 몬스터가 한 칸짜리 길목을 막습니다.

| 구역 | 오브젝트 ID | 종류 | props |
|---|---|---|---|
| 1 숲 입구 | `spawn_west` | spawn | (에코 마을에서 들어오는 자리) |
| | `warp_west` | warp | `target=r01`, `targetSpawn=warp_east` (에코 마을로 돌아가기, 조건 없음) |
| | `t_forest_intro` | trigger | `dialogue=forest_intro`, `once=true` (spawn 바로 옆) |
| | `rune_L2-1` | rune | `lesson=L2-1` |
| | `sign_forest` | sign | `dialogue=sign_forest` |
| | `campfire_entrance` | campfire | |
| | `m_P0201` | monster | `problem=P0201` (길목) |
| | `m_P0202` | monster | `problem=P0202` (선택) |
| | `m_P0203` | monster | `problem=P0203` (구역 출구) |
| 2 고리 길 | `rune_L2-2` | rune | `lesson=L2-2` |
| | `sign_loop` | sign | `dialogue=sign_loop` (같은 길이 반복된다는 단서) |
| | `npc_lost_traveler` | npc | `dialogue=npc_lost_traveler`, `sprite=npc_traveler` (같은 자리를 맴도는 여행자) |
| | `m_P0204` | monster | `problem=P0204` (길목) |
| | `m_P0205` | monster | `problem=P0205` (선택) |
| | `m_P0206` | monster | `problem=P0206` (구역 출구) |
| | `chest_loop` | chest | `gold=40`, `dialogue=chest_loop` |
| 3 멈춘 개울 | `rune_L2-3` | rune | `lesson=L2-3` |
| | `rune_L2-4` | rune | `lesson=L2-4` (개울 건너편 쉼터) |
| | `npc_woodcutter` | npc | `dialogue=npc_woodcutter`, `sprite=npc_woodcutter` |
| | `campfire_stream` | campfire | |
| | `m_P0207` | monster | `problem=P0207` (길목) |
| | `m_P0208` | monster | `problem=P0208` (선택, 숨겨진 길 끝) |
| | `chest_hidden_grove` | chest | `gold=60`, `dialogue=chest_hidden_grove` (숨겨진 길: 지나갈 수 있는 덤불) |
| 4 수호목 앞 | `m_P0209` | monster | `problem=P0209` (구역 출구) |
| | `t_boss_intro` | trigger | `dialogue=boss_intro`, `once=true` (보스 두 칸 앞) |
| 5 수호목의 공터 | `m_P0210` | monster | `problem=P0210` (보스) |
| | `warp_east` | warp | `requires=problem:P0210`, `lockedDialogue=east_gate_locked`, `openDialogue=to_be_continued`, `target=r03`, `targetSpawn=spawn_west` (고블린 동굴로, region03-spec.md §4) |

- **지역 간 이동**: warp에 `target`(지역 ID)과 `targetSpawn`(도착 지역의 오브젝트 ID)이 있고 조건을 만족하면, 앱이 그 지역을 불러와 해당 오브젝트 옆 걸을 수 있는 칸에 플레이어를 놓습니다. 에코 마을 `warp_east`에도 `target=r02`, `targetSpawn=spawn_west`를 추가합니다(지금의 `to_be_continued` 대사는 `openDialogue`로 남겨서 처음 건너갈 때 짧게 보여 줌).
- **숨겨진 길**: 개울 구역에 지나갈 수 있는 덤불(지역 1과 같은 방식)이 있고, 표지판이나 NPC 대사가 위치를 귀띔합니다.

## 5. 대사 ID 목록

`content/regions/r02-crossroad-forest/dialogue.json`: `region_intro`, `forest_intro`, `sign_forest`, `sign_loop`, `npc_lost_traveler`, `npc_woodcutter`, `chest_loop`, `chest_hidden_grove`, `boss_intro`, `boss_defeated`, `east_gate_locked`, `to_be_continued`, `region_clear`, 레슨마다 `lesson_L2-N_intro`, `lesson_L2-N_done`.

## 6. 아트(새로 필요한 것)

| 논리 이름 | 크기 | 내용 |
|---|---|---|
| `monster_fork_sprout` | 16×16 × 2 | 두 갈래로 갈라진 새싹 몬스터 |
| `monster_leap_owl` | 16×16 × 2 | 달력 무늬 부엉이(윤년) |
| `monster_loop_snake` | 16×16 × 2 | 자기 꼬리를 무는 고리 뱀 |
| `monster_count_shroom` | 16×16 × 2 | 숫자 무늬 버섯 |
| `monster_hail_wisp` | 16×16 × 2 | 우박 도깨비불 |
| `monster_acorn_mite` | 16×16 × 2 | 도토리 진드기 |
| `boss_crossroad_tree` | 32×32 × 2 | 길이 사방으로 갈라진 뿌리를 가진 수호목, 시계 룬 눈 |
| `npc_traveler`, `npc_woodcutter` | 128×16 걷기 시트 | 여행자, 나무꾼 |
| 숲 타일(타일셋 끝에 추가) | 16×16 | `forest_floor`, `fallen_leaves`, `tall_grass`, `stump`, `log`, `mushroom_patch`, `stream`, `stepping_stone`, `signpost_fork`, `pine_tree`, `moss_stone`, `root_floor` |

- 새 타일 중 충돌 타일: `stump`, `log`, `stream`, `signpost_fork`, `pine_tree`, `moss_stone`.
- 화풍은 기존 지역 1 에셋과 누리의 새 팔레트(색 윤곽선, 단계 음영)를 맞춥니다.
