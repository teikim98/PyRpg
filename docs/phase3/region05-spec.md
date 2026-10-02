# 지역 5(교역항) 구현 명세

> Phase 3 단위 3-5의 공통 기준입니다. 형식 규칙은 지역 1 명세([`../phase2/region1-spec.md`](../phase2/region1-spec.md)) §1, 지역 간 이동·변형 문제·마을 시설 규칙은 [`plan.md`](./plan.md) §5와 지역 2~4 명세를 따릅니다.
> 기획 근거: design.md §2.2(2막의 시작), §6.2(지역 5: 레슨 5, 일반 12, 보스 1), §7.2(상점은 마을마다), §8(문제 품질 기준).

## 1. 지역 개요

| 항목 | 내용 |
|---|---|
| ID / 폴더 | `r05` / `content/regions/r05-trade-port/` |
| 이름 | 교역항 |
| 개념 | tuple(묶음, 언패킹, `a, b = b, a`, 여러 값 반환, 불변), dict(`d[k]`, `get(k, 기본값)`, `in`, `keys`/`values`/`items`, 세기, 거꾸로 만들기), set(`add`/`discard`/`in`, 교집합·합집합·차집합, 중복 제거), `collections.Counter`(`most_common`, 뺄셈), `defaultdict(list/int/set)`, `deque`(`append`/`popleft`/`appendleft`/`rotate`) |
| 분위기 | 바다로 열린 큰 항구 도시. 시간이 멈춰서 파도가 유리처럼 굳어 있고, 갈매기가 공중에 걸려 있습니다. 하역하던 화물이 부두에 산처럼 쌓여 있고, 상인들의 장부가 엉망이 되어 버그들이 장부 숫자를 갉아 먹습니다 |
| 이야기 | 2막 '도구와 효율'의 시작(design.md §2.2). 대도서관 동쪽 문을 지나 해안 길로 내려오면 교역항입니다. 상인 길드장이 '세계가 멈춘 날 항구로 들어온 마지막 배'의 기록을 보여 주고, 그 배를 몰던 밀수꾼 선장이 시계 룬을 숨겨 부두 끝 밀수선에 버티고 있습니다. 길드장은 '멈춘 세계를 고칠 도구'로 장부 정리 주문(dict·Counter)을 가르쳐 주고, 다음 지역(사막)으로 가는 배편을 약속합니다. **할트 이름은 아직 나오지 않습니다**(지역 7에서 처음). 대도서관 기록의 '모든 주문을 제시간에 끝내도록 지키던 자' 이야기를 길드장도 소문으로 들었다고 한 줄 덧붙입니다 |
| 보스 | 밀수꾼 선장(P0513): 질문마다 `list.count`로 다시 세는 O(N·Q) 풀이를 시간 결계로 막고, `Counter`(또는 dict로 한 번 세기)로 O(N + Q)에 답하는 풀이를 통과시킵니다(design.md §6.2) |

## 2. 레슨과 주문서

| 레슨 | 주문서 ID | 주문서 이름 | 다루는 내용 | JS 비교 포인트 |
|---|---|---|---|---|
| L5-1 | `scroll.tuple` | 묶음의 주문서 | tuple 만들기, 인덱싱, 불변(TypeError), 언패킹 `a, b = t`, 맞바꾸기 `a, b = b, a`, 함수에서 여러 값 반환, `for x, y in pairs` | 구조 분해 `const [a, b] = arr`, `[a, b] = [b, a]`. JS에는 불변 배열이 없음(`Object.freeze`) |
| L5-2 | `scroll.dict` | 장부의 주문서 | dict 만들기, `d[k]`(없으면 KeyError) vs `d.get(k, 0)`, `in`, 추가·수정·`del`, `keys`/`values`/`items` 순회, 세기 `d[x] = d.get(x, 0) + 1`, 키↔값 뒤집기, 입력 순서 유지 | 객체 `{}`·`Map`. `obj.x` → `d["x"]`, `Object.entries(o)` → `d.items()`, `key in obj` → `k in d`, 없는 키가 `undefined`가 아니라 KeyError |
| L5-3 | `scroll.set` | 짐 검사의 주문서 | set 만들기(`set()`와 `{}`의 차이), `add`/`discard`/`remove`, `in`이 빠름(list는 느림, 지역 7 복선), `&`/`\|`/`-`, `len(set(arr))`로 종류 수, set은 순서가 없음(출력 전 `sorted`) | `new Set()`, `has` → `in`, `size` → `len`. JS Set에는 교집합 연산자가 없음 |
| L5-4 | `scroll.counter` | 셈의 주문서 | `from collections import Counter, defaultdict`, `Counter(arr)`, `c[x]`(없으면 0), `most_common(k)`, `Counter` 뺄셈, `defaultdict(list)`로 묶기, `defaultdict(int)` | 직접 `reduce`로 세던 것을 한 줄로. `Map`의 `get(k) ?? 0` 대신 기본값이 있는 dict |
| L5-5 | `scroll.deque` | 부두 줄의 주문서 | `deque`, `append`/`popleft`/`appendleft`/`pop`, `rotate`, 줄 서기 시뮬레이션. `list.pop(0)`도 되지만 긴 줄에서는 느리다는 예고(지역 7·8 복선) | `arr.shift()`가 `list.pop(0)`과 같고, JS에는 내장 deque가 없음 |

