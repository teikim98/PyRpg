// Python 실행기 E2E(design.md §9.4~§9.6, §12.3). dev/runner.html의 window.__runner로 실제 워커를 돌린다.
import { expect, test, type Page } from "@playwright/test";
import type { Problem } from "../../src/contracts/content";
import type { JudgeResult, RunOutput } from "../../src/contracts/runner";

// page.evaluate 콜백은 브라우저에서 실행되므로, 같은 이름의 W를 페이지 전역에도 심어 둔다
const W = () => window as any;

async function open(page: Page): Promise<void> {
  page.on("pageerror", (e) => console.log("pageerror:", e.message));
  await page.addInitScript(() => {
    (window as any).W = () => window;
  });
  await page.goto("/dev/runner.html");
  await page.waitForFunction(() => (window as any).__runner !== undefined);
  await page.evaluate(() => (window as any).__runner.init());
}

async function run(page: Page, code: string, stdin = "", timeoutMs?: number): Promise<RunOutput> {
  return page.evaluate(([c, s, t]) => W().__runner.run({ code: c, stdin: s, timeoutMs: t ?? undefined }), [
    code,
    stdin,
    timeoutMs ?? null,
  ] as const);
}

function stdinProblem(id: string, tests: { in: string; out: string }[], extra: Partial<Problem> = {}): Problem {
  return {
    id,
    regionId: "r1",
    title: id,
    kind: "stdin",
    enemy: { name: id, sprite: "slime", attack: 10 },
    requires: [],
    boss: false,
    concept: "c",
    timeLimitMs: 2000,
    estimatedMinutes: 1,
    tests: tests.map((t, i) => ({ ...t, public: i === 0 })),
    statement: "",
    starter: "",
    solution: "",
    explanation: "",
    hints: ["", "", ""],
    diagnoses: [],
    reward: { xp: 0, gold: 0 },
    ...extra,
  };
}

