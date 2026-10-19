// 고장 난 다리 퍼즐의 저장 규칙과 복잡도 예측 질문의 상태(docs/phase3/region07-spec.md §9.1, §9.2).
import { describe, expect, it } from "vitest";
import type { Problem, Puzzle } from "../../src/contracts/content";
import {
  applyPuzzleSolved,
  complexityGuessFlag,
  complexityRevealText,
  createComplexityTracker,
  doorPuzzleId,
  isPuzzleSolved,
  itemsRewardedBy,
  puzzleAsProblem,
  puzzleSolvedFlag,
  shouldAskComplexity,
  validComplexityChoices,
} from "../../src/systems";
import { loadContent } from "../../src/content/loader";
import { validateSave } from "../../src/state/validate";
import { newSave } from "./systems-fixtures";

const PUZZLE: Puzzle = {
  id: "Z0701",
  regionId: "r07",
  title: "부서진 수로 다리",
  kind: "function",
  entry: "solution",
  statement: "# 다리",
  starter: "def solution(n):\n    return False\n",
  solution: "def solution(n):\n    return True\n",
  timeLimitMs: 2000,
  tests: [{ args: "(7,)", expect: "True", public: true }],
  hints: ["a", "b", "c"],
  source: { problem: "P0708", wrong: "wrong_a.py" },
  solvedDialogue: "bridge_fixed",
};

const boss = (over: Partial<Problem> = {}): Problem => ({
  id: "P0707",
  regionId: "r07",
  title: "모래 전갈",
  kind: "stdin",
  enemy: { name: "모래 전갈", sprite: "boss_sand_scorpion", attack: 30 },
  requires: [],
  boss: true,
  midBoss: true,
  phases: [{ phase: 1, name: "정확성" }, { phase: 2, name: "시간 결계" }],
  concept: "scroll.lookup",
  timeLimitMs: 2000,
  estimatedMinutes: 20,
  tests: [{ in: "1\n", out: "1\n", public: true }, { in: "2\n", out: "2\n", phase: 2 }],
  statement: "",
  starter: "",
  solution: "",
  explanation: "",
  hints: ["a", "b", "c"],
  diagnoses: [],
  reward: { xp: 400, gold: 200 },
  targetComplexity: "O(N + Q)",
  complexityChoices: ["O(N × Q)", "O(N + Q)", "O(N²)"],
  ...over,
});

describe("퍼즐: 문제 모양으로 바꾸기와 저장", () => {
  it("적 대신 다리 그림, 반격·보상·진단 없음, 시작 코드는 starter", () => {
    const p = puzzleAsProblem(PUZZLE, "obj_bridge_broken");
    expect(p.enemy).toEqual({ name: "부서진 수로 다리", sprite: "obj_bridge_broken", attack: 0 });
    expect(p.reward).toEqual({ xp: 0, gold: 0 });
    expect(p.boss).toBe(false);
    expect(p.requires).toEqual([]);
    expect(p.diagnoses).toEqual([]);
    expect(p.starter).toBe(PUZZLE.starter);
    expect(p.entry).toBe("solution");
    expect(p.tests).toBe(PUZZLE.tests);
    expect(puzzleAsProblem({ ...PUZZLE, kind: "stdin", entry: undefined }, "obj_door").entry).toBeUndefined();
  });

  it("door의 puzzle 속성", () => {
    expect(doorPuzzleId({ puzzle: "Z0701", lockedDialogue: "bridge_broken" })).toBe("Z0701");
    expect(doorPuzzleId({ requires: "problem:P0101" })).toBeUndefined();
    expect(doorPuzzleId({ puzzle: "" })).toBeUndefined();
  });

  it("풀면 flags[puzzle.solved:<ID>]와 removedObjects만 바뀌고, 저장 검증기를 통과한다", () => {
    const s0 = newSave();
    const s1 = applyPuzzleSolved(s0, "Z0701", "bridge_r07");
    expect(s1.flags[puzzleSolvedFlag("Z0701")]).toBe(true);
    expect(s1.removedObjects).toEqual([...s0.removedObjects, "bridge_r07"]);
    expect(isPuzzleSolved(s1, "Z0701")).toBe(true);
    expect(isPuzzleSolved(s0, "Z0701")).toBe(false);
    // 원본은 그대로, 전투 기록·XP·스트릭·퀘스트는 건드리지 않는다
    expect(s0.flags[puzzleSolvedFlag("Z0701")]).toBeUndefined();
    expect(s1.problems).toBe(s0.problems);
    expect(s1.player).toBe(s0.player);
    expect(s1.streak).toBe(s0.streak);
    expect(s1.history).toBe(s0.history);
    // 두 번 적용해도 door는 한 번만
    expect(applyPuzzleSolved(s1, "Z0701", "bridge_r07").removedObjects.filter((x) => x === "bridge_r07")).toHaveLength(1);
    expect(validateSave(JSON.parse(JSON.stringify(s1))).ok).toBe(true);
  });
});

