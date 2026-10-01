// 콘텐츠 스모크 테스트(design.md §12.1, §9.5, §9.6).
// 게임 안(Pyodide)의 채점·오답 진단·Traceback 해설이 로컬 CPython 검증(tools/verify_content.py)과 같은지
// 실제 콘텐츠 전부로 확인한다. content/regions/의 지역마다 문제·레슨·보스 보정 테스트를 만든다.
//
//   PW_PORT=4179 npx playwright test tests/e2e/content.spec.ts
//   PW_REGIONS=r02 PW_PORT=4179 npx playwright test tests/e2e/content.spec.ts   (지역 일부만)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { Verdict } from "../../src/contracts/content";

/** content/regions/의 지역 전부. PW_REGIONS=r02처럼 쉼표로 골라 일부만 돌릴 수 있다 */
const ONLY = process.env.PW_REGIONS?.split(",").map((s) => s.trim()).filter(Boolean);
const REGIONS = readdirSync(resolve("content/regions"))
  .filter((d) => /^r\d\d-/.test(d))
  .sort()
  .map((dir) => ({ id: dir.slice(0, 3), problems: readdirSync(resolve("content/regions", dir, "problems")).sort() }))
  .filter((r) => !ONLY || ONLY.includes(r.id));

/** 비효율 답안의 반복 1회 비용을 어림할 입력(반복 10^6회). 보스마다 입력 형식이 다르다 */
const SLOW_PROBE_STDIN: Record<string, string> = {
  P0105: "1 1000000\n",
  P0210: "1000000\n",
  // max(arr[:i+1])를 N번: 1 + 2 + … + 1414 ≈ 10^6
  P0311: `1414\n${Array.from({ length: 1414 }, (_, i) => (i * 37) % 1999 - 999).join(" ")}\n`,
};

/** 시간 결계 보정 기준(§9.6 2단계): 제한은 모범답안의 3배 이상, 비효율 답안은 제한의 3배 이상 */
const BUDGET_HEADROOM = 3;

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.goto("/dev/content.html");
  await page.waitForFunction(() => (window as any).__runner !== undefined);
  await page.evaluate(() => (window as any).__runner.init());
});

test.afterAll(async () => {
  await page?.close();
  if (rows.length) console.log(["", "| 문제 | 답안 | 기대 실패 | 실제 실패 | 진단 | 해설 |", "|---|---|---|---|---|---|", ...rows].join("\n"));
});

const rows: string[] = [];
const fmt = (m: Record<string, string>) =>
  Object.keys(m).length ? Object.entries(m).map(([k, v]) => `${k}:${v}`).join(" ") : "-";

interface ExplainCheck {
  test: number;
  verdict: Verdict;
  type?: string;
  message?: string;
  line?: number;
  ruleBased: boolean;
  text: string;
}

interface AnswerCheck {
  file: string;
  expected: Record<string, string>;
  got: Record<string, string>;
  diag?: string;
  wantDiag?: string;
  explains: ExplainCheck[];
  fatal: boolean;
  firstActual?: string;
  limitMs: number;
  /** 보스: 전투 화면처럼 페이즈를 차례로 채점해서 처음 실패한 페이즈의 결과 */
  phaseRun?: { phase: number; got: Record<string, string>; diag?: string } | null;
}

interface ProblemReport {
  found: boolean;
  boss: boolean;
  solutionMatchesFile: boolean;
  wrongFiles: string[];
  pyFiles: string[];
  /** 테스트별 페이즈 */
  phases: number[];
  answers: AnswerCheck[];
}

