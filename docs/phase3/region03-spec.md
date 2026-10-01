# 지역 3(고블린 동굴) 구현 명세

> Phase 3 단위 3-3의 공통 기준입니다. 형식 규칙은 지역 1 명세([`../phase2/region1-spec.md`](../phase2/region1-spec.md)) §1, 지역 간 이동·변형 문제·마을 시설 규칙은 [`plan.md`](./plan.md) §5와 지역 2 명세를 따릅니다.
> 기획 근거: design.md §2.2(1막), §6.2(지역 3: 레슨 5, 일반 10, 보스 1), §7(보상), §8(문제 품질 기준).

## 1. 지역 개요

| 항목 | 내용 |
|---|---|
| ID / 폴더 | `r03` / `content/regions/r03-goblin-cave/` |
| 이름 | 고블린 동굴 |
| 개념 | list: 만들기·인덱싱(음수 인덱스)·슬라이싱, 메서드(`append`, `pop`, `insert`, `remove`, `index`, `count`, `sort`, `reverse`), `len`/`sum`/`min`/`max`, `in`, `for x in list`, 리스트 컴프리헨션, 2차원 리스트(`[[0]*m for _ in range(n)]`와 `[[0]*m]*n` 함정) |
| 분위기 | 고블린들이 보물을 일렬로 쌓아 둔 동굴. 시간이 멈춰서 보물 더미가 '줄'로 굳어 있고, 고블린들은 줄 세우기와 자르기에 집착합니다. 횃불 불꽃이 멈춰 있습니다 |
| 이야기 | 갈림길 숲 동쪽 끝에서 들어옵니다. 누리의 지도에 동굴은 칸칸이 나뉜 '보물 선반'으로 그려져 있습니다. 동굴 안쪽에서 '대정지는 누군가 일부러 일으킨 것'이라는 단서의 첫 조각(벽화)을 발견합니다(§2.2 1막 복선) |
| 보스 | 고블린 족장(P0311): 매번 `max(arr[:i])`로 앞부분 최댓값을 구하는 O(N²) 풀이를 시간 결계로 막고, 지금까지의 최댓값을 들고 가는 O(N) 풀이를 통과시킵니다(design.md §6.2) |

## 2. 레슨과 주문서

| 레슨 | 주문서 ID | 주문서 이름 | 다루는 내용 | JS 비교 포인트 |
|---|---|---|---|---|
| L3-1 | `scroll.list` | 줄 세우기의 주문서 | list 만들기, 인덱싱, 음수 인덱스, `len`, `in`, `list(map(int, input().split()))` | JS 배열과 거의 같음. `arr[-1]`이 된다, `.length` → `len()` |
| L3-2 | `scroll.slice` | 자르기의 주문서 | 슬라이싱 `[a:b:c]`, 끝 미포함, 복사 `arr[:]`, 뒤집기 `[::-1]` | `slice(a, b)`와 같지만 간격·음수가 됨. 슬라이스는 새 리스트 |
| L3-3 | `scroll.methods` | 보물 정리의 주문서 | `append`/`pop`/`insert`/`remove`/`index`/`count`, `sort()` vs `sorted()`, `reverse()`, `sum`/`min`/`max` | `push` → `append`, `sort()`가 숫자를 숫자로 정렬(JS는 문자열 정렬이 기본), 제자리 수정은 `None`을 돌려줌 |
| L3-4 | `scroll.comprehension` | 한 줄 주문서 | 리스트 컴프리헨션(조건 포함), `for x in arr` 순회 vs `for i in range(len(arr))`, `enumerate` 맛보기 | `arr.map(x => x*2)` ↔ `[x*2 for x in arr]`, `filter` ↔ `if` |
| L3-5 | `scroll.grid` | 격자의 주문서 | 2차원 리스트 만들기·읽기·출력, `[[0]*m]*n` 별칭 함정, 행·열 순회 | JS의 `Array(n).fill([])` 함정과 같은 이야기 |

## 3. 문제(일반 10 + 보스 1)

