// 저장 데이터와 진행 로직 계약(design.md §7). 구현은 src/state/, src/systems/.

export type Facing = "up" | "down" | "left" | "right";
export type HintLevel = 0 | 1 | 2 | 3;

export interface ProblemRecord {
  /** [시전(제출)] 횟수 */
  attempts: number;
  /** HP 0으로 쓰러진 횟수 */
  knockouts: number;
  solved: boolean;
  solvedAt?: string;
  /** 지금까지 연 가장 높은 힌트 단계 */
  maxHintLevel: HintLevel;
  solutionViewed: boolean;
  /** 마지막으로 작성하던 코드(전투를 떠나도 보존, §1 원칙 2) */
  draft?: string;
}

export interface ShadowEntry {
  /** 개념 ID(주문서 ID) */
  concept: string;
  /** 대표로 출제할 원래 문제 ID */
  problemId: string;
  /** 칸 0~5(§7.6) */
  box: number;
  /** YYYY-MM-DD(새벽 4시 경계 기준 날짜) */
  due: string;
  purified: boolean;
  createdAt: string;
}

export interface AttemptLog {
  /** 시도 시각 ISO */
  at: string;
  problemId: string;
  concept: string;
  /** FSRS 전환 대비(§7.6): again | hard | good | easy */
  grade: "again" | "hard" | "good" | "easy";
  shadow: boolean;
}

export interface StreakState {
  /** 학습을 인정받은 날짜(YYYY-MM-DD), 오름차순, 최근 60일만 */
  activeDays: string[];
  /** 모닥불 불씨(자동 보호) */
  embers: number;
  /** 얼음 룬(구매 보호) */
  iceRunes: number;
  /** 보호로 메운 날짜 */
  protectedDays: string[];
  /** 오늘 인정 조건 진행(전투·그림자 처치 수) — 날짜가 바뀌면 0 */
  todayDate: string;
  todayCount: number;
}

export interface SaveData {
  version: 1;
  createdAt: string;
  updatedAt: string;
  player: {
    name: string;
    xp: number;
    gold: number;
    hp: number;
  };
  location: { regionId: string; x: number; y: number; facing: Facing };
  lastCampfire: { regionId: string; x: number; y: number };
  scrolls: string[];
  lessonsCompleted: string[];
  problems: Record<string, ProblemRecord>;
  /** 처치한 몬스터, 연 상자, 열린 문 등 맵에서 사라진 오브젝트 ID */
  removedObjects: string[];
  /** 본 대사, 지역 클리어 등 */
  flags: Record<string, boolean>;
  inventory: Record<string, number>;
  equipment: string[];
  titles: string[];
  shadows: ShadowEntry[];
  streak: StreakState;
  history: AttemptLog[];
}

export interface BattleOutcome {
  problemId: string;
  result: "victory" | "retreat" | "knockout";
  /** 이번 전투에서 [시전] 횟수 */
  attempts: number;
  maxHintLevel: HintLevel;
  solutionViewed: boolean;
  finalCode: string;
  hpLeft: number;
  elapsedMs: number;
}

export interface RewardSummary {
  xp: number;
  gold: number;
  /** 힌트·해설서로 줄어든 비율(0~1) */
  penalty: number;
  levelBefore: number;
  levelAfter: number;
  /** 새로 등록되거나 칸이 바뀐 그림자 */
  shadowNote?: string;
  /** 이번 처치로 스트릭 인정 조건을 채웠는지 */
  streakCounted: boolean;
}