async function checkProblem(pid: string): Promise<ProblemReport> {
  return page.evaluate(async (id: string): Promise<ProblemReport> => {
    const W = window as any;
    const problem = W.__content.regions.flatMap((r: any) => r.problems).find((p: any) => p.id === id);
    const pf = W.__problemFiles[id];
    const py: Record<string, string> = W.__py[id] ?? {};
    const tb = W.__content.traceback;
    if (!problem || !pf) {
      return { found: false, boss: false, solutionMatchesFile: false, wrongFiles: [], pyFiles: [], phases: [], answers: [] };
    }
    const judgeOne = async (file: string, code: string, expected: Record<string, string>, wantDiag?: string) => {
      const r = await W.__runner.judge(problem, code, { scope: "all" });
      const got = Object.fromEntries(
        r.tests.filter((t: any) => t.verdict !== "AC").map((t: any) => [String(t.index + 1), t.verdict]),
      );
      const explains = r.tests
        .filter((t: any) => (t.verdict === "RE" || t.verdict === "TLE") && t.error)
        .map((t: any) => ({
          test: t.index + 1,
          verdict: t.verdict,
          type: t.error.type,
          message: t.error.message,
          line: t.error.line,
          ruleBased: W.__python.pickRule(t.error, tb) !== undefined,
          text: W.__python.explainError(t.error, tb),
        }));
      const first = r.tests.find((t: any) => t.verdict !== "AC");
      // 보스 전투(src/ui/battle.ts)는 페이즈마다 따로 채점하고, 통과하면 다음 페이즈로 넘어간다
      let phaseRun: { phase: number; got: Record<string, string>; diag?: string } | null | undefined;
      if (problem.boss) {
        phaseRun = null;
        const phases = [...new Set<number>(problem.tests.map((t: any) => t.phase ?? 1))].sort((a, b) => a - b);
        for (const phase of phases) {
          const pr = await W.__runner.judge(problem, code, { scope: "all", phase });
          if (pr.verdict !== "AC") {
            phaseRun = {
              phase,
              got: Object.fromEntries(
                pr.tests.filter((t: any) => t.verdict !== "AC").map((t: any) => [String(t.index + 1), t.verdict]),
              ),
              diag: W.__python.diagnoseResult(problem, pr),
            };
            break;
          }
        }
      }
      return {
        phaseRun,
        file,
        expected,
        got,
        diag: W.__python.diagnoseResult(problem, r),
        wantDiag,
        explains,
        fatal: r.fatal,
        firstActual: first?.actual,
        limitMs: r.limitMs,
      };
    };
    const answers = [await judgeOne("solution.py", problem.solution, {})];
    // 정답으로 인정하는 다른 답안(예: P0108 튜플 반환, compare.sequenceAsList)
    for (const a of pf.accepted ?? []) answers.push(await judgeOne(a.file, py[a.file] ?? "", {}));
    for (const w of pf.wrong) answers.push(await judgeOne(w.file, py[w.file] ?? "", w.expectFail, w.diagnosis?.text));
    return {
      found: true,
      boss: problem.boss,
      solutionMatchesFile: py["solution.py"] === problem.solution,
      wrongFiles: pf.wrong.map((w: any) => w.file),
      pyFiles: Object.keys(py),
      phases: problem.tests.map((t: any) => t.phase ?? 1),
      answers,
    };
  }, pid);
}


interface BlockRun {
  lesson: string;
  n: number;
  code: string;
  stdin: string;
  needsInput: boolean;
  stdout: string;
  error?: { type: string; message: string };
  timedOut: boolean;
  fatal: boolean;
}

interface ExerciseRun {
  lesson: string;
  stdout: string;
  expectedOutput: string;
  match: boolean;
  error?: { type: string; message: string };
  noneMatches: boolean;
}