- 레슨마다 run 블록 2개 이상과 빈칸 연습 1개(지역 1~4와 같은 형식). L5-2에서 KeyError가 나는 장면은 `try/except`로 감싸 보여 줍니다(L4-1과 같은 방식).

## 3. 문제(일반 12 + 보스 1)

| ID | 제목(가제) | 형식 | 개념 | 필요 주문서 | 구역 | 필수 |
|---|---|---|---|---|---|---|
| P0501 | 뒤바뀐 좌표 | stdin | 언패킹, 맞바꾸기, 좌표 쌍 출력 | scroll.tuple | 해안 시장 | 필수 |
| P0502 | 가장 싸고 가장 비싼 | function | 여러 값 반환 `return (lo, hi)`(튜플 비교) | scroll.tuple | 해안 시장 | 필수 |
| P0503 | 시세표 조회 | stdin | dict 만들기 + 질문마다 `get`(없으면 정해진 문구) | scroll.dict | 해안 시장 | 선택 |
| P0504 | 단어 장부 | function | dict로 세기, 처음 나온 순서대로 `(단어, 수)` 리스트 반환 | scroll.dict | 상인 길드 | 필수 |
| P0505 | 이름과 번호표 | stdin | 양방향 dict(이름 → 번호, 번호 → 이름. 백준 1620 유형의 오리지널) | scroll.dict | 상인 길드 | 선택 |
| P0506 | 같은 화물 두 번 | function | set으로 처음 중복된 값 찾기(없으면 -1) | scroll.set | 창고 거리 | 필수 |
| P0507 | 두 배의 공통 화물 | stdin | 교집합 + 정렬 출력(백준 1764 유형의 오리지널) | scroll.set | 창고 거리 | 필수 |
| P0508 | 금지 품목 검사 | stdin | 금지 목록 set, 많은 검사 질문(멤버십) | scroll.set | 창고 거리 | 선택 |
| P0509 | 가장 많이 실린 화물 | function | `Counter`/dict로 최빈값, 동률이면 사전순으로 앞선 것 | scroll.counter | 부두 | 필수 |
| P0510 | 항구별 선원 명부 | stdin | `defaultdict(list)`로 항구별 묶기, 항구 이름순·입력순 출력 | scroll.counter | 부두 | 필수 |
| P0511 | 돌아오지 않은 선원 | function | 출항 명단 − 귀항 명단(동명이인, `Counter` 뺄셈. 프로그래머스 42576 유형의 오리지널) | scroll.counter | 부두 | 필수 |
| P0512 | 부두의 대기 줄 | stdin | `deque` 명령 처리(`push_back`, `push_front`, `pop_front`, `size`, `front` 등, 빈 줄이면 -1) | scroll.deque | 등대 앞 | 필수 |
| P0513 | [보스] 밀수꾼 선장 | stdin | 화물 목록 N개와 질문 Q개: 질문마다 그 화물이 몇 개인지, 마지막 줄에 가장 많은 화물(동률이면 사전순). 1페이즈 정확성(N, Q ≤ 1000), 2페이즈 N, Q ≤ 100,000 시간 결계 | 지역 5 주문서 5개 | 밀수선 갑판 | 필수 |

