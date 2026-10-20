// 월드(단위 4) E2E: dev/world.html 하네스에서 실제 키 입력으로 이동·충돌·상호작용을 확인한다.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// window.__world / __events 타입은 src/game/harness.ts의 전역 선언을 쓴다
import type { Facing } from "../../src/contracts/state";

const manifest = JSON.parse(readFileSync("assets/manifest.json", "utf-8")) as {
  tileAnimations?: Record<string, { frames: string[]; fps: number }>;
};

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
    expect(byId.get("t_prologue")!.props).toEqual({ dialogue: "prologue", once: true, joinCompanion: true });
    expect(byId.get("gate_well")!.props).toEqual({ requires: "lesson:L1-1", lockedDialogue: "gate_well_locked" });
    expect(byId.get("chest_shop")!.props).toEqual({ gold: 30, dialogue: "chest_shop" });
    expect(byId.get("npc_echo_child")!.props).toEqual({ dialogue: "npc_echo_child", sprite: "npc_child" });
    expect(byId.get("m_P0105")!.props).toEqual({ problem: "P0105" });
    expect(byId.get("warp_east")!.props).toEqual({
      lockedDialogue: "east_gate_locked",
      requires: "problem:P0105",
      openDialogue: "to_be_continued",
      target: "r02",
      targetSpawn: "spawn_west",
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

// 지역 3(고블린 동굴) 맵: ?map=r03. 바위 틈(cave_crack)은 벽처럼 보이지만 실제로 지나갈 수 있다
/** map.tmj의 ground 레이어에서 바위 틈 타일 칸(하나뿐) */
function caveCrack(): { x: number; y: number } {
  const map = JSON.parse(readFileSync("content/regions/r03-goblin-cave/map.tmj", "utf8"));
  const ts = map.tilesets[0];
  const gid = ts.firstgid + ts.tiles.find((t: { type: string }) => t.type === "cave_crack").id;
  const ground = map.layers.find((l: { name: string }) => l.name === "ground").data as number[];
  const cells = ground.map((g, i) => (g === gid ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  return { x: cells[0] % map.width, y: Math.floor(cells[0] / map.width) };
}

test.describe("world (dev/world.html?map=r03)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/world.html?map=r03");
    await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 30_000 });
  });

  test("boots at spawn_west with the region03-spec objects, and the cave crack is walkable", async ({ page }) => {
    const objs = await page.evaluate(() => window.__world!.getObjects());
    const byId = new Map(objs.map((o) => [o.id, o]));
    const spawn = byId.get("spawn_west")!;
    expect({ x: (await pos(page)).x, y: (await pos(page)).y }).toEqual({ x: spawn.x, y: spawn.y });
    expect(byId.get("board_shadow_r03")?.type).toBe("board");
    expect(byId.get("npc_goblin_clerk")?.props).toEqual({ dialogue: "npc_goblin_clerk", sprite: "npc_goblin" });
    expect(byId.get("m_P0311")?.props).toEqual({ problem: "P0311" });
    expect(byId.get("campfire_mural")?.type).toBe("campfire");
    expect(objs).toHaveLength(30);

    // 거울 웅덩이 북쪽 벽: 두 칸 아래에서 위로 걸어 틈을 지나 숨겨진 굴로 들어간다
    const chest = byId.get("chest_hidden_pool")!;
    const pool = byId.get("rune_L3-4")!;
    const { x: crackX, y: crackY } = caveCrack();
    expect(chest.y).toBeLessThan(crackY);
    expect(pool.y).toBeGreaterThan(crackY);
    await teleport(page, crackX, crackY + 1, "up");
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: crackX, y: crackY });
    await step(page, "ArrowUp");
    expect(await pos(page)).toMatchObject({ x: crackX, y: crackY - 1 });
    // 틈 옆의 벽 앞면은 막혀 있다
    await teleport(page, crackX - 1, crackY + 1, "up");
    await pressAndStay(page, "ArrowUp");
  });
});

// ── 그래픽 개편(docs/art-overhaul/plan.md §3): 걷기·제자리 애니메이션, 타일 애니메이션, 화면 연출 ──
const ART_SCREENS = "docs/art-overhaul/screens";

