import { expect, test } from "@playwright/test";

test("page boots cross-origin isolated", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true);
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
});

test("pyodide core files are served", async ({ request }) => {
  for (const f of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
    const r = await request.get(`/pyodide/${f}`);
    expect(r.status(), f).toBe(200);
  }
});
