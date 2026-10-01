// dev/runner.html: 실행기를 단독으로 띄워 보는 개발·E2E용 페이지
import { SAMPLE_ANSWERS, SAMPLE_PROBLEMS } from "../../../tests/fixtures/samples";
import { outputsMatch } from "../compare";
import { diagnoseResult } from "../diagnose";
import { explainError } from "../explain";
import { createPythonRunner, type PythonRunnerOptions } from "../runner";

const runner = createPythonRunner();

Object.assign(window as object, {
  __runner: runner,
  __createRunner: (opts?: PythonRunnerOptions) => createPythonRunner(opts),
  __fixtures: { problems: SAMPLE_PROBLEMS, answers: SAMPLE_ANSWERS },
  __python: { explainError, diagnoseResult, outputsMatch },
});

const status = document.getElementById("status")!;
const out = document.getElementById("out")!;

runner.init().then(
  () => {
    status.textContent = `준비 완료 · 기준 ${runner.referenceMs().toFixed(1)} ms · 소프트 중단 ${runner.softStop() ? "켜짐" : "꺼짐"}`;
  },
  (e: unknown) => {
    status.textContent = `부팅 실패: ${String(e)}`;
  },
);

document.getElementById("run")!.addEventListener("click", async () => {
  const code = (document.getElementById("code") as HTMLTextAreaElement).value;
  const stdin = (document.getElementById("stdin") as HTMLTextAreaElement).value;
  const r = await runner.run({ code, stdin });
  out.textContent = [
    r.stdout,
    r.stderr && `[stderr]\n${r.stderr}`,
    r.error && `${r.error.traceback}\n→ ${explainError(r.error, [])}`,
    `${r.timeMs.toFixed(1)} ms${r.timedOut ? " (시간 초과)" : ""}${r.fatal ? " (fatal)" : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
});
