// Phase 2 버그 점검에서 찾은 문제의 회귀 테스트(실제 게임 /?e2e, 실제 키 입력).
// PW_PORT=4182 npx playwright test tests/e2e/bugfix.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const where = (page: Page) => page.evaluate(() => (window as any).__pyrpg.where()) as Promise<{ x: number; y: number; facing: Facing; busy: boolean; modal: boolean }>;
const save = (page: Page) => page.evaluate(() => (window as any).__pyrpg.state().save);
const said = (page: Page) => page.evaluate(() => [...(window as any).__pyrpg.said]) as Promise<string[]>;
const obj = (page: Page, id: string) =>
  page.evaluate((id) => (window as any).__pyrpg.objects().find((o: any) => o.id === id), id) as Promise<{ id: string; x: number; y: number; removed: boolean }>;
const ready = (page: Page) => page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });

async function boot(page: Page, fresh = true): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?e2e");
  await ready(page);
  if (fresh) {
    // 다른 테스트가 남긴 저장을 지우고 새 게임으로
    await page.evaluate(() => (window as any).__pyrpg.store.clear());
    await page.reload();
    await ready(page);
  }
}

async function settle(page: Page, until?: string, timeout = 60_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let idleSince = 0;
  while (Date.now() < deadline) {
    if (until && (await page.locator(until).count())) return;
    if (await page.locator(".dlg-modal").count()) {
      await page.keyboard.press("Space");
      idleSince = 0;
      continue;
    }
    const w = await where(page);
    if (!until && !w.busy && !w.modal) {
      if (!idleSince) idleSince = Date.now();
      else if (Date.now() - idleSince > 250) return;
    } else idleSince = 0;
    await page.waitForTimeout(40);
  }
  throw new Error(`settle timeout (until=${until})`);
}

async function seedAndReload(page: Page, seed: Record<string, unknown>): Promise<void> {
  await settle(page);
  await page.evaluate((s) => (window as any).__pyrpg.seed(s), seed);
  await page.reload();
  await ready(page);
  await settle(page);
}

async function walkTo(page: Page, x: number, y: number): Promise<void> {
  for (let i = 0; i < 400; i++) {
    await settle(page);
    const path: Facing[] | null = await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [x, y]);
    if (!path) throw new Error(`no path to ${x},${y}`);
    if (path.length === 0) return;
    const b = await where(page);
    await page.keyboard.press(KEY[path[0]]);
    await page.waitForFunction(
      ([bx, by]) => {
        const w = (window as any).__pyrpg.where();
        return w.x !== bx || w.y !== by || w.busy;
      },
      [b.x, b.y],
    );
  }
}

async function bump(page: Page, id: string): Promise<void> {
  const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), id);
  await walkTo(page, a.end.x, a.end.y);
  await page.keyboard.press(KEY[a.face as Facing]);
}

const editorText = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll(".battle-editor .cm-line"), (l) => l.textContent ?? "").join("\n"));

async function typeCode(page: Page, text: string): Promise<void> {
  await page.locator(".battle-editor .cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
  await expect.poll(() => editorText(page)).toBe(text);
}

async function cast(page: Page): Promise<void> {
  await expect(page.locator(".act-cast")).toBeEnabled({ timeout: 60_000 });
  await page.locator(".act-cast").click();
  await page.waitForFunction(
    () => {
      const root = document.querySelector(".battle");
      const banner = document.querySelector(".battle-banner") as HTMLElement | null;
      return !root || (banner && !banner.hidden) || !root.classList.contains("is-busy");
    },
    null,
    { timeout: 90_000 },
  );
}

async function readSlot(page: Page): Promise<any> {
  return page.evaluate(
    () =>
      new Promise((res, rej) => {
        const r = indexedDB.open("pyrpg");
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
          const g = r.result.transaction("saves").objectStore("saves").get("slot1");
          g.onsuccess = () => {
            r.result.close();
            res(g.result ?? null);
          };
        };
      }),
  );
}

