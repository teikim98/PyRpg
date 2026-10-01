// 콘텐츠 데이터의 런타임 타입(design.md §11).
// content/ 아래 파일을 src/content/의 로더가 읽어서 이 타입으로 바꾼다.

export type Verdict = "AC" | "WA" | "RE" | "TLE";
export type Emotion = "neutral" | "happy" | "worried" | "surprised" | "serious";
export type ProblemKind = "stdin" | "function";

export interface StdinTest {
  in: string;
  out: string;
  public?: boolean;
  /** 보스 페이즈 번호. 생략하면 1 */
  phase?: number;
  note?: string;
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

export interface GameContent {
  regions: Region[];
  companion: CompanionProfile;
  traceback: TracebackRule[];
  /** 공통 대사(캠프파이어, 쓰러짐, 주문서 없음 등) */
  commonDialogues: DialogueMap;
}
