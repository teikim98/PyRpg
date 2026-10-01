// 메인 스레드(runner.ts) ↔ 워커(worker.ts) 메시지 형식. 값은 모두 문자열·숫자·불리언(큰 정수는 repr 문자열).
import type { Verdict } from "../contracts/content";
import type { PyError } from "../contracts/runner";

export type WorkerRequest =
  | { id: number; type: "init"; interruptBuffer?: SharedArrayBuffer }
  | { id: number; type: "run"; code: string; stdin: string }
  | { id: number; type: "stdinTest"; code: string; stdin: string; expected: string }
  | {
      id: number;
      type: "functionTest";
      code: string;
      entry: string;
      args: string;
      expect: string;
      /** Problem.compare를 JSON 문자열로. 없으면 "" */
      compare: string;
    }
  | { id: number; type: "reference"; runs: number }
  /** 큰 입력 생성기 실행(design.md §11.1). 시간을 재지 않는다 */
  | { id: number; type: "generate"; code: string; arg: string };

export interface RunReply {
  stdout: string;
  stderr: string;
  error: PyError | null;
  /** Python 안에서 잰 사용자 코드 실행 시간 */
  timeMs: number;
  /** KeyboardInterrupt(소프트 중단)로 끝남 */
  interrupted: boolean;
  /**
   * 응답 직전 interrupt buffer에 신호가 남아 있었는지. Python은 신호를 처리하면 buffer를 0으로 되돌리므로,
   * 메인 스레드가 신호를 썼는데 false면 사용자 코드가 KeyboardInterrupt를 except로 삼킨 것이다(시간 초과).
   */
  interruptPending: boolean;
}

export interface TestReply extends RunReply {
  verdict: Verdict;
  actual: string;
}

export type WorkerResponse =
  | { id: number; ok: true; type: "init"; bootMs: number; version: string }
  | { id: number; ok: true; type: "run"; result: RunReply }
  | { id: number; ok: true; type: "test"; result: TestReply }
  | { id: number; ok: true; type: "reference"; times: number[] }
  | { id: number; ok: true; type: "generate"; input: string; output: string }
  /** fatal이면 워커를 버려야 한다 */
  | { id: number; ok: false; fatal: boolean; message: string };

/** fatal(런타임 사망) 때 PyError.message에 넣는 표식. explain.ts가 전용 해설을 붙인다 */
export const FATAL_MESSAGE = "Pyodide 런타임이 멈췄어요(브라우저 C 스택 초과)";
/** 스택 초과가 아닌 런타임 사망(os._exit 등). PyError.type은 "FatalError" */
export const FATAL_OTHER_MESSAGE = "Pyodide 런타임이 멈췄어요";

/** Pyodide 런타임이 죽었음을 뜻하는 메시지(research.md §3.2.6) */
export function isFatalMessage(message: string): boolean {
  return /fatally failed|fatal error|Maximum call stack size exceeded|memory access out of bounds|unreachable/i.test(
    message,
  );
}
