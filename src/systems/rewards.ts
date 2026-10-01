// 전투 보상(design.md §5.3, §7.1, §7.2, §7.8).
// 힌트 대가는 누적하지 않고 가장 높은 단계만 적용: 1단계 0%, 2단계 −25%, 3단계 −50%. 해설서 = 보상 0.
import type { Problem } from "../contracts/content";
import type { BattleOutcome, HintLevel, SaveData } from "../contracts/state";

/** 길잡이 깃털(§7.3): 2단계 힌트를 대가 없이(그림자 등록은 그대로). ID는 content/items.json과 맞춘다 */
export const GUIDE_FEATHER_ID = "guide-feather";
/** 그림자 몬스터 보상 비율(§7.1) */
export const SHADOW_REWARD_RATE = 0.5;

const HINT_PENALTY: Record<HintLevel, number> = { 0: 0, 1: 0, 2: 0.25, 3: 0.5 };

/** 줄어드는 비율(0~1). 1이면 보상 없음 */
export function hintPenalty(maxHintLevel: HintLevel, solutionViewed: boolean, opts: { guideFeather?: boolean } = {}): number {
  if (solutionViewed) return 1;
  if (maxHintLevel === 2 && opts.guideFeather) return 0;
  return HINT_PENALTY[maxHintLevel] ?? 0;
}

export interface BattleReward {
  xp: number;
  gold: number;
  penalty: number;
}

export interface RewardOptions {
  /** 그림자 몬스터 전투(보상 50%, 기존 기록의 힌트 단계는 보지 않음) */
  shadow?: boolean;
}

/**
 * 승리 보상. 승리가 아니면 0.
 * 일반 전투는 이전에 연 힌트 단계도 이어지므로(재도전) 기록과 이번 결과 중 큰 쪽을 쓴다.
 * 이미 처치한 문제를 다시 이긴 경우(그림자 아님)는 보상 0.
 */
export function computeBattleReward(problem: Problem, outcome: BattleOutcome, save: SaveData, opts: RewardOptions = {}): BattleReward {
  if (outcome.result !== "victory") return { xp: 0, gold: 0, penalty: 0 };
  const rec = save.problems[problem.id];
  let hint: HintLevel = outcome.maxHintLevel;
  let solution = outcome.solutionViewed;
  if (!opts.shadow) {
    if (rec?.solved) return { xp: 0, gold: 0, penalty: 0 };
    if (rec) {
      hint = Math.max(hint, rec.maxHintLevel) as HintLevel;
      solution = solution || rec.solutionViewed;
    }
  }
  const penalty = hintPenalty(hint, solution, { guideFeather: save.equipment.includes(GUIDE_FEATHER_ID) });
  const rate = (opts.shadow ? SHADOW_REWARD_RATE : 1) * (1 - penalty);
  return {
    xp: Math.floor(problem.reward.xp * rate),
    gold: Math.floor(problem.reward.gold * rate),
    penalty,
  };
}
