// 시스템 테스트 공용 도우미(테스트 파일 아님)
import type { Problem } from "../../src/contracts/content";
import type { BattleOutcome, SaveData } from "../../src/contracts/state";
import { createNewSave } from "../../src/state/newGame";

/** 기기 현지 시각으로 YYYY-MM-DD hh:mm */
export function at(date: string, hour = 12, minute = 0): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour, minute);
}

export function problem(over: Partial<Problem> = {}): Problem {
  return {
    id: "P0101",
    regionId: "r01",
    title: "금화 두 자루",
    kind: "stdin",
    enemy: { name: "슬라임", sprite: "slime", attack: 30 },
    requires: [],
    boss: false,
    concept: "S1-io",
    timeLimitMs: 2000,
    estimatedMinutes: 5,
    tests: [],
    statement: "",
    starter: "",
    solution: "",
    explanation: "",
    hints: ["a", "b", "c"],
    diagnoses: [],
    reward: { xp: 100, gold: 50 },
    ...over,
  };
}

export function outcome(over: Partial<BattleOutcome> = {}): BattleOutcome {
  return {
    problemId: "P0101",
    result: "victory",
    attempts: 1,
    maxHintLevel: 0,
    solutionViewed: false,
    finalCode: "print(1)",
    hpLeft: 100,
    elapsedMs: 1000,
    ...over,
  };
}

export function newSave(date = "2026-10-01"): SaveData {
  return createNewSave(at(date, 9), { spawn: { x: 5, y: 7 } });
}
