// 지역 3(고블린 동굴) 클리어 E2E(docs/phase3/plan.md §3 지역별 검증, docs/phase3/region03-spec.md).
// 지역 1·2를 끝낸 저장에서 시작해 실제 방향키·대화·레슨·CodeMirror·Pyodide 채점으로 지역 3을 끝까지 플레이한다.
// 도우미는 region2.spec.ts와 같은 방식이다(window.__pyrpg 훅은 좌표·진행도·길찾기만, 이동은 실제 키).
// PW_PORT=4201 npx playwright test tests/e2e/region3.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const PROBLEMS = "content/regions/r03-goblin-cave/problems";
const code = (pid: string, file: string) => readFileSync(`${PROBLEMS}/${pid}/${file}`, "utf8");
const solution = (pid: string) => code(pid, "solution.py");

const SCREENS = "docs/phase3/screens";

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${SCREENS}/${name}` });
}

// ───────────── 훅 읽기 ─────────────

const where = (page: Page) => page.evaluate(() => (window as any).__pyrpg.where()) as Promise<{ x: number; y: number; facing: Facing; busy: boolean; modal: boolean }>;
const save = (page: Page) => page.evaluate(() => (window as any).__pyrpg.state().save);
const said = (page: Page) => page.evaluate(() => [...(window as any).__pyrpg.said]) as Promise<string[]>;
const obj = (page: Page, id: string) =>
  page.evaluate((id) => (window as any).__pyrpg.objects().find((o: any) => o.id === id), id) as Promise<{ id: string; x: number; y: number; removed: boolean; type: string }>;
const objIds = (page: Page, type: string) =>
  page.evaluate((t) => (window as any).__pyrpg.objects().filter((o: any) => o.type === t).map((o: any) => o.id), type) as Promise<string[]>;

/** 맵(map.tmj)의 ground 레이어에서 바위 틈(cave_crack, 지나갈 수 있는 숨겨진 길 입구)의 칸 */
function caveCrack(): { x: number; y: number } {
  const map = JSON.parse(readFileSync("content/regions/r03-goblin-cave/map.tmj", "utf8"));
  const ts = map.tilesets[0];
  const gid = ts.firstgid + ts.tiles.find((t: any) => t.type === "cave_crack").id;
  const ground = map.layers.find((l: any) => l.name === "ground").data as number[];
  const col = map.layers.find((l: any) => l.name === "collision").data as number[];
  const cells = ground.map((g, i) => (g === gid ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  expect(col[cells[0]]).toBe(0);
  return { x: cells[0] % map.width, y: Math.floor(cells[0] / map.width) };
}

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?e2e");
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
}

async function reloadReady(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
}

async function seedAndReload(page: Page, seed: Record<string, unknown>): Promise<void> {
  await settle(page);
  await page.evaluate((s) => (window as any).__pyrpg.seed(s), seed);
  await reloadReady(page);
  await settle(page);
}

// ───────────── 대화 ─────────────

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
  throw new Error(`settle timeout (until=${until}) said=${(await said(page)).join(",")}`);
}

/** 대화가 끝날 때까지 넘기면서 화면에 나온 대사 글을 모은다 */
async function readAll(page: Page): Promise<string[]> {
  const texts: string[] = [];
  const deadline = Date.now() + 60_000;
  let idleSince = 0;
  let lastKey = "";
  while (Date.now() < deadline) {
    if (await page.locator(".dlg-modal").count()) {
      // 글자가 다 찍히면(▼ 준비) 읽고 넘긴다. 아직 찍는 중이면 Space로 다 보여 준다
      if (!(await page.locator(".dlg-next.is-ready").count())) {
        await page.keyboard.press("Space");
        await page.waitForTimeout(30);
        idleSince = 0;
        continue;
      }
      const key = `${(await said(page)).length}:${await page.locator(".dlg-box").getAttribute("data-line")}`;
      if (key !== lastKey) {
        texts.push((await page.locator(".dlg-text").textContent()) ?? "");
        lastKey = key;
      }
      await page.keyboard.press("Space");
      await page.waitForTimeout(30);
      idleSince = 0;
      continue;
    }
    const w = await where(page);
    if (!w.busy && !w.modal) {
      if (!idleSince) idleSince = Date.now();
      else if (Date.now() - idleSince > 150) return texts;
    } else idleSince = 0;
    await page.waitForTimeout(40);
  }
  throw new Error("readAll timeout");
}

// ───────────── 이동 ─────────────

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
    if (!path) throw new Error(`no path to ${x},${y} from ${JSON.stringify(await where(page))}`);
    if (path.length === 0) return;
    await step(page, path[0]);
  }
  throw new Error("walkTo: too many steps");
}

async function approach(page: Page, id: string): Promise<Facing> {
  const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), id);
  if (!a) throw new Error(`cannot approach ${id} from ${JSON.stringify(await where(page))}`);
  await walkTo(page, a.end.x, a.end.y);
  return a.face;
}

async function face(page: Page, dir: Facing): Promise<void> {
  await page.keyboard.press(KEY[dir]);
  await page.waitForFunction((d) => (window as any).__pyrpg.where().facing === d, dir);
}

async function interact(page: Page, id: string): Promise<void> {
  const dir = await approach(page, id);
  await face(page, dir);
  await page.keyboard.press("Space");
}

async function bump(page: Page, id: string): Promise<void> {
  const dir = await approach(page, id);
  await page.keyboard.press(KEY[dir]);
}

/** 오브젝트와 상호작용하고 대화가 끝나면 마지막 대사 ID */
async function talk(page: Page, id: string): Promise<string | undefined> {
  await interact(page, id);
  await settle(page);
  return (await said(page)).at(-1);
}

// ───────────── 레슨 ─────────────

async function doLesson(page: Page, answer: string, shotName?: string): Promise<void> {
  await settle(page, ".lesson-modal");
  await expect(page.locator(".lesson-modal")).toBeVisible();
  const input = page.locator(".blank-input");
  await input.click();
  await page.keyboard.type(answer);
  if (shotName) await shot(page, shotName);
  await page.locator(".blank-run").click();
  await expect(page.locator(".lesson-claim")).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator(".exercise .nuri-row")).toHaveAttribute("data-emotion", "happy");
  await page.locator(".lesson-claim").click();
  await page.locator(".scroll-ok").click();
  await settle(page);
}

async function lesson(page: Page, rune: string, answer: string, scroll: string, shotName?: string): Promise<void> {
  const id = rune.replace("rune_", "");
  await interact(page, rune);
  await doLesson(page, answer, shotName);
  // 일일 퀘스트 보상으로 레벨이 오르면 끝에 level_up이 붙을 수 있다
  const tail = (await said(page)).filter((d) => d !== "level_up").slice(-2);
  expect(tail).toEqual([`lesson_${id}_intro`, `lesson_${id}_done`]);
  const s = await save(page);
  expect(s.lessonsCompleted).toContain(id);
  expect(s.scrolls).toContain(scroll);
}

// ───────────── 전투 ─────────────

const editor = (page: Page) => page.locator(".battle-editor .cm-content");
const editorText = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll(".battle-editor .cm-line"), (l) => l.textContent ?? "").join("\n"));
const msg = (page: Page) => page.locator(".battle-msg-text");

async function typeCode(page: Page, text: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
  await expect.poll(() => editorText(page)).toBe(text);
}

/** timeoutMs: 시전 결과를 기다리는 시간(보스 시간 결계의 TLE는 테스트 4개 × 경계 재확인 2회 × 제한만큼 걸린다) */
async function cast(page: Page, timeoutMs = 120_000): Promise<void> {
  await expect(page.locator(".act-cast")).toBeEnabled({ timeout: 60_000 });
  await page.locator(".act-cast").click();
  await page.waitForFunction(
    () => {
      const root = document.querySelector(".battle");
      const banner = document.querySelector(".battle-banner") as HTMLElement | null;
      return !root || (banner && !banner.hidden) || !root.classList.contains("is-busy");
    },
    null,
    { timeout: timeoutMs },
  );
}

/** 오답을 시전하고 판정·진단을 확인한다 */
async function castWrong(page: Page, pid: string, file: string, expectText: (string | RegExp)[]): Promise<void> {
  const wrong = code(pid, file);
  await typeCode(page, wrong);
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeHidden();
  for (const t of expectText) await expect(msg(page)).toContainText(t);
  // 틀린 코드는 편집기에 그대로 남는다
  expect(await editorText(page)).toBe(wrong);
}

async function winCurrent(page: Page, pid: string, boss = false): Promise<void> {
  await typeCode(page, solution(pid));
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  await expect(page.locator(".reward-xp .reward-value")).toHaveText(boss ? "+1000 XP" : "+100 XP");
  await expect(page.locator(".reward-gold .reward-value")).toHaveText(boss ? "+500 G" : "+50 G");
  await page.locator(".reward-ok").click();
}

async function openBattle(page: Page, monster: string, pid: string): Promise<void> {
  await bump(page, monster);
  await settle(page, ".battle-modal");
  await expect(page.locator(".battle")).toHaveAttribute("data-problem", pid);
}

async function fightAndWin(page: Page, monster: string, pid: string): Promise<void> {
  await openBattle(page, monster, pid);
  await winCurrent(page, pid);
  await settle(page);
  expect((await obj(page, monster)).removed).toBe(true);
  expect((await save(page)).problems[pid].solved).toBe(true);
}

// ───────────── 준비: 지역 1·2를 끝낸 저장 ─────────────

const R01_LESSONS = ["L1-1", "L1-2", "L1-3", "L1-4"];
const R01_FLAGS = ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r01.clear"];
const R02_LESSONS = ["L2-1", "L2-2", "L2-3", "L2-4"];
const R02_FLAGS = ["region.r02.clear", "trigger.r02.t_boss_intro"];

/**
 * 새 게임으로 부팅 → 지역 1을 끝낸 저장으로 에코 마을 동쪽 문을 건너 갈림길 숲에 들어간 뒤,
 * 지역 2도 다 끝내고(몬스터·상자 제거, 레슨 4개) 숲 동쪽 문 바로 앞에 선 저장으로 다시 시작한다
 */
async function seedRegion2Cleared(page: Page): Promise<void> {
  await boot(page);
  await settle(page);
  const removed1 = [...(await objIds(page, "monster")), ...(await objIds(page, "door")), ...(await objIds(page, "chest"))];
  const gate1 = await obj(page, "warp_east");
  await seedAndReload(page, { lessons: R01_LESSONS, removed: removed1, at: { x: gate1.x - 1, y: gate1.y, facing: "right" }, flags: R01_FLAGS });
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");

  const removed2 = [...(await objIds(page, "monster")), ...(await objIds(page, "chest"))];
  const gate2 = await obj(page, "warp_east");
  await seedAndReload(page, { lessons: R02_LESSONS, removed: removed2, at: { x: gate2.x - 1, y: gate2.y, facing: "right" }, flags: R02_FLAGS });
  const w = await where(page);
  expect({ x: w.x, y: w.y }).toEqual({ x: gate2.x - 1, y: gate2.y });
  const s = await save(page);
  expect(s.location.regionId).toBe("r02");
  expect(s.problems.P0210.solved).toBe(true);
  expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.branch", "scroll.loop", "scroll.while", "scroll.gather"]));
  expect(await said(page)).toEqual([]);
  await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
}

/** 갈림길 숲 동쪽 문으로 고블린 동굴에 처음 들어간다 */
async function crossToCave(page: Page): Promise<void> {
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
}

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 3 고블린 동굴 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("입장: 갈림길 숲 동쪽 문 → 첫 대사·동굴 트리거 → 복귀 지점이 동굴 입구 → 서쪽 문으로 돌아갔다가 다시 오기", async () => {
    test.setTimeout(240_000);
    await seedRegion2Cleared(page);
    const campBefore = (await save(page)).lastCampfire;
    expect(campBefore.regionId).not.toBe("r03");

    // 처음 건널 때: r02 openDialogue(숲의 to_be_continued) → 지역 첫 대사 → spawn 옆 트리거(도착 칸)
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "cave_intro"]);
    // 다음 지역으로 실제로 넘어가는데 '이야기는 여기까지/준비 중'이라고 말하면 안 된다
    for (const t of texts) expect(t).not.toMatch(/준비 중|여기까지입니다/);
    expect(texts.join(" ")).toContain("횃불");
    await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    const spawn = await obj(page, "spawn_west");
    const trig = await obj(page, "t_cave_intro");
    expect(st.save.location.regionId).toBe("r03");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: trig.x, y: trig.y });
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    expect(st.save.flags["trigger.r03.t_cave_intro"]).toBe(true);
    expect(st.save.flags["region.r03.intro"]).toBe(true);
    // 쓰러졌을 때의 복귀 지점이 동굴 입구로 옮겨졌다
    expect(st.save.lastCampfire).toEqual({ regionId: "r03", x: trig.x, y: trig.y });

    // 서쪽 문 → 갈림길 숲 동쪽 문 옆
    await interact(page, "warp_west");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
    expect((await save(page)).location.regionId).toBe("r02");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await said(page)).slice(3)).toEqual([]);

    // 다시 건너면 대사 없이 바로(once 트리거·지역 첫 대사·openDialogue 모두 한 번만)
    await interact(page, "warp_east");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "cave_intro"]);
  });

  test("동굴 입구: L3-1 → P0301 오답 2번(AttributeError·IndexError 진단, 줄 번호) → 승리 → 캠프파이어 → P0302", async () => {
    test.setTimeout(300_000);
    // 주문서 없이 번호표 고블린에 부딪히면 막힌다
    await bump(page, "m_P0301");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L3-1", "-1", "scroll.list", "r03-play-lesson.png");

    await openBattle(page, "m_P0301", "P0301");
    const maxHp = (await save(page)).player.hp;
    // JS식 arr.length → AttributeError, 6번째 줄, JS 말투 진단
    await castWrong(page, "P0301", "wrong_b.py", ["AttributeError", "JS 말투", "len(arr)"]);
    await expect(msg(page).locator(".err-line")).toHaveText("6번째 줄");
    await expect(msg(page).locator(".diag")).toBeVisible();
    // 반격: 공격력 20, 6개 모두 실패
    await expect(msg(page).locator(".counter")).toContainText("HP −20");
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 20}/${maxHp}`);
    await shot(page, "r03-play-battle-diag.png");
    // arr[len(arr)] → IndexError, 줄 바깥 진단
    await castWrong(page, "P0301", "wrong_a.py", ["IndexError", "줄 바깥을 읽었어"]);
    await expect(msg(page).locator(".err-line")).toHaveText("6번째 줄");
    await winCurrent(page, "P0301");
    await settle(page);
    expect((await save(page)).problems.P0301).toMatchObject({ solved: true, attempts: 3 });
    expect((await obj(page, "m_P0301")).removed).toBe(true);

    expect(await talk(page, "campfire_entrance")).toBe("campfire_rest");
    const s = await save(page);
    expect(s.lastCampfire.regionId).toBe("r03");
    await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);

    await fightAndWin(page, "m_P0302", "P0302");
  });

  test("갈림 굴: 표지판(숨겨진 길 귀띔) → L3-2 → P0304 오답(끝 미포함 진단) → 승리", async () => {
    test.setTimeout(300_000);
    expect(await talk(page, "sign_tunnels")).toBe("sign_tunnels");
    await lesson(page, "rune_L3-2", "1:4", "scroll.slice");
    await openBattle(page, "m_P0304", "P0304");
    await castWrong(page, "P0304", "wrong_a.py", ["빈 리스트가 나왔어", "끝은 포함하지 않아"]);
    await winCurrent(page, "P0304");
    await settle(page);
    expect((await obj(page, "m_P0304")).removed).toBe(true);
  });

  test("보물 창고: L3-3(창고 길목 앞) → P0306 → 고블린 서기 귀띔 → 상자 → 그림자 게시판 → 캠프파이어 → P0307 오답(arr = arr.sort()) → 승리", async () => {
    test.setTimeout(400_000);
    // 창고 길목의 상자 게(P0306)는 보물 정리의 주문서가 있어야 싸울 수 있으므로, 비석은 길목보다 앞에 있어야 한다
    await bump(page, "m_P0306");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);
    await lesson(page, "rune_L3-3", "arr.sort()", "scroll.methods");
    await fightAndWin(page, "m_P0306", "P0306");

    expect(await talk(page, "npc_goblin_clerk")).toBe("npc_goblin_clerk");

    const gold0 = (await save(page)).player.gold;
    expect(await talk(page, "chest_storeroom")).toBe("chest_storeroom");
    expect((await save(page)).player.gold).toBe(gold0 + 50);
    expect((await obj(page, "chest_storeroom")).removed).toBe(true);

    // 그림자 게시판(지역 3 쉼터): 한 번 열어 보고 닫는다
    await interact(page, "board_shadow_r03");
    await settle(page, ".board-modal");
    await expect(page.locator(".board-modal")).toBeVisible();
    await expect(page.locator(".board-modal .quest-item").first()).toBeVisible();
    await page.locator(".board-modal .sys-close").click();
    await expect(page.locator(".board-modal")).toHaveCount(0);
    await settle(page);

    expect(await talk(page, "campfire_storeroom")).toBe("campfire_rest");
    const camp = await obj(page, "campfire_storeroom");
    const s = await save(page);
    expect(s.lastCampfire.regionId).toBe("r03");
    expect(Math.abs(s.lastCampfire.x - camp.x) + Math.abs(s.lastCampfire.y - camp.y)).toBe(1);

    await openBattle(page, "m_P0307", "P0307");
    // treasures = treasures.sort() → None → TypeError, 3번째 줄
    await castWrong(page, "P0307", "wrong_b.py", ["TypeError", "None"]);
    await expect(msg(page).locator(".err-line")).toHaveText("3번째 줄");
    await expect(msg(page).locator(".diag")).toContainText("sorted(treasures)");
    // k번째를 칸 k로 읽음 → WA 진단
    await castWrong(page, "P0307", "wrong_a.py", ["한 칸 큰 값", "ordered[k - 1]"]);
    await winCurrent(page, "P0307");
    await settle(page);
    expect((await obj(page, "m_P0307")).removed).toBe(true);
  });

  test("새로고침: 고블린 동굴의 위치·진행이 그대로", async () => {
    test.setTimeout(120_000);
    const p0 = await where(page);
    const s0 = await save(page);
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    expect(s1.location.regionId).toBe("r03");
    for (const id of ["m_P0301", "m_P0302", "m_P0304", "m_P0306", "m_P0307", "chest_storeroom"]) expect((await obj(page, id)).removed, id).toBe(true);
  });

  test("거울 웅덩이: L3-4 → 횃불 사이 바위 틈을 지나 숨겨진 굴 → 상자·P0309 → P0308 오답(순회 중 remove) → 승리", async () => {
    test.setTimeout(400_000);
    await lesson(page, "rune_L3-4", "x % 2 == 0", "scroll.comprehension");

    const crack = caveCrack();
    const chest = await obj(page, "chest_hidden_pool");
    const pool = await obj(page, "rune_L3-4");
    expect(chest.y).toBeLessThan(crack.y);
    expect(pool.y).toBeGreaterThan(crack.y);
    // 틈 바로 아래 칸까지 가서 벽(처럼 보이는 틈)으로 걸어 들어간다
    await walkTo(page, crack.x, crack.y + 1);
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: crack.x, y: crack.y });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: crack.x, y: crack.y - 1 });
    const gold0 = (await save(page)).player.gold;
    expect(await talk(page, "chest_hidden_pool")).toBe("chest_hidden_pool");
    expect((await save(page)).player.gold).toBe(gold0 + 70);
    // 숨겨진 굴의 선택 몬스터: 같은 돌멩이를 두 번 고른 오답 → 진단 → 승리
    await openBattle(page, "m_P0309", "P0309");
    await castWrong(page, "P0309", "wrong_a.py", ["range(i + 1, len(numbers))"]);
    await winCurrent(page, "P0309");
    await settle(page);
    expect((await obj(page, "m_P0309")).removed).toBe(true);

    await openBattle(page, "m_P0308", "P0308");
    await castWrong(page, "P0308", "wrong_b.py", ["새 리스트"]);
    await winCurrent(page, "P0308");
    await settle(page);
    expect((await obj(page, "m_P0308")).removed).toBe(true);
  });

  test("벽화의 방: 벽화(첫 단서) → L3-5 → P0310 오답([[-1] * m] * n 별칭) → 승리 → 보스 앞 캠프파이어", async () => {
    test.setTimeout(300_000);
    await interact(page, "sign_mural");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_mural");
    expect(texts.join(" ")).toContain("멈추었노라");
    await lesson(page, "rune_L3-5", "1", "scroll.grid");
    await openBattle(page, "m_P0310", "P0310");
    await castWrong(page, "P0310", "wrong_b.py", ["같은 줄 하나를 n번 가리켜"]);
    await castWrong(page, "P0310", "wrong_a.py", ["IndexError", "짧은 줄"]);
    await winCurrent(page, "P0310");
    await settle(page);
    expect((await obj(page, "m_P0310")).removed).toBe(true);

    // 보스 앞 쉼터: 벽화의 방 캠프파이어에서 HP를 채우고 복귀 지점을 옮긴다
    expect(await talk(page, "campfire_mural")).toBe("campfire_rest");
    const camp = await obj(page, "campfire_mural");
    const s = await save(page);
    expect(s.lastCampfire.regionId).toBe("r03");
    expect(Math.abs(s.lastCampfire.x - camp.x) + Math.abs(s.lastCampfire.y - camp.y)).toBe(1);
    await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);
  });

  test("족장의 왕좌: 보스 앞 트리거 → P0311 느린 풀이 1페이즈 통과·2페이즈 TLE(20만 개) → 모범답안 승리 → 클리어 → 실전 추천 → 동쪽 문", async () => {
    test.setTimeout(600_000);
    const boss = await obj(page, "m_P0311");
    const n0 = (await said(page)).length;
    await bump(page, "m_P0311");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0311");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();

    // 매번 max(arr[:i + 1]): 1페이즈(N ≤ 1000) 통과
    const slow = code("P0311", "slow.py");
    await typeCode(page, slow);
    await cast(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();
    // 2페이즈: 같은 코드 → TLE(생성기가 만든 N = 200,000 입력), 시간 게이지 초과, 진단이 먼저
    const t0 = Date.now();
    await cast(page, 400_000);
    const slowMs = Date.now() - t0;
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    // 보스전은 판정과 통과 개수만(2페이즈의 큰 입력 4개 모두 시간 초과)
    await expect(page.locator(".fb")).toContainText("통과 0/4");
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("max(arr[:i + 1])");
    await expect(msg(page)).not.toContainText("폭발");
    await shot(page, "r03-play-boss-phase2.png");

    // 최댓값을 0으로 시작한 풀이 → WA 진단(음수)
    await castWrong(page, "P0311", "wrong_a.py", ["best = 0", "arr[0]"]);
    // O(N) 풀이 → 승리
    await typeCode(page, solution("P0311"));
    const t1 = Date.now();
    await cast(page);
    const modelMs = Date.now() - t1;
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    console.log(`P0311 2페이즈 시전(벽시계): slow.py=${slowMs} ms(TLE), 모범답안=${modelMs} ms(생성기 캐시 후)`);
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("보스 격파!");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+1000 XP");
    await expect(page.locator(".reward-gold .reward-value")).toHaveText("+500 G");
    await page.locator(".reward-ok").click();
    await settle(page, ".recommend-modal");
    const lines = await said(page);
    expect(lines.indexOf("boss_defeated")).toBeGreaterThan(-1);
    expect(lines.indexOf("region_clear")).toBeGreaterThan(lines.indexOf("boss_defeated"));
    // 실전 추천: 프로그래머스 3개(링크, 먼저) + 백준 3개(재개 전이라 비활성)
    await expect(page.locator(".recommend-modal")).toContainText("고블린 동굴");
    await expect(page.locator(".recommend-item")).toHaveCount(6);
    const links = page.locator(".recommend-item.site-programmers a.recommend-link");
    await expect(links).toHaveCount(3);
    await expect(links.first()).toHaveAttribute("href", "https://school.programmers.co.kr/learn/courses/30/lessons/42748");
    for (let i = 0; i < 3; i++) await expect(page.locator(".recommend-item").nth(i)).toHaveAttribute("data-site", "programmers");
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(3);
    await expect(page.locator(".recommend-item.site-boj a")).toHaveCount(0);
    await shot(page, "r03-play-clear.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    const s = await save(page);
    expect(s.flags["region.r03.clear"]).toBe(true);
    for (const id of ["m_P0301", "m_P0302", "m_P0304", "m_P0306", "m_P0307", "m_P0308", "m_P0309", "m_P0310", "m_P0311", "chest_storeroom", "chest_hidden_pool"]) {
      expect(s.removedObjects, id).toContain(id);
    }
    for (const id of ["m_P0303", "m_P0305"]) expect(s.removedObjects, id).not.toContain(id);
    expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.list", "scroll.slice", "scroll.methods", "scroll.comprehension", "scroll.grid"]));
    for (const p of ["P0301", "P0302", "P0304", "P0306", "P0307", "P0308", "P0309", "P0310", "P0311"]) expect(s.problems[p].solved, p).toBe(true);

    // 새로고침해도 클리어 연출이 다시 나오지 않는다
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    expect((await save(page)).location.regionId).toBe("r03");

    // 보스가 있던 칸을 지나 동쪽 끝 문: 지역 4가 아직 없으므로 to_be_continued만 보여 주고 머문다(매번)
    await walkTo(page, boss.x, boss.y);
    for (let k = 0; k < 2; k++) {
      const n = (await said(page)).length;
      await interact(page, "warp_east");
      await settle(page);
      expect((await said(page)).slice(n)).toEqual(["to_be_continued"]);
      expect((await save(page)).location.regionId).toBe("r03");
      await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
    }
  });
});

