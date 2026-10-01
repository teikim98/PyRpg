# 지역 1(에코 마을) 구현 명세

> Phase 2 병렬 작업의 공통 기준입니다. 맵(월드 담당)과 문제·대사·레슨(콘텐츠 담당)이 이 문서의 ID를 그대로 씁니다.
> 기획 근거: design.md §8.1(맵 구성), §8.3(샘플 문제), §8.5(추가 전투 후보), §7(보상).

## 1. ID 규칙

| 대상 | 형식 | 예 |
|---|---|---|
| 지역 | `r01` | 폴더 `content/regions/r01-echo-village/` |
| 문제 | `P01NN` | `P0101` |
| 레슨 | `L1-N` | `L1-1` |
| 주문서 | `scroll.<이름>` | `scroll.voice` |
| 맵 오브젝트 | 종류 접두어 + 이름 | `m_P0101`(몬스터), `rune_L1-1`, `chest_shop` |
| 대사 | 소문자 스네이크 | `prologue` |
| 문 조건(`requires`) | `lesson:<ID>`, `problem:<ID>`, `flag:<이름>`, `scroll:<ID>`. 쉼표로 여러 개(모두 만족) | `lesson:L1-1` |

## 2. 레슨과 주문서

| 레슨 | 주문서 ID | 주문서 이름 | 위치 |
|---|---|---|---|
| L1-1 | `scroll.voice` | 목소리의 주문서 | 우물가 |
| L1-2 | `scroll.convert` | 변환의 주문서 | 마을 광장 |
| L1-3 | `scroll.arith` | 산술의 주문서 | 상점 거리 |
| L1-4 | `scroll.quick_ear` | 빠른 귀의 주문서 | 메아리 골목 |

## 3. 문제(일반 9 + 보스 1)

'필수'는 길목을 막는 몬스터입니다. '선택'은 길에서 비켜 있어서 진행을 막지 않습니다(design.md §7.1).

| ID | 제목(가제) | 형식 | 개념(§8.5) | 필요 주문서 | 구역 | 필수 | 스프라이트 |
|---|---|---|---|---|---|---|---|
| P0101 | 금화 두 자루 | stdin | 형변환 | scroll.convert | 광장 | 필수 | monster_type_slime |
| P0106 | 날짜 각인 | stdin | `print`의 `sep` | scroll.convert | 광장 | 필수 | monster_sep_sprite |
| P0109 | 저울 판정 | stdin | 비교 연산자와 `bool` | scroll.convert | 광장 | 선택 | monster_type_slime |
| P0102 | 공평한 분배 | stdin | `//`, `%` | scroll.arith | 상점 거리 | 필수 | monster_remainder_bat |
| P0103 | 몇 번 때려야 할까 | function | 올림 나눗셈 | scroll.arith | 상점 거리 | 필수 | monster_iron_mole |
| P0108 | 시계탑의 초 | function | `//`·`%`로 초 → 시·분·초 | scroll.arith | 상점 거리 | 선택 | monster_clock_beetle |
| P0104 | 메아리 주문 | stdin | `readline`, `strip`, 문자열 곱셈 | scroll.quick_ear | 메아리 골목 | 필수 | monster_echo_ghost |
| P0107 | 이어 말하기 | stdin | `print`의 `end` | scroll.quick_ear | 메아리 골목 | 필수 | monster_sep_sprite |
| P0110 | 큰 수의 자릿수 | stdin | `str()`과 `len` | scroll.quick_ear | 메아리 골목 숨겨진 방 | 선택 | monster_clock_beetle |
| P0105 | [보스] 계단 미믹 | stdin | 등차수열 합 | 지역 1 주문서 4개 | 시계탑 계단 | 필수 | boss_stair_mimic |

P0101~P0105는 design.md §8.3의 본문·테스트·답안을 그대로 옮깁니다. P0106~P0110은 §8.5 후보로 새로 만들되 같은 품질 기준(공개 1+숨김 3 이상, 경계값, 오답 예시 2개와 진단, 3단계 힌트)을 지킵니다.

## 4. 맵 구역과 오브젝트

구역은 서쪽에서 동쪽(또는 아래에서 위)으로 이어지고, 각 구역의 출구는 필수 몬스터가 한 칸짜리 길목을 막습니다. 몬스터를 처치하면 사라지고 길이 열립니다.

