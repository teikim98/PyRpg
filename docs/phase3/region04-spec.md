# 지역 4(무너진 대도서관) 구현 명세

> Phase 3 단위 3-4의 공통 기준입니다. 형식 규칙은 지역 1 명세([`../phase2/region1-spec.md`](../phase2/region1-spec.md)) §1, 지역 간 이동·변형 문제·마을 시설 규칙은 [`plan.md`](./plan.md) §5와 지역 2·3 명세를 따릅니다.
> 기획 근거: design.md §2.2(1막의 끝), §6.2(지역 4: 레슨 4, 일반 10, 보스 1), §7.3(기록관의 안경: 지역 4 상자), §8(문제 품질 기준).

## 1. 지역 개요

| 항목 | 내용 |
|---|---|
| ID / 폴더 | `r04` / `content/regions/r04-grand-library/` |
| 이름 | 무너진 대도서관 |
| 개념 | 문자열: 인덱싱·슬라이싱·`len`·`in`·`for c in s`, 불변성(`s[0] = "a"`는 TypeError), 메서드(`upper`/`lower`/`strip`/`replace`/`find`/`count`/`startswith`/`endswith`/`isdigit`/`isalpha`/`isupper`), `split`/`join`, f-string(`{x:.2f}`, `{n:>5}`, `{n:03d}`), 아스키 코드(`ord`/`chr`, `[0] * 26` 세기, 알파벳 밀기) |
| 분위기 | 천장이 무너져 내린 거대한 도서관. 시간이 멈춰서 공중에 흩날리던 책장(페이지)과 글자들이 그대로 떠 있습니다. 촛불은 청록 서리에 덮여 있고, 글자 벌레들이 책 속 문장을 갉아 먹습니다 |
| 이야기 | 고블린 동굴 동쪽 끝에서 들어옵니다. 동굴 벽화가 가리킨 '기록'을 찾아온 곳입니다. 유령 사서가 남은 기록을 지키고 있고, 봉인 서고에서 **'대정지는 누군가 일부러 일으킨 것'이라는 기록**을 발견합니다(design.md §2.2 1막의 끝). 기록은 '모든 주문을 제시간에 끝내도록 지키던 자'가 세계를 멈췄다고만 말하고, 이름(할트)은 아직 나오지 않습니다(이름은 2막). 누리는 자기 지도에 이 도서관이 '처음부터' 그려져 있었다는 데 잠깐 고개를 갸웃합니다(§3 숨겨진 이야기 복선, 한 줄만) |
| 보스 | 사서 골렘(P0411, 기초 종합 구현): 문자열을 고칠 때마다 슬라이싱으로 새 문자열을 만드는 O(N·Q) 풀이를 시간 결계로 막고, `list(s)`로 바꿔 고친 뒤 마지막에 `"".join`하는 O(N + Q) 풀이를 통과시킵니다(design.md §6.2 "문자열 `+=` 반복 → `join`"의 취지. CPython·Pyodide는 `out += s`를 제자리 확장으로 최적화해서 지역 3처럼 막을 수 없으므로, 확실히 O(N)씩 드는 '중간 글자 바꾸기'로 같은 교훈을 줍니다) |

## 2. 레슨과 주문서

| 레슨 | 주문서 ID | 주문서 이름 | 다루는 내용 | JS 비교 포인트 |
|---|---|---|---|---|
| L4-1 | `scroll.string` | 글자 읽기의 주문서 | 문자열 인덱싱·음수 인덱스·슬라이싱(지역 3 복습), `len`, `in`, `for c in s`, 불변성(TypeError), `[::-1]`로 뒤집기 | JS 문자열도 불변. `s.length` → `len(s)`, `s.at(-1)` → `s[-1]`, `s.includes(x)` → `x in s`, `[...s].reverse().join("")` → `s[::-1]` |
| L4-2 | `scroll.strmethods` | 글자 다듬기의 주문서 | `upper`/`lower`/`strip`/`replace`/`find`/`count`/`startswith`/`endswith`, `isdigit`/`isalpha`/`isupper`, 메서드가 새 문자열을 돌려줌(`s.upper()`만 쓰고 대입 안 하는 실수) | `toUpperCase` → `upper`, `trim` → `strip`, `indexOf` → `find`(없으면 -1), `replaceAll` → `replace`(기본이 전부 바꿈) |
| L4-3 | `scroll.splitjoin` | 엮고 푸는 주문서 | `split()` vs `split(",")`, `"구분자".join(리스트)`(원소가 문자열이어야 함, `map(str, …)`), f-string과 서식(`:.2f`, `:>5`, `:03d`), `print(*arr)` 복습 | `arr.join(" ")` ↔ `" ".join(arr)`(주어가 반대), 템플릿 리터럴 `${x}` ↔ f-string `{x}`, `toFixed(2)` ↔ `:.2f` |
| L4-4 | `scroll.ascii` | 글자 번호의 주문서 | `ord`/`chr`, `ord(c) - ord("a")`로 0~25 칸 번호, `[0] * 26`으로 알파벳 세기, 알파벳 밀기(`% 26`), 대소문자 판별 | `charCodeAt` ↔ `ord`, `String.fromCharCode` ↔ `chr` |