- 모든 문제는 지역 1~4의 품질 기준을 따르고(공개 1 + 숨김 3 이상, 경계값, 오답 2개 이상과 진단, 힌트 3단계, 변형 2개), 지역 1~5 개념만 씁니다. 함수 구현형은 `def solution` 틀을 미리 줍니다. 함수형과 stdin형은 대략 절반씩.
- 함수 구현형이 tuple을 반환하는 문제(P0502, P0504)는 비교 규칙을 명확히: P0502는 `(lo, hi)` 튜플을 기대하고 리스트 `[lo, hi]`도 인정할지 `compare.sequenceAsList`로 정합니다(지역 1 P0108 선례: 인정). P0504는 `[(단어, 수), ...]` 리스트이고 안쪽 튜플을 리스트로 써도 인정.
- 진단에 넣을 흔한 실수: `d[k]` KeyError(`get` 권함), `{}`로 빈 set을 만들려다 dict(`'dict' object has no attribute 'add'`), set을 정렬하지 않고 출력(순서 불일치), tuple 칸에 대입(TypeError), `from collections import Counter`를 빠뜨림(NameError), `Counter.most_common(1)`의 결과가 `[(값, 수)]` 리스트라는 것을 잊음, `defaultdict` 대신 dict에서 `d[k].append`(KeyError), 빈 deque에서 `popleft`(IndexError), 동률 처리 누락.
- 보스 P0513(밀수꾼 선장): 비효율 답안 `slow.py`는 질문마다 `arr.count(q)`(O(N·Q)), 마지막 최빈값도 `max(set(arr), key=arr.count)`류. 모범답안은 `Counter`. dict로 직접 세는 풀이 `alt_dict.py`, 정렬 후 `bisect`로 세는 풀이 대신 정렬 + 묶음 세기 풀이도 정답으로 인정합니다(모두 O(N log N) 이하). 오답 예: 없는 화물에 KeyError, 동률에서 사전순을 안 따름, 질문 순서가 아니라 정렬 순서로 출력.
  - 2페이즈 입력은 `gen`(design.md §11.1). 화물 이름은 짧은 영어 소문자 단어(종류 수천 개)로 해서 입력이 몇 MB를 넘지 않게 합니다(지역 4 보스처럼 10MB를 넘기지 말 것). `budgetUnits`는 Pyodide에서 재서 정합니다(모범답안·`alt_*` 모두 ≥ 3배 여유, `slow.py`는 확실히 초과). 2페이즈 테스트가 모두 같은 크기면 `phases[2].stopOnTle`.
- 보상: 일반 100 XP / 50 골드, 보스 1000 XP / 500 골드.
- 실전 추천(2026-10-02 이 PC에서 프로그래머스 접속해 제목·레벨 확인): 프로그래머스 42576 완주하지 못한 선수(Lv.1), 1845 폰켓몬(Lv.1), 92334 신고 결과 받기(Lv.1), 42578 의상(Lv.2)을 먼저, 이어서 백준 1764 듣보잡(S4), 1620 나는야 포켓몬 마스터 이다솜(S4)(백준은 서비스 중지로 링크 비활성).

## 4. 맵 구역과 오브젝트

대도서관의 `warp_east`(지금은 `to_be_continued`)에 `target=r05`, `targetSpawn=spawn_west`를 더합니다. **`openDialogue=to_be_continued`는 그대로 둡니다**(지역 4 검증에서 고친 방식: 처음 한 번 연결 대사가 나오고 넘어감. 대도서관 `to_be_continued` 대사에서 "준비 중" 문구는 빼고 해안 길로 이어지는 대사로 바꿉니다. 이 대사 수정은 콘텐츠 담당). 항구는 서 → 동으로 이어지고, 각 구역 출구는 필수 몬스터가 한 칸짜리 길목을 막습니다. 크기는 지역 3·4와 비슷하게(가로 100 안팎 × 세로 24~30).