describe("모래시계 부적 보상(region07-spec.md §5.2)", () => {
  it("지역 7 최종 보스 P0714를 처음 이기면 얻는다(지역 2 길잡이 깃털과 같은 방식)", () => {
    const items = loadContent().items;
    expect(items.find((i) => i.id === "hourglass-charm")?.rewardFrom).toBe("P0714");
    expect(itemsRewardedBy(items, "P0714").map((i) => i.id)).toEqual(["hourglass-charm"]);
  });
});

describe("복잡도 예측 질문", () => {
  it("선택지 형식: 서로 다른 3개, targetComplexity 포함", () => {
    expect(validComplexityChoices(boss())).toBe(true);
    expect(validComplexityChoices(boss({ complexityChoices: ["O(N)", "O(N + Q)"] }))).toBe(false);
    expect(validComplexityChoices(boss({ complexityChoices: ["O(N)", "O(N)", "O(N + Q)"] }))).toBe(false);
    expect(validComplexityChoices(boss({ complexityChoices: ["O(N)", "O(1)", "O(N²)"] }))).toBe(false);
    expect(validComplexityChoices(boss({ complexityChoices: ["O(N)", " ", "O(N + Q)"] }))).toBe(false);
    expect(validComplexityChoices(boss({ targetComplexity: undefined }))).toBe(false);
  });

  it("맵의 보스전에서만 묻는다(그림자전·연습 전투·퍼즐·이미 공개한 문제·선택지 없는 보스·일반 전투는 아님)", () => {
    expect(shouldAskComplexity(boss())).toBe(true);
    expect(shouldAskComplexity(boss(), { shadow: true })).toBe(false);
    expect(shouldAskComplexity(boss(), { practice: true })).toBe(false);
    expect(shouldAskComplexity(boss(), { puzzle: true })).toBe(false);
    expect(shouldAskComplexity(boss(), { targetRevealed: true })).toBe(false);
    expect(shouldAskComplexity(boss({ complexityChoices: undefined }))).toBe(false);
    expect(shouldAskComplexity(boss({ boss: false, midBoss: undefined }))).toBe(false);
    // 페이즈가 하나뿐인 보스(예: 그림자 변형처럼 1페이즈만 낸 문제)
    expect(shouldAskComplexity(boss({ phases: undefined, tests: [{ in: "1\n", out: "1\n", public: true }] }))).toBe(false);
  });

  it("고른 직후에는 결과를 보이지 않고, 공개는 한 번만(부적 공개와 보상 창 가운데 먼저)", () => {
    const t = createComplexityTracker("O(N + Q)");
    expect(t.reveal()).toBeNull(); // 아직 묻지 않음
    expect(t.answer("O(N × Q)")).toBe(false); // 저장 값: 맞았는가
    expect(t.choice).toBe("O(N × Q)");
    expect(t.reveal()).toEqual({ guess: "O(N × Q)", target: "O(N + Q)", correct: false });
    expect(t.revealed).toBe(true);
    expect(t.reveal()).toBeNull(); // 보상 창에서는 다시 보이지 않음
  });

  it("맞힌 답, 건너뛰기", () => {
    const ok = createComplexityTracker("O(N + Q)");
    expect(ok.answer("O(N + Q)")).toBe(true);
    expect(ok.reveal()?.correct).toBe(true);
    const skip = createComplexityTracker("O(N + Q)");
    expect(skip.answer(null)).toBeNull();
    expect(skip.choice).toBeNull();
    expect(skip.reveal()).toBeNull(); // 건너뛰면 공개할 예측이 없다
  });

  it("문구와 저장 키, 저장 검증기가 새 플래그 키를 막지 않는다", () => {
    expect(complexityRevealText("O(N × Q)", "O(N + Q)")).toBe("예측: O(N × Q) / 목표: O(N + Q)");
    expect(complexityGuessFlag("P0707")).toBe("complexity.guess:P0707");
    const s = newSave();
    s.flags[complexityGuessFlag("P0707")] = false;
    s.flags[complexityGuessFlag("P0714")] = true;
    expect(validateSave(JSON.parse(JSON.stringify(s))).ok).toBe(true);
  });
});
