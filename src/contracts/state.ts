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
  /**
   * 처치 전까지 이 문제의 전투 창에서 쓴 시간의 합(ms, 탭이 보이는 동안만, 한 전투 상한 2시간, design.md §7.1 기준 시간).
   * 그림자전은 더하지 않는다. 단위 3-E1에서 더한 선택 항목(없으면 0)
   */
  elapsedTotalMs?: number;
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
  /** 이 전투에서 쓴 시간(ms, 탭이 보이는 동안만, 상한 2시간). 0이면 생략. 단위 3-E1에서 더한 선택 항목 */
  elapsedMs?: number;
  /**
   * 그림자 기록에만: 그날 하루 계획에서 이 그림자에 잡은 예상 분(design.md §7.6 하루 계획 5·6, 결정 23 P-E12).
   * 오늘 치른 분량을 셀 때 쓴다(보스 2페이즈를 붙였는지는 기록만으로 알 수 없으므로 저장). 단위 3-E2에서 더한 선택 항목
   */
  budgetMinutes?: number;
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
  // ── 아래는 단위 3-1에서 더한 선택 항목(없으면 기본값). 버전은 1 그대로 ──
  /** 오늘의 일일 퀘스트(§7.5) */
  quests?: DailyQuestState;
  /** 칭호 가운데 HUD·프로필에 보일 것(§7.4) */
  activeTitle?: string;
  /** 꾸미기 아이템 적용 상태(대상별 아이템 ID) */
  cosmetics?: { player?: string; companion?: string };
}

export interface DailyQuestState {
  /** YYYY-MM-DD(새벽 4시 경계) */
  date: string;
  /** content/quests.json pool의 ID, perDay개 */
  ids: string[];
  /** ids와 같은 순서의 진행 수 */
  progress: number[];
  /** 보상을 받은 퀘스트(ids와 같은 순서) */
  claimed: boolean[];
  /** 모두 완료 상자를 받았는가 */
  chest: boolean;
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
  /** 이번 전투에서 쓴 시간(ms). 탭이 보이는 동안만 센다(단위 3-E1). 적용할 때 반올림하고 2시간에서 자른다 */
  elapsedMs: number;
  /** 보스 시간 결계 페이즈를 첫 시전에 통과했는가(칭호 '시간을 돌린 자', §7.4). 보스가 아니면 생략 */
  timeBarrierFirstTry?: boolean;
  /**
   * 전투 창의 [연습 전투] 버튼으로 끝났다(결정 23 P-E5). result는 "retreat"이고, 앱은 후퇴를 적용한 뒤
   * BattleContext.practiceOffer의 연습 전투를 바로 연다. 아니면 생략
   */
  startPractice?: boolean;
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
  /**
   * 보스 복잡도 예측 질문의 공개(design.md §5.3, region07-spec.md §9.2). 고른 답이 있고 전투 중 모래시계 부적이 아직
   * 공개하지 않았으면 보상 창에 "예측: … / 목표: …"를 보인다. 앱이 채운다
   */
  complexityReveal?: { guess: string; target: string };
}