| 구역 | 오브젝트 ID | 종류 | props |
|---|---|---|---|
| 1 해안 시장 | `spawn_west` | spawn | |
| | `warp_west` | warp | `target=r04`, `targetSpawn=warp_east` |
| | `t_port_intro` | trigger | `dialogue=port_intro`, `once=true` (spawn 바로 옆) |
| | `rune_L5-1` | rune | `lesson=L5-1` |
| | `shop_port` | shop | (항구 상점. 상점 대사는 `npc_port_merchant`) |
| | `npc_port_merchant` | npc | `dialogue=npc_port_merchant`, `sprite=npc_merchant` (지역 1 상인 스프라이트 재사용) |
| | `campfire_market` | campfire | |
| | `m_P0501` | monster | `problem=P0501` (길목) |
| | `m_P0503` | monster | `problem=P0503` (선택) |
| | `m_P0502` | monster | `problem=P0502` (구역 출구) |
| 2 상인 길드 | `rune_L5-2` | rune | `lesson=L5-2` |
| | `npc_guild_master` | npc | `dialogue=npc_guild_master`, `sprite=npc_guild_master` (이야기 진행, 숨겨진 길 귀띔) |
| | `board_shadow_r05` | board | |
| | `m_P0505` | monster | `problem=P0505` (선택) |
| | `m_P0504` | monster | `problem=P0504` (구역 출구) |
| 3 창고 거리 | `rune_L5-3` | rune | `lesson=L5-3` |
| | `sign_warehouses` | sign | `dialogue=sign_warehouses` |
| | `chest_hidden_crates` | chest | `gold=80`, `dialogue=chest_hidden_crates` (숨겨진 길: 비어 있는 화물 상자 칸 `crate_gap`) |
| | `m_P0506` | monster | `problem=P0506` (길목) |
| | `m_P0508` | monster | `problem=P0508` (선택) |
| | `m_P0507` | monster | `problem=P0507` (구역 출구) |
| 4 부두 | `rune_L5-4` | rune | `lesson=L5-4` |
| | `campfire_docks` | campfire | |
| | `m_P0509` | monster | `problem=P0509` (길목) |
| | `m_P0510` | monster | `problem=P0510` |
| | `m_P0511` | monster | `problem=P0511` (구역 출구) |
| 5 등대 앞 | `rune_L5-5` | rune | `lesson=L5-5` |
| | `sign_lighthouse` | sign | `dialogue=sign_lighthouse` (마지막 배의 항해 일지) |
| | `campfire_lighthouse` | campfire | (보스 전 마지막 회복) |
| | `m_P0512` | monster | `problem=P0512` (구역 출구) |
| | `t_boss_intro` | trigger | `dialogue=boss_intro`, `once=true` (보스 두 칸 앞) |
| 6 밀수선 갑판 | `m_P0513` | monster | `problem=P0513` (보스) |
| | `warp_east` | warp | `requires=problem:P0513`, `lockedDialogue=east_gate_locked`, `openDialogue=to_be_continued` |

- 몬스터가 요구하는 주문서의 비석은 그 몬스터보다 앞(치우기 전에 닿는 곳)에 둡니다(`tools/maps/common.py`의 공통 검사).
- 숨겨진 길: 창고 거리의 화물 상자 더미 가운데 지나갈 수 있는 빈 상자 칸 하나(새 타일 `crate_gap`, 지역 1~4와 같은 방식). 표지는 이 명세로 고정합니다: **"밧줄 더미(`rope_coil`) 바로 북쪽의 빈 상자"**. 맵 담당은 창고 거리에서 `rope_coil`을 이 한 곳(숨겨진 칸 바로 남쪽)에만 두고 `build_r05.py`가 이를 검사하게 하며, 콘텐츠 담당은 귀띔 대사(길드장, 표지판)에 이 표지를 그대로 씁니다(지역 4에서 대사와 맵이 어긋났던 일을 막기 위해).
- 상점 `shop_port`: 지역 1 `shop_echo`와 같은 종류(`shop`). 파는 물건은 지금 상점과 같습니다(content/items.json).

## 5. 대사 ID 목록

`region_intro`, `port_intro`, `npc_port_merchant`, `npc_guild_master`, `sign_warehouses`, `chest_hidden_crates`, `sign_lighthouse`, `boss_intro`, `boss_defeated`, `east_gate_locked`, `to_be_continued`, `region_clear`, 레슨마다 `lesson_L5-N_intro`, `lesson_L5-N_done`.