| ID | 제목(가제) | 형식 | 개념 | 필요 주문서 | 구역 | 필수 |
|---|---|---|---|---|---|---|
| P0301 | 보물 줄의 끝 | stdin | 인덱싱, 음수 인덱스 | scroll.list | 동굴 입구 | 필수 |
| P0302 | 금화 더미 합 | stdin | 한 줄 입력 → 리스트, `sum`/`max`/`min` | scroll.list | 동굴 입구 | 필수 |
| P0303 | 빠진 보물 번호 | stdin | `in`으로 찾기(번호 1~30 중 빠진 것) | scroll.list | 동굴 입구 | 선택 |
| P0304 | 보물 자르기 | function | 슬라이싱(구간 꺼내기) | scroll.slice | 갈림 굴 | 필수 |
| P0305 | 거꾸로 선반 | stdin | `[::-1]`, 간격 슬라이스 | scroll.slice | 갈림 굴 | 선택 |
| P0306 | 고블린 출석부 | stdin | `append`/`pop`/`remove` 명령 처리 | scroll.methods | 보물 창고 | 필수 |
| P0307 | K번째 보물 | function | `sorted`로 정렬 후 K번째(1부터) | scroll.methods | 보물 창고 | 필수 |
| P0308 | 짝수 보석만 | function | 컴프리헨션 + 조건 | scroll.comprehension | 거울 웅덩이 | 필수 |
| P0309 | 두 개 골라 더하기 | function | 이중 반복 + 중복 제거 + 정렬 | scroll.comprehension | 거울 웅덩이 | 선택 |
| P0310 | 세로로 읽는 벽화 | stdin | 2차원 리스트, 열 단위 읽기(길이가 다른 줄) | scroll.grid | 벽화의 방 | 필수 |
| P0311 | [보스] 고블린 족장 | stdin | 앞부분 최댓값: 1페이즈 정확성(N ≤ 1000), 2페이즈 N ≤ 200,000 시간 결계 | 지역 3 주문서 5개 | 족장의 왕좌 | 필수 |

- 모든 문제는 지역 1·2의 품질 기준을 따르고(공개 1 + 숨김 3 이상, 경계값, 오답 2개와 진단, 힌트 3단계, 변형 2개), 지역 1~3 개념만 씁니다. 함수 구현형은 `def solution` 틀을 미리 줍니다.
- 진단에 넣을 흔한 실수: `arr[len(arr)]` IndexError, 슬라이스 끝 포함 착각, `arr = arr.sort()`로 None, `[[0]*m]*n` 별칭, 1부터 세는 K번째를 0부터 셈, JS식 `arr.length`·`arr.push`(AttributeError).
- 보스 P0311: 출력은 각 위치까지의 최댓값 N개(공백 구분). 2페이즈 입력은 N = 200,000(테스트 입력 생성기 `gen` 또는 길게 적은 입력. design.md §11.1). 비효율 답안 `slow.py`는 매번 `max(arr[:i+1])`. `budgetUnits`는 지역 2처럼 Pyodide에서 재서 정합니다(모범답안 ≥ 3배 여유, 비효율 답안은 확실히 초과).
- 보상: 일반 100 XP / 50 골드, 보스 1000 XP / 500 골드.
- 실전 추천(research.md §2.5.2 지역 3): 프로그래머스 42748 K번째수, 68644 두 개 뽑아서 더하기, 12949 행렬의 곱셈을 먼저, 이어서 백준 5597, 20053, 10798.

## 4. 맵 구역과 오브젝트

갈림길 숲의 `warp_east`(지금은 `to_be_continued`)에 `target=r03`, `targetSpawn=spawn_west`를 더합니다. 동굴은 서 → 동(또는 위 → 아래)으로 이어지고, 각 구역 출구는 필수 몬스터가 한 칸짜리 길목을 막습니다.

