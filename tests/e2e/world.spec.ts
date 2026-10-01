// 월드(단위 4) E2E: dev/world.html 하네스에서 실제 키 입력으로 이동·충돌·상호작용을 확인한다.
import { expect, test, type Page } from "@playwright/test";

// window.__world / __events 타입은 src/game/harness.ts의 전역 선언을 쓴다
import type { Facing } from "../../src/contracts/state";

/** region1-spec.md §4의 오브젝트 ID와 종류 */
const SPEC_OBJECTS: Record<string, string> = {
  spawn: "spawn",
  t_prologue: "trigger",
  "rune_L1-1": "rune",
  sign_well: "sign",
  gate_well: "door",
  "rune_L1-2": "rune",
  sign_plaza: "sign",
  npc_frozen_merchant: "npc",
  campfire_plaza: "campfire",
  m_P0101: "monster",
  m_P0106: "monster",
  m_P0109: "monster",
  "rune_L1-3": "rune",
  npc_shopkeeper: "npc",
  chest_shop: "chest",
  m_P0102: "monster",
  m_P0103: "monster",
  m_P0108: "monster",
  "rune_L1-4": "rune",
  sign_alley_riddle: "sign",
  npc_echo_child: "npc",
  campfire_alley: "campfire",
  m_P0104: "monster",
  m_P0107: "monster",
  chest_hidden: "chest",
  m_P0110: "monster",
  t_boss_intro: "trigger",
  m_P0105: "monster",
  warp_east: "warp",
};

async function boot(page: Page): Promise<void> {
  await page.goto("/dev/world.html");
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 30_000 });
}

const pos = (page: Page) => page.evaluate(() => window.__world!.getPlayerPosition());
const eventCount = (page: Page) => page.evaluate(() => window.__events!.length);
const eventsSince = (page: Page, n: number) => page.evaluate((n) => window.__events!.slice(n), n);
const movedCount = (page: Page) => page.evaluate(() => window.__events!.filter((e) => e.type === "moved").length);

/** 키를 한 번 누르고 한 칸 이동이 끝날 때까지 기다린다 */
async function step(page: Page, key: string): Promise<void> {
  const n = await movedCount(page);
  await page.keyboard.press(key);
  await page.waitForFunction((n) => window.__events!.filter((e) => e.type === "moved").length > n, n);
}

/** 키를 눌러도 움직이지 않는지 확인한다(이동 시간보다 넉넉히 기다림) */
async function pressAndStay(page: Page, key: string): Promise<void> {
  const before = await pos(page);
  const n = await movedCount(page);
  await page.keyboard.press(key);
  await page.waitForTimeout(350);
  expect(await movedCount(page)).toBe(n);
  const after = await pos(page);
  expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
}

async function teleport(page: Page, x: number, y: number, facing: Facing): Promise<void> {
  await page.evaluate(([x, y, f]) => window.__world!.teleport(x, y, f), [x, y, facing] as const);
}