test.describe("지역 3 실패·잠긴 문·시간 측정", () => {
  test("쓰러짐: 동굴 안에서 쓰러지면 동굴 입구(복귀 지점)에서 HP 가득으로 다시 시작(숲으로 돌아가지 않는다)", async ({ page }) => {
    test.setTimeout(240_000);
    await seedRegion2Cleared(page);
    await crossToCave(page);
    const camp = (await save(page)).lastCampfire;
    expect(camp.regionId).toBe("r03");
    await lesson(page, "rune_L3-1", "-1", "scroll.list");
    const maxHp = (await save(page)).player.hp;

    await openBattle(page, "m_P0301", "P0301");
    const wrong = code("P0301", "wrong_a.py");
    await typeCode(page, wrong);
    for (let i = 0; i < 10 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
    await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("knockout");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
    await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
    const s = await save(page);
    expect(s.location.regionId).toBe("r03");
    expect(s.player.hp).toBe(maxHp);
    expect(s.problems.P0301).toMatchObject({ knockouts: 1, draft: wrong, solved: false });
  });

  test("동쪽 문: 족장을 쓰러뜨리기 전에는 보물 벽에 막혀 있다", async ({ page }) => {
    test.setTimeout(180_000);
    await seedRegion2Cleared(page);
    await crossToCave(page);
    const gate = await obj(page, "warp_east");
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [gate.x - 1, gate.y])).toBeNull();
    await seedAndReload(page, {
      lessons: ["L3-1", "L3-2", "L3-3", "L3-4", "L3-5"],
      removed: ["m_P0301", "m_P0302", "m_P0304", "m_P0306", "m_P0307", "m_P0308", "m_P0310"],
      at: { x: gate.x - 1, y: gate.y, facing: "right" },
    });
    expect((await save(page)).location.regionId).toBe("r03");
    await interact(page, "warp_east");
    await settle(page);
    expect(await said(page)).toEqual(["east_gate_locked"]);
    expect((await save(page)).location.regionId).toBe("r03");
    expect((await obj(page, "m_P0311")).removed).toBe(false);
  });

  test("시간 측정: P0311 2페이즈 생성기·모범답안 채점이 제한보다 훨씬 짧다", async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page);
    const m = await page.evaluate(async () => {
      const W = (window as any).__pyrpg;
      await W.runner.init();
      const p = W.content.regions.find((r: any) => r.id === "r03").problems.find((q: any) => q.id === "P0311");
      const idx = p.tests.map((t: any, i: number) => (t.gen ? i : -1)).filter((i: number) => i >= 0);
      const gen: number[] = [];
      for (const i of idx) {
        const t0 = performance.now();
        await W.runner.testData(p, i);
        gen.push(performance.now() - t0);
      }
      return { idx, gen, refMs: W.runner.referenceMs() };
    });
    expect(m.idx).toHaveLength(4);
    // 생성기는 사용자 코드가 아니라 시간을 재지 않지만, 시전 대기 시간에 들어가므로 짧아야 한다
    const r = await page.evaluate(async (code) => {
      const W = (window as any).__pyrpg;
      const p = W.content.regions.find((r: any) => r.id === "r03").problems.find((q: any) => q.id === "P0311");
      const t0 = performance.now();
      const res = await W.runner.judge(p, code, { scope: "all", phase: 2 });
      return { wall: performance.now() - t0, verdict: res.verdict, limitMs: res.limitMs, times: res.tests.map((t: any) => t.timeMs) };
    }, solution("P0311"));
    // 처음부터(생성기 캐시 없이) 시전 한 번에 드는 전체 시간: 새 페이지에서 다시 잰다
    const page2 = await page.context().newPage();
    await boot(page2);
    const cold = await page2.evaluate(async (code) => {
      const W = (window as any).__pyrpg;
      await W.runner.init();
      const p = W.content.regions.find((r: any) => r.id === "r03").problems.find((q: any) => q.id === "P0311");
      const t0 = performance.now();
      const res = await W.runner.judge(p, code, { scope: "all", phase: 2 });
      return { wall: performance.now() - t0, verdict: res.verdict };
    }, solution("P0311"));
    await page2.close();
    console.log(
      `P0311 2페이즈: ref=${m.refMs.toFixed(1)} ms, 제한=${r.limitMs} ms, 생성기=${m.gen.map((g: number) => g.toFixed(0)).join("/")} ms, ` +
        `모범답안 테스트별=${r.times.map((t: number) => t.toFixed(0)).join("/")} ms, 채점 전체(캐시 후)=${r.wall.toFixed(0)} ms, ` +
        `채점 전체(생성 포함, 새 페이지)=${cold.wall.toFixed(0)} ms`,
    );
    expect(r.verdict).toBe("AC");
    expect(cold.verdict).toBe("AC");
    for (const t of r.times) expect(t * 3).toBeLessThanOrEqual(r.limitMs);
    for (const g of m.gen) expect(g).toBeLessThan(15_000);
  });
});
