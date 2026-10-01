// UI 개발·E2E용 고정 데이터(design.md §8.3 P0101·P0103·P0105, §5.4 빈칸 연습을 본뜸)
import type { CompanionProfile, DialogueLine, Lesson, Problem, RecommendedProblem, TracebackRule } from "../../../src/contracts/content";

export const companion: CompanionProfile = { name: "누리", portrait: "portrait_nuri" };

export const P0101: Problem = {
  id: "P0101",
  regionId: "r01",
  title: "금화 두 자루",
  kind: "stdin",
  enemy: { name: "타입 슬라임", sprite: "monster_type_slime", attack: 20 },
  requires: ["scroll.convert"],
  boss: false,
  concept: "scroll.convert",
  timeLimitMs: 2000,
  estimatedMinutes: 5,
  tests: [
    { in: "1 2\n", out: "3\n", public: true },
    { in: "0 0\n", out: "0\n" },
    { in: "7 0\n", out: "7\n" },
    { in: "999999999999999999 1\n", out: "1000000000000000000\n" },
    { in: "1000000000000000000 1000000000000000000\n", out: "2000000000000000000\n" },
  ],
  statement:
    "광장의 상인이 금화 두 자루를 맡긴 채 굳어 버렸습니다. 두 자루에 든 금화 수를 합쳐서 장부에 적어 주세요.\n\n**입력**: 첫째 줄에 두 정수 a, b가 공백 하나를 사이에 두고 주어집니다. (0 ≤ a, b ≤ 10^18)\n\n**출력**: a + b를 출력합니다.\n\n## 예제\n\n| 입력 | 출력 |\n|---|---|\n| `1 2` | `3` |",
  starter: "",
  solution: "a, b = map(int, input().split())\nprint(a + b)\n",
  explanation: "Python의 `int`는 크기 제한이 없으므로 10^18끼리 더해도 정확합니다. JS의 Number로는 `999999999999999999`를 정확히 담을 수조차 없습니다.",
  hints: [
    "`input()`이 돌려주는 값의 자료형을 확인해 보세요.",
    "`split()`으로 나눈 뒤 각각 `int()`로 바꿉니다.",
    "```python\na, b = map(int, ____.split())\n```",
  ],
  diagnoses: [
    { when: { outputMatches: "^\\d+\\d+$" }, text: "`input()`은 문자열을 돌려줘요. 그래서 `+`가 덧셈이 아니라 이어 붙이기가 됐어요. `int()`로 바꿔 보세요." },
    { when: { outputMatches: "\\.0$" }, text: "`float`는 소수점이 붙어서 출력되고, 큰 수에서는 정밀도도 잃어요. 정수는 `int`로 바꿔 주세요." },
  ],
  reward: { xp: 100, gold: 50 },
};

export const P0103: Problem = {
  id: "P0103",
  regionId: "r01",
  title: "몇 번 때려야 할까",
  kind: "function",
  entry: "solution",
  enemy: { name: "철갑 두더지", sprite: "monster_iron_mole", attack: 30 },
  requires: ["scroll.arith"],
  boss: false,
  concept: "scroll.arith",
  timeLimitMs: 2000,
  estimatedMinutes: 8,
  tests: [
    { args: "(10, 3)", expect: "4", public: true },
    { args: "(9, 3)", expect: "3", public: true },
    { args: "(1, 1)", expect: "1" },
    { args: "(1, 1000000000000000000)", expect: "1" },
    { args: "(1000000000000000000, 1)", expect: "1000000000000000000" },
    { args: "(999999999999999999, 1)", expect: "999999999999999999" },
    { args: "(1000000000000000000, 3)", expect: "333333333333333334" },
  ],
  statement:
    "철갑 두더지의 체력은 hp이고, 한 번 때릴 때마다 체력이 atk씩 줄어듭니다. 체력이 0 이하가 되면 두더지가 쓰러집니다. 두더지를 쓰러뜨리려면 최소 몇 번 때려야 하는지 반환하도록 `solution` 함수를 완성하세요.\n\n**제한**: hp와 atk는 정수이고, 1 ≤ hp, atk ≤ 10^18입니다.\n\n## 예제\n\n| hp | atk | 반환값 |\n|---|---|---|\n| `10` | `3` | `4` |\n| `9` | `3` | `3` |",
  starter: "def solution(hp, atk):\n    answer = 0\n    return answer\n",
  solution: "def solution(hp, atk):\n    return (hp + atk - 1) // atk\n",
  explanation: "hp ÷ atk를 올림한 값이 답입니다. 나누기 전에 `atk - 1`을 더하면, 나누어떨어지지 않을 때만 몫이 1 늘어납니다.",
  hints: [
    "나누어떨어지지 않으면 한 번 더 때려야 해요.",
    "올림 나눗셈을 정수 연산만으로 만들어 보세요. `/`를 쓰면 큰 수에서 틀려요.",
    "```python\nreturn (hp + ____) // atk\n```",
  ],
  diagnoses: [],
  reward: { xp: 100, gold: 50 },
};

