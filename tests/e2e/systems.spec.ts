// 시스템 화면 E2E(단위 3-1, design.md §7.2~§7.6): 실제 게임(/?e2e)에서 실제 키·클릭으로
// 그림자 게시판 → 그림자전, 일일 퀘스트와 상자, 상점, 장비(망토·깃털), 칭호를 확인한다.
// PW_PORT=4194 npx playwright test tests/e2e/systems.spec.ts
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const PROBLEMS = "content/regions/r01-echo-village/problems";
const solution = (pid: string) => readFileSync(`${PROBLEMS}/${pid}/solution.py`, "utf8");

const SCREENS = "docs/phase3/screens";
mkdirSync(SCREENS, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SCREENS}/${name}` });
}

const where = (page: Page) => page.evaluate(() => (window as any).__pyrpg.where()) as Promise<{ x: number; y: number; facing: Facing; busy: boolean; modal: boolean }>;
const save = (page: Page) => page.evaluate(() => (window as any).__pyrpg.state().save);
const obj = (page: Page, id: string) =>
  page.evaluate((id) => (window as any).__pyrpg.objects().find((o: any) => o.id === id), id) as Promise<{ id: string; x: number; y: number; removed: boolean }>;

/** 기기 시간으로 어제(새벽 4시 경계) */
function yesterday(): string {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?e2e");
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
}

async function seedAndReload(page: Page, seed: Record<string, unknown>): Promise<void> {
  await settle(page);
  await page.evaluate((s) => (window as any).__pyrpg.seed(s), seed);
  await page.reload();
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
  await settle(page);
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
      else if (Date.now() - idleSince > 150) return;
    } else idleSince = 0;
    await page.waitForTimeout(40);
  }
  throw new Error(`settle timeout (until=${until})`);
}

async function step(page: Page, dir: Facing): Promise<void> {
  const b = await where(page);
  await page.keyboard.press(KEY[dir]);
  await page.waitForFunction(
    ([bx, by]) => {
      const w = (window as any).__pyrpg.where();
      return w.x !== bx || w.y !== by || w.busy;
    },
    [b.x, b.y],
    { timeout: 5_000 },
  );
}

async function walkTo(page: Page, x: number, y: number): Promise<void> {
  for (let i = 0; i < 400; i++) {
    await settle(page);
    const path: Facing[] | null = await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [x, y]);
    if (!path) throw new Error(`no path to ${x},${y}`);
    if (path.length === 0) return;
    await step(page, path[0]);
  }
  throw new Error("walkTo: too many steps");
}

async function approach(page: Page, id: string): Promise<Facing> {
  const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), id);
  if (!a) throw new Error(`cannot approach ${id}`);
  await walkTo(page, a.end.x, a.end.y);
  return a.face;
}

async function interact(page: Page, id: string): Promise<void> {
  const dir = await approach(page, id);
  await page.keyboard.press(KEY[dir]);
  await page.waitForFunction((d) => (window as any).__pyrpg.where().facing === d, dir);
  await page.keyboard.press("Space");
}

async function bump(page: Page, id: string): Promise<void> {
  const dir = await approach(page, id);
  await page.keyboard.press(KEY[dir]);
}

const editor = (page: Page) => page.locator(".battle-editor .cm-content");
const editorText = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll(".battle-editor .cm-line"), (l) => l.textContent ?? "").join("\n"));

async function typeCode(page: Page, text: string): Promise<void> {
  await editor(page).click();
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

/** 승리 배너 → 보상 창까지. 보상 창의 XP 문구를 돌려준다 */
async function winWith(page: Page, code: string): Promise<string> {
  await typeCode(page, code);
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  const xp = (await page.locator(".reward-xp .reward-value").textContent()) ?? "";
  await page.locator(".reward-ok").click();
  await settle(page);
  return xp;
}

async function openMenu(page: Page, item: string, modal: string): Promise<void> {
  await settle(page);
  await page.keyboard.press("KeyM");
  await expect(page.locator(".menu-modal")).toBeVisible();
  await page.locator(item).click();
  await expect(page.locator(modal)).toBeVisible();
}

async function closeAll(page: Page): Promise<void> {
  for (let i = 0; i < 4 && (await page.locator(".ui-modal").count()); i++) await page.keyboard.press("Escape");
  await settle(page);
}

test.describe.serial("시스템 화면(단위 3-1)", () => {
  test("그림자 게시판 → 그림자전 AC: 칸 상승·보상 50%, 일일 퀘스트 3개 완료와 상자", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2"],
      removed: ["gate_well", "m_P0101"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
      patch: {
        shadows: [{ concept: "scroll.convert", problemId: "P0101", box: 2, due: yesterday(), purified: false, createdAt: "2026-09-01T00:00:00.000Z" }],
        quests: { date: "today", ids: ["shadow-1", "rest-1", "win-nohint-1"], progress: [0, 0, 0], claimed: [false, false, false], chest: false },
      },
    });
    const before = await save(page);
    await expect(page.locator(".hud-quests")).toHaveText("퀘스트 0/3");

    // 게시판: 오늘의 그림자 1마리(칸 2), 퀘스트, 스트릭
    const dir = await approach(page, "board_shadow");
    await shot(page, "systems-map-board.png");
    await page.keyboard.press(KEY[dir]);
    await page.waitForFunction((d) => (window as any).__pyrpg.where().facing === d, dir);
    await page.keyboard.press("Space");
    await settle(page, ".board-modal");
    await expect(page.locator(".shadow-card")).toHaveCount(1);
    await expect(page.locator(".shadow-card")).toContainText("칸 2");
    await expect(page.locator(".shadow-card")).toContainText("7일 뒤");
    await expect(page.locator(".quest-item")).toHaveCount(3);
    await expect(page.locator(".streak-week")).toContainText("이번 주");
    await expect(page.locator(".quest-chest")).toContainText("금화 50");
    await shot(page, "systems-board.png");

    // 그림자전: 변형(있으면) 또는 원래 문제. 원래 문제의 모범답안이 변형도 통과한다(plan §5.1)
    await page.locator(".board-fight").click();
    await settle(page, ".battle-modal");
    await expect(page.locator(".battle.is-shadow")).toBeVisible();
    expect(await page.locator(".battle").getAttribute("data-problem")).toMatch(/^P0101(-v\d+)?$/);
    await expect(page.locator(".enemy-name")).toContainText("그림자");
    await expect(page.locator(".act-solution")).toBeHidden();
    await shot(page, "systems-shadow-battle.png");
    expect(await winWith(page, solution("P0101"))).toBe("+50 XP");

    let s = await save(page);
    expect(s.shadows[0].box).toBe(3);
    expect(s.history.at(-1)).toMatchObject({ shadow: true, concept: "scroll.convert", grade: "easy" });
    // 그림자 50% + 퀘스트 30
    expect(s.player.xp).toBe(before.player.xp + 50 + 30);
    expect(s.quests.claimed).toEqual([true, false, false]);
    await expect(page.locator(".hud-quests")).toHaveText("퀘스트 1/3");

    // 캠프파이어에서 쉬기
    await interact(page, "campfire_plaza");
    await settle(page);
    // 힌트 없이 전투 1개(P0106)
    await bump(page, "m_P0106");
    await settle(page, ".battle-modal");
    expect(await winWith(page, solution("P0106"))).toBe("+100 XP");
    s = await save(page);
    expect(s.quests.claimed).toEqual([true, true, true]);
    expect(s.quests.chest).toBe(true);
    expect(s.inventory.potion).toBe(1);
    expect(s.player.gold).toBe(before.player.gold + 25 + 50 + 3 * 20 + 50);
    await expect(page.locator(".hud-quests")).toHaveText("퀘스트 3/3");
    await expect(page.locator(".toast", { hasText: "모두 끝냈어" })).toBeVisible();

    // 메뉴의 퀘스트: 다 끝낸 목록과 받은 상자
    await openMenu(page, ".menu-quests", ".quests-modal");
    await expect(page.locator(".quest-item.is-done")).toHaveCount(3);
    await expect(page.locator(".quest-chest.is-claimed")).toBeVisible();
    await shot(page, "systems-quests.png");
    await closeAll(page);

    // 새로고침해도 남는다
    await page.reload();
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    expect((await save(page)).shadows[0].box).toBe(3);
    await expect(page.locator(".hud-quests")).toHaveText("퀘스트 3/3");
  });

  test("상점에서 사고, 장비에서 망토·깃털을 끼고(힌트 2 무료), 칭호를 단다", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    const cur = await save(page);
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2", "L1-3"],
      removed: ["gate_well", "m_P0101", "m_P0106"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
      patch: {
        player: { ...cur.player, gold: 500, hp: 100 },
        inventory: { "guide-feather": 1, potion: 1 },
      },
    });
    // 이미 이룬 칭호(첫 전투 AC)는 시작할 때 받는다
    expect((await save(page)).titles).toContain("first-spell");

    // 상점: 가격과 내용물이 다 보이고, 레벨이 모자란 품목은 실루엣
    const toShop = await approach(page, "shop_echo");
    await shot(page, "systems-map-shop.png");
    await page.keyboard.press(KEY[toShop]);
    await page.waitForFunction((d) => (window as any).__pyrpg.where().facing === d, toShop);
    await page.keyboard.press("Space");
    await settle(page, ".shop-modal");
    await expect(page.locator(".shop-gold")).toHaveText("500 G");
    await expect(page.locator(".shop-item.is-locked .item-icon.is-silhouette").first()).toBeVisible();
    await expect(page.locator('.shop-item[data-item="dye-nuri-starlight"]')).toContainText("Lv 10에 열려");
    await page.locator('.shop-buy[data-buy="sturdy-cloak"]').click();
    await expect(page.locator(".shop-status")).toContainText("튼튼한 망토");
    await expect(page.locator(".shop-gold")).toHaveText("350 G");
    await expect(page.locator('.shop-item[data-item="sturdy-cloak"]')).toHaveAttribute("data-state", "owned");
    await shot(page, "systems-shop.png");
    await closeAll(page);
    let s = await save(page);
    expect(s.player.gold).toBe(350);
    expect(s.inventory["sturdy-cloak"]).toBe(1);

    // 장비: 망토 → 최대 HP 120, 슬롯은 1칸이라 깃털을 끼려면 망토를 뺀다
    await openMenu(page, ".menu-equipment", ".equip-modal");
    await page.locator('.equip-toggle[data-item="sturdy-cloak"]').click();
    await expect(page.locator(".hud-hp-text")).toHaveText("100/120");
    await expect(page.locator('.equip-item[data-item="echo-ring"]')).toContainText("(준비 중)");
    await page.locator('.equip-toggle[data-item="guide-feather"]').click();
    await expect(page.locator(".equip-modal .shop-status")).toContainText("슬롯");
    await shot(page, "systems-equipment.png");
    await page.locator('.equip-toggle[data-item="sturdy-cloak"]').click();
    await page.locator('.equip-toggle[data-item="guide-feather"]').click();
    await expect(page.locator('.equip-item[data-item="guide-feather"]')).toHaveClass(/is-equipped/);
    await closeAll(page);
    expect((await save(page)).equipment).toEqual(["guide-feather"]);
    await expect(page.locator(".hud-hp-text")).toHaveText("100/100");

    // 깃털: 힌트 2가 무료로 표시되고, 열어도 보상이 줄지 않는다
    await bump(page, "m_P0102");
    await settle(page, ".battle-modal");
    await expect(page.locator(".act-hint-2")).toContainText("깃털: 무료");
    await expect(page.locator(".act-potion")).toContainText("회복약 ×1");
    await page.locator(".act-hint-1").click();
    await page.locator(".act-hint-2").click();
    await expect(page.locator(".confirm-msg")).toContainText("길잡이 깃털");
    await page.locator(".confirm-yes").click();
    await expect(page.locator(".act-hint-2")).toContainText("✓");
    expect(await winWith(page, solution("P0102"))).toBe("+100 XP");
    s = await save(page);
    expect(s.problems.P0102).toMatchObject({ solved: true, maxHintLevel: 2 });
    // 힌트 2단계라 그림자로는 등록된다
    expect(s.shadows.some((x: any) => x.concept === "scroll.arith")).toBe(true);

    // 칭호: 첫 주문을 달면 HUD 이름표에 보인다
    await openMenu(page, ".menu-titles", ".titles-modal");
    await page.locator('.title-pick[data-title="first-spell"]').click();
    await expect(page.locator(".hud-title")).toHaveText("「첫 주문」");
    await expect(page.locator('.title-item[data-title="first-spell"]')).toHaveClass(/is-active/);
    await shot(page, "systems-titles.png");
    await closeAll(page);
    expect((await save(page)).activeTitle).toBe("first-spell");
  });
});