async function writeSlot(page: Page, value: unknown): Promise<void> {
  await page.evaluate(
    (v) =>
      new Promise<void>((res, rej) => {
        const r = indexedDB.open("pyrpg");
        r.onsuccess = () => {
          const tx = r.result.transaction("saves", "readwrite");
          tx.objectStore("saves").put(v, "slot1");
          tx.oncomplete = () => {
            r.result.close();
            res();
          };
          tx.onerror = () => rej(tx.error);
        };
      }),
    value,
  );
}

test("이동 도중 메뉴를 열어도 밟은 칸의 트리거(프롤로그·누리 합류)가 메뉴를 닫은 뒤 발동한다", async ({ page }) => {
  await boot(page);
  await settle(page);
  const t = await obj(page, "t_prologue");
  // 한 칸 이동(135ms)이 끝나기 전에 메뉴를 연다
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu-modal")).toBeVisible();
  await page.waitForTimeout(400);
  expect(await where(page)).toMatchObject({ x: t.x, y: t.y });
  await page.keyboard.press("Escape");
  await expect(page.locator(".menu-modal")).toHaveCount(0);
  await settle(page);
  expect(await said(page)).toContain("prologue");
  const s = await save(page);
  expect(s.flags["trigger.r01.t_prologue"]).toBe(true);
  expect(s.flags["companion.joined"]).toBe(true);
});

test("트리거 대사 도중에 새로고침하면 다시 시작할 때 그 대사가 나온다", async ({ page }) => {
  await boot(page);
  await settle(page);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".dlg-modal")).toBeVisible();
  // 이동 뒤 자동 저장(800ms)이 대사 도중에 끝나게 기다린다
  await page.waitForTimeout(1500);
  await page.reload();
  await ready(page);
  await settle(page);
  expect(await said(page)).toContain("prologue");
  const s = await save(page);
  expect(s.flags["companion.joined"]).toBe(true);
});

test("읽지 못하는 저장 데이터(더 새로운 버전)는 새 게임으로 덮어쓰지 않는다", async ({ page }) => {
  await boot(page);
  await settle(page);
  const s = await save(page);
  s.version = 2;
  s.player.xp = 777;
  await writeSlot(page, s);
  await page.reload();
  await ready(page);
  await expect(page.locator(".ui-toast-layer")).toContainText("저장하지 않아");
  await settle(page);
  // 게임은 새로 시작하지만 원래 데이터는 그대로 남는다(걸어 다녀도)
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await page.waitForTimeout(1200);
  const slot = await readSlot(page);
  expect(slot.version).toBe(2);
  expect(slot.player.xp).toBe(777);
  await page.evaluate(() => (window as any).__pyrpg.store.clear());
});