/** CPython으로 같은 코드를 실행한 stdout(python3가 없거나 실패하면 undefined). Pyodide 출력과 맞춰 본다 */
const CPYTHON = process.env.PYRPG_CPYTHON ?? (existsSync("/root/.local/bin/python3.14") ? "/root/.local/bin/python3.14" : "python3");
function cpython(code: string, stdin: string): string | undefined {
  const r = spawnSync(CPYTHON, ["-c", code], { input: stdin, encoding: "utf-8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  if (r.error || r.status !== 0) return undefined;
  return r.stdout;
}

for (const region of REGIONS) {
  test.describe(`콘텐츠 스모크 ${region.id}: 문제`, () => {
    for (const pid of region.problems) {
      test(`${pid}: 모범답안 AC, 오답·비효율 답안은 expectFail 그대로, 진단·해설 일치`, async () => {
        test.setTimeout(180_000);
        const rep = await checkProblem(pid);
        expect(rep.found, `${pid}가 콘텐츠에 없음`).toBe(true);
        expect(rep.solutionMatchesFile).toBe(true);
        // 폴더의 wrong_*.py·slow.py가 모두 problem.json wrong[]에 있다
        const extra = rep.pyFiles.filter((f) => (f.startsWith("wrong_") || f === "slow.py") && !rep.wrongFiles.includes(f));
        expect(extra, "wrong[]에 없는 오답 파일").toEqual([]);
        if (rep.boss) expect(rep.wrongFiles).toContain("slow.py");

        for (const a of rep.answers) {
          const where = `${pid} ${a.file}`;
          const correct = a.file === "solution.py" || a.file.startsWith("alt_");
          const diagOk = correct ? a.diag === undefined : a.diag === a.wantDiag;
          const explainOk = a.explains.every((e) => e.ruleBased && typeof e.line === "number");
          rows.push(
            `| ${pid} | ${a.file} | ${fmt(a.expected)} | ${fmt(a.got)} | ${diagOk ? "OK" : "불일치"} | ${
              a.explains.length ? (explainOk ? `OK(${a.explains.map((e) => `${e.type}@${e.line}`)[0]})` : "불일치") : "-"
            } |`,
          );
          expect.soft(a.got, `${where} 판정`).toEqual(a.expected);
          expect.soft(a.fatal, `${where} 런타임 사망(§9.5)`).toBe(false);
          if (correct) {
            expect.soft(a.diag, `${where} 진단`).toBeUndefined();
          } else {
            expect.soft(a.diag, `${where} 진단(첫 실패 actual=${JSON.stringify(a.firstActual)})`).toBe(a.wantDiag);
          }
          for (const e of a.explains) {
            // 규칙 기반 해설(일반 문구가 아님)과 사용자 줄 번호
            expect.soft(e.ruleBased, `${where} #${e.test} ${e.type}: ${e.message} 에 맞는 traceback 규칙`).toBe(true);
            expect.soft(typeof e.line, `${where} #${e.test} ${e.type} 줄 번호`).toBe("number");
            expect.soft(e.text.startsWith(`${e.line}번째 줄: `), `${where} #${e.test} 해설 앞의 줄 번호`).toBe(true);
            expect.soft(e.text, `${where} #${e.test} 일반 문구가 아님`).not.toContain("에러가 났어요. 메시지를 보고");
            if (e.verdict === "TLE") expect.soft(e.type).toBe("KeyboardInterrupt");
          }
          if (rep.boss) {
            if (correct) {
              expect.soft(a.phaseRun, `${where} 페이즈별 채점`).toBeNull();
            } else {
              // 처음 실패한 페이즈의 판정은 expectFail 중 그 페이즈의 것과 같고, 진단도 자기 규칙
              expect.soft(a.phaseRun, `${where} 페이즈별 채점에서 실패해야 함`).toBeTruthy();
              if (a.phaseRun) {
                const inPhase = Object.fromEntries(
                  Object.entries(a.expected).filter(([k]) => rep.phases[Number(k) - 1] === a.phaseRun!.phase),
                );
                expect.soft(a.phaseRun.got, `${where} ${a.phaseRun.phase}페이즈 판정`).toEqual(inPhase);
                expect.soft(a.phaseRun.diag, `${where} ${a.phaseRun.phase}페이즈 진단`).toBe(a.wantDiag);
              }
            }
          }
        }
      });
    }
  });

  test(`콘텐츠 스모크 ${region.id}: 레슨 run 블록과 빈칸 연습`, async () => {
    test.setTimeout(120_000);
    const res = await page.evaluate(async (rid: string) => {
      const W = window as any;
      const region = W.__content.regions.find((r: any) => r.id === rid);
      const blocks: BlockRun[] = [];
      const exercises: ExerciseRun[] = [];
      for (const l of region.lessons) {
        // tools/verify_content.py check_lesson()과 같은 추출 규칙
        const found = [...(l.body as string).matchAll(/^```python run[ \t]*\n([\s\S]*?)^```[ \t]*$/gm)].map((m) => m[1]!);
        for (const [i, code] of found.entries()) {
          // 주석 속 input()은 빼고 본다(L1-2의 "# input()이 이런 문자열을 준다고 치고")
          const needsInput = /input\s*\(|stdin/.test(code.replace(/#.*$/gm, ""));
          const stdin = needsInput ? "메아리\n3 4\n" : "";
          const r = await W.__runner.run({ code, stdin });
          blocks.push({
            lesson: l.id,
            n: i + 1,
            code,
            stdin,
            needsInput,
            stdout: r.stdout,
            error: r.error ? { type: r.error.type, message: r.error.message } : undefined,
            timedOut: r.timedOut,
            fatal: r.fatal,
          });
        }
        const ex = l.exercise;
        if (ex) {
          const run = (v: string) => W.__runner.run({ code: ex.code.replace("___", v), stdin: ex.stdin ?? "" });
          const r = await run(ex.answer);
          const none = await run("None");
          exercises.push({
            lesson: l.id,
            stdout: r.stdout,
            expectedOutput: ex.expectedOutput,
            match: !r.error && !r.timedOut && W.__python.outputsMatch(r.stdout, ex.expectedOutput),
            error: r.error ? { type: r.error.type, message: r.error.message } : undefined,
            noneMatches: !none.error && W.__python.outputsMatch(none.stdout, ex.expectedOutput),
          });
        }
      }
      return { blocks, exercises, lessons: region.lessons.length };
    }, region.id);

    expect(res.lessons).toBeGreaterThan(0);
    expect(res.blocks.length).toBeGreaterThan(0);
    const needInput = res.blocks.filter((b) => b.needsInput).map((b) => `${b.lesson}#${b.n}`);
    console.log(`레슨 run 블록 ${res.blocks.length}개, input()이 필요한 블록: ${needInput.length ? needInput.join(", ") : "없음"}`);
    let compared = 0;
    for (const b of res.blocks) {
      const where = `${b.lesson} run 블록 ${b.n}`;
      expect.soft(b.error, `${where} 에러`).toBeUndefined();
      expect.soft(b.timedOut || b.fatal, `${where} 시간 초과/사망`).toBe(false);
      const want = cpython(b.code, b.stdin);
      if (want !== undefined) {
        compared++;
        expect.soft(b.stdout, `${where}: Pyodide와 CPython 출력`).toBe(want);
      }
    }
    console.log(`CPython(${CPYTHON})과 출력 비교한 블록: ${compared}/${res.blocks.length}`);
    expect(res.exercises.length).toBe(res.lessons);
    for (const e of res.exercises) {
      expect.soft(e.error, `${e.lesson} 빈칸 연습 에러`).toBeUndefined();
      expect.soft(e.match, `${e.lesson} 빈칸 연습: ${JSON.stringify(e.stdout)} vs ${JSON.stringify(e.expectedOutput)}`).toBe(true);
      expect.soft(e.noneMatches, `${e.lesson} 빈칸에 None을 넣어도 정답`).toBe(false);
    }
  });

  test(`콘텐츠 스모크 ${region.id}: 보스 시간 결계 budgetUnits 보정(§9.6 2단계)`, async () => {
    test.setTimeout(180_000);
    const bosses = await page.evaluate(
      (rid: string) =>
        (window as any).__content.regions
          .find((r: any) => r.id === rid)
          .problems.filter((p: any) => p.boss)
          .map((p: any) => p.id) as string[],
      region.id,
    );
    expect(bosses.length).toBe(1);
    for (const pid of bosses) {
      const m = await page.evaluate(
        async ([id, headroom, probeStdin]: [string, number, string]) => {
          const W = window as any;
          const p = W.__content.regions.flatMap((r: any) => r.problems).find((x: any) => x.id === id);
          const slowCode: string = W.__py[id]["slow.py"];
          const refMs: number = await W.__runner.remeasure();
          const barrier = p.tests.map((t: any, i: number) => ({ t, i })).filter(({ t }: any) => W.__python.isTimeBarrier(p, t));
          // 모범답안: 시간 결계 테스트마다 5번 재서 중앙값, 그중 가장 느린 테스트
          const samples: number[][] = barrier.map(() => []);
          let limitMs = 0;
          for (let k = 0; k < 5; k++) {
            const r = await W.__runner.judge(p, p.solution, { scope: "all", phase: 2 });
            limitMs = r.limitMs;
            r.tests.forEach((t: any, j: number) => samples[j]!.push(t.timeMs));
          }
          const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
          const modelMs = Math.max(...samples.map(med));
          // 비효율 답안: 시간 결계 판정 + 제한의 headroom배를 줘도 끝나지 않는지(실제 입력 그대로)
          const slowJudge = await W.__runner.judge(p, slowCode, { scope: "all", phase: 2 });
          const slowTle = slowJudge.tests.filter((t: any) => t.verdict === "TLE").map((t: any) => t.index);
          const generous: { index: number; timedOut: boolean; ms: number }[] = [];
          for (const idx of slowTle) {
            const t0 = performance.now();
            // 생성기(gen) 테스트는 실행기가 만든 실제 입력을 쓴다(design.md §11.1)
            const stdin = (await W.__runner.testData(p, idx)).in;
            const r = await W.__runner.run({ code: slowCode, stdin, timeoutMs: Math.ceil(limitMs * headroom) });
            generous.push({ index: idx, timedOut: r.timedOut, ms: performance.now() - t0 });
          }
          // 비효율 답안의 반복 1회 비용으로 실제 입력 시간을 어림한다(10^6회 실행)
          const t0 = performance.now();
          const probe = await W.__runner.run({ code: slowCode, stdin: probeStdin, timeoutMs: 10_000 });
          const perIterMs = (probe.timeMs || performance.now() - t0) / 1_000_000;
          return {
            id,
            budgetUnits: p.budgetUnits as number | undefined,
            refMs,
            limitMs,
            modelMs,
            modelUnits: modelMs / refMs,
            slowVerdicts: slowJudge.tests.map((t: any) => `${t.index + 1}:${t.verdict}`),
            slowTimesMs: slowJudge.tests.map((t: any) => Math.round(t.timeMs)),
            generous,
            perIterMs,
          };
        },
        [pid, BUDGET_HEADROOM, SLOW_PROBE_STDIN[pid] ?? "1000000\n"] as [string, number, string],
      );
      console.log(
        `${m.id} 보정: ref=${m.refMs.toFixed(1)} ms, budgetUnits=${m.budgetUnits}, 제한=${m.limitMs} ms, ` +
          `모범답안=${m.modelMs.toFixed(3)} ms(${m.modelUnits.toFixed(5)} units, 제한/모범=${(m.limitMs / m.modelMs).toFixed(0)}배), ` +
          `비효율 판정=${m.slowVerdicts.join(" ")} 시간=${m.slowTimesMs.join("/")} ms, ` +
          `제한×${BUDGET_HEADROOM}에서도 미종료=${m.generous.map((g) => `#${g.index + 1}:${g.timedOut}`).join(" ")}, ` +
          `반복 1회≈${(m.perIterMs * 1e6).toFixed(0)} ns`,
      );
      expect(m.budgetUnits, "보스에 budgetUnits").toBeGreaterThan(0);
      // 모범답안 대비 3배 이상 여유
      expect(m.limitMs).toBeGreaterThanOrEqual(BUDGET_HEADROOM * m.modelMs);
      // 비효율 답안은 제한의 3배를 줘도 끝나지 않는다
      expect(m.generous.length).toBeGreaterThan(0);
      for (const g of m.generous) expect(g.timedOut, `slow.py #${g.index + 1} 제한×${BUDGET_HEADROOM}`).toBe(true);
    }
  });
}
