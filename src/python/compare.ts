// stdin/stdout형 출력 비교 규칙(design.md §5.5). judge.py의 normalize_output과 같은 규칙.
// 레슨 미니 연습(BlankExercise.expectedOutput)처럼 run() 결과를 JS에서 비교할 때도 쓴다.

/** 각 줄 끝 공백을 지우고, 끝에 남은 빈 줄(마지막 개행)을 없앤다 */
export function normalizeOutput(s: string): string {
  const lines = s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