test.describe("Python 실행기", () => {
  test("cross-origin isolated, 부팅, 기준 측정", async ({ page }) => {
    await open(page);
    const info = await page.evaluate(() => ({
      coi: self.crossOriginIsolated,
      ready: W().__runner.isReady(),
      ref: W().__runner.referenceMs(),
      soft: W().__runner.softStop(),
    }));
    console.log("referenceMs =", info.ref.toFixed(1));
    expect(info.coi).toBe(true);
    expect(info.ready).toBe(true);
    expect(info.soft).toBe(true);
    expect(info.ref).toBeGreaterThan(0);
  });

  test("샘플 5문제: 모범답안 AC, 오답·비효율 답안은 §8.4와 같은 판정", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    const results = await page.evaluate(async () => {
      const { problems, answers } = W().__fixtures;
      const { diagnoseResult } = W().__python;
      const out: { pid: string; name: string; fails: Record<number, string>; expected: Record<number, string>; r: JudgeResult; diag?: string }[] = [];
      for (const pid of Object.keys(answers)) {
        for (const [name, ans] of Object.entries<any>(answers[pid])) {
          const r = await W().__runner.judge(problems[pid], ans.code, { scope: "all" });
          const fails = Object.fromEntries(
            r.tests.filter((t: any) => t.verdict !== "AC").map((t: any) => [t.index + 1, t.verdict]),
          );
          out.push({ pid, name, fails, expected: ans.fails, r, diag: diagnoseResult(problems[pid], r) });
        }
      }
      return out;
    });
    for (const x of results) {
      expect(x.fails, `${x.pid} ${x.name}`).toEqual(x.expected);
      expect(x.r.total).toBe(x.r.tests.length);
      expect(x.r.passed).toBe(x.r.total - Object.keys(x.expected).length);
      expect(x.r.fatal).toBe(false);
      if (x.name === "model") expect(x.r.verdict).toBe("AC");
      else expect(x.r.verdict).toBe(Object.values(x.expected)[0]);
    }
    const byKey = Object.fromEntries(results.map((x) => [`${x.pid}.${x.name}`, x]));
    // 오답 진단(fixture의 규칙)
    expect(byKey["P0101.wrongA"]!.diag).toContain("input()");
    expect(byKey["P0101.wrongB"]!.diag).toContain("float");
    expect(byKey["P0102.wrongA"]!.diag).toContain("실수를 돌려줘요");
    expect(byKey["P0102.wrongB"]!.diag).toContain("정밀도");
    expect(byKey["P0103.wrongB"]!.diag).toContain("정밀도");
    expect(byKey["P0104.wrongA"]!.diag).toContain("개행");
    expect(byKey["P0104.wrongB"]!.diag).toContain("곱하려고");
    expect(byKey["P0105.slow"]!.diag).toContain("느려요");
    expect(byKey["P0105.model"]!.diag).toBeUndefined();
    // P0104 오답 B의 RE는 사용자 줄 번호를 가진다
    const re = byKey["P0104.wrongB"]!.r.tests[0]!;
    expect(re.error?.type).toBe("TypeError");
    expect(re.error?.line).toBe(5);
    expect(re.error?.traceback).toContain('File "<주문>", line 5');
    expect(re.error?.traceback).not.toContain("pyrpg_judge");
    // 큰 정수는 repr 문자열로만 온다
    const big = byKey["P0103.model"]!.r.tests[6]!;
    expect(big.actual).toBe("333333333333333334");
    // 보스 비효율 답안: 시간 결계 테스트의 제한은 기준 단위로 계산된 작은 값
    const slow = byKey["P0105.slow"]!.r;
    console.log("P0105 slow limitMs =", slow.limitMs, "times =", slow.tests.map((t) => t.timeMs.toFixed(1)).join(", "));
    expect(slow.limitMs).toBeLessThan(1000);
    expect(slow.tests.map((t) => t.verdict)).toEqual(["AC", "AC", "AC", "TLE", "TLE", "AC"]);
    expect(slow.tests[3]!.error?.type).toBe("KeyboardInterrupt");
    expect(slow.tests[3]!.error?.line).toBe(4);
  });

  test("보스 시간 결계는 budgetUnits가 없어도 TLE 뒤 남은 테스트를 계속 채점한다", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const r = await page.evaluate(async (): Promise<{ boss: JudgeResult; normal: JudgeResult }> => {
      const base = W().__fixtures.problems.P0105;
      const slow = W().__fixtures.answers.P0105.slow.code;
      // budgetUnits 없음 → 일반 제한(timeLimitMs 150 → 300 ms 이상)을 쓰지만 시간 결계라서 멈추지 않는다
      const boss = { ...base, budgetUnits: undefined, timeLimitMs: 150 };
      // 보스가 아니면 일반 제한을 넘긴 뒤 남은 테스트는 같은 판정으로 건너뛴다
      const normal = { ...base, boss: false, phases: undefined, budgetUnits: undefined, timeLimitMs: 150 };
      return {
        boss: await W().__runner.judge(boss, slow, { scope: "all" }),
        normal: await W().__runner.judge(normal, slow, { scope: "all" }),
      };
    });
    expect(r.boss.tests.map((t) => t.verdict)).toEqual(["AC", "AC", "AC", "TLE", "TLE", "AC"]);
    expect(r.boss.tests[5]!.timeMs).toBeGreaterThan(0);
    expect(r.normal.tests.map((t) => t.verdict)).toEqual(["AC", "AC", "AC", "TLE", "TLE", "TLE"]);
    // 건너뛴 테스트는 실행하지 않았다
    expect(r.normal.tests[4]!.timeMs).toBe(0);
  });

  test("scope public과 phase 필터, onProgress", async ({ page }) => {
    await open(page);
    const r = await page.evaluate(async (): Promise<{ pub: JudgeResult; ph1: JudgeResult; ph2: JudgeResult; seen: number[] }> => {
      const p = W().__fixtures.problems.P0105;
      const code = W().__fixtures.answers.P0105.model.code;
      const seen: number[] = [];
      const pub = await W().__runner.judge(p, code, { scope: "public", onProgress: (t: any) => seen.push(t.index) });
      const ph2 = await W().__runner.judge(p, code, { scope: "all", phase: 2 });
      const ph1 = await W().__runner.judge(p, code, { scope: "all", phase: 1 });
      return { pub, ph2, ph1, seen };
    });
    expect(r.pub.total).toBe(1);
    expect(r.pub.tests[0]!.public).toBe(true);
    expect(r.seen).toEqual([0]);
    expect(r.ph2.tests.map((t) => t.index)).toEqual([3, 4, 5]);
    expect(r.ph2.verdict).toBe("AC");
    expect(r.ph1.tests.map((t) => t.index)).toEqual([0, 1, 2]);
    // 1페이즈는 일반 제한(넉넉함), 2페이즈는 시간 결계 제한
    expect(r.ph1.limitMs).toBeGreaterThan(r.ph2.limitMs);
  });

  test("run(): input()과 sys.stdin.readline, end='', 큰 정수, 에러 줄 번호", async ({ page }) => {
    await open(page);
    let r = await run(page, "a = input()\nb = input()\nprint(a + '|' + b)", "x y\nz\n");
    expect(r.stdout).toBe("x y|z\n");
    r = await run(page, "import sys\ninput = sys.stdin.readline\nn = int(input())\nprint(sum(map(int, input().split())) * n)", "2\n1 2 3\n");
    expect(r.stdout).toBe("12\n");
    r = await run(page, "import sys\ndata = sys.stdin.read().split()\nprint(len(data))\nprint(open(0).read() == '')", "1 2\n3\n");
    expect(r.stdout).toBe("3\nTrue\n");
    r = await run(page, "input()\ninput()", "only\n");
    expect(r.error?.type).toBe("EOFError");
    expect(r.error?.line).toBe(2);
    r = await run(page, "print(1, end='')\nprint(2, end='')\nprint('a', 'b', sep='-', end='!')");
    expect(r.stdout).toBe("12a-b!");
    r = await run(page, "print(10**18 + 10**18)\nprint(sum([10**18] * 10))\nprint(2**200)");
    expect(r.stdout).toBe(`2000000000000000000\n10000000000000000000\n${(2n ** 200n).toString()}\n`);
    r = await run(page, "x = 1\n\ny = x + 'a'\n");
    expect(r.error?.type).toBe("TypeError");
    expect(r.error?.line).toBe(3);
    expect(r.error?.message).toContain("unsupported operand");
    r = await run(page, "def f():\n    return 1 / 0\nprint(f())");
    expect(r.error?.line).toBe(2);
    expect(r.error?.traceback).toContain("line 3, in <module>");
    r = await run(page, "print('a'\n");
    expect(r.error?.type).toBe("SyntaxError");
    expect(r.error?.line).toBe(1);
    r = await run(page, "import sys\nprint('err', file=sys.stderr)\nprint('한글 출력')\nsys.exit(0)\nprint('x')");
    expect(r.stderr).toBe("err\n");
    expect(r.stdout).toBe("한글 출력\n");
    expect(r.error).toBeUndefined();
    const exp = await page.evaluate(
      (e) => W().__python.explainError(e, [{ exception: "TypeError", pattern: "unsupported operand", text: "구체" }, { exception: "TypeError", text: "기본" }]),
      { type: "TypeError", message: "unsupported operand type(s) for +: 'int' and 'str'", line: 3, traceback: "" },
    );
    expect(exp).toBe("3번째 줄: 구체");
  });

  test("테스트마다 전역 상태와 재귀 한도가 격리된다", async ({ page }) => {
    await open(page);
    const p = stdinProblem("ISO", [
      { in: "\n", out: "1 1000 4300\n" },
      { in: "\n", out: "1 1000 4300\n" },
      { in: "\n", out: "1 1000 4300\n" },
    ]);
    const code = [
      "import sys",
      "try:",
      "    counter",
      "except NameError:",
      "    counter = 0",
      "counter += 1",
      "print(counter, sys.getrecursionlimit(), sys.get_int_max_str_digits())",
      "sys.setrecursionlimit(5000)",
      "sys.set_int_max_str_digits(0)",
      "import math\nmath.pi = 3",
    ].join("\n");
    const r: JudgeResult = await page.evaluate(([pp, c]) => W().__runner.judge(pp, c, { scope: "all" }), [p, code] as const);
    expect(r.tests.map((t) => t.actual)).toEqual(["1 1000 4300\n", "1 1000 4300\n", "1 1000 4300\n"]);
    expect(r.verdict).toBe("AC");
  });

  test("sys.stdout.close()와 builtins 덮어쓰기가 다음 실행·테스트에 남지 않는다", async ({ page }) => {
    await open(page);
    // 출력 뒤 stdout을 닫는 코드(빠른 출력 관용구를 흉내 내다 생기는 실수)
    let r = await run(page, "import sys\nprint(1)\nsys.stdout.close()");
    expect(r.stdout).toBe("1\n");
    r = await run(page, "import sys\nprint('e', file=sys.stderr)\nsys.stderr.close()");
    expect(r.stderr).toBe("e\n");
    r = await run(page, "import sys\nprint(2)\nprint('e2', file=sys.stderr)");
    expect(r.error).toBeUndefined();
    expect(r.stdout).toBe("2\n");
    expect(r.stderr).toBe("e2\n");

    const p = stdinProblem("BUILTINS", [
      { in: "1 2\n", out: "3\n" },
      { in: "4 5\n", out: "9\n" },
    ]);
    const code = "import builtins\na, b = map(int, input().split())\nprint(a + b)\nbuiltins.input = lambda *x: '100 100'\nbuiltins.leak = 1";
    const j: JudgeResult = await page.evaluate(([pp, c]) => W().__runner.judge(pp, c, { scope: "all" }), [p, code] as const);
    expect(j.tests.map((t) => t.actual)).toEqual(["3\n", "9\n"]);
    r = await run(page, "print(input(), 'leak' in dir(__builtins__))", "hello\n");
    expect(r.stdout).toBe("hello False\n");
  });

  test("긴 Traceback은 가운데를 줄이고 마지막 에러 줄을 남긴다", async ({ page }) => {
    await open(page);
    // 서로 부르는 재귀는 같은 줄 반복이 아니라서 Traceback이 길어진다
    const r = await run(page, "def f(n):\n    return g(n + 1)\ndef g(n):\n    return f(n + 1)\nf(0)");
    expect(r.error?.type).toBe("RecursionError");
    expect(r.error!.traceback.length).toBeLessThanOrEqual(4100);
    expect(r.error!.traceback.startsWith("Traceback (most recent call last):")).toBe(true);
    expect(r.error!.traceback.trimEnd().endsWith("RecursionError: maximum recursion depth exceeded")).toBe(true);
  });

  test("except로 KeyboardInterrupt를 삼키는 무한 루프도 하드 중단으로 멈추고 복구한다", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const code = "while True:\n    try:\n        pass\n    except:\n        pass";
    const t0 = Date.now();
    const r = await run(page, code, "", 800);
    expect(r.timedOut).toBe(true);
    expect(Date.now() - t0).toBeLessThan(800 + 1000 + 1500);
    expect((await run(page, "print('alive')")).stdout).toBe("alive\n");
    // 삼킨 뒤 정답을 출력하고 끝내도 제한을 넘겼으면 TLE
    const p = stdinProblem("SWALLOW", [{ in: "\n", out: "1\n" }], { timeLimitMs: 100 });
    const late = "import time\ntry:\n    while True:\n        pass\nexcept BaseException:\n    pass\nprint(1)";
    const j: JudgeResult = await page.evaluate(([pp, c]) => W().__runner.judge(pp, c, { scope: "all" }), [p, late] as const);
    expect(j.verdict).toBe("TLE");
  });

  test("while True: pass → 소프트 중단으로 빠르게 TLE, 다음 실행 정상", async ({ page }) => {
    await open(page);
    const before = await page.evaluate(() => W().__runner.restarts());
    const t0 = Date.now();
    const r = await run(page, "x = 0\nwhile True:\n    x += 1", "", 800);
    const elapsed = Date.now() - t0;
    expect(r.timedOut).toBe(true);
    expect(r.fatal).toBe(false);
    expect(r.error?.type).toBe("KeyboardInterrupt");
    expect(r.error?.line).toBeGreaterThanOrEqual(2);
    expect(elapsed).toBeLessThan(1700);
    // 소프트 중단은 워커를 재사용한다
    expect(await page.evaluate(() => W().__runner.restarts())).toBe(before);
    const next = await run(page, "print(1 + 1)");
    expect(next.stdout).toBe("2\n");
    expect(next.timedOut).toBe(false);

    // 채점: 일반 제한을 넘긴 뒤 남은 테스트는 건너뛴다
    const p = stdinProblem("LOOP", [
      { in: "\n", out: "1\n" },
      { in: "\n", out: "1\n" },
      { in: "\n", out: "1\n" },
    ], { timeLimitMs: 200 });
    const t1 = Date.now();
    const j: JudgeResult = await page.evaluate((pp) => W().__runner.judge(pp, "while True: pass", { scope: "all" }), p);
    expect(j.verdict).toBe("TLE");
    expect(j.tests.map((t) => t.verdict)).toEqual(["TLE", "TLE", "TLE"]);
    expect(j.passed).toBe(0);
    expect(Date.now() - t1).toBeLessThan(j.limitMs + 1500);
    const ok: JudgeResult = await page.evaluate((pp) => W().__runner.judge(pp, "print(1)", { scope: "all" }), p);
    expect(ok.verdict).toBe("AC");
  });

  test("하드 중단 모드(terminate)도 복구한다", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const r = await page.evaluate(async () => {
      const hard = W().__createRunner({ stopMode: "hard" });
      await hard.init();
      const soft = hard.softStop();
      const t0 = performance.now();
      const loop = await hard.run({ code: "while True: pass", timeoutMs: 800 });
      const loopMs = performance.now() - t0;
      const restarts = hard.restarts();
      const next = await hard.run({ code: "print(sum(range(10)))" });
      const p = W().__fixtures.problems.P0105;
      const slow = await hard.judge(p, W().__fixtures.answers.P0105.slow.code, { scope: "all", phase: 2 });
      hard.dispose();
      return { soft, loop, loopMs, restarts, next, slow };
    });
    expect(r.soft).toBe(false);
    expect(r.loop.timedOut).toBe(true);
    expect(r.loop.error?.type).toBe("KeyboardInterrupt");
    expect(r.loopMs).toBeLessThan(1500);
    expect(r.restarts).toBe(1);
    expect(r.next.stdout).toBe("45\n");
    expect(r.slow.tests.map((t: any) => t.verdict)).toEqual(["TLE", "TLE", "AC"]);
  });

  test("깊은 @lru_cache 재귀 → fatal 감지, 워커 재생성, 다음 실행 정상", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const deep = [
      "import sys",
      "from functools import lru_cache",
      "sys.setrecursionlimit(10**6)",
      "@lru_cache(maxsize=None)",
      "def f(n):",
      "    return 0 if n == 0 else f(n - 1) + 1",
      "print(f(2000))",
    ].join("\n");
    const before = await page.evaluate(() => W().__runner.restarts());
    const r = await run(page, deep);
    expect(r.fatal).toBe(true);
    expect(r.error?.type).toBe("RecursionError");
    const explained = await page.evaluate((e) => W().__python.explainError(e, []), r.error!);
    expect(explained).toContain("재귀");
    expect(await page.evaluate(() => W().__runner.restarts())).toBe(before + 1);
    const next = await run(page, "print('alive')");
    expect(next.stdout).toBe("alive\n");
    expect(next.fatal).toBe(false);

    // 채점 중 fatal: 결과에 fatal 표시, 남은 테스트는 건너뛰고, 다음 채점은 정상
    const p = stdinProblem("FATAL", [
      { in: "\n", out: "2000\n" },
      { in: "\n", out: "2000\n" },
    ]);
    const j: JudgeResult = await page.evaluate(([pp, c]) => W().__runner.judge(pp, c, { scope: "all" }), [p, deep] as const);
    expect(j.fatal).toBe(true);
    expect(j.verdict).toBe("RE");
    expect(j.tests.map((t) => t.verdict)).toEqual(["RE", "RE"]);
    const ok: JudgeResult = await page.evaluate((pp) => W().__runner.judge(pp, "print(2000)", { scope: "all" }), p);
    expect(ok.verdict).toBe("AC");
    expect(ok.fatal).toBe(false);
  });

  test("무한 출력은 1 MB에서 자르고, os._exit도 워커 재생성으로 복구", async ({ page }) => {
    test.setTimeout(120_000);
    await open(page);
    const flood = await run(page, "i = 0\nwhile True:\n    print(i)\n    i += 1", "", 1500);
    expect(flood.timedOut).toBe(true);
    expect(flood.stdout.length).toBeLessThan((1 << 20) + 100);
    expect(flood.stdout).toContain("출력이 너무 길어서");
    const exit = await run(page, "import os\nos._exit(0)");
    expect(exit.fatal).toBe(true);
    expect(exit.error?.type).toBe("FatalError");
    const next = await run(page, "print('ok')");
    expect(next.stdout).toBe("ok\n");
  });
});
