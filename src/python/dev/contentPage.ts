// dev/content.html: 콘텐츠 스모크 테스트(design.md §12.1)용 페이지.
// 실제 콘텐츠(loadContent)와 실제 실행기를 띄우고, 로더가 담지 않는 오답·비효율 답안(.py)과
// problem.json 원본(wrong[].expectFail)을 개발용으로만 따로 묶어 노출한다. 게임 로더의 출력 형식은 바꾸지 않는다.
import { loadContent } from "../../content/loader";
import type { ProblemFile } from "../../content/loader";
import { outputsMatch } from "../compare";
import { diagnoseResult, ruleMatches } from "../diagnose";
import { explainError, pickRule } from "../explain";
import { budgetLimitMs, isTimeBarrier, testLimitMs, usesBudget } from "../limits";
import { createPythonRunner } from "../runner";

function problemIdOf(path: string): { pid: string; file: string } {
  const m = /problems\/([^/]+)\/([^/]+)$/.exec(path);
  if (!m) throw new Error(`경로 형식 오류 ${path}`);
  return { pid: m[1]!, file: m[2]! };
}

/** 문제 ID → 파일 이름 → 원문(solution.py, starter.py, wrong_*.py, slow.py) */
function collectPy(): Record<string, Record<string, string>> {
  const mods = import.meta.glob<string>("../../../content/regions/*/problems/*/*.py", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  const out: Record<string, Record<string, string>> = {};
  for (const [path, text] of Object.entries(mods)) {
    const { pid, file } = problemIdOf(path);
    (out[pid] ??= {})[file] = text;
  }
  return out;
}

/** 문제 ID → problem.json 원본(wrong[]의 expectFail·diagnosis 포함) */
function collectProblemFiles(): Record<string, ProblemFile> {
  const mods = import.meta.glob<ProblemFile>("../../../content/regions/*/problems/*/problem.json", {
    eager: true,
    import: "default",
  });
  const out: Record<string, ProblemFile> = {};
  for (const [path, json] of Object.entries(mods)) out[problemIdOf(path).pid] = json;
  return out;
}

const content = loadContent();
const runner = createPythonRunner();

Object.assign(window as object, {
  __content: content,
  __runner: runner,
  __py: collectPy(),
  __problemFiles: collectProblemFiles(),
  __python: {
    diagnoseResult,
    ruleMatches,
    explainError,
    pickRule,
    outputsMatch,
    isTimeBarrier,
    usesBudget,
    testLimitMs,
    budgetLimitMs,
  },
});

const status = document.getElementById("status")!;
const problems = content.regions.flatMap((r) => r.problems).length;
const lessons = content.regions.flatMap((r) => r.lessons).length;
status.textContent = `콘텐츠: 지역 ${content.regions.length}, 문제 ${problems}, 레슨 ${lessons} · 실행기 부팅 중…`;
runner.init().then(
  () => {
    status.textContent = `콘텐츠: 지역 ${content.regions.length}, 문제 ${problems}, 레슨 ${lessons} · 기준 ${runner
      .referenceMs()
      .toFixed(1)} ms`;
  },
  (e: unknown) => {
    status.textContent = `부팅 실패: ${String(e)}`;
  },
);