| 구역 | 오브젝트 ID | 종류 | props |
|---|---|---|---|
| 1 동굴 입구 | `spawn_west` | spawn | |
| | `warp_west` | warp | `target=r02`, `targetSpawn=warp_east` |
| | `t_cave_intro` | trigger | `dialogue=cave_intro`, `once=true` (spawn 바로 옆) |
| | `rune_L3-1` | rune | `lesson=L3-1` |
| | `campfire_entrance` | campfire | |
| | `m_P0301` | monster | `problem=P0301` (길목) |
| | `m_P0303` | monster | `problem=P0303` (선택) |
| | `m_P0302` | monster | `problem=P0302` (구역 출구) |
| 2 갈림 굴 | `rune_L3-2` | rune | `lesson=L3-2` |
| | `sign_tunnels` | sign | `dialogue=sign_tunnels` |
| | `m_P0305` | monster | `problem=P0305` (선택) |
| | `m_P0304` | monster | `problem=P0304` (구역 출구) |
| 3 보물 창고 | `rune_L3-3` | rune | `lesson=L3-3` |
| | `npc_goblin_clerk` | npc | `dialogue=npc_goblin_clerk`, `sprite=npc_goblin` (말이 통하는 고블린 서기) |
| | `chest_storeroom` | chest | `gold=50`, `dialogue=chest_storeroom` |
| | `board_shadow_r03` | board | |
| | `campfire_storeroom` | campfire | |
| | `m_P0306` | monster | `problem=P0306` (길목) |
| | `m_P0307` | monster | `problem=P0307` (구역 출구) |
| 4 거울 웅덩이 | `rune_L3-4` | rune | `lesson=L3-4` |
| | `m_P0309` | monster | `problem=P0309` (선택, 숨겨진 길 끝) |
| | `chest_hidden_pool` | chest | `gold=70`, `dialogue=chest_hidden_pool` (숨겨진 길: 지나갈 수 있는 바위 틈) |
| | `m_P0308` | monster | `problem=P0308` (구역 출구) |
| 5 벽화의 방 | `rune_L3-5` | rune | `lesson=L3-5` |
| | `sign_mural` | sign | `dialogue=sign_mural` (대정지가 의도된 것이라는 첫 단서) |
| | `m_P0310` | monster | `problem=P0310` (구역 출구) |
| | `t_boss_intro` | trigger | `dialogue=boss_intro`, `once=true` (보스 두 칸 앞) |
| 6 족장의 왕좌 | `m_P0311` | monster | `problem=P0311` (보스) |
| | `warp_east` | warp | `requires=problem:P0311`, `lockedDialogue=east_gate_locked`, `openDialogue=to_be_continued` |

- 숨겨진 길: 거울 웅덩이 구역의 바위 벽 가운데 지나갈 수 있는 틈 하나(지역 1·2의 덤불과 같은 방식, 새 타일 `cave_crack`). 고블린 서기나 표지판 대사가 위치를 귀띔합니다.

## 5. 대사 ID 목록

`region_intro`, `cave_intro`, `sign_tunnels`, `npc_goblin_clerk`, `chest_storeroom`, `chest_hidden_pool`, `sign_mural`, `boss_intro`, `boss_defeated`, `east_gate_locked`, `to_be_continued`, `region_clear`, 레슨마다 `lesson_L3-N_intro`, `lesson_L3-N_done`.

## 6. 아트(새로 필요한 것)

| 논리 이름 | 크기 | 내용 |
|---|---|---|
| `monster_index_goblin` | 16×16 × 2 | 번호표를 든 꼬마 고블린 |
| `monster_slice_bat` | 16×16 × 2 | 날개가 칼날처럼 잘린 동굴 박쥐 |
| `monster_stack_crab` | 16×16 × 2 | 등에 상자를 층층이 쌓은 게 |
| `monster_mirror_slime` | 16×16 × 2 | 웅덩이처럼 반사하는 슬라임 |
| `monster_grid_golem` | 16×16 × 2 | 몸이 격자무늬 돌인 작은 골렘 |
| `boss_goblin_chief` | 32×32 × 2 | 보물 왕관을 쓴 고블린 족장, 시계 룬 목걸이 |
| `npc_goblin` | 128×16 걷기 시트 | 안경 쓴 고블린 서기 |
| 동굴 타일(타일셋 끝에 추가) | 16×16 | `cave_floor`, `cave_wall`, `cave_wall_top`, `torch_frozen`, `crystal`, `rubble`, `treasure_pile`, `cave_pool`, `mural_wall`, `cave_crack`, `minecart_rail`, `bone_pile` |

- 새 타일 중 충돌 타일: `cave_wall`, `cave_wall_top`, `torch_frozen`, `crystal`, `rubble`, `treasure_pile`, `cave_pool`, `mural_wall`, `bone_pile`(`cave_crack`은 지나갈 수 있음).
- 화풍은 지역 1·2와 누리의 새 팔레트(색 윤곽선, 단계 음영)를 맞춥니다. 어두운 동굴이지만 읽기 쉽게, 멈춘 횃불의 청록 서리 강조.
