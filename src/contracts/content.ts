// 콘텐츠 데이터의 런타임 타입(design.md §11).
// content/ 아래 파일을 src/content/의 로더가 읽어서 이 타입으로 바꾼다.

export type Verdict = "AC" | "WA" | "RE" | "TLE";
export type Emotion = "neutral" | "happy" | "worried" | "surprised" | "serious";
export type ProblemKind = "stdin" | "function";

export interface StdinTest {
  /** gen이 있으면 빈 문자열(실행기가 채점 직전에 생성기로 만든다) */
  in: string;
  /** gen이 있으면 빈 문자열 */
  out: string;
  public?: boolean;
  /** 보스 페이즈 번호. 생략하면 1 */
  phase?: number;
  note?: string;
  /** 큰 입력 생성기(design.md §11.1). 숨김 테스트에만 쓴다 */
  gen?: TestGenerator;
}

/**
 * 큰 입력 생성기(design.md §11.1). problem.json에는 `"gen": "gen_big.py", "genArg": "desc"`로 적고,
 * 로더가 파일 내용을 code에 담는다. 생성기 파일은 `generate(arg)`를 정의하고 (입력, 기대 출력) 문자열 튜플을
 * 돌려준다. 시드를 고정해서 언제나 같은 값을 만든다(CPython 검증기와 Pyodide 실행기가 같은 값을 쓴다)
 */
export interface TestGenerator {
  /** 문제 폴더 안의 파일 이름. 예: "gen_big.py" */
  file: string;
  /** 파일 내용(Python) */
  code: string;
  /** generate(arg)에 넘길 문자열. problem.json의 genArg(생략하면 "") */
  arg: string;
}

export interface FunctionTest {
  /** Python 튜플 리터럴 문자열. 예: "(10, 3)". JSON 숫자로 쓰지 않는다(§11.1 큰 정수 규칙) */
  args: string;
  /** Python 리터럴 문자열. 예: "4" */
  expect: string;
  public?: boolean;
  phase?: number;
  note?: string;
}

export type ProblemTest = StdinTest | FunctionTest;

export interface DiagnosisRule {
  when: {
    /** 첫 실패 테스트의 실제 출력(또는 반환값 repr)에 대한 정규식 */
    outputMatches?: string;
    /** 예외 이름. 예: "TypeError" */
    exception?: string;
    /** 예외 메시지에 대한 정규식 */
    messageMatches?: string;
    verdict?: Verdict;
    /** 공개 테스트는 통과하고 숨김 테스트에서만 틀릴 때 */
    onlyHiddenFail?: boolean;
  };
  text: string;
}

export interface EnemyDef {
  name: string;
  /** assets/manifest.json의 스프라이트 논리 이름 */
  sprite: string;
  /** WA·RE·TLE 시 피해 = attack × (1 − 통과율) (§5.3) */
  attack: number;
}

export interface BossPhase {
  phase: number;
  name: string;
  /** 페이즈 시작 시 누리의 대사(선택) */
  intro?: string;
}

/** 함수 구현형 반환값 비교 옵션. 생략하면 Python == 그대로(True == 1도 같음) */
export interface ProblemCompare {
  /** 튜플과 리스트를 구별하지 않는다(중첩 포함). 예: [1, 1, 1] 대신 (1, 1, 1)을 반환해도 정답 */
  sequenceAsList?: boolean;
}

/**
 * 그림자 몬스터용 변형 문제(docs/phase3/plan.md §5.1). 이야기와 입력값만 바꾸고 형식·시그니처는 원래 문제와 같다.
 * 그래서 원래 문제의 모범답안이 변형의 모든 테스트를 통과한다
 */
export interface ProblemVariant {
  /** 예: "P0101-v1" */
  id: string;
  title: string;
  /** Markdown 본문(problem.json의 statement 경로에서 읽은 내용) */
  statement: string;
  /** 보스 변형은 1페이즈 테스트만 */
  tests: ProblemTest[];
}

export interface Problem {
  id: string;
  regionId: string;
  title: string;
  kind: ProblemKind;
  /** 함수 구현형의 함수 이름. 기본 "solution" */
  entry?: string;
  enemy: EnemyDef;
  /** 이 전투를 시작하려면 가지고 있어야 할 주문서 ID */
  requires: string[];
  boss: boolean;
  /** 보스만. 페이즈 순서대로 */
  phases?: BossPhase[];
  /** 같은 개념 연습 전투(시간 기반 우회, §7.1) */
  practice?: boolean;
  /** 그림자 몬스터 개념 단위(§7.6). 보통 주문서 ID */
  concept: string;
  /** 일반 테스트의 시간 상한(ms). 로컬 검증 기준 */
  timeLimitMs: number;
  /** 함수 구현형 비교 옵션(judge.py, tools/verify_content.py가 같은 규칙으로 비교) */
  compare?: ProblemCompare;
  /** 시간 결계 페이즈의 기기별 예산(§9.6). 없으면 timeLimitMs 사용 */
  budgetUnits?: number;
  estimatedMinutes: number;
  tests: ProblemTest[];
  /** Markdown 본문 */
  statement: string;
  /** 함수 구현형의 처음 코드. stdin형은 빈 문자열 또는 짧은 주석 */
  starter: string;
  /** 모범답안(해설서용) */
  solution: string;
  /** 해설서의 풀이 설명(Markdown) */
  explanation: string;
  hints: [string, string, string];
  diagnoses: DiagnosisRule[];
  reward: { xp: number; gold: number };
  /** 그림자 전투에서 돌려 쓰는 변형(§7.6). 없으면 원래 문제를 그대로 낸다 */
  variants?: ProblemVariant[];
  /** 보스 시간 결계의 목표 복잡도(예: "O(√N)"). 모래시계 부적(§7.3)이 시간 게이지에 보여 준다 */
  targetComplexity?: string;
}

