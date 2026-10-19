// 보스 복잡도 예측 질문(design.md §5.3, docs/phase3/region07-spec.md §9.2, 결정 23 P-D2·결정 30).
// 1페이즈를 통과하고 2페이즈 시작 대사가 나온 직후 "입력 크기로 보아 목표 복잡도는?"을 묻는다.
// 판정·보상·HP에는 영향이 없고, 고른 직후에는 맞았는지 말하지 않는다. 정답은 2페이즈를 통과한 뒤 보상 창,
// 또는 모래시계 부적이 목표 복잡도를 공개하는 순간 가운데 먼저 오는 쪽에서 "예측: … / 목표: …"로 함께 보여 준다.
import type { Problem } from "../contracts/content";

/**
 * 고른 답의 저장 키. 값은 고른 답이 목표 복잡도와 같았는가(true/false). 저장 데이터의 flags는 true/false만 담으므로
 * 고른 문자열 대신 맞았는지를 남긴다(고른 답 자체는 그 전투 안에서 공개할 때까지만 쓴다). 건너뛰면 남기지 않는다
 */
export const complexityGuessFlag = (problemId: string): string => `complexity.guess:${problemId}`;

/** 선택지 형식: 서로 다른 비어 있지 않은 문자열 3개이고 targetComplexity가 그 가운데 하나 */
export function validComplexityChoices(problem: Pick<Problem, "complexityChoices" | "targetComplexity">): boolean {
  const c = problem.complexityChoices;
  if (!Array.isArray(c) || c.length !== 3) return false;
  if (!c.every((x) => typeof x === "string" && x.trim() !== "")) return false;
  if (new Set(c).size !== 3) return false;
  return typeof problem.targetComplexity === "string" && c.includes(problem.targetComplexity);
}

export interface ComplexityAskContext {
  /** 그림자전(변형 문제). 묻지 않는다 */
  shadow?: boolean;
  /** 연습 전투. 묻지 않는다 */
  practice?: boolean;
  /** 퍼즐 모드. 묻지 않는다 */
  puzzle?: boolean;
  /** 모래시계 부적이 이 문제의 목표 복잡도를 이미 공개했으면(답을 이미 봤으므로) 묻지 않는다 */
  targetRevealed?: boolean;
}

/** 이 전투에서 2페이즈 시작 뒤에 물을지. 보스이고 페이즈가 둘 이상이며 선택지가 올바를 때만 */
export function shouldAskComplexity(problem: Problem, ctx: ComplexityAskContext = {}): boolean {
  if (!problem.boss || ctx.shadow || ctx.practice || ctx.puzzle || ctx.targetRevealed) return false;
  const phases = problem.phases?.length ?? new Set(problem.tests.map((t) => t.phase ?? 1)).size;
  if (phases < 2) return false;
  return validComplexityChoices(problem);
}

/** 공개 문구 */
export function complexityRevealText(guess: string, target: string): string {
  return `예측: ${guess} / 목표: ${target}`;
}

export interface ComplexityReveal {
  guess: string;
  target: string;
  correct: boolean;
}

/**
 * 한 전투의 예측 상태. answer()로 고르고(null = 건너뛰기), reveal()은 고른 답이 있을 때 처음 한 번만 값을 돌려준다
 * (모래시계 부적 공개와 보상 창 가운데 먼저 부른 쪽만 보여 주게)
 */
export interface ComplexityTracker {
  readonly target: string;
  /** undefined: 아직 묻지 않았거나 답하지 않음, null: 건너뜀, 문자열: 고른 답 */
  readonly choice: string | null | undefined;
  readonly revealed: boolean;
  /** 고른 답을 기록한다. 저장할 플래그 값(맞았는가)을 돌려주고, 건너뛰었으면 null */
  answer(choice: string | null): boolean | null;
  reveal(): ComplexityReveal | null;
}

export function createComplexityTracker(target: string): ComplexityTracker {
  let choice: string | null | undefined;
  let revealed = false;
  return {
    target,
    get choice() {
      return choice;
    },
    get revealed() {
      return revealed;
    },
    answer(c) {
      choice = c;
      return c === null ? null : c === target;
    },
    reveal() {
      if (revealed || typeof choice !== "string") return null;
      revealed = true;
      return { guess: choice, target, correct: choice === target };
    },
  };
}
