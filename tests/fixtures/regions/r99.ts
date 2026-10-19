// 지역 간 이동 시험용 작은 지역(r99). 실제 콘텐츠(content/)에는 없고, 단위 테스트와 E2E(?e2e&fixtures)에서만 쓴다.
//   T 나무(막힘)  . 풀  S spawn_west  H t_r99_hello(spawn 바로 옆 once 트리거)  W warp_west(에코 마을로)  C 캠프파이어
//   B m_P9901(복잡도 예측 질문 시험용 중간 보스, region07-spec.md §9.2)  D bridge_r99(고장 난 다리 퍼즐 Z9901, §9.1)
import type { Problem, Puzzle, Region } from "../../../src/contracts/content";

const ROWS = [
  "TTTTTTTTTT",
  "T....B..DT",
  "TSH......T",
  "T........T",
  "TW......CT",
  "TTTTTTTTTT",
];

const TILE = { grass: 1, tree: 7 }; // overworld 타일셋 gid(firstgid 1)

type Obj = [id: string, type: string, props: Record<string, string | boolean>];
const OBJECTS: Record<string, Obj> = {
  S: ["spawn_west", "spawn", {}],
  H: ["t_r99_hello", "trigger", { dialogue: "r99_hello", once: true }],
  W: ["warp_west", "warp", { openDialogue: "r99_back", target: "r01", targetSpawn: "warp_east" }],
  C: ["campfire_r99", "campfire", {}],
  B: ["m_P9901", "monster", { problem: "P9901" }],
  D: ["bridge_r99", "door", { puzzle: "Z9901", lockedDialogue: "r99_bridge_broken", sprite: "obj_bridge_broken" }],
};

function buildMap(): Record<string, unknown> {
  const h = ROWS.length;
  const w = ROWS[0].length;
  const ground: number[] = [];
  const objects: Record<string, unknown>[] = [];
  ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      ground.push(ch === "T" ? TILE.tree : TILE.grass);
      const o = OBJECTS[ch];
      if (!o) return;
      const [name, type, props] = o;
      objects.push({
        id: objects.length + 1,
        name,
        type,
        x: x * 16,
        y: y * 16,
        width: 16,
        height: 16,
        properties: Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === "boolean" ? "bool" : "string", value: v })),
      });
    }),
  );
  return {
    type: "map",
    orientation: "orthogonal",
    infinite: false,
    width: w,
    height: h,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [{ firstgid: 1, name: "overworld", tilecount: 24, columns: 8, tilewidth: 16, tileheight: 16 }],
    layers: [
      { type: "tilelayer", name: "ground", width: w, height: h, data: ground },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

/** 1부터 n까지의 합. 2페이즈(n = 10^18)는 반복문으로는 끝나지 않는다(지역 1 P0105와 같은 구조, 함수형) */
export function fixtureBossP9901(): Problem {
  return {
    id: "P9901",
    regionId: "r99",
    title: "[중간 보스] 시험 계단",
    kind: "function",
    entry: "solution",
    enemy: { name: "시험 계단", sprite: "boss_stair_mimic", attack: 10 },
    requires: [],
    boss: true,
    midBoss: true,
    phases: [
      { phase: 1, name: "정확성" },
      { phase: 2, name: "시간 결계", intro: "계단이 10^18칸까지 늘어났어!" },
    ],
    concept: "scroll.arith",
    timeLimitMs: 2000,
    budgetUnits: 0.5,
    estimatedMinutes: 10,
    tests: [
      { args: "(10,)", expect: "55", public: true, phase: 1 },
      { args: "(1,)", expect: "1", phase: 1, note: "경계" },
      { args: "(3,)", expect: "6", phase: 1 },
      { args: "(1000000000000000000,)", expect: "500000000000000000500000000000000000", phase: 2 },
    ],
    statement: "# 시험 계단\n`solution(n)`: 1부터 n까지의 합을 돌려준다.",
    starter: "def solution(n):\n    pass\n",
    solution: "def solution(n):\n    return n * (n + 1) // 2\n",
    explanation: "등차수열의 합.",
    hints: ["하나씩 더하면 오래 걸려.", "등차수열의 합 공식.", "`n * (n + 1) // 2`"],
    diagnoses: [],
    reward: { xp: 400, gold: 200 },
    targetComplexity: "O(1)",
    complexityChoices: ["O(N)", "O(1)", "O(N²)"],
  };
}

/** 고장 난 다리 퍼즐: 완전제곱수를 소수로 보는 판정(i * i < n) → i * i <= n(Z0701과 같은 버그) */
export function fixturePuzzleZ9901(): Puzzle {
  return {
    id: "Z9901",
    regionId: "r99",
    title: "시험 다리",
    kind: "function",
    entry: "solution",
    statement: "# 시험 다리\n다리 장치의 `solution(n)`은 n이 소수인지 돌려준다. 49 같은 수에서 틀린다.",
    starter:
      "def solution(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i < n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True\n",
    solution:
      "def solution(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True\n",
    timeLimitMs: 2000,
    tests: [
      { args: "(7,)", expect: "True", public: true },
      { args: "(49,)", expect: "False", note: "경계: 완전제곱수" },
      { args: "(1,)", expect: "False", note: "경계" },
      { args: "(2,)", expect: "True" },
      { args: "(9,)", expect: "False" },
    ],
    hints: ["49에서 반복이 어디까지 도는지 따라가 봐.", "7 × 7 = 49인데 7은 확인했을까?", "`while i * i <= n:`"],
    source: { problem: "P9901", wrong: "wrong_a.py" },
    solvedDialogue: "r99_bridge_fixed",
  };
}

export function fixtureRegionR99(): Region {
  return {
    id: "r99",
    order: 99,
    name: "시험의 들판",
    map: buildMap(),
    introDialogue: "r99_intro",
    problems: [fixtureBossP9901()],
    lessons: [],
    puzzles: [fixturePuzzleZ9901()],
    recommended: [],
    dialogues: {
      r99_intro: [{ speaker: "companion", emotion: "happy", text: "여기는 시험의 들판이야." }],
      r99_hello: [{ speaker: "companion", emotion: "neutral", text: "spawn 옆 트리거야." }],
      r99_back: [{ speaker: "system", text: "에코 마을로 돌아간다." }],
      r99_bridge_broken: [{ speaker: "companion", emotion: "worried", text: "다리가 부서져 있어. 장치 코드를 고쳐 보자." }],
      r99_bridge_fixed: [{ speaker: "companion", emotion: "happy", text: "다리가 이어졌어!" }],
    },
  };
}
