// DOM UI 계약(design.md §5, §9.7). 구현은 src/ui/.
// 모든 UI는 캔버스 위에 겹치는 DOM이다. 열려 있는 동안 앱이 월드 입력을 끈다.
import type { CompanionProfile, DialogueLine, Lesson, Problem, RecommendedProblem, TracebackRule } from "./content";
import type { JudgeResult, PyError, PythonRunner } from "./runner";
import type { BattleOutcome, HintLevel, RewardSummary } from "./state";

export interface NameContext {
  player: string;
  companion: string;
}

export interface DialogueUI {
  /** 한 줄씩 보여 주고 마지막 줄을 넘기면 resolve */
  play(lines: DialogueLine[], names: NameContext): Promise<void>;
}

export interface LessonUI {
  /** 레슨 본문 → 예제 실행 → 미니 연습. 끝까지 마치면 completed=true */
  open(lesson: Lesson, runner: PythonRunner, names: NameContext): Promise<{ completed: boolean }>;
}

export interface CodexUI {
  /** 획득한 주문서의 레슨을 다시 열람·실행 */
  open(lessons: Lesson[], runner: PythonRunner, names: NameContext): Promise<void>;
}

export interface BattleContext {
  problem: Problem;
  runner: PythonRunner;
  companion: CompanionProfile;
  names: NameContext;
  player: { hp: number; maxHp: number };
  /** 저장된 작성 중 코드. 없으면 problem.starter */
  draft?: string;
  /** 이 적에게 쓰러진 횟수. 3 이상이면 해설서를 열 수 있음(§5.3) */
  knockouts: number;
  /** 이미 연 힌트 단계(재도전 시 이어짐) */
  hintLevel: HintLevel;
  /** 지역 번호. 피드백 공개 수준(§7.1)에 쓴다 */
  regionOrder: number;
  traceback: TracebackRule[];
  /** 에러 해설(§5.3). 앱이 src/python/explain.ts를 넘겨준다 */
  explain: ExplainError;
  /** 오답 진단(§5.3). 해당 규칙이 없으면 undefined. 앱이 src/python/diagnose.ts를 넘겨준다 */
  diagnose: DiagnoseResult;
  /** 작성 중 코드가 바뀔 때(디바운스해서) 호출 */
  onDraft(code: string): void;
  /**
   * 전투 도중 대가가 걸린 상태가 바뀔 때(힌트를 새 단계로 열었을 때, 해설서를 열었을 때, 반격을 받은 뒤).
   * 앱은 이것으로 '지금 후퇴했다면'의 결과를 임시 저장해서, 새로고침으로 힌트 대가·해설서·쓰러짐을 피하지 못하게 한다
   */
  onProgress?(state: BattleProgress): void;
  /**
   * 마지막 시전이 AC가 된 순간(승리 배너를 누르기 전). 앱은 여기서 승리를 바로 저장해서
   * 배너를 누르기 전에 새로고침해도 승리가 남게 한다. open()이 돌려주는 결과도 같은 승리다(보상은 한 번만)
   */
  onVictory?(outcome: BattleOutcome): void;
  /** 공통 대사(content/common/dialogue.json)에서 넘겨받는 누리 대사. 없으면 전투 UI의 기본 문구 */
  companionLines?: {
    /** 실행기가 죽었다 살아났을 때(fatal_recursion) */
    fatalRecursion?: DialogueLine[];
    /** 오래 붙잡고 있을 때 연습 전투 제안(practice_suggest) */
    practiceSuggest?: DialogueLine[];
  };
}

export interface BattleProgress {
  /** 이번 전투에서 [시전] 횟수 */
  attempts: number;
  maxHintLevel: HintLevel;
  solutionViewed: boolean;
  hp: number;
}

export interface BattleUI {
  open(ctx: BattleContext): Promise<BattleOutcome>;
}

export interface HudState {
  regionName: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  gold: number;
  /** 이번 주 학습일 수(목표 5/7, §7.5) */
  weekDays: number;
  scrolls: number;
}

export interface HudUI {
  update(state: HudState): void;
  toast(message: string): void;
}

export interface MenuActions {
  openCodex(): Promise<void>;
  exportSave(): Promise<void>;
  importSave(file: File): Promise<void>;
  resetSave(): Promise<void>;
}

export interface MenuUI {
  open(actions: MenuActions): Promise<void>;
}

export interface RewardUI {
  show(summary: RewardSummary, problem: Problem): Promise<void>;
  /** 지역 클리어 시 실전 추천 문제(§7.7) */
  showRecommended(regionName: string, items: RecommendedProblem[], bojBaseUrl: string | null): Promise<void>;
}

export interface UiServices {
  dialogue: DialogueUI;
  lesson: LessonUI;
  codex: CodexUI;
  battle: BattleUI;
  hud: HudUI;
  menu: MenuUI;
  reward: RewardUI;
}

/** 에러 해설(§5.3 Traceback 해설). 구현은 src/python/explain.ts */
export type ExplainError = (error: PyError, rules: TracebackRule[]) => string;

/** 오답 진단(§5.3). problem.diagnoses 규칙을 채점 결과에 맞춰 본다. 구현은 src/python/diagnose.ts */
export type DiagnoseResult = (problem: Problem, result: JudgeResult) => string | undefined;
