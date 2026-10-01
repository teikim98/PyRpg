// Traceback 해설(design.md §5.3). 규칙은 content/companion/traceback.json에서 온다.
import type { TracebackRule } from "../contracts/content";
import type { PyError } from "../contracts/runner";
import type { ExplainError } from "../contracts/ui";
import { FATAL_MESSAGE, FATAL_OTHER_MESSAGE } from "./protocol";

/** 해설 사전에 규칙이 없을 때 쓰는 기본 해설 */
const BUILTIN: Record<string, string> = {
  SyntaxError: "문법이 맞지 않아요. 괄호·따옴표·콜론(:)이 빠지지 않았는지 살펴보세요.",
  IndentationError: "들여쓰기가 맞지 않아요. 같은 블록의 줄은 같은 칸만큼 들여 써야 해요.",
  NameError: "정의되지 않은 이름을 썼어요. 철자나 변수를 만든 순서를 확인해 보세요.",
  TypeError: "값의 종류(자료형)가 맞지 않는 연산을 했어요. 문자열과 숫자를 섞지 않았는지 보세요.",
  ValueError: "값의 종류는 맞지만 내용이 알맞지 않아요. 예를 들어 int()에 숫자가 아닌 글자를 넣었을 때 나요.",
  IndexError: "리스트나 문자열의 범위를 벗어난 위치를 읽으려고 했어요. 인덱스는 0부터 길이−1까지예요.",
  KeyError: "dict에 없는 키를 읽으려고 했어요. in으로 먼저 확인하거나 get()을 써 보세요.",
  ZeroDivisionError: "0으로 나누려고 했어요.",
  AttributeError: "그 값에는 없는 메서드나 속성을 썼어요. 자료형을 확인해 보세요.",
  EOFError: "입력을 더 읽으려고 했지만 남은 입력이 없어요. input()을 몇 번 부르는지 확인해 보세요.",
  RecursionError: "재귀가 너무 깊어요. 끝나는 조건이 있는지, 반복문으로 바꿀 수 있는지 살펴보세요.",
  KeyboardInterrupt: "시간 제한을 넘겨서 주문을 멈췄어요. 끝나지 않는 반복이나 너무 많은 반복이 없는지 보세요.",
  OverflowError: "숫자가 너무 커서 실수(float)로 다룰 수 없어요. 정수 연산(//)으로 바꿔 보세요.",
  ModuleNotFoundError: "그 모듈은 여기서 쓸 수 없어요. 표준 라이브러리만 쓸 수 있어요.",
  MemoryError: "메모리를 너무 많이 쓰려고 했어요. 아주 큰 리스트를 만들고 있지 않은지 보세요.",
  SystemExit: "프로그램이 0이 아닌 종료 코드로 끝났어요. sys.exit()에 넘긴 값을 확인해 보세요.",
  FatalError: "실행 환경이 멈춰서 새로 시작했어요. os._exit 같은 함수나 너무 큰 메모리 사용이 없는지 보세요.",
};

const FATAL_TEXT = "재귀가 너무 깊어서 브라우저의 한계를 넘었어요. 반복문이나 dict 메모로 바꿔 볼래?";

/** 런타임 사망(fatal)으로 생긴 에러인지(워커를 다시 만들었음) */
export function isFatalError(error: PyError): boolean {
  return error.message === FATAL_MESSAGE || (error.type === "FatalError" && error.message === FATAL_OTHER_MESSAGE);
}

function safeTest(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return false;
  }
}

function hasPattern(r: TracebackRule): r is TracebackRule & { pattern: string } {
  return r.pattern !== undefined && r.pattern !== "";
}

/**
 * 예외 이름이 같고 (패턴이 없거나 메시지에 패턴이 맞는) 규칙 중 **배열에서 처음** 것을 고른다.
 * content/companion/traceback.json은 예외마다 구체적인 패턴 규칙을 기본 규칙보다 앞에 둔다.
 * tools/verify_content.py의 check_companion()과 같은 규칙이다.
 */
export function pickRule(error: PyError, rules: TracebackRule[]): TracebackRule | undefined {
  return rules.find((r) => r.exception === error.type && (!hasPattern(r) || safeTest(r.pattern, error.message)));
}

function bodyText(error: PyError, rules: TracebackRule[]): string {
  if (error.message === FATAL_MESSAGE) {
    // fatal(브라우저 스택 초과)은 일반 RecursionError 기본 규칙보다 전용 해설이 낫다.
    // 메시지에 맞는 패턴 규칙이 있으면 그것을 쓴다
    const specific = rules.find((r) => r.exception === error.type && hasPattern(r) && safeTest(r.pattern, error.message));
    return specific ? specific.text : FATAL_TEXT;
  }
  const rule = pickRule(error, rules);
  if (rule) return rule.text;
  const builtin = BUILTIN[error.type];
  if (builtin) return builtin;
  return `${error.type} 에러가 났어요. 메시지를 보고 그 줄을 다시 살펴보세요.`;
}

export const explainError: ExplainError = (error, rules) => {
  const text = bodyText(error, rules);
  return typeof error.line === "number" ? `${error.line}번째 줄: ${text}` : text;
};

export default explainError;
