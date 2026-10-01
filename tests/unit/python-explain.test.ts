import { describe, expect, it } from "vitest";
import type { TracebackRule } from "../../src/contracts/content";
import type { PyError } from "../../src/contracts/runner";
import { explainError, isFatalError, pickRule } from "../../src/python/explain";
import { FATAL_MESSAGE } from "../../src/python/protocol";
import { fatalError } from "../../src/python/runner";

// content/companion/traceback.json처럼 예외마다 패턴 규칙을 기본 규칙보다 앞에 둔다
const rules: TracebackRule[] = [
  { exception: "TypeError", pattern: "can only concatenate str \\(not \"int\"\\) to str", text: "문자열+숫자" },
  { exception: "TypeError", pattern: "can't multiply sequence", text: "문자열×문자열" },
  { exception: "TypeError", text: "타입 기본" },
  { exception: "NameError", text: "이름 기본" },
  { exception: "ValueError", pattern: "invalid literal for int", text: "int 변환 실패" },
  { exception: "RecursionError", text: "재귀 기본" },
];

const err = (type: string, message: string, line?: number): PyError => ({
  type,
  message,
  traceback: `${type}: ${message}\n`,
  ...(line !== undefined ? { line } : {}),
});

describe("pickRule", () => {
  it("패턴이 맞는 규칙이 기본 규칙보다 먼저", () => {
    expect(pickRule(err("TypeError", 'can only concatenate str (not "int") to str'), rules)?.text).toBe("문자열+숫자");
    expect(pickRule(err("TypeError", "can't multiply sequence by non-int of type 'str'"), rules)?.text).toBe(
      "문자열×문자열",
    );
  });
  it("패턴이 안 맞으면 같은 예외의 기본 규칙", () => {
    expect(pickRule(err("TypeError", "unsupported operand"), rules)?.text).toBe("타입 기본");
  });
  it("기본 규칙이 없고 패턴도 안 맞으면 없음", () => {
    expect(pickRule(err("ValueError", "math domain error"), rules)).toBeUndefined();
  });
  it("배열 순서대로 처음 맞는 규칙(기본 규칙이 앞에 있으면 기본 규칙)", () => {
    const defaultFirst: TracebackRule[] = [
      { exception: "TypeError", text: "기본" },
      { exception: "TypeError", pattern: "can't multiply", text: "구체" },
    ];
    expect(pickRule(err("TypeError", "can't multiply sequence by non-int of type 'str'"), defaultFirst)?.text).toBe("기본");
    // 패턴 규칙끼리도 앞의 것이 이긴다
    const two: TracebackRule[] = [
      { exception: "TypeError", pattern: "unsupported operand type\\(s\\) for .*'str'", text: "str" },
      { exception: "TypeError", pattern: "unsupported operand type", text: "일반" },
    ];
    expect(pickRule(err("TypeError", "unsupported operand type(s) for +: 'int' and 'str'"), two)?.text).toBe("str");
    expect(pickRule(err("TypeError", "unsupported operand type(s) for +: 'int' and 'list'"), two)?.text).toBe("일반");
  });
  it("잘못된 정규식은 무시", () => {
    const bad: TracebackRule[] = [{ exception: "KeyError", pattern: "(", text: "x" }];
    expect(pickRule(err("KeyError", "'a'"), bad)).toBeUndefined();
  });
});

describe("explainError", () => {
  it("사용자 줄 번호를 앞에 붙인다", () => {
    expect(explainError(err("NameError", "name 'x' is not defined", 3), rules)).toBe("3번째 줄: 이름 기본");
  });
  it("줄 번호가 없으면 해설만", () => {
    expect(explainError(err("NameError", "name 'solution' is not defined"), rules)).toBe("이름 기본");
  });
  it("규칙이 없으면 내장 기본 해설", () => {
    const text = explainError(err("ZeroDivisionError", "division by zero", 2), []);
    expect(text.startsWith("2번째 줄: ")).toBe(true);
    expect(text).toContain("0으로 나누");
  });
  it("모르는 예외는 일반 문구", () => {
    expect(explainError(err("FooError", "bar"), [])).toContain("FooError");
  });
  it("시간 초과(KeyboardInterrupt)", () => {
    expect(explainError(err("KeyboardInterrupt", "", 2), [])).toContain("시간 제한");
  });
  it("fatal 원인 분류: 스택 초과는 RecursionError, 나머지는 FatalError", () => {
    expect(fatalError("RangeError: Maximum call stack size exceeded").type).toBe("RecursionError");
    expect(fatalError(undefined).type).toBe("RecursionError");
    const other = fatalError("Error: Pyodide already fatally failed (exit)");
    expect(other.type).toBe("FatalError");
    expect(isFatalError(other)).toBe(true);
    expect(explainError(other, [])).toContain("실행 환경");
  });
  it("fatal은 RecursionError 기본 규칙 대신 전용 해설", () => {
    const fatal = err("RecursionError", FATAL_MESSAGE);
    expect(isFatalError(fatal)).toBe(true);
    expect(explainError(fatal, rules)).toContain("dict 메모");
    // 보통 RecursionError는 사전의 기본 규칙
    expect(explainError(err("RecursionError", "maximum recursion depth exceeded", 2), rules)).toBe("2번째 줄: 재귀 기본");
    // fatal 전용 패턴 규칙이 있으면 그것을 쓴다
    const withFatal: TracebackRule[] = [...rules, { exception: "RecursionError", pattern: "Pyodide", text: "전용" }];
    expect(explainError(fatal, withFatal)).toBe("전용");
    // 맞지 않는 패턴 규칙만 있으면 내장 fatal 해설(기본 규칙이 아님)
    const noMatch: TracebackRule[] = [...rules, { exception: "RecursionError", pattern: "^xyz", text: "x" }];
    expect(explainError(fatal, noMatch)).toContain("dict 메모");
  });
});