test("IndexedDB를 쓸 수 없어도 게임은 시작한다", async ({ page }) => {
  await page.addInitScript(() => {
    (IDBFactory.prototype as any).open = function () {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/?e2e");
  await ready(page);
  await settle(page);
  await page.keyboard.press("ArrowDown");
  await settle(page);
  expect((await save(page)).flags["trigger.r01.t_prologue"]).toBe(true);
});

test("처음부터를 누른 뒤 새로고침이 끝나기 전에 움직여도 옛 저장이 되살아나지 않는다", async ({ browser }) => {
  // 새로고침 응답을 늦추려면 service worker를 거치지 않아야 한다
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await boot(page);
  await settle(page);
  await page.keyboard.press("ArrowDown");
  await settle(page);
  await page.keyboard.press("ArrowRight");
  await settle(page);
  await page.waitForTimeout(1200);
  expect((await readSlot(page)).flags["trigger.r01.t_prologue"]).toBe(true);
  let delayed = false;
  await page.route("**/?e2e", async (route) => {
    if (!delayed) {
      delayed = true;
      await new Promise((r) => setTimeout(r, 2000));
    }
    await route.continue();
  });
  await page.keyboard.press("Escape");
  await page.locator(".menu-reset").click();
  await page.locator(".confirm-yes").click();
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowLeft").catch(() => undefined);
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight").catch(() => undefined);
  await ready(page);
  await page.waitForTimeout(300);
  const s = await save(page);
  expect(s.flags["trigger.r01.t_prologue"]).toBeUndefined();
  const spawn = await obj(page, "spawn");
  expect(s.location).toMatchObject({ x: spawn.x, y: spawn.y });
  await context.close();
});

test("전투 도중 새로고침해도 힌트 대가·HP·그림자 등록이 남는다", async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await settle(page);
  const gate = await obj(page, "gate_well");
  await seedAndReload(page, { lessons: ["L1-1", "L1-2"], removed: ["gate_well"], at: { x: gate.x, y: gate.y - 1 }, flags: ["trigger.r01.t_prologue"] });
  const maxHp = (await save(page)).player.hp;
  await bump(page, "m_P0101");
  await settle(page, ".battle-modal");
  const wrong = readFileSync("content/regions/r01-echo-village/problems/P0101/wrong_a.py", "utf8");
  await typeCode(page, wrong);
  await cast(page);
  await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 20}/${maxHp}`);
  // 2단계 힌트(보상 −25%, 그림자 등록)
  await page.locator(".act-hint-1").click();
  await page.locator(".act-hint-2").click();
  await page.locator(".confirm-yes").click();
  await page.waitForTimeout(500);
  await page.reload();
  await ready(page);
  await settle(page);
  const s = await save(page);
  expect(s.problems.P0101).toMatchObject({ maxHintLevel: 2, attempts: 1, solved: false });
  expect(s.player.hp).toBe(maxHp - 20);
  expect(s.shadows.map((x: any) => x.concept)).toContain("scroll.convert");
  // 다시 싸워 이겨도 2단계 힌트 대가가 적용된다
  await bump(page, "m_P0101");
  await settle(page, ".battle-modal");
  await typeCode(page, readFileSync("content/regions/r01-echo-village/problems/P0101/solution.py", "utf8"));
  await cast(page);
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  await expect(page.locator(".reward-xp .reward-value")).toHaveText("+75 XP");
  await page.locator(".reward-ok").click();
  await settle(page);
});

test("막힌 칸(맵 밖 숲)에 저장된 위치로 불러와도 갇히지 않는다", async ({ page }) => {
  await boot(page);
  await settle(page);
  await seedAndReload(page, { at: { x: 0, y: 0 }, flags: ["trigger.r01.t_prologue"] });
  const w = await where(page);
  expect({ x: w.x, y: w.y }).not.toEqual({ x: 0, y: 0 });
  // 가장 가까운 빈 칸은 아직 열지 않은 광장일 수 있으므로 마지막 캠프파이어(새 게임은 시작 지점)로 간다
  const spawn = await obj(page, "spawn");
  expect({ x: w.x, y: w.y }).toEqual({ x: spawn.x, y: spawn.y });
  expect((await save(page)).location).toMatchObject({ x: w.x, y: w.y });
});

async function offlineCheck(browser: Browser, visits: number): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("/?e2e");
    await ready(page);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    for (let i = 1; i < visits; i++) {
      await page.reload();
      await ready(page);
    }
    // service worker가 받은 파일 목록을 캐시할 시간
    await page.waitForTimeout(3000);
    await context.setOffline(true);
    await page.reload();
    await ready(page);
    // 지형·스프라이트 PNG를 실제로 읽었다(존재 확인 HEAD가 실패하면 자리 표시 그림으로 바뀐다)
    const loaded = await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((e) => /\/(sprites|tiles)\/.+\.png$/.test(e.name) && (e as any).responseStatus === 200 && (e as any).initiatorType !== "fetch").length,
    );
    expect(loaded).toBeGreaterThan(5);
  } finally {
    await context.close();
  }
}

test("오프라인: 한 번만 접속한 뒤에도 게임이 뜨고, 도트 그림을 캐시에서 읽는다", async ({ browser }) => {
  test.setTimeout(120_000);
  await offlineCheck(browser, 1);
});

test("오프라인: 두 번 접속한 뒤 새로고침해도 도트 그림을 캐시에서 읽는다", async ({ browser }) => {
  test.setTimeout(120_000);
  await offlineCheck(browser, 2);
});