- 레슨마다 run 블록 2개 이상과 빈칸 연습 1개(지역 1~3과 같은 형식). L4-1에서 `s[0] = "x"`가 TypeError를 내는 run 블록을 보여 주고, 그래서 '고칠 때는 `list(s)`로 바꿔서 고치고 `"".join`으로 돌려놓는다'를 L4-3에서 다시 짚습니다(보스 복선).

## 3. 문제(일반 10 + 보스 1)

| ID | 제목(가제) | 형식 | 개념 | 필요 주문서 | 구역 | 필수 |
|---|---|---|---|---|---|---|
| P0401 | 책등의 첫 글자와 끝 글자 | stdin | 인덱싱, 음수 인덱스, `len` | scroll.string | 정문 홀 | 필수 |
| P0402 | 거울 제목 | function | `[::-1]`로 회문 판별(대소문자 그대로, `True`/`False` 반환) | scroll.string | 정문 홀 | 필수 |
| P0403 | 모음 갉아먹는 벌레 | stdin | `for c in s` + `in "aeiou"`로 모음 개수 | scroll.string | 정문 홀 | 선택 |
| P0404 | 낡은 제목 정리 | function | `strip`/`lower`/`replace` 연쇄(앞뒤 공백 제거, 소문자, `_` → 공백) | scroll.strmethods | 열람실 | 필수 |
| P0405 | 주문어 찾기 | stdin | `find`(처음 위치, 없으면 -1)와 `count`(겹치지 않는 개수) | scroll.strmethods | 열람실 | 선택 |
| P0406 | 거꾸로 꽂힌 단어들 | stdin | `split` → 단어 순서 뒤집기 → `" ".join` | scroll.splitjoin | 서고 미로 | 필수 |
| P0407 | 대출 장부 | function | f-string 서식: 이름과 권수·연체료를 `"{name}: {n:03d}권 {fee:.2f}골드"` 같은 정해진 형식의 문자열 리스트로 반환 | scroll.splitjoin | 서고 미로 | 필수 |
| P0408 | 글자 수 세기 | stdin | `ord(c) - ord("a")`, `[0] * 26`, `print(*cnt)`(백준 10808 유형의 오리지널) | scroll.ascii | 필사실 | 필수 |
| P0409 | 시저의 봉인 | function | 알파벳 밀기: 대소문자 유지, 공백은 그대로, `% 26`로 z 다음 a(프로그래머스 12926 유형의 오리지널) | scroll.ascii | 필사실 | 필수 |
| P0410 | 뒤집힌 대소문자 | stdin | `isupper`/`upper`/`lower`로 대소문자 바꾸기 + 숫자·기호는 그대로(`swapcase` 써도 통과) | scroll.ascii | 봉인 서고 | 선택 |
| P0411 | [보스] 사서 골렘 | stdin | 기초 종합 구현(아래). 1페이즈 정확성(N, Q ≤ 1000), 2페이즈 N, Q ≤ 100,000 시간 결계 | 지역 4 주문서 4개 | 골렘의 열람대 | 필수 |

