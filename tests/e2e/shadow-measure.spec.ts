// 칸 3 이상 보스 그림자의 2페이즈 대기 시간 측정(design.md §7.6 보스 그림자, 결정 23 P-E11, 단위 3-E2).
// 평소 전체 E2E에서는 건너뛴다. 다른 Playwright가 돌지 않을 때 단독으로:
//
//   PYRPG_MEASURE_SHADOW=1 PW_PORT=4310 npx playwright test tests/e2e/shadow-measure.spec.ts
//
// 보스마다 칸 3 그림자 문제(변형 1페이즈 + 원래 2페이즈)를 만들어 실제 Pyodide로
// (a) 첫 시전(2페이즈 입력 생성 포함) (b) 두 번째 시전(생성 캐시 사용) (c) slow.py 시전의 벽시계 시간을 잰다.
// 측정마다 새 페이지(새 실행기, 빈 생성 캐시)에서 3번 재고 중앙값을 쓴다.
// 제외 기준(P-E11): (a) 20초, (b) 10초, (c) 15초 가운데 하나라도 넘으면 SHADOW_PHASE2_EXCLUDE에 넣는다.
import { expect, test, type Browser } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const RUNS = 3;
const LIMITS = { first: 20_000, second: 10_000, slow: 15_000 };

interface Sample {
  first: number;
  second: number;
  slow: number;
  firstVerdicts: string;
  secondVerdicts: string;
  slowVerdicts: string;
}

async function measureOnce(browser: Browser, pid: string): Promise<Sample> {
  const page = await browser.newPage();
  try {
    page.on("pageerror", (e) => console.log("pageerror:", e.message));
    await page.goto("/dev/content.html");
    await page.waitForFunction(() => (window as any).__runner !== undefined && (window as any).__shadow !== undefined);
    await page.evaluate(() => (window as any).__runner.init());
    return await page.evaluate(async (id: string) => {
      const W = window as any;
      const original = W.__content.regions.flatMap((r: any) => r.problems).find((p: any) => p.id === id);
      const p = W.__shadow.shadowProblem(original, [], { twoPhase: true, anonymous: true });
      const slowCode: string = W.__py[id]["slow.py"];
      const verdicts = (r: any) => r.tests.map((t: any) => t.verdict).join(" ");
      const cast = async (code: string) => {
        const t0 = performance.now();
        const r = await W.__runner.judge(p, code, { scope: "all", phase: 2 });
        return { ms: performance.now() - t0, v: verdicts(r) };
      };
      const a = await cast(original.solution);
      const b = await cast(original.solution);
      const c = await cast(slowCode);
      return { first: a.ms, second: b.ms, slow: c.ms, firstVerdicts: a.v, secondVerdicts: b.v, slowVerdicts: c.v };
    }, pid);
  } finally {
    await page.close();
  }
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

test("보스 그림자 2페이즈 대기 시간(P-E11)", async ({ browser }) => {
  test.skip(!process.env.PYRPG_MEASURE_SHADOW, "PYRPG_MEASURE_SHADOW=1일 때만 잰다");
  test.setTimeout(60 * 60_000);
  const page = await browser.newPage();
  await page.goto("/dev/content.html");
  await page.waitForFunction(() => (window as any).__content !== undefined);
  const bosses: string[] = await page.evaluate(() =>
    (window as any).__content.regions.flatMap((r: any) => r.problems).filter((p: any) => p.boss).map((p: any) => p.id),
  );
  await page.close();
  const started = new Date();
  const samples: Record<string, Sample[]> = {};
  // 같은 보스를 연달아 재지 않게 바깥 고리를 반복 횟수로 둔다
  for (let k = 0; k < RUNS; k++) {
    for (const pid of bosses) {
      const s = await measureOnce(browser, pid);
      (samples[pid] ??= []).push(s);
      console.log(`${pid} #${k + 1}: 첫 ${Math.round(s.first)} ms [${s.firstVerdicts}] / 두 번째 ${Math.round(s.second)} ms [${s.secondVerdicts}] / slow ${Math.round(s.slow)} ms [${s.slowVerdicts}]`);
    }
  }
  const rows = bosses.map((pid) => {
    const xs = samples[pid]!;
    const m = { first: median(xs.map((x) => x.first)), second: median(xs.map((x) => x.second)), slow: median(xs.map((x) => x.slow)) };
    const exclude = m.first > LIMITS.first || m.second > LIMITS.second || m.slow > LIMITS.slow;
    return { pid, ...m, exclude, solutionAc: xs.every((x) => /^(AC ?)+$/.test(x.firstVerdicts) && /^(AC ?)+$/.test(x.secondVerdicts)), slowTle: xs.every((x) => x.slowVerdicts.includes("TLE")) };
  });
  const s = (ms: number) => (ms / 1000).toFixed(1);
  console.log(
    [
      "",
      `측정 시작 ${started.toISOString()}, 끝 ${new Date().toISOString()}, 페이지마다 ${RUNS}번의 중앙값(초)`,
      "| 보스 | 첫 시전(생성 포함) | 두 번째 시전 | slow.py 시전 | 결정 |",
      "|---|---|---|---|---|",
      ...rows.map((r) => `| ${r.pid} | ${s(r.first)} | ${s(r.second)} | ${s(r.slow)} | ${r.exclude ? "제외(1페이즈만)" : "2페이즈 포함"} |`),
      `SHADOW_PHASE2_EXCLUDE = [${rows.filter((r) => r.exclude).map((r) => `"${r.pid}"`).join(", ")}]`,
    ].join("\n"),
  );
  // 측정이 뜻을 가지려면 모범답안은 AC, slow.py는 TLE여야 한다
  for (const r of rows) {
    expect.soft(r.solutionAc, `${r.pid} 모범답안 AC`).toBe(true);
    expect.soft(r.slowTle, `${r.pid} slow.py TLE`).toBe(true);
  }
});
