// 오답 진단(design.md §5.3). problem.diagnoses를 첫 실패 테스트에 맞춰 본다.
import type { DiagnosisRule, Problem } from "../contracts/content";
import type { JudgeResult, TestResult } from "../contracts/runner";
import type { DiagnoseResult } from "../contracts/ui";
import { normalizeOutput } from "./compare";

function safeTest(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return false;
  }
}

/**
 * 규칙의 조건(when)을 모두 만족하는지. 조건이 하나도 없는 규칙은 맞지 않는 것으로 본다(§11.1).
 * outputMatches는 stdin형이면 출력 정규화(줄 끝 공백·마지막 개행 제거) 뒤의 문자열에 적용한다.
 */
export function ruleMatches(rule: DiagnosisRule, problem: Problem, result: JudgeResult, fail: TestResult): boolean {
  const w = rule.when;
  let checked = 0;
  if (w.verdict !== undefined) {
    checked++;
    if (fail.verdict !== w.verdict) return false;
  }
  if (w.exception !== undefined) {
    checked++;
    if (fail.error?.type !== w.exception) return false;
  }
  if (w.messageMatches !== undefined) {
    checked++;
    if (!fail.error || !safeTest(w.messageMatches, fail.error.message)) return false;
  }
  if (w.outputMatches !== undefined) {
    checked++;
    const actual = problem.kind === "stdin" ? normalizeOutput(fail.actual) : fail.actual;
    if (!safeTest(w.outputMatches, actual)) return false;
  }
  if (w.onlyHiddenFail === true) {
    checked++;
    const publicTests = result.tests.filter((t) => t.public);
    const publicAllPass = publicTests.every((t) => t.verdict === "AC");
    // 공개 테스트를 하나도 채점하지 않았다면(페이즈 채점 등) 숨김 실패만으로 판단한다
    if (!publicAllPass || fail.public) return false;
  }
  return checked > 0;
}

export const diagnoseResult: DiagnoseResult = (problem, result) => {
  if (result.verdict === "AC") return undefined;
  const fail = result.tests.find((t) => t.verdict !== "AC");
  if (!fail) return undefined;
  const rule = problem.diagnoses.find((r) => ruleMatches(r, problem, result, fail));
  return rule?.text;
};

export default diagnoseResult;
