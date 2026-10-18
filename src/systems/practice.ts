// 연습 상대와 연습 전투(design.md §6.2 '연습 상대', §7.1 시간 기반 우회·"'연습 몬스터'와 '연습 전투'는 다릅니다", §7.5, 단위 3-E3).
// 순수 함수: 무엇을 제안할지(findPracticeOffer), 연습 전투에 낼 문제(practiceProblem), 연습 전투 결과 반영(applyPracticeOutcome).
// '지금 위치에서 걸어서 닿는가'는 맵이 필요하므로 앱이 src/app/reach.ts로 계산해 canReach로 넘긴다.
import type { Problem } from "../contracts/content";
import type { BattleOutcome, SaveData } from "../contracts/state";
import type { PracticeOffer } from "../contracts/ui";
import { lastStreakRepair } from "./battle";
import { nextShadowVariantIndex, variantProblem } from "./shadowBoard";
import { markActivity } from "./streak";

export interface PracticeOfferInput {
  /** 막힌 문제 */
  problem: Problem;
  /** 모든 지역의 문제(콘텐츠 전체) */
  problems: readonly Problem[];
  save: Pick<SaveData, "problems" | "history">;
  /** 그날 그림자 게시판에 오른 문제 ID. ①③의 변형은 이 문제들을 피한다 */
  avoid?: ReadonlySet<string>;
  /**
   * ②: 그 문제의 몬스터가 지금 지역 맵에 남아 있고, 숨겨진 칸을 지나지 않고 지금 위치에서 걸어서 닿는가.
   * 없으면 ②를 건너뛴다(그 몬스터가 있다고 말하지 않는다)
   */
  canReach?: (problemId: string) => boolean;
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * 연습 전투에 낼 문제: 이미 푼 문제의 변형. 그림자전에 다음으로 나올 변형은 피한다(변형이 2개 이상이면).
 * 변형이 없으면 null(원래 문제를 그대로 내면 '변형'이 아니므로 그 문제는 연습 상대가 되지 않는다)
 */
export function practiceProblem(source: Problem, history: SaveData["history"]): Problem | null {
  const variants = source.variants ?? [];
  if (variants.length === 0) return null;
  const next = nextShadowVariantIndex(source, history);
  const idx = variants.length > 1 ? (next - 1 + variants.length) % variants.length : 0;
  return variantProblem(source, variants[idx]);
}

/** 이미 푼 문제를 최근에 푼 순서로(같으면 ID 순). solvedAt이 없는 옛 기록은 맨 뒤 */
function byRecent(save: PracticeOfferInput["save"]) {
  return (a: Problem, b: Problem) => {
    const ta = save.problems[a.id]?.solvedAt ?? "";
    const tb = save.problems[b.id]?.solvedAt ?? "";
    if (ta !== tb) return ta < tb ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

/**
 * 연습 상대 탐색(design.md §6.2, 처음 찾은 것):
 * ① 같은 concept(없으면 같은 requires)의 이미 푼 다른 문제 변형으로 연습 전투(보스가 아닌 것 먼저, 최근에 푼 것 먼저)
 * ② 같은 지역에서 같은 주문서(requires 집합이 같음)의 미해결 연습 몬스터 가운데 지금 걸어서 닿는 것(ID 순)
 * ③ 가장 최근에 푼 문제의 변형으로 몸풀기(①이 없으므로 개념이 다르다)
 * ④ 없음(코덱스의 레슨 예제와 힌트 1)
 * 응용 전투(problem.applied)는 ③만, 없으면 ④(주문서·개념을 드러내지 않게).
 * 그림자전·연습 전투·연습 몬스터 전투에서는 부르지 않는다(부르는 쪽이 거른다).
 */
export function findPracticeOffer(input: PracticeOfferInput): PracticeOffer {
  const { problem: p, problems, save } = input;
  const avoid = input.avoid ?? new Set<string>();
  const applied = p.applied === true;
  const solved = problems.filter((q) => q.id !== p.id && save.problems[q.id]?.solved === true && !avoid.has(q.id) && (q.variants?.length ?? 0) > 0);
  const offerFrom = (kind: "variant" | "warmup", list: Problem[]): PracticeOffer | null => {
    for (const q of list) {
      const prob = practiceProblem(q, save.history);
      if (!prob) continue;
      return kind === "variant"
        ? { kind, sourceId: q.id, name: q.enemy.name, problem: prob }
        : { kind, sourceId: q.id, name: q.enemy.name, problem: prob, ...(applied ? { applied: true } : {}) };
    }
    return null;
  };

  if (!applied) {
    // ①
    const recent = byRecent(save);
    const order = (a: Problem, b: Problem) => Number(a.boss) - Number(b.boss) || recent(a, b);
    let same = solved.filter((q) => q.concept === p.concept);
    if (same.length === 0) same = solved.filter((q) => sameSet(q.requires, p.requires));
    const v = offerFrom("variant", [...same].sort(order));
    if (v) return v;
    // ②
    if (input.canReach) {
      const monsters = problems
        .filter((q) => q.practice === true && q.id !== p.id && q.regionId === p.regionId && !q.boss)
        .filter((q) => sameSet(q.requires, p.requires) && save.problems[q.id]?.solved !== true)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      const m = monsters.find((q) => input.canReach!(q.id));
      if (m) return { kind: "monster", problemId: m.id, name: m.enemy.name };
    }
  }
  // ③
  const w = offerFrom("warmup", [...solved].sort(byRecent(save)));
  if (w) return w;
  // ④
  return applied ? { kind: "none", applied: true } : { kind: "none" };
}

export interface PracticeApplyResult {
  save: SaveData;
  /** 이번 승리로 오늘이 처음 학습일로 인정됐는가 */
  streakCounted: boolean;
  /** 돌아오면서 보호(불씨·얼음 룬)로 메운 날짜 */
  protectedNow: string[];
}

/**
 * 연습 전투 결과 반영: 보상·문제 기록·그림자·history·HP·퀘스트·칭호는 그대로이고(결정 23 P-E8),
 * 이기면 그날을 스트릭 학습일로 인정한다(오늘 처치 수·불씨·복구에는 넣지 않음, design.md §7.5).
 * 입력을 바꾸지 않는다. 승리가 아니면 save를 그대로 돌려준다
 */
export function applyPracticeOutcome(save: SaveData, outcome: Pick<BattleOutcome, "result">, now: Date): PracticeApplyResult {
  if (outcome.result !== "victory") return { save, streakCounted: false, protectedNow: [] };
  const m = markActivity(save.streak, now, { countOnly: true, lastRepair: lastStreakRepair(save.flags) });
  return { save: { ...save, streak: m.state }, streakCounted: m.counted, protectedNow: m.protectedNow };
}
