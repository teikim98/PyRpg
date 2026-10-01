import { expect, test } from "@playwright/test";

// 저장 계층(src/state)을 실제 IndexedDB로 확인한다. 페이지: dev/state.html
const ready = async (page: import("@playwright/test").Page) => {
  await page.goto("/dev/state.html");
  await page.waitForFunction(() => document.getElementById("out")?.textContent === "ready");
};

test("IndexedDB 저장 → 새로고침 → 복원, 내보내기/불러오기 왕복", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as any).__stateHarness.clear());
  expect(await page.evaluate(() => (window as any).__stateHarness.load())).toBeNull();

  const saved = await page.evaluate(async () => {
    const h = (window as any).__stateHarness;
    return h.save(h.win(h.newSave()));
  });
  expect(saved.player.xp).toBe(75);
  expect(saved.shadows).toHaveLength(1);

  await page.reload();
  await page.waitForFunction(() => document.getElementById("out")?.textContent === "ready");
  const loaded = await page.evaluate(() => (window as any).__stateHarness.load());
  expect(loaded).toEqual(saved);

  // 내보내기 → 초기화 → 불러오기 → 같은 상태
  const restored = await page.evaluate(async () => {
    const h = (window as any).__stateHarness;
    const data = await h.load();
    const { text, filename } = h.exportSave(data);
    await h.clear();
    const empty = await h.load();
    await h.autosaveFlush(h.importSave(text));
    return { empty, filename, after: await h.load() };
  });
  expect(restored.empty).toBeNull();
  expect(restored.filename).toMatch(/^pyrpg-save-\d{8}-\d{4}\.json$/);
  expect({ ...restored.after, updatedAt: "" }).toEqual({ ...saved, updatedAt: "" });

  expect(typeof (await page.evaluate(() => (window as any).__stateHarness.persist()))).toBe("boolean");
});

test("손상된 저장 데이터는 corrupt 오류", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as any).__stateHarness.putRaw({ version: 1, player: "x" }));
  const err = await page.evaluate(() => (window as any).__stateHarness.loadError());
  expect(err).toMatchObject({ name: "SaveStoreError", code: "corrupt" });
  expect(err.issues.length).toBeGreaterThan(0);
  await page.evaluate(() => (window as any).__stateHarness.clear());
});