export interface Scroll {
  id: string;
  name: string;
  summary: string;
}

export interface BlankExercise {
  kind: "blank";
  prompt: string;
  /** 빈칸을 ___ 로 표시한 코드. 빈칸은 하나 */
  code: string;
  /** 빈칸에 넣어 실행할 stdin(선택) */
  stdin?: string;
  /** 빈칸을 채워 실행했을 때 기대하는 stdout(끝 공백·개행 무시) */
  expectedOutput: string;
  /** 정답 예시(누리가 알려 주는 용도) */
  answer: string;
}

export interface Lesson {
  id: string;
  regionId: string;
  title: string;
  scroll: Scroll;
  /** Markdown. ```python run 블록에는 [실행] 버튼, ```js compare 블록은 JS 비교 박스 */
  body: string;
  exercise?: BlankExercise;
}

export interface DialogueLine {
  /** "companion" | "player" | "system" | NPC 이름 */
  speaker: string;
  emotion?: Emotion;
  /** {player}, {companion}은 이름으로 치환 */
  text: string;
}

export type DialogueMap = Record<string, DialogueLine[]>;

export interface RecommendedProblem {
  site: "programmers" | "boj";
  id: number;
  title: string;
  level: string;
}

/** Tiled JSON(.tmj)을 그대로 담는다. 해석은 src/game이 한다 */
export type TiledMap = Record<string, unknown>;

export interface Region {
  id: string;
  order: number;
  name: string;
  map: TiledMap;
  /** 지역에 처음 들어왔을 때 재생할 대사 ID */
  introDialogue?: string;
  /** 보스를 쓰러뜨린 뒤 재생할 대사 ID */
  clearDialogue?: string;
  problems: Problem[];
  lessons: Lesson[];
  dialogues: DialogueMap;
  recommended: RecommendedProblem[];
}

export interface CompanionProfile {
  name: string;
  /** assets/manifest.json의 초상화 논리 이름 접두어. 예: "portrait_nuri" → portrait_nuri_happy */
  portrait: string;
}

export interface TracebackRule {
  exception: string;
  /** 메시지 정규식. 없으면 예외 종류별 기본 해설 */
  pattern?: string;
  text: string;
}

// ───────────── 장비·칭호·일일 퀘스트(design.md §7.2~§7.5, content/items.json·titles.json·quests.json) ─────────────

export type ItemKind = "consumable" | "iceRune" | "accessory" | "cosmetic";

/** 장신구 효과. pending이면 아직 화면에 연결하지 않은 효과('준비 중') */
export type AccessoryEffect =
  | { type: "maxHp"; value: number }
  | { type: "guideFeather" }
  | { type: "targetComplexity" }
  | { type: "lineCounts" }
  | { type: "codexLinks" };

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  /** 상점 가격(골드). 없으면 상점에서 팔지 않는다 */
  price?: number;
  /** 상점에서 살 수 있는 레벨(§7.1: 열리지 않은 품목은 실루엣) */
  minLevel?: number;
  /** 상점에 없을 때 얻는 곳 안내. 예: "지역 2 보스" */
  source?: string;
  /** 이 문제를 처음 이기면 얻는다(예: 지역 2 보스 → 길잡이 깃털) */
  rewardFrom?: string;
  /** 소모품: 전투 중 HP 회복량 */
  heal?: number;
  /** 소모품 최대 보유 수 */
  maxStack?: number;
  /** 장신구 */
  effect?: AccessoryEffect;
  /** 효과를 아직 연결하지 않음('준비 중'으로 표시) */
  pending?: boolean;
  /** 꾸미기: 색을 바꿀 대상과 색 */
  target?: "player" | "companion";
  tint?: string;
}

export type TitleCondition =
  | { type: "firstWin" }
  | { type: "noHintRegion" }
  | { type: "timeBarrierFirstTry" }
  | { type: "shadowWins"; count: number }
  | { type: "persistence"; attempts: number }
  | { type: "goodWeeks"; weeks: number; days: number }
  | { type: "regionClear"; region: string };

export interface TitleDef {
  id: string;
  name: string;
  description: string;
  condition: TitleCondition;
}

/** 퀘스트 진행을 올리는 사건 */
export type QuestEventType = "win" | "anyWin" | "shadow" | "lesson" | "codexRun" | "rest";

export interface QuestDef {
  id: string;
  text: string;
  event: QuestEventType;
  count: number;
  /** win 사건 조건 */
  filter?: { noHint?: boolean; firstCast?: boolean };
  /** 오늘 뽑힐 수 있는 조건(할 수 없는 퀘스트는 뽑지 않는다) */
  needs?: "shadowDue" | "battleLeft" | "lessonLeft" | "lessonDone";
}

export interface QuestContent {
  /** 퀘스트 하나의 보상 */
  reward: { xp: number; gold: number };
  /** 하루 3개를 다 하면 받는 상자(내용물을 미리 보여 준다) */
  chest: { gold: number; items: Record<string, number> };
  /** 하루에 뽑는 수 */
  perDay: number;
  pool: QuestDef[];
}

export interface GameContent {
  regions: Region[];
  companion: CompanionProfile;
  traceback: TracebackRule[];
  /** 공통 대사(캠프파이어, 쓰러짐, 주문서 없음 등) */
  commonDialogues: DialogueMap;
  items: ItemDef[];
  titles: TitleDef[];
  quests: QuestContent;
}