interface Sample {
  t: number;
  p: { frame: number; bob: number; mode: string; facing: string };
  n: { frame: number; bob: number; mode: string };
}
type SamplerWindow = { __samples: Sample[]; __sampling: boolean };

/** 매 화면 프레임마다 플레이어·누리의 그려진 프레임을 기록한다 */
async function startSampling(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as SamplerWindow;
    w.__samples = [];
    w.__sampling = true;
    const tick = () => {
      if (!w.__sampling) return;
      const s = window.__world!.inspect!();
      w.__samples.push({ t: performance.now(), p: s.player, n: s.nuri });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopSampling(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const w = window as unknown as SamplerWindow;
    w.__sampling = false;
    return w.__samples;
  });
}

/** 연속으로 같은 값은 하나로 */
const runs = <T>(xs: T[]): T[] => xs.filter((x, i) => i === 0 || x !== xs[i - 1]);

const inspect = (page: Page) => page.evaluate(() => window.__world!.inspect!());

async function bootWith(page: Page, query: string): Promise<void> {
  await page.goto(`/dev/world.html${query}`);
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 30_000 });
}

test.describe("world animation and ambience (art overhaul)", () => {
  test("new 16×24 sheet: holding a key walks 1→2→3→0 without restarting between steps, bobbing on the foot frames", async ({ page }) => {
    await bootWith(page, "?sheet=new&fx=off");
    expect((await inspect(page)).player.layout).toBe("grid6x4");
    await teleport(page, 5, 25, "right");
    await startSampling(page);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(900);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(400);
    const samples = await stopSampling(page);
    const walking = samples.filter((s) => s.p.mode === "walk");
    expect(walking.length).toBeGreaterThan(20);
    // 오른쪽 행(2) × 6 + 열
    const cols = walking.map((s) => s.p.frame - 2 * 6);
    for (const c of cols) expect(c).toBeGreaterThanOrEqual(0);
    for (const c of cols) expect(c).toBeLessThanOrEqual(3);
    const seq = runs(cols);
    // 걸음 경계에서 처음(왼발)으로 돌아가지 않고 이어진다: 다음 열은 늘 주기의 다음 칸
    const next: Record<number, number> = { 1: 2, 2: 3, 3: 0, 0: 1 };
    for (let i = 1; i < seq.length; i++) expect(seq[i], `walk sequence ${seq.join(",")}`).toBe(next[seq[i - 1]]);
    expect(seq.length).toBeGreaterThanOrEqual(10);
    // 발 딛는 프레임(1, 3)에서만 1px 올라간다
    for (const s of walking) expect(s.p.bob).toBe([1, 3].includes(s.p.frame - 12) ? 1 : 0);
    // 누리는 반 박자 어긋나서 같은 순간에 같은 열이 아니다
    const both = walking.filter((s) => s.n.mode === "walk");
    expect(both.length).toBeGreaterThan(10);
    const sameCol = both.filter((s) => s.n.frame % 6 === s.p.frame % 6).length;
    expect(sameCol / both.length).toBeLessThan(0.2);
    // 멈추면 서기
    const end = await inspect(page);
    expect(end.player.mode).toBe("idle");
    expect([0, 5]).toContain(end.player.frame - 12);
    expect(end.player.bob).toBe(0);
  });

  test("old 16×16 sheet keeps working and no longer freezes between steps", async ({ page }) => {
    // 지금 플레이어 그림은 새 형식이라, 옛 형식(16×16 가로 8프레임)은 코드로 그린 시트로 확인한다(?sheet=old)
    await bootWith(page, "?fx=off");
    expect((await inspect(page)).player.layout).toBe("grid6x4");
    await bootWith(page, "?sheet=old&fx=off");
    expect((await inspect(page)).player.layout).toBe("legacy8");
    await teleport(page, 5, 25, "right");
    await startSampling(page);
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(800);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(300);
    const walking = (await stopSampling(page)).filter((s) => s.p.mode === "walk");
    const seq = runs(walking.map((s) => s.p.frame));
    // 오른쪽 = [서기 4, 걸음 5]가 걸음마다 번갈아(한 걸음에 한 번씩 걸음 프레임)
    expect(new Set(seq)).toEqual(new Set([4, 5]));
    expect(seq.length).toBeGreaterThanOrEqual(8);
    expect((await pos(page)).x).toBeGreaterThanOrEqual(9);
  });

  test("standing still breathes and blinks; bumping a wall walks in place", async ({ page }) => {
    await bootWith(page, "?sheet=new&fx=off");
    await teleport(page, 5, 25, "down");
    await startSampling(page);
    await page.waitForTimeout(5200);
    const idle = await stopSampling(page);
    const frames = new Set(idle.map((s) => s.p.frame));
    expect(frames).toContain(4); // 숨쉬기(아래 행)
    expect(frames).toContain(5); // 눈 깜빡임
    // 처음 1초 남짓은 숨쉬지 않는다
    expect(idle.filter((s) => s.t - idle[0].t < 1200).every((s) => s.p.frame !== 4)).toBe(true);

    // 시작 칸 왼쪽은 화단: 왼쪽 키를 누르고 있으면 제자리걸음, 떼면 서기
    const start = await page.evaluate(() => window.__world!.getObjects().find((o) => o.type === "spawn")!);
    await teleport(page, start.x, start.y, "down");
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(500);
    const bump = await inspect(page);
    expect(bump.player.mode).toBe("bump");
    expect(bump.player.facing).toBe("left");
    expect(bump.player.bob).toBe(0);
    await page.keyboard.up("ArrowLeft");
    await expect.poll(async () => (await inspect(page)).player.mode).toBe("idle");
    expect((await pos(page)).x).toBe(start.x);
  });

  test("NPCs idle on the new sheet and turn to face the player when spoken to", async ({ page }) => {
    await bootWith(page, "?sheet=new&fx=off");
    const npc = (await page.evaluate(() => window.__world!.getObjects())).find((o) => o.id === "npc_frozen_merchant")!;
    const before = (await inspect(page)).npcs.npc_frozen_merchant;
    expect(before.layout).toBe("grid6x4");
    expect(before.facing).toBe("down");
    await teleport(page, npc.x - 1, npc.y, "right");
    await page.keyboard.press("Space");
    await expect.poll(async () => (await inspect(page)).npcs.npc_frozen_merchant.facing).toBe("left");
    expect(Math.floor((await inspect(page)).npcs.npc_frozen_merchant.frame / 6)).toBe(1);
    // 플레이어가 한 칸 움직이면 원래 방향으로
    await step(page, "ArrowDown");
    await expect.poll(async () => (await inspect(page)).npcs.npc_frozen_merchant.facing).toBe("down");
  });

  test("monsters loop 4 frames on 4-frame sheets and 2 frames on old sheets; chests stay closed", async ({ page }) => {
    const seen = async () => {
      const frames: Record<string, Set<number>> = {};
      for (let i = 0; i < 16; i++) {
        const objs = (await inspect(page)).objects;
        for (const [id, o] of Object.entries(objs)) (frames[id] ??= new Set()).add(o.frame);
        await page.waitForTimeout(90);
      }
      return frames;
    };
    await bootWith(page, "?sheet=new&fx=off");
    let frames = await seen();
    let objs = (await inspect(page)).objects;
    expect(objs.m_P0101.frames).toBe(4);
    expect(frames.m_P0101).toEqual(new Set([0, 1, 2, 3]));
    expect(objs.m_P0105.key).toBe("boss_stair_mimic");
    expect(frames.m_P0105.size).toBe(4);
    expect(frames.chest_shop).toEqual(new Set([0]));

    // 지금 그림: 지역 1 몬스터는 새 화풍 4프레임
    await bootWith(page, "?fx=off");
    frames = await seen();
    objs = (await inspect(page)).objects;
    expect(objs.m_P0101.frames).toBe(4);
    expect(frames.m_P0101).toEqual(new Set([0, 1, 2, 3]));
    expect(frames.chest_shop).toEqual(new Set([0]));

    // 지역 7도 새 화풍 4프레임(화풍 통일): 몬스터·중간 보스가 4프레임을 모두 돈다
    await bootWith(page, "?map=r07&fx=off");
    frames = await seen();
    objs = (await inspect(page)).objects;
    expect(objs.m_P0701.key).toBe("monster_sand_stream");
    expect(objs.m_P0701.frames).toBe(4);
    expect(frames.m_P0701).toEqual(new Set([0, 1, 2, 3]));
    expect(objs.m_P0707.key).toBe("boss_sand_scorpion");
    expect(objs.m_P0707.frames).toBe(4);
    expect(frames.m_P0707).toEqual(new Set([0, 1, 2, 3]));
  });

  test("tileAnimations swap the painted tile over time without touching map data", async ({ page }) => {
    // manifest tileAnimations(지역 1 물·꽃·가로등): 지역 1에 있는 것은 칸이 있고, 그린 타일이 프레임을 돈다
    await bootWith(page, "?fx=off");
    const objects = await page.evaluate(() => window.__world!.getObjects());
    const anims = (await inspect(page)).tileAnimations;
    expect(anims.map((a) => a.name).sort()).toEqual(Object.keys(manifest.tileAnimations ?? {}).sort());
    for (const a of anims) {
      expect(a.frames, a.name).toHaveLength(manifest.tileAnimations![a.name].frames.length);
      expect(a.cells, a.name).toBeGreaterThan(0);
    }
    const realWater = new Set<number>();
    for (let i = 0; i < 16; i++) {
      realWater.add((await inspect(page)).tileAnimations.find((a) => a.name === "water")!.current);
      await page.waitForTimeout(90);
    }
    expect(realWater).toEqual(new Set(anims.find((a) => a.name === "water")!.frames));
    // 맵 데이터(오브젝트)는 그대로
    expect(await page.evaluate(() => window.__world!.getObjects())).toEqual(objects);

    await bootWith(page, "?tileanim=test&fx=off");
    const water = (await inspect(page)).tileAnimations[0];
    expect(water.name).toBe("water");
    expect(water.cells).toBeGreaterThan(0);
    const current = new Set<number>();
    for (let i = 0; i < 12; i++) {
      current.add((await inspect(page)).tileAnimations[0].current);
      await page.waitForTimeout(70);
    }
    expect(current).toEqual(new Set(water.frames));
  });

  test("region ambience: grade + vignette filters and floating particles, switchable", async ({ page }) => {
    await bootWith(page, "");
    const a = (await inspect(page)).ambience;
    expect(a).toMatchObject({ grade: "dusty_teal", particles: "sparkle", filters: true, enabled: true });
    expect(a.particleCount).toBeGreaterThan(5);
    await page.evaluate(() => window.__world!.setAmbienceEnabled!(false));
    expect((await inspect(page)).ambience.enabled).toBe(false);

    await bootWith(page, "?map=r03");
    expect((await inspect(page)).ambience).toMatchObject({ grade: "cave", particles: "dust", filters: true });
    await bootWith(page, "?map=r02&fx=off");
    expect((await inspect(page)).ambience).toMatchObject({ grade: "forest", particles: "leaves", enabled: false });
  });

  test("screens: Echo Village walking with ambience (new test sheet and current art), doorway under the eave", async ({ page }) => {
    // 첫 화면(시작 칸 근처): 연출 끈 것 / 켠 것
    await bootWith(page, "?sheet=new&fx=off");
    await page.waitForTimeout(400);
    await page.locator("#world").screenshot({ path: `${ART_SCREENS}/engine-village-nofx.png` });
    await bootWith(page, "?sheet=new");
    await page.waitForTimeout(400);
    await page.locator("#world").screenshot({ path: `${ART_SCREENS}/engine-village-fx.png` });
    // 길 위를 걷는 도중(발 딛는 프레임)
    await teleport(page, 12, 25, "right");
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => {
      const p = window.__world!.inspect!().player;
      return p.mode === "walk" && p.bob === 1;
    });
    await page.locator("#world").screenshot({ path: `${ART_SCREENS}/engine-walk-fx.png` });
    await page.keyboard.up("ArrowRight");
    // 문간: 머리가 지붕 처마 밑으로
    await teleport(page, 4, 23, "down");
    await page.waitForTimeout(300);
    await page.locator("#world").screenshot({ path: `${ART_SCREENS}/engine-doorway.png` });
    // 지금 그림(옛 16×16 시트) 그대로도 연출과 함께 동작
    await bootWith(page, "");
    await teleport(page, 12, 25, "right");
    await page.waitForTimeout(400);
    await page.locator("#world").screenshot({ path: `${ART_SCREENS}/engine-village-current-art.png` });
  });
});
