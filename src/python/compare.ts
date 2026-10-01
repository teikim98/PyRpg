// stdin/stdout형 출력 비교 규칙(design.md §5.5). judge.py의 normalize_output, tools/verify_content.py의 norm과
// 같은 규칙이다(tests/unit/python-parity.test.ts가 CPython으로 맞춰 본다).
// 레슨 미니 연습(BlankExercise.expectedOutput)처럼 run() 결과를 JS에서 비교할 때도 쓴다.

/**
 * \r\n을 \n으로 바꾸고, 각 줄 끝의 ASCII 공백(" \t\r\f\v")을 지우고, 끝에 남은 빈 줄(마지막 개행)을 없앤다.
 * JS의 \s나 Python의 str.rstrip()은 유니코드 공백까지 지우고 둘의 범위가 서로 달라서 쓰지 않는다.
 */
export function normalizeOutput(s: string): string {
  const lines = s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/[ \t\r\f\v]+$/, ""));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
