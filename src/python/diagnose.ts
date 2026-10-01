// 오답 진단(design.md §5.3). problem.diagnoses를 첫 실패 테스트에 맞춰 본다.
// tools/verify_content.py의 diagnose()와 같은 의미여야 한다(tests/e2e/content.spec.ts가 둘을 맞춰 본다).
import type { DiagnosisRule, Problem } from "../contracts/content";
import type { JudgeResult, TestResult } from "../contracts/runner";
import type { DiagnoseResult } from "../contracts/ui";

/** 플래그 없는 JS 정규식. 잘못된 정규식은 맞지 않는 것으로 본다 */
function safeTest(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return false;
  }
}

/** 공개 테스트를 모두 통과했고 첫 실패가 숨김 테스트인지 */
export function isOnlyHiddenFail(result: JudgeResult, fail: TestResult): boolean {
  return !fail.public && result.tests.every((t) => !t.public || t.verdict === "AC");
}

/**
 * 규칙의 조건(when)을 모두 만족하는지. 조건이 하나도 없는 규칙은 맞지 않는 것으로 본다(§11.1).
 * - outputMatches: 첫 실패 테스트의 **가공하지 않은** actual(stdin형은 stdout 그대로, 함수형은 반환값 repr)에
 *   플래그 없는 JS 정규식으로 적용한다. 끝 개행은 규칙 쪽에서 `\s*$`처럼 허용한다.
 * - messageMatches: 예외 메시지에 같은 방식으로 적용한다.
 * - onlyHiddenFail: true면 "공개 테스트 전부 통과·첫 실패가 숨김", false면 그 반대일 때 맞는다.
 */
export function ruleMatches(rule: DiagnosisRule, _problem: Problem, result: JudgeResult, fail: TestResult): boolean {
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
    if (!safeTest(w.messageMatches, fail.error?.message ?? "")) return false;
  }
  if (w.outputMatches !== undefined) {
    checked++;
    if (!safeTest(w.outputMatches, fail.actual)) return false;
  }
  if (w.onlyHiddenFail !== undefined) {
    checked++;
    if (isOnlyHiddenFail(result, fail) !== w.onlyHiddenFail) return false;
  }
  return checked > 0;
}

/** 첫 실패 테스트에서 규칙을 배열 순서대로 보고 처음 맞는 규칙의 해설 */
export const diagnoseResult: DiagnoseResult = (problem, result) => {
  if (result.verdict === "AC") return undefined;
  const fail = result.tests.find((t) => t.verdict !== "AC");
  if (!fail) return undefined;
  const rule = problem.diagnoses.find((r) => ruleMatches(r, problem, result, fail));
  return rule?.text;
};

export default diagnoseResult;
