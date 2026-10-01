import { describe, expect, it } from "vitest";
import type { DiagnosisRule, Problem, Verdict } from "../../src/contracts/content";
import type { JudgeResult, PyError, TestResult } from "../../src/contracts/runner";
import { diagnoseResult, ruleMatches } from "../../src/python/diagnose";
import { DIAG, SAMPLE_PROBLEMS } from "../fixtures/samples";

function tr(index: number, verdict: Verdict, actual: string, opts: { public?: boolean; error?: PyError } = {}): TestResult {
  return {
    index,
    public: opts.public ?? index === 0,
    phase: 1,
    verdict,
    timeMs: 1,
    input: "",
    expected: "",
    actual,
    ...(opts.error ? { error: opts.error } : {}),
  };
}

function jr(tests: TestResult[]): JudgeResult {
  const fail = tests.find((t) => t.verdict !== "AC");
  return {
    verdict: fail ? fail.verdict : "AC",
    passed: tests.filter((t) => t.verdict === "AC").length,
    total: tests.length,
    tests,
    fatal: false,
    limitMs: 1000,
  };
}

const P0101 = SAMPLE_PROBLEMS.P0101!;
const P0102 = SAMPLE_PROBLEMS.P0102!;
const P0104 = SAMPLE_PROBLEMS.P0104!;
const P0105 = SAMPLE_PROBLEMS.P0105!;

describe("diagnoseResult", () => {
  it("AC면 진단 없음", () => {
    expect(diagnoseResult(P0101, jr([tr(0, "AC", "3\n")]))).toBeUndefined();
  });

  it("outputMatches는 가공하지 않은 stdout에 플래그 없는 JS 정규식으로 적용(규칙이 \\s*$로 끝 개행 허용)", () => {
    expect(diagnoseResult(P0101, jr([tr(0, "WA", "12\n")]))).toBe(DIAG.concat);
    expect(diagnoseResult(P0101, jr([tr(0, "WA", "3.0  \n\n")]))).toBe(DIAG.floatDot);
    const fail = tr(0, "WA", "12\n");
    // 정규화하지 않으므로 $ 앞의 개행을 규칙이 허용하지 않으면 맞지 않는다(Python re의 $와 다름)
    expect(ruleMatches({ when: { outputMatches: "^\\d+$" }, text: "" }, P0101, jr([fail]), fail)).toBe(false);
    expect(ruleMatches({ when: { outputMatches: "^\\d+\\s*$" }, text: "" }, P0101, jr([fail]), fail)).toBe(true);
    // 줄 끝 공백도 그대로 남아 있다
    const sp = tr(0, "WA", "1 2 \n");
    expect(ruleMatches({ when: { outputMatches: "2 \\n$" }, text: "" }, P0101, jr([sp]), sp)).toBe(true);
    // 플래그 없음: ^는 문자열 처음에서만, .은 개행을 넘지 않는다
    const two = tr(0, "WA", "a\nb\n");
    expect(ruleMatches({ when: { outputMatches: "^b" }, text: "" }, P0101, jr([two]), two)).toBe(false);
    expect(ruleMatches({ when: { outputMatches: "a.b" }, text: "" }, P0101, jr([two]), two)).toBe(false);
  });

  it("첫 실패 테스트 기준", () => {
    const r = jr([tr(0, "AC", "3 1\n"), tr(1, "WA", "0.0 0\n", { public: false }), tr(2, "WA", "1 5\n", { public: false })]);
    expect(diagnoseResult(P0102, r)).toBe(DIAG.slashDiv);
  });

  it("onlyHiddenFail: 공개 통과 + 숨김 실패일 때만", () => {
    const hidden = jr([tr(0, "AC", "3 1\n"), tr(4, "WA", "333333333333333312 1\n", { public: false })]);
    expect(diagnoseResult(P0102, hidden)).toBe(DIAG.precision);
    const publicFail = jr([tr(0, "WA", "3 2\n")]);
    expect(diagnoseResult(P0102, publicFail)).toBeUndefined();
    // 공개 테스트가 하나라도 실패하면(첫 실패가 숨김이어도) 아님
    const mixed = jr([tr(0, "AC", "3 1\n"), tr(1, "WA", "x", { public: false }), tr(2, "WA", "y", { public: true })]);
    expect(diagnoseResult(P0102, mixed)).toBeUndefined();
  });

  it("onlyHiddenFail: false는 공개 테스트에서 실패할 때 맞는다(verify_content.py와 같은 의미)", () => {
    const rule: DiagnosisRule = { when: { onlyHiddenFail: false }, text: "공개" };
    const pub = tr(0, "WA", "x");
    expect(ruleMatches(rule, P0101, jr([pub]), pub)).toBe(true);
    const hid = tr(1, "WA", "x", { public: false });
    const r = jr([tr(0, "AC", "3\n"), hid]);
    expect(ruleMatches(rule, P0101, r, hid)).toBe(false);
  });

  it("규칙은 배열 순서대로, 처음 맞는 것", () => {
    const p: Problem = {
      ...P0101,
      diagnoses: [
        { when: { verdict: "WA" }, text: "먼저" },
        { when: { verdict: "WA", outputMatches: "12" }, text: "나중" },
      ],
    };
    expect(diagnoseResult(p, jr([tr(0, "WA", "12\n")]))).toBe("먼저");
  });

  it("exception + messageMatches", () => {
    const error: PyError = {
      type: "TypeError",
      message: "can't multiply sequence by non-int of type 'str'",
      line: 5,
      traceback: "",
    };
    expect(diagnoseResult(P0104, jr([tr(0, "RE", "", { error })]))).toBe(DIAG.strTimes);
    const other: PyError = { ...error, message: "unsupported operand" };
    expect(diagnoseResult(P0104, jr([tr(0, "RE", "", { error: other })]))).toBeUndefined();
  });

  it("verdict 조건(TLE)", () => {
    const r = jr([tr(0, "AC", "55\n"), tr(3, "TLE", "", { public: false })]);
    expect(diagnoseResult(P0105, r)).toBe(DIAG.tle);
  });

  it("출력 중간 개행(P0104 오답 A)", () => {
    expect(diagnoseResult(P0104, jr([tr(0, "WA", "ab\nab\nab\n\n")]))).toBe(DIAG.newline);
  });
});

describe("ruleMatches", () => {
  const fail = tr(0, "WA", "x");
  const r = jr([fail]);
  it("조건이 없는 규칙은 맞지 않음", () => {
    expect(ruleMatches({ when: {}, text: "" }, P0101, r, fail)).toBe(false);
  });
  it("잘못된 정규식은 맞지 않음", () => {
    expect(ruleMatches({ when: { outputMatches: "(" }, text: "" }, P0101, r, fail)).toBe(false);
  });
  it("모든 조건을 만족해야 함", () => {
    const rule: DiagnosisRule = { when: { outputMatches: "x", verdict: "RE" }, text: "" };
    expect(ruleMatches(rule, P0101, r, fail)).toBe(false);
    expect(ruleMatches({ when: { outputMatches: "x", verdict: "WA" }, text: "" }, P0101, r, fail)).toBe(true);
  });
  it("함수형은 반환값 repr를 그대로 본다", () => {
    const fn: Problem = SAMPLE_PROBLEMS.P0103!;
    const f = tr(0, "WA", "3");
    expect(ruleMatches({ when: { outputMatches: "^3$" }, text: "" }, fn, jr([f]), f)).toBe(true);
  });
});