- 모든 문제는 지역 1~3의 품질 기준을 따르고(공개 1 + 숨김 3 이상, 경계값, 오답 2개와 진단, 힌트 3단계, 변형 2개), 지역 1~4 개념만 씁니다. 함수 구현형은 `def solution` 틀을 미리 줍니다. 문자열 입력은 끝의 줄바꿈을 신경 써야 하므로 stdin형 starter는 `input()` 또는 `sys.stdin.readline().rstrip()`을 씁니다(공백이 있는 줄을 `strip()`하면 안 되는 문제는 `rstrip("\n")`).
- 진단에 넣을 흔한 실수: `s[0] = "x"` TypeError('str' object does not support item assignment), `s.upper()`만 쓰고 대입하지 않음(출력이 그대로), `"".join(정수 리스트)` TypeError(expected str instance, int found), `readline()`의 `\n`이 남아 길이·비교가 틀림, `find`와 `index`의 차이(없을 때 ValueError), JS식 `s.length`·`s.toUpperCase()`(AttributeError), `ord(c) - 97`을 대문자에 써서 음수 칸, `chr(ord(c) + k)`에서 `% 26`을 빠뜨려 z 다음이 `{`.
- 보스 P0411(사서 골렘): 첫 줄에 길이 N의 소문자 문자열(망가진 책의 문장), 둘째 줄에 Q, 이어서 Q줄의 수리 명령. 명령은 `SET i c`(i번째 글자를 c로, 1부터), `SWAP i j`(두 글자 맞바꾸기), `UPPER i`(i번째 글자를 대문자로). 모든 명령을 적용한 문자열 한 줄과, 그 문자열 안의 대문자 개수를 둘째 줄에 출력합니다. 지역 1(입력·형변환), 2(조건·반복), 3(list), 4(문자열·`ord`·`join`)를 모두 씁니다.
  - 모범답안: `arr = list(s)`로 고치고 마지막에 `"".join(arr)`. 비효율 답안 `slow.py`: 명령마다 `s = s[:i] + c + s[i+1:]`(O(N)씩, 총 O(N·Q)). 오답 예: 1부터 세는 i를 그대로 칸 번호로 씀, `SWAP`에서 같은 칸(i = j)을 처리하다 글자를 잃음, 대문자 개수를 명령 수로 셈.
  - 정답으로 인정하는 다른 풀이: 매 명령은 list로 고치고 출력만 `out += c`로 이어 붙이는 풀이(`alt_concat.py`)도 통과해야 합니다(지역 3 보스와 같은 원칙: `+=` 이어 붙이기 자체는 막지 않음).
  - 2페이즈 입력은 `gen`(design.md §11.1). `budgetUnits`는 지역 2·3처럼 Pyodide에서 재서 정합니다(모범답안 ≥ 3배 여유, `alt_concat.py`도 3배 이상 여유, `slow.py`는 확실히 초과). 2페이즈 테스트가 모두 같은 크기면 `phases[2].stopOnTle`을 켭니다.
- 보상: 일반 100 XP / 50 골드, 보스 1000 XP / 500 골드.
- 실전 추천(research.md §2.5.2 지역 4, 2026-10-02 이 PC에서 프로그래머스 접속해 제목·레벨 확인): 프로그래머스 12926 시저 암호(Lv.1), 72410 신규 아이디 추천(Lv.1), 60057 문자열 압축(Lv.2)을 먼저, 이어서 백준 10808 알파벳 개수, 1316 그룹 단어 체커, 17413 단어 뒤집기 2(백준은 서비스 중지로 링크 비활성).

## 4. 맵 구역과 오브젝트

고블린 동굴의 `warp_east`(지금은 `to_be_continued`)에 `target=r04`, `targetSpawn=spawn_west`를 더하고 `openDialogue`를 뺍니다. 도서관은 서 → 동으로 이어지고, 각 구역 출구는 필수 몬스터가 한 칸짜리 길목을 막습니다. 크기는 지역 3과 비슷하게(가로 100 안팎 × 세로 24~30).

