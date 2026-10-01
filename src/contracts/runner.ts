// Python 실행기 계약(design.md §9.4~§9.6). 구현은 src/python/.
import type { Problem, Verdict } from "./content";

export interface PyError {
  /** 예외 이름. 예: "TypeError", "KeyboardInterrupt" */
  type: string;
  message: string;
  /** 사용자 코드 기준 줄 번호(1부터). 채점기 내부 줄은 제외 */
  line?: number;
  /** 사용자 코드 줄만 남긴 Traceback */
  traceback: string;
}

export interface RunRequest {
  code: string;
  stdin?: string;
  /** 기본 5000 */
  timeoutMs?: number;
}

export interface RunOutput {
  stdout: string;
  stderr: string;
  error?: PyError;
  timedOut: boolean;
  /** Pyodide 런타임이 죽어서 워커를 다시 만들었음(§9.5) */
  fatal: boolean;
  timeMs: number;
}

export interface TestResult {
  /** problem.tests의 인덱스(0부터) */
  index: number;
  public: boolean;
  phase: number;
  verdict: Verdict;
  timeMs: number;
  /** 사람이 읽을 입력 표현. stdin형은 입력 문자열, 함수형은 args 문자열 */
  input: string;
  expected: string;
  /** stdin형은 stdout, 함수형은 반환값 repr */
  actual: string;
  /** 함수형만: 사용자 코드의 print 출력(채점에는 쓰지 않음). 비어 있으면 생략 */
  stdout?: string;
  error?: PyError;
}

export interface JudgeOptions {
  /** "public"은 [예제 실행], "all"은 [시전(제출)] */
  scope: "public" | "all";
  /** 지정하면 해당 페이즈의 테스트만 채점 */
  phase?: number;
  /** 테스트 하나가 끝날 때마다 호출(타격 연출용) */
  onProgress?: (result: TestResult) => void;
}

export interface JudgeResult {
  /** 전부 AC면 AC, 아니면 처음 실패한 테스트의 판정 */
  verdict: Verdict;
  passed: number;
  total: number;
  tests: TestResult[];
  fatal: boolean;
  /** 이번 채점에 적용한 시간 제한(ms) */
  limitMs: number;
}

export interface PythonRunner {
  /** 워커 부팅과 기준 루프 측정. 여러 번 불러도 한 번만 부팅 */
  init(): Promise<void>;
  isReady(): boolean;
  /** 자유 실행(레슨 예제, 미니 연습, 직접 입력 실행) */
  run(req: RunRequest): Promise<RunOutput>;
  judge(problem: Problem, code: string, opts: JudgeOptions): Promise<JudgeResult>;
  /** 기준 루프 중앙값(ms). init 전에는 0 */
  referenceMs(): number;
  dispose(): void;
}
