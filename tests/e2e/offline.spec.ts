import { expect, test } from "@playwright/test";

// design.md §12.3 오프라인: 한 번 접속한 뒤에는 네트워크 없이 새로고침해도 게임이 뜨고 채점된다(service worker)
test("오프라인 새로고침과 워커 재생성", async ({ page, context }) => {
  test.setTimeout(180_000);
  const ready = () => page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });

  await page.goto("/?e2e");
  await ready();
  // service worker가 페이지를 제어하고 Pyodide를 캐시에 넣을 때까지 기다린 뒤, 앱 파일도 캐시되도록 한 번 더 연다
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await ready();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(() => (window as any).__pyrpg.runner.init());

  await context.setOffline(true);
  try {
    await page.reload();
    await ready();
    expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
    const run = (code: string) => page.evaluate((c) => (window as any).__pyrpg.runner.run({ code: c }), code);
    await page.evaluate(() => (window as any).__pyrpg.runner.init());
    expect((await run("print(6 * 7)")).stdout).toBe("42\n");

    // fatal 뒤 워커를 새로 만들 때도 캐시에서 Pyodide를 다시 읽는다
    const deep = "import sys\nfrom functools import lru_cache\nsys.setrecursionlimit(10**6)\n@lru_cache(maxsize=None)\ndef f(n):\n    return 0 if n == 0 else f(n - 1) + 1\nprint(f(2000))";
    expect((await run(deep)).fatal).toBe(true);
    expect((await run("print('alive')")).stdout).toBe("alive\n");
  } finally {
    await context.setOffline(false);
  }
});