test.describe("world (dev/world.html)", () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
  });

  test("boots with a canvas and the player at the spawn object", async ({ page }) => {
    await expect(page.locator("#world canvas")).toBeVisible();
    const spawn = await page.evaluate(() => window.__world!.getObjects().find((o) => o.type === "spawn")!);
    const p = await pos(page);
    expect({ x: p.x, y: p.y }).toEqual({ x: spawn.x, y: spawn.y });
    expect(p.facing).toBe("down");
  });

  test("map objects include every region1-spec §4 id with the right type and props", async ({ page }) => {
    const objs = await page.evaluate(() => window.__world!.getObjects());
    const byId = new Map(objs.map((o) => [o.id, o]));
    for (const [id, type] of Object.entries(SPEC_OBJECTS)) {
      expect(byId.get(id)?.type, id).toBe(type);
    }
    expect(byId.get("t_prologue")!.props).toEqual({ dialogue: "prologue", once: true });
    expect(byId.get("gate_well")!.props).toEqual({ requires: "lesson:L1-1", lockedDialogue: "gate_well_locked" });
    expect(byId.get("chest_shop")!.props).toEqual({ gold: 30, dialogue: "chest_shop" });
    expect(byId.get("npc_echo_child")!.props).toEqual({ dialogue: "npc_echo_child", sprite: "npc_child" });
    expect(byId.get("m_P0105")!.props).toEqual({ problem: "P0105" });
    expect(byId.get("warp_east")!.props).toEqual({
      lockedDialogue: "east_gate_locked",
      requires: "problem:P0105",
      openDialogue: "to_be_continued",
    });
    // 숨겨진 방 입구는 표지판에서 동쪽 7칸, 북쪽 4칸
    const sign = byId.get("sign_alley_riddle")!;
    await teleport(page, sign.x + 7, sign.y - 3, "up");
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: sign.x + 7, y: sign.y - 4 });
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: sign.x + 7, y: sign.y - 5 });
  });

  test("walls block movement but turn the player", async ({ page }) => {
    // 시작 칸 왼쪽은 화단
    await pressAndStay(page, "ArrowLeft");
    expect((await pos(page)).facing).toBe("left");
    await pressAndStay(page, "ArrowRight");
    expect((await pos(page)).facing).toBe("right");
  });

  test("arrow keys and WASD move exactly one tile per press; trigger next to spawn fires", async ({ page }) => {
    const start = await pos(page);
    const n = await eventCount(page);
    await step(page, "ArrowDown");
    expect(await pos(page)).toEqual({ x: start.x, y: start.y + 1, facing: "down" });
    const evs = await eventsSince(page, n);
    expect(evs).toContainEqual({ type: "moved", x: start.x, y: start.y + 1, facing: "down" });
    expect(evs).toContainEqual({ type: "trigger", id: "t_prologue" });

    await step(page, "KeyD");
    expect(await pos(page)).toEqual({ x: start.x + 1, y: start.y + 1, facing: "right" });
    await step(page, "KeyS");
    expect(await pos(page)).toEqual({ x: start.x + 1, y: start.y + 2, facing: "down" });
    await step(page, "KeyW");
    expect(await pos(page)).toEqual({ x: start.x + 1, y: start.y + 1, facing: "up" });
    await step(page, "KeyA");
    expect(await pos(page)).toEqual({ x: start.x, y: start.y + 1, facing: "left" });
    await step(page, "ArrowRight");
    await step(page, "ArrowRight");
    expect(await pos(page)).toMatchObject({ x: start.x + 2, y: start.y + 1 });
    // 한 번 누를 때 정확히 한 칸
    await page.waitForTimeout(300);
    expect(await pos(page)).toMatchObject({ x: start.x + 2, y: start.y + 1 });
  });

  test("holding a direction keeps walking", async ({ page }) => {
    await teleport(page, 5, 25, "right");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(300);
    const p = await pos(page);
    expect(p.y).toBe(25);
    expect(p.x).toBeGreaterThanOrEqual(7);
  });

  test("facing a sign or NPC and pressing Space/Enter/Z emits onInteract", async ({ page }) => {
    const objs = await page.evaluate(() => window.__world!.getObjects());
    const sign = objs.find((o) => o.id === "sign_well")!;
    await teleport(page, sign.x, sign.y - 1, "down");
    let n = await eventCount(page);
    await page.keyboard.press("Space");
    await expect.poll(() => eventsSince(page, n)).toContainEqual({ type: "interact", id: "sign_well", objectType: "sign" });

    await teleport(page, sign.x - 1, sign.y, "right");
    n = await eventCount(page);
    await page.keyboard.press("KeyZ");
    await expect.poll(() => eventsSince(page, n)).toContainEqual({ type: "interact", id: "sign_well", objectType: "sign" });

    const npc = objs.find((o) => o.id === "npc_frozen_merchant")!;
    await teleport(page, npc.x, npc.y + 1, "up");
    n = await eventCount(page);
    await page.keyboard.press("Enter");
    await expect.poll(() => eventsSince(page, n)).toContainEqual({ type: "interact", id: "npc_frozen_merchant", objectType: "npc" });

    // 아무것도 없는 쪽을 보고 누르면 아무 일도 없다
    await teleport(page, npc.x, npc.y + 2, "down");
    n = await eventCount(page);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    expect(await eventsSince(page, n)).toEqual([]);
  });

  test("walking into a monster emits onInteract; removeObject opens the chokepoint", async ({ page }) => {
    const m = (await page.evaluate(() => window.__world!.getObjects())).find((o) => o.id === "m_P0101")!;
    await teleport(page, m.x, m.y + 1, "down");
    const n = await eventCount(page);
    await pressAndStay(page, "ArrowUp");
    const evs = await eventsSince(page, n);
    expect(evs.filter((e) => e.type === "interact")).toEqual([{ type: "interact", id: "m_P0101", objectType: "monster" }]);

    await page.evaluate(() => window.__world!.removeObject("m_P0101", "purify"));
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: m.x, y: m.y });
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: m.x, y: m.y - 1 });
    // 제거된 오브젝트도 getObjects에는 남아 있다
    expect(await page.evaluate(() => window.__world!.getObjects().some((o) => o.id === "m_P0101"))).toBe(true);
  });

  test("gate door blocks until removed with the open effect", async ({ page }) => {
    const g = (await page.evaluate(() => window.__world!.getObjects())).find((o) => o.id === "gate_well")!;
    await teleport(page, g.x, g.y + 1, "up");
    const n = await eventCount(page);
    await pressAndStay(page, "ArrowUp");
    // 문은 부딪혀도 호출하지 않고, 바라보고 상호작용 키를 눌러야 한다
    expect((await eventsSince(page, n)).filter((e) => e.type === "interact")).toEqual([]);
    await page.keyboard.press("Space");
    await expect.poll(() => eventsSince(page, n)).toContainEqual({ type: "interact", id: "gate_well", objectType: "door" });
    await page.evaluate(() => window.__world!.removeObject("gate_well", "open"));
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: g.x, y: g.y });
  });

  test("setInputEnabled(false) stops movement and does not swallow keys", async ({ page }) => {
    await teleport(page, 5, 25, "right");
    await page.evaluate(() => window.__world!.setInputEnabled(false));
    const n = await eventCount(page);
    await page.evaluate(() => {
      (window as unknown as { __prevented: string[] }).__prevented = [];
      window.addEventListener("keydown", (e) => {
        if (e.defaultPrevented) (window as unknown as { __prevented: string[] }).__prevented.push(e.code);
      });
    });
    await pressAndStay(page, "ArrowRight");
    await pressAndStay(page, "KeyD");
    await page.keyboard.press("Space");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    expect(await eventsSince(page, n)).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __prevented: string[] }).__prevented)).toEqual([]);

    await page.evaluate(() => window.__world!.setInputEnabled(true));
    await step(page, "ArrowRight");
    expect(await pos(page)).toMatchObject({ x: 6, y: 25 });
  });

  test("typing into a focused textarea reaches the textarea and never moves the player", async ({ page }) => {
    await teleport(page, 5, 25, "right");
    const before = await pos(page);
    const n = await eventCount(page);
    await page.locator("#probe").focus();
    await page.keyboard.type("def f(a, b):");
    await page.keyboard.press("Enter");
    await page.keyboard.type("    return a + b");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    expect(await page.locator("#probe").inputValue()).toBe("def f(a, b):\n    return a + b");
    expect(await eventsSince(page, n)).toEqual([]);
    expect(await pos(page)).toEqual(before);

    // 캔버스를 누르면 입력칸 포커스가 빠지고 다시 움직일 수 있다(design.md §9.7)
    await page.locator("#world canvas").click();
    await step(page, "ArrowRight");
    expect(await pos(page)).toMatchObject({ x: before.x + 1, y: before.y });
  });

  test("Esc and M emit onMenu", async ({ page }) => {
    const n = await eventCount(page);
    await page.keyboard.press("Escape");
    await page.keyboard.press("KeyM");
    await expect.poll(() => eventsSince(page, n)).toEqual([{ type: "menu" }, { type: "menu" }]);
  });
});