| 구역 | 오브젝트 ID | 종류 | props |
|---|---|---|---|
| 1 정문 홀 | `spawn_west` | spawn | |
| | `warp_west` | warp | `target=r03`, `targetSpawn=warp_east` |
| | `t_library_intro` | trigger | `dialogue=library_intro`, `once=true` (spawn 바로 옆) |
| | `rune_L4-1` | rune | `lesson=L4-1` |
| | `campfire_hall` | campfire | (꺼지지 않는 화로) |
| | `m_P0401` | monster | `problem=P0401` (길목) |
| | `m_P0403` | monster | `problem=P0403` (선택) |
| | `m_P0402` | monster | `problem=P0402` (구역 출구) |
| 2 열람실 | `rune_L4-2` | rune | `lesson=L4-2` |
| | `npc_ghost_librarian` | npc | `dialogue=npc_ghost_librarian`, `sprite=npc_ghost_librarian` (유령 사서. 숨겨진 길 위치를 귀띔) |
| | `board_shadow_r04` | board | |
| | `m_P0405` | monster | `problem=P0405` (선택) |
| | `m_P0404` | monster | `problem=P0404` (구역 출구) |
| 3 서고 미로 | `rune_L4-3` | rune | `lesson=L4-3` |
| | `sign_stacks` | sign | `dialogue=sign_stacks` |
| | `chest_hidden_stacks` | chest | `gold=70`, `dialogue=chest_hidden_stacks` (숨겨진 길: 비어 있는 책장 칸 `shelf_gap`) |
| | `m_P0406` | monster | `problem=P0406` (길목) |
| | `m_P0407` | monster | `problem=P0407` (구역 출구) |
| 4 필사실 | `rune_L4-4` | rune | `lesson=L4-4` |
| | `chest_archivist` | chest | `item=archivist-glasses`, `dialogue=chest_archivist` (기록관의 안경, 길목 앞 필수 경로 옆) |
| | `campfire_scriptorium` | campfire | |
| | `m_P0408` | monster | `problem=P0408` (길목) |
| | `m_P0409` | monster | `problem=P0409` (구역 출구) |
| 5 봉인 서고 | `sign_sealed_record` | sign | `dialogue=sign_sealed_record` (대정지가 의도된 것이라는 기록) |
| | `m_P0410` | monster | `problem=P0410` (선택) |
| | `t_boss_intro` | trigger | `dialogue=boss_intro`, `once=true` (보스 두 칸 앞) |
| 6 골렘의 열람대 | `m_P0411` | monster | `problem=P0411` (보스) |
| | `warp_east` | warp | `requires=problem:P0411`, `lockedDialogue=east_gate_locked`, `openDialogue=to_be_continued` |

- 몬스터가 요구하는 주문서의 비석은 그 몬스터보다 앞(치우기 전에 닿는 곳)에 둡니다(`tools/maps/common.py`의 공통 검사).
- 숨겨진 길: 서고 미로의 책장 벽 가운데 지나갈 수 있는 빈 책장 칸 하나(새 타일 `shelf_gap`, 지역 1~3의 덤불·벽 틈과 같은 방식). 유령 사서와 표지판 대사가 위치를 귀띔합니다.
- 보스 앞 캠프파이어: 필사실의 `campfire_scriptorium`이 보스 전 마지막 회복 지점입니다. 봉인 서고가 길면 봉인 서고 안에 하나 더 둡니다.

### 4.1 상자의 아이템(`item` prop)

- 상자 오브젝트에 선택 prop `item`(아이템 ID)을 둡니다. 열면 그 아이템을 얻고 토스트로 "기록관의 안경을 얻었다!"를 보여 줍니다. `gold`와 함께 쓸 수 있습니다.
- 이미 가진 장신구면(다른 경로로 얻은 경우) 다시 주지 않고 상자만 엽니다.

## 5. 대사 ID 목록

`region_intro`, `library_intro`, `npc_ghost_librarian`, `sign_stacks`, `chest_hidden_stacks`, `chest_archivist`, `sign_sealed_record`, `boss_intro`, `boss_defeated`, `east_gate_locked`, `to_be_continued`, `region_clear`, 레슨마다 `lesson_L4-N_intro`, `lesson_L4-N_done`.

- `chest_archivist`: 누리가 안경을 보고 "Traceback 해설 옆에 어느 레슨을 다시 보면 좋을지 알려 준대!"처럼 효과를 설명하고, 장비 메뉴(Esc → 장비)에서 낄 수 있다고 알려 줍니다.

## 6. 기록관의 안경(장신구 효과 연결)

