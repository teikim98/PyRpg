// 고장 난 다리 퍼즐(design.md §5.4, docs/phase3/region07-spec.md §9.1).
// 맵의 door에 props.puzzle(퍼즐 ID)이 있으면 상호작용 때 전투 화면을 '퍼즐 모드'로 연다. 통과하면
// flags["puzzle.solved:<ID>"]를 저장하고 door를 removedObjects에 넣는다. 전투 수·보상·그림자·일일 퀘스트·칭호·스트릭과 관계없다.
import type { Problem, Puzzle } from "../contracts/content";
import type { SaveData } from "../contracts/state";

export const puzzleSolvedFlag = (puzzleId: string): string => `puzzle.solved:${puzzleId}`;

/** door 오브젝트의 퍼즐 ID(없으면 undefined) */
export function doorPuzzleId(props: Record<string, unknown>): string | undefined {
  const v = props.puzzle;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export function isPuzzleSolved(save: SaveData, puzzleId: string): boolean {
  return save.flags[puzzleSolvedFlag(puzzleId)] === true;
}

/**
 * 전투 화면·실행기가 그대로 쓸 수 있게 퍼즐을 문제 모양으로 바꾼다. 적 대신 다리 그림(sprite),
 * 반격·보상·진단·해설서는 없다(공격력 0, 보상 0, 진단 없음, 해설 빈 문자열)
 */
export function puzzleAsProblem(puzzle: Puzzle, sprite: string): Problem {
  const p: Problem = {
    id: puzzle.id,
    regionId: puzzle.regionId,
    title: puzzle.title,
    kind: puzzle.kind,
    enemy: { name: puzzle.title, sprite, attack: 0 },
    requires: [],
    boss: false,
    concept: puzzle.source.problem,
    timeLimitMs: puzzle.timeLimitMs,
    estimatedMinutes: 5,
    tests: puzzle.tests,
    statement: puzzle.statement,
    starter: puzzle.starter,
    solution: puzzle.solution,
    explanation: "",
    hints: puzzle.hints,
    diagnoses: [],
    reward: { xp: 0, gold: 0 },
  };
  if (puzzle.kind === "function") p.entry = puzzle.entry ?? "solution";
  return p;
}

/** 퍼즐을 푼 결과를 저장 데이터에 적용한다(새 객체). 플래그와 door 제거만 바꾼다 */
export function applyPuzzleSolved(save: SaveData, puzzleId: string, doorId: string): SaveData {
  const removed = save.removedObjects.includes(doorId) ? save.removedObjects : [...save.removedObjects, doorId];
  return { ...save, flags: { ...save.flags, [puzzleSolvedFlag(puzzleId)]: true }, removedObjects: removed };
}