export const P0105: Problem = {
  id: "P0105",
  regionId: "r01",
  title: "[보스] 계단 미믹",
  kind: "stdin",
  enemy: { name: "계단 미믹", sprite: "boss_stair_mimic", attack: 40 },
  requires: ["scroll.voice", "scroll.convert", "scroll.arith", "scroll.quick_ear"],
  boss: true,
  phases: [
    { phase: 1, name: "정확성", intro: "계단 미믹이 정체를 드러냈어! 먼저 정확하게 맞혀 보자." },
    { phase: 2, name: "시간 결계", intro: "미믹이 시간 결계를 펼쳤어! 이제는 빨라야 해. 시간 게이지를 봐!" },
  ],
  concept: "scroll.arith",
  timeLimitMs: 2000,
  budgetUnits: 40,
  estimatedMinutes: 15,
  tests: [
    { in: "1 10\n", out: "55\n", public: true, phase: 1 },
    { in: "5 5\n", out: "5\n", phase: 1 },
    { in: "3 7\n", out: "25\n", phase: 1 },
    { in: "1 1000000000000000000\n", out: "500000000000000000500000000000000000\n", phase: 2 },
    { in: "100000000000000000 1000000000000000000\n", out: "495000000000000000550000000000000000\n", phase: 2 },
    { in: "1000000000000000000 1000000000000000000\n", out: "1000000000000000000\n", phase: 2 },
  ],
  statement:
    "시계탑으로 오르는 계단 가운데 하나가 미믹이었습니다! a번 계단부터 b번 계단까지, 모든 계단 번호의 합을 외쳐야 미믹이 정체를 드러냅니다.\n\n**입력**: 첫째 줄에 두 정수 a, b가 공백 하나를 사이에 두고 주어집니다. (1 ≤ a ≤ b ≤ 10^18)\n\n**출력**: a + (a + 1) + … + b를 출력합니다.\n\n## 예제\n\n| 입력 | 출력 |\n|---|---|\n| `1 10` | `55` |",
  starter: "",
  solution: "a, b = map(int, input().split())\nprint((a + b) * (b - a + 1) // 2)\n",
  explanation: "등차수열의 합 공식 '(첫 항 + 끝 항) × 항의 개수 ÷ 2'를 씁니다.",
  hints: [
    "반복문이 10^18번 돈다면 얼마나 걸릴지 계산해 보세요.",
    "1부터 10까지의 합을 (1 + 10), (2 + 9), … 처럼 짝지어 보세요(가우스의 방법).",
    "```python\nprint((a + b) * (____) // 2)\n```",
  ],
  diagnoses: [
    { when: { verdict: "TLE" }, text: "주문은 맞았지만 너무 느려요. 10^18번 반복하면, 1초에 1억 번씩 더해도 300년이 넘게 걸려요. 반복하지 않고 한 번에 계산하는 방법이 있어요." },
  ],
  reward: { xp: 1000, gold: 500 },
};

export const problems: Record<string, Problem> = { P0101, P0103, P0105 };

export const L12: Lesson = {
  id: "L1-2",
  regionId: "r01",
  title: "변환의 주문",
  scroll: { id: "scroll.convert", name: "변환의 주문서", summary: "`int()`, `float()`, `str()`과 `map(int, input().split())`" },
  body: [
    "# 문자열을 숫자로",
    "",
    "`input()`은 **언제나 문자열**을 돌려줘, {player}. 숫자로 계산하려면 `int()`로 바꿔야 해.",
    "",
    "```python run",
    'print(int("3") + 4)',
    'print("3" + "4")',
    "```",
    "",
    "```js compare",
    '"1" + 2   // "12" (JS는 자동 변환)',
    "```",
    "",
    "| 함수 | 결과 |",
    "|---|---|",
    '| `int("7")` | `7` |',
    '| `str(7)` | `"7"` |',
    "",
    "> 한 줄에 두 수를 받을 때는 `map(int, input().split())`을 통째로 외워 두자.",
  ].join("\n"),
  exercise: {
    kind: "blank",
    prompt: "두 수를 입력받아 합을 출력하도록 빈칸을 채워 보세요.",
    code: "a, b = map(___, input().split())\nprint(a + b)",
    stdin: "3 4\n",
    expectedOutput: "7\n",
    answer: "int",
  },
};

export const L11: Lesson = {
  id: "L1-1",
  regionId: "r01",
  title: "목소리의 주문",
  scroll: { id: "scroll.voice", name: "목소리의 주문서", summary: "`print`와 `input`, `sep`·`end`" },
  body: "# print\n\n`print`는 JS의 `console.log`와 비슷해.\n\n```python run\nprint(\"안녕\", \"에코 마을\", sep=\", \")\n```\n",
};

export const lessons: Lesson[] = [L11, L12];

export const dialogueLines: DialogueLine[] = [
  { speaker: "companion", emotion: "surprised", text: "…깨어났어? 나는 {companion}! 지도 제작자야." },
  { speaker: "player", text: "여긴 어디지?" },
  { speaker: "companion", emotion: "happy", text: "에코 마을이야. 반가워, {player}! `print`부터 배워 보자." },
  { speaker: "상인", text: "(굳어 있다…)" },
  { speaker: "system", text: "목소리의 주문서를 찾아보자." },
];

export const traceback: TracebackRule[] = [
  { exception: "TypeError", text: "자료형이 맞지 않는 연산을 했어." },
  { exception: "NameError", text: "정의하지 않은 이름을 썼어." },
];

export const recommended: RecommendedProblem[] = [
  { site: "boj", id: 1000, title: "A+B", level: "브론즈 5" },
  { site: "programmers", id: 120802, title: "두 수의 합", level: "Lv. 0" },
  { site: "boj", id: 10869, title: "사칙연산", level: "브론즈 5" },
  { site: "programmers", id: 120803, title: "두 수의 차", level: "Lv. 0" },
];