| 구역 | 오브젝트 ID | 종류 | props |
|---|---|---|---|
| 1 우물가 | `spawn` | spawn | |
| | `t_prologue` | trigger | `dialogue=prologue`, `once=true`, `joinCompanion=true` (spawn 칸 바로 옆. 대사가 끝나면 누리가 합류해서 따라다님) |
| | `rune_L1-1` | rune | `lesson=L1-1` |
| | `sign_well` | sign | `dialogue=sign_well` |
| | `gate_well` | door | `requires=lesson:L1-1`, `lockedDialogue=gate_well_locked` |
| 2 마을 광장 | `rune_L1-2` | rune | `lesson=L1-2` |
| | `sign_plaza` | sign | `dialogue=sign_plaza` |
| | `npc_frozen_merchant` | npc | `dialogue=npc_frozen_merchant`, `sprite=npc_merchant` |
| | `campfire_plaza` | campfire | |
| | `m_P0101` | monster | `problem=P0101` (길목 1) |
| | `m_P0106` | monster | `problem=P0106` (길목 2, 구역 출구) |
| | `m_P0109` | monster | `problem=P0109` (선택, 광장 구석) |
| 3 상점 거리 | `rune_L1-3` | rune | `lesson=L1-3` |
| | `npc_shopkeeper` | npc | `dialogue=npc_shopkeeper`, `sprite=npc_villager` |
| | `chest_shop` | chest | `gold=30`, `dialogue=chest_shop` |
| | `m_P0102` | monster | `problem=P0102` (길목) |
| | `m_P0103` | monster | `problem=P0103` (구역 출구) |
| | `m_P0108` | monster | `problem=P0108` (선택) |
| 4 메아리 골목 | `rune_L1-4` | rune | `lesson=L1-4` |
| | `sign_alley_riddle` | sign | `dialogue=sign_alley_riddle` (표지판 수수께끼: "`len('serpent')`걸음 동쪽, `2 ** 2`걸음 북쪽") |
| | `npc_echo_child` | npc | `dialogue=npc_echo_child`, `sprite=npc_child` |
| | `campfire_alley` | campfire | |
| | `m_P0104` | monster | `problem=P0104` (길목) |
| | `m_P0107` | monster | `problem=P0107` (구역 출구) |
| | `chest_hidden` | chest | `gold=50`, `dialogue=chest_hidden` (숨겨진 방) |
| | `m_P0110` | monster | `problem=P0110` (숨겨진 방, 선택) |
| 5 시계탑 계단 | `t_boss_intro` | trigger | `dialogue=boss_intro`, `once=true` (보스 두 칸 앞) |
| | `m_P0105` | monster | `problem=P0105` (보스) |
| | `warp_east` | warp | `lockedDialogue=east_gate_locked`, `requires=problem:P0105`, `openDialogue=to_be_continued` |

- **숨겨진 방**: 표지판 수수께끼(표지판에서 동쪽 7칸, 북쪽 4칸)가 가리키는 자리에 보통 덤불처럼 보이지만 지나갈 수 있는 칸이 있고, 그 너머가 숨겨진 방입니다. 맵 생성기는 이 칸을 `bush` 타일로 그리되 충돌 레이어에서 뺍니다.
- **캠프파이어**: 상호작용하면 저장 + HP 회복. HP 0이 되면 마지막 캠프파이어로 돌아갑니다. 우물가에는 캠프파이어 대신 시작 지점이 그 역할을 합니다.

## 5. 대사 ID 목록

콘텐츠 담당이 `content/regions/r01-echo-village/dialogue.json`에 아래 ID를 모두 만듭니다(누리 = 반말, 활발, design.md §3 B안).

`prologue`, `sign_well`, `gate_well_locked`, `sign_plaza`, `npc_frozen_merchant`, `npc_shopkeeper`, `chest_shop`, `sign_alley_riddle`, `npc_echo_child`, `chest_hidden`, `boss_intro`, `boss_defeated`, `east_gate_locked`, `to_be_continued`, `region_clear`, 그리고 레슨마다 `lesson_L1-N_intro`(비석에 다가갔을 때), `lesson_L1-N_done`(주문서 획득 후).

공통 대사(`content/common/dialogue.json`): `need_scroll`(주문서가 없어 싸울 수 없음), `campfire_rest`, `knockout`(쓰러져 캠프파이어로 돌아옴), `solution_unlocked`(세 번 쓰러져 해설서가 열림), `retreat`, `practice_suggest`(시간 기반 우회 제안), `shadow_registered`, `level_up`, `fatal_recursion`(재귀가 너무 깊어 실행기가 다시 시작됨).
