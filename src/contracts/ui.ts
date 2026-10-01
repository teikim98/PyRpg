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