items.json의 `archivist-glasses`(`effect.type = "codexLinks"`, 지금은 `pending: true`)를 실제로 연결합니다.

- `content/companion/traceback.json`의 해설 규칙에 선택 필드 `lesson`(레슨 ID)을 둡니다. 예: `TypeError: can only concatenate str` → `L1-3`(형변환), `IndexError: list index out of range` → `L3-1`, `'str' object does not support item assignment` → `L4-1`, `AttributeError ... 'str' object has no attribute` → `L4-2`, `ValueError: invalid literal for int()` → `L1-3`. 지역 1~4 레슨에 맞는 규칙에만 답니다.
- 안경을 장착하고 있고, 해설 규칙에 `lesson`이 있고, 그 레슨을 이미 배웠으면 전투 메시지의 해설 아래에 "📖 코덱스: <레슨 제목>" 버튼을 보여 줍니다. 누르면 코덱스가 그 레슨을 연 채로 열리고, 닫으면 전투로 돌아옵니다(에디터 코드와 전투 상태 유지). 배우지 않은 레슨이면 버튼을 보여 주지 않습니다.
- 안경이 없으면 지금과 똑같습니다. `pending`을 지웁니다.
- 검사: `tools/verify_content.py`가 `lesson`이 실제 레슨 ID인지 확인합니다. 단위 테스트(규칙 → 레슨), E2E(안경 장착 → RE → 버튼 → 코덱스 → 돌아와서 코드 유지).

## 7. 아트(새로 필요한 것)

| 논리 이름 | 크기 | 내용 |
|---|---|---|
| `monster_letter_moth` | 16×16 × 2 | 날개에 글자가 찍힌 나방 |
| `monster_ink_slime` | 16×16 × 2 | 잉크병에서 흘러나온 검푸른 슬라임 |
| `monster_quill_sprite` | 16×16 × 2 | 깃펜 모양의 작은 정령 |
| `monster_scroll_snake` | 16×16 × 2 | 두루마리가 풀리며 뱀처럼 기어 다님 |
| `monster_cipher_owl` | 16×16 × 2 | 눈에 알파벳 바퀴가 도는 부엉이 |
| `boss_librarian_golem` | 32×32 × 2 | 책장으로 된 몸의 골렘, 가슴에 시계 룬, 손에 거대한 깃펜 |
| `npc_ghost_librarian` | 128×16 걷기 시트 | 반투명한 유령 사서(동그란 안경, 긴 로브) |
| 도서관 타일(타일셋 끝에 추가) | 16×16 | `lib_floor`, `lib_carpet`, `lib_wall`, `lib_wall_top`, `bookshelf`, `bookshelf_fallen`, `book_pile`, `reading_desk`, `candle_frozen`, `broken_pillar`, `floating_pages`, `shelf_gap` |

- 새 타일 중 충돌 타일: `lib_wall`, `lib_wall_top`, `bookshelf`, `bookshelf_fallen`, `book_pile`, `reading_desk`, `candle_frozen`, `broken_pillar`(`lib_floor`, `lib_carpet`, `floating_pages`, `shelf_gap`은 지나갈 수 있음). `shelf_gap`은 `bookshelf`와 거의 같아 보이되 자세히 보면 책이 빠진 칸이 보이게.
- 화풍은 지역 1~3과 누리의 팔레트(색 윤곽선, 단계 음영)를 맞춥니다. 따뜻한 나무·양피지 톤에 멈춘 촛불과 떠 있는 페이지의 청록 서리 강조. 지역 1~3 몬스터와 실루엣이 겹치지 않게.

## 8. 검증(이 지역의 완료 기준)

- `npm run verify` 통과(콘텐츠, 변형, `build_r04.py --check`, 아트 검사), 단위 테스트, 콘텐츠 스모크 r04(Pyodide와 CPython 판정 일치), 보스 budgetUnits 측정 결과 기록.
- 지역 4 클리어 E2E: 실제 키보드로 고블린 동굴 동쪽 문 → 대도서관 → 레슨 4 → 필수 몬스터 → 안경 상자 → 보스 1·2페이즈 → 클리어 창(실전 추천) → `to_be_continued`.
- 전체 E2E 통과.