## 6. 아트(새로 필요한 것)

| 논리 이름 | 크기 | 내용 |
|---|---|---|
| `monster_twin_fish` | 16×16 × 2 | 꼬리가 붙은 쌍둥이 물고기(tuple) |
| `monster_ledger_gull` | 16×16 × 2 | 장부를 물고 있는 갈매기(dict) |
| `monster_bubble_jelly` | 16×16 × 2 | 속에 서로 다른 구슬이 하나씩 든 해파리(set) |
| `monster_tally_parrot` | 16×16 × 2 | 깃털에 눈금이 새겨진 앵무새(Counter) |
| `monster_queue_crab` | 16×16 × 2 | 등에 작은 게들이 줄지어 탄 소라게(deque). 지역 3 '층층 게'와 실루엣이 겹치지 않게 |
| `boss_smuggler_captain` | 32×32 × 2 | 외눈 안대·삼각모의 밀수꾼 선장, 허리에 시계 룬, 손에 장부 |
| `npc_guild_master` | 128×16 걷기 시트 | 상인 길드장(금테 모자, 두꺼운 장부, 둥근 체형) |
| 항구 타일(타일셋 끝에 추가) | 16×16 | `port_cobble`, `dock_plank`, `harbor_water`, `frozen_wave`, `pier_post`, `crate`, `crate_gap`, `barrel`, `rope_coil`, `fishing_net`, `ship_deck`, `ship_rail`, `market_stall`, `lighthouse_wall` |

- 새 타일 중 충돌 타일: `harbor_water`, `frozen_wave`, `pier_post`, `crate`, `barrel`, `fishing_net`, `ship_rail`, `market_stall`, `lighthouse_wall`(`port_cobble`, `dock_plank`, `ship_deck`, `rope_coil`, `crate_gap`은 지나갈 수 있음. `rope_coil`은 장식이지만 밟을 수 있게). `crate_gap`은 `crate`와 거의 같아 보이되 자세히 보면 뚜껑이 없거나 옆판 하나가 빠져 있게.
- 화풍은 지역 1~4와 누리의 팔레트(색 윤곽선, 단계 음영)를 맞춥니다. 밝은 바다색·흰 돛·나무 부두에, 굳은 파도와 공중에 걸린 갈매기의 청록 서리 강조. 지역 1~4 몬스터와 실루엣이 겹치지 않게.

## 7. 함께 하는 시스템 작업(지역 4 결정 반영)

- **보스 시전 진행 표시**(사용자 결정 10, 2026-10-02 ①안): 시전 중 메시지 칸에 지금 단계를 보여 줍니다. 큰 입력을 만드는 중이면 "큰 입력 준비 중… (k/n)", 채점 중이면 "시험 k/n"처럼. 화면이 멈추지 않는 것은 그대로 유지하고, 결과 연출은 지금처럼 테스트마다. 지역 4 보스(P0411)로 확인합니다.
- **조사 '을(를)' 정리**: 승리 문구("…을(를) 정화했어!"), 상점·장비 안내 등 남은 '을(를)'·'이(가)'·'은(는)'을 `src/app/josa.ts`로 받침에 맞게.
- **코덱스 버튼이 가려지는 문제**: 진단 없는 RE에서 일반 해설이 길면 1280×800에서 "📖 코덱스" 버튼이 메시지 칸 아래로 밀립니다. 진단이 있을 때처럼 머리 줄에 두거나 해설 위로 올려, 스크롤 없이 보이게.

## 8. 검증(이 지역의 완료 기준)

- `npm run verify` 통과(콘텐츠, 변형, `build_r05.py --check`, 아트 검사), 단위 테스트, 콘텐츠 스모크 r05(Pyodide와 CPython 판정 일치), 보스 budgetUnits 측정 결과 기록.
- 지역 5 클리어 E2E: 실제 키보드로 대도서관 동쪽 문 → 교역항 → 레슨 5 → 필수 몬스터 → 상점 이용 → 숨겨진 길 → 보스 1·2페이즈(진행 표시 확인) → 클리어 창(실전 추천) → `to_be_continued`.
- 전체 E2E 통과.
