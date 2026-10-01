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

export interface PurifiedShadowView {
  concept: string;
  /** 주문서 이름 */
  name: string;
  /** 귀환 그림자까지 통과했는가 */
  returnCleared: boolean;
}

export interface CodexUI {
  /** 획득한 주문서의 레슨을 다시 열람·실행. extra.purified는 '정화된 그림자' 목록(§7.6) */
  open(lessons: Lesson[], runner: PythonRunner, names: NameContext, extra?: { purified?: PurifiedShadowView[] }): Promise<void>;
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
  /** 그림자 몬스터 전투(§7.6): 보상 50%, 해설서 없음 */
  shadow?: boolean;
  /** 장신구 효과(§7.3) */
  perks?: {
    /** 길잡이 깃털: 힌트 2단계 대가 없음(그림자 등록은 그대로) */
    freeHint2?: boolean;
    /** 모래시계 부적: 시간 게이지에 보일 목표 복잡도 */
    targetComplexity?: string;
  };
  /** 가진 회복약(§7.2). 없거나 0이면 버튼을 숨긴다 */
  potions?: { count: number; heal: number; name: string };
  /** 회복약 하나를 쓴 순간(앱이 인벤토리에서 뺀다) */
  onUsePotion?(): void;
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
  /** 고른 칭호 이름(§7.4) */
  title?: string;
  /** 오늘의 일일 퀘스트 진행(§7.5) */
  quests?: { done: number; total: number };
}

export interface HudUI {
  update(state: HudState): void;
  toast(message: string): void;
}

export interface MenuActions {
  openCodex(): Promise<void>;
  /** 장비(§7.3) */
  openEquipment?(): Promise<void>;
  /** 프로필·칭호(§7.4) */
  openTitles?(): Promise<void>;
  /** 일일 퀘스트·스트릭(§7.5) */
  openQuests?(): Promise<void>;
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

// ───────────── 시스템 화면(design.md §7.2~§7.6, phase3/plan.md §2) ─────────────

export interface ShadowBoardEntry {
  concept: string;
  /** 주문서 이름 */
  name: string;
  box: number;
  due: string;
  overdueDays: number;
  /** 힌트 없이 이기면(한 칸 올라가면) 다음 출현까지 일수. 칸 5면 정화 */
  nextIntervalDays: number;
  /** 정화 90일 뒤 돌아온 귀환 그림자 */
  returning: boolean;
}

export interface QuestView {
  id: string;
  text: string;
  progress: number;
  count: number;
  done: boolean;
}

export interface QuestPanelView {
  date: string;
  quests: QuestView[];
  reward: { xp: number; gold: number };
  /** 모두 완료 상자의 내용물(미리 보여 준다) */
  chest: { gold: number; items: { name: string; count: number }[]; claimed: boolean };
}

export interface StreakView {
  weekDays: number;
  weekGoal: number;
  /** 연속 일수(작게 표시) */
  streak: number;
  embers: number;
  iceRunes: number;
  maxProtections: number;
  todayCount: number;
  emberThreshold: number;
  /** 복구 가능하면 */
  repair?: { missedDays: string[]; previousStreak: number; battlesLeft: number };
}

export interface BoardView {
  shadows: ShadowBoardEntry[];
  /** 등록됐지만 오늘은 아닌 그림자 수 */
  waiting: number;
  /** 오늘 이미 상대한 그림자 수 / 하루 상한 */
  foughtToday: number;
  dailyLimit: number;
  quests: QuestPanelView;
  streak: StreakView;
}

export interface BoardUI {
  /** 그림자 게시판. 처치할 그림자를 고르면 그 개념 ID, 그냥 닫으면 null */
  open(view: BoardView, names: NameContext): Promise<string | null>;
  /** 일일 퀘스트·스트릭만(메뉴의 퀘스트) */
  openQuests(view: Pick<BoardView, "quests" | "streak">): Promise<void>;
}

export type ShopEntryState = "available" | "owned" | "locked" | "full" | "poor";

export interface ShopEntry {
  id: string;
  name: string;
  kind: "consumable" | "iceRune" | "accessory" | "cosmetic";
  description: string;
  price: number;
  state: ShopEntryState;
  minLevel: number;
  /** 소모품·얼음 룬 보유 수 */
  have?: number;
  /** 효과를 아직 연결하지 않은 장신구 */
  pending?: boolean;
  /** 꾸미기 색("#rrggbb") */
  tint?: string;
}

export interface ShopView {
  gold: number;
  level: number;
  entries: ShopEntry[];
}

export interface ShopUI {
  /** buy는 결과 문구를 돌려준다. 실패하면 throw. 사고 나면 view()로 다시 그린다 */
  open(view: () => ShopView, buy: (id: string) => Promise<string>, names: NameContext): Promise<void>;
}

export interface EquipmentItemView {
  id: string;
  name: string;
  description: string;
  owned: boolean;
  equipped: boolean;
  pending: boolean;
  /** 아직 없을 때 얻는 곳 */
  source?: string;
  /** 꾸미기 색("#rrggbb") */
  tint?: string;
}

export interface EquipmentView {
  level: number;
  slots: number;
  /** 다음 슬롯이 열리는 레벨(다 열렸으면 없음) */
  nextSlotLevel?: number;
  accessories: EquipmentItemView[];
  cosmetics: (EquipmentItemView & { target: "player" | "companion" })[];
  consumables: { id: string; name: string; description: string; count: number }[];
  maxHp: number;
}

export interface EquipmentActions {
  /** 장착/해제 전환. 결과 문구, 실패하면 throw */
  toggleAccessory(id: string): Promise<string>;
  /** 꾸미기 적용/해제 전환 */
  toggleCosmetic(id: string): Promise<string>;
}

export interface EquipmentUI {
  open(view: () => EquipmentView, actions: EquipmentActions): Promise<void>;
}

export interface TitlesView {
  playerName: string;
  level: number;
  streak: number;
  weekDays: number;
  active?: string;
  titles: { id: string; name: string; description: string; earned: boolean }[];
}

export interface TitlesUI {
  /** select(null)은 칭호 숨기기 */
  open(view: () => TitlesView, select: (id: string | null) => Promise<void>): Promise<void>;
}

export interface UiServices {
  dialogue: DialogueUI;
  lesson: LessonUI;
  codex: CodexUI;
  battle: BattleUI;
  hud: HudUI;
  menu: MenuUI;
  reward: RewardUI;
  board: BoardUI;
  shop: ShopUI;
  equipment: EquipmentUI;
  titles: TitlesUI;
}

/** 에러 해설(§5.3 Traceback 해설). 구현은 src/python/explain.ts */
export type ExplainError = (error: PyError, rules: TracebackRule[]) => string;

/** 오답 진단(§5.3). problem.diagnoses 규칙을 채점 결과에 맞춰 본다. 구현은 src/python/diagnose.ts */
export type DiagnoseResult = (problem: Problem, result: JudgeResult) => string | undefined;
