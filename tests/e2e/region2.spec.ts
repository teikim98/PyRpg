// 지역 2(갈림길 숲) 클리어 E2E(docs/phase3/plan.md §3 지역별 검증, docs/phase3/region02-spec.md).
// 지역 1을 끝낸 저장에서 시작해 실제 방향키·대화·레슨·CodeMirror·Pyodide 채점으로 지역 2를 끝까지 플레이한다.
// 도우미는 game.spec.ts와 같은 방식이다(window.__pyrpg 훅은 좌표·진행도·길찾기만, 이동은 실제 키).
// PW_PORT=4195 npx playwright test tests/e2e/region2.spec.ts
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const PROBLEMS = "content/regions/r02-crossroad-forest/problems";
const code = (pid: string, file: string) => readFileSync(`${PROBLEMS}/${pid}/${file}`, "utf8");
const solution = (pid: string) => code(pid, "solution.py");

const SCREENS = "docs/phase3/screens";
// 지역 3(고블린 동굴) 콘텐츠는 다른 브랜치에서 들어온다. 있으면 갈림길 숲 동쪽 문이 그리로 이어진다
const HAS_R03 = existsSync("content/regions/r03-goblin-cave/region.json");

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

/** 맵(map.tmj)의 deco 레이어에서 덤불 타일(지나갈 수 있는 숨겨진 길 입구)의 칸 */
function hiddenBush(): { x: number; y: number } {
  const map = JSON.parse(readFileSync("content/regions/r02-crossroad-forest/map.tmj", "utf8"));
  const ts = map.tilesets[0];
  const gid = ts.firstgid + ts.tiles.find((t: any) => t.type === "bush").id;
  const deco = map.layers.find((l: any) => l.name === "deco").data as number[];
  const col = map.layers.find((l: any) => l.name === "collision").data as number[];
  const cells = deco.map((g, i) => (g === gid && !col[i] ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  // 나무꾼 대사('덤불이 줄지어 있는데, 그중 딱 하나만…'): 같은 줄에 막힌 덤불이 나란히 있다
  const row = Math.floor(cells[0] / map.width);
  const walls = deco.filter((g, i) => g === gid && col[i] && Math.floor(i / map.width) === row);
  expect(walls.length).toBeGreaterThanOrEqual(2);
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

/** 대화창이 뜰 때까지 기다린다(대사 확인용) */
async function dialogueText(page: Page): Promise<string> {
  await expect(page.locator(".dlg-modal")).toBeVisible();
  return (await page.locator(".dlg-text").textContent()) ?? "";
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

async function lesson(page: Page, rune: string, answer: string, shotName?: string): Promise<void> {
  const id = rune.replace("rune_", "");
  await interact(page, rune);
  await doLesson(page, answer, shotName);
  // 일일 퀘스트 보상으로 레벨이 오르면 끝에 level_up이 붙을 수 있다
  const tail = (await said(page)).filter((d) => d !== "level_up").slice(-2);
  expect(tail).toEqual([`lesson_${id}_intro`, `lesson_${id}_done`]);
  expect((await save(page)).lessonsCompleted).toContain(id);
}

// ───────────── 전투 ─────────────

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

async function winBattle(page: Page, pid: string): Promise<void> {
  await settle(page, ".battle-modal");
  await expect(page.locator(".battle")).toHaveAttribute("data-problem", pid);
  await typeCode(page, solution(pid));
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  await expect(page.locator(".reward-xp .reward-value")).toHaveText("+100 XP");
  await expect(page.locator(".reward-gold .reward-value")).toHaveText("+50 G");
  await page.locator(".reward-ok").click();
  await settle(page);
}

async function fightAndWin(page: Page, monster: string, pid: string): Promise<void> {
  await bump(page, monster);
  await winBattle(page, pid);
  expect((await obj(page, monster)).removed).toBe(true);
  expect((await save(page)).problems[pid].solved).toBe(true);
}

// ───────────── 준비: 지역 1을 끝낸 저장 ─────────────

const R01_LESSONS = ["L1-1", "L1-2", "L1-3", "L1-4"];
const R01_FLAGS = ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r01.clear"];

/** 새 게임으로 부팅한 뒤, 지역 1을 다 끝내고(몬스터·문 제거, 레슨 4개) 동쪽 문 바로 앞에 선 저장으로 다시 시작한다 */
async function seedRegion1Cleared(page: Page): Promise<void> {
  await boot(page);
  await settle(page);
  const removed = [...(await objIds(page, "monster")), ...(await objIds(page, "door")), ...(await objIds(page, "chest"))];
  const gate = await obj(page, "warp_east");
  // 동쪽 문 서쪽 칸(보스가 막던 계단 위)
  await seedAndReload(page, { lessons: R01_LESSONS, removed, at: { x: gate.x - 1, y: gate.y, facing: "right" }, flags: R01_FLAGS });
  const w = await where(page);
  expect({ x: w.x, y: w.y }).toEqual({ x: gate.x - 1, y: gate.y });
  expect((await save(page)).problems.P0105.solved).toBe(true);
  expect(await said(page)).toEqual([]);
}

/** 에코 마을 동쪽 문으로 갈림길 숲에 처음 들어간다 */
async function crossToForest(page: Page): Promise<void> {
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
}

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 2 갈림길 숲 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("입장: 에코 마을 동쪽 문 → 첫 대사·숲 트리거 → 서쪽 문으로 돌아갔다가 다시 오기", async () => {
    test.setTimeout(180_000);
    await seedRegion1Cleared(page);

    // 처음 건널 때: r01 openDialogue(에코 마을의 to_be_continued) → 지역 첫 대사 → spawn 옆 트리거(도착 칸)
    await interact(page, "warp_east");
    expect(await dialogueText(page)).toContain("문이 열렸다");
    await settle(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "forest_intro"]);
    await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    const spawn = await obj(page, "spawn_west");
    const trig = await obj(page, "t_forest_intro");
    expect(st.save.location.regionId).toBe("r02");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: trig.x, y: trig.y });
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    expect(st.save.flags["trigger.r02.t_forest_intro"]).toBe(true);
    expect(st.save.flags["region.r02.intro"]).toBe(true);
    // 누리가 함께 다닌다(대사 화자 companion)
    expect(st.save.flags["companion.joined"]).toBe(true);

    // 서쪽 문 → 에코 마을 동쪽 문 옆
    await interact(page, "warp_west");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("에코 마을");
    expect((await save(page)).location.regionId).toBe("r01");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await said(page)).slice(3)).toEqual([]);

    // 다시 건너면 대사 없이 바로(once 트리거·지역 첫 대사·openDialogue 모두 한 번만)
    await interact(page, "warp_east");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "forest_intro"]);
  });

  test("숲 입구: 표지판 → L2-1 → P0201 WA(진단)/AC → 캠프파이어 → P0203", async () => {
    test.setTimeout(300_000);
    await interact(page, "sign_forest");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("sign_forest");

    // 주문서 없이 갈래 새싹에 부딪히면 막힌다
    await bump(page, "m_P0201");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L2-1", "elif", "r02-play-lesson.png");
    expect((await save(page)).scrolls).toContain("scroll.branch");

    // P0201: 문자열 "0"과 비교 → WA, 누리 진단, HP 감소
    await bump(page, "m_P0201");
    await settle(page, ".battle-modal");
    const maxHp = (await save(page)).player.hp;
    const wrong = code("P0201", "wrong_b.py");
    await typeCode(page, wrong);
    await cast(page);
    await expect(page.locator(".fb-test.verdict-WA").first()).toBeVisible();
    await expect(page.locator(".battle-msg-text")).toContainText("짝수인데도 오른쪽으로 갔어.");
    // 반격은 실패한 테스트 비율만큼(공격력 20, 7개 중 4개 실패 → 11)
    await expect(page.locator(".battle-msg-text .counter")).toContainText("HP −11");
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 11}/${maxHp}`);
    expect(await editorText(page)).toBe(wrong);
    await shot(page, "r02-play-battle-wa.png");
    // int() 누락 → RE, TypeError 진단
    await typeCode(page, code("P0201", "wrong_a.py"));
    await cast(page);
    await expect(page.locator(".battle-msg-text")).toContainText("문자열 서식");
    // 모범답안
    await typeCode(page, solution("P0201"));
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+100 XP");
    await page.locator(".reward-ok").click();
    await settle(page);
    expect((await save(page)).problems.P0201).toMatchObject({ solved: true, attempts: 3 });
    expect((await obj(page, "m_P0201")).removed).toBe(true);

    await interact(page, "campfire_entrance");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("campfire_rest");
    const s = await save(page);
    expect(s.lastCampfire.regionId).toBe("r02");
    // 승리로 레벨이 올라 최대 HP가 늘었을 수 있다. 쉬면 가득
    expect(s.player.hp).toBeGreaterThanOrEqual(maxHp);
    await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);

    await fightAndWin(page, "m_P0203", "P0203");
  });

  test("새로고침: 갈림길 숲의 위치·진행이 그대로", async () => {
    test.setTimeout(120_000);
    const p0 = await where(page);
    const s0 = await save(page);
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    expect(s1.location.regionId).toBe("r02");
    for (const id of ["m_P0201", "m_P0203"]) expect((await obj(page, id)).removed).toBe(true);
    // 처치한 길목을 지나 고리 길로 갈 수 있다
    const m = await obj(page, "m_P0203");
    await walkTo(page, m.x, m.y);
  });

  test("고리 길: 표지판·여행자 → L2-2 → P0204 → 상자 → P0206", async () => {
    test.setTimeout(300_000);
    await interact(page, "sign_loop");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("sign_loop");
    await interact(page, "npc_lost_traveler");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("npc_lost_traveler");
    await lesson(page, "rune_L2-2", "6");
    await fightAndWin(page, "m_P0204", "P0204");
    const gold0 = (await save(page)).player.gold;
    await interact(page, "chest_loop");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("chest_loop");
    expect((await save(page)).player.gold).toBe(gold0 + 40);
    await fightAndWin(page, "m_P0206", "P0206");
  });

  test("멈춘 개울: L2-3 → 나무꾼 귀띔 → 개울 따라 북쪽 덤불 → 숨겨진 쉼터 상자·P0208 → P0207 → L2-4 → 캠프파이어", async () => {
    test.setTimeout(400_000);
    await lesson(page, "rune_L2-3", "continue");
    await interact(page, "npc_woodcutter");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("npc_woodcutter");

    // 숨겨진 길: 나무꾼 대사대로 개울 서쪽 기슭을 따라 북쪽으로 올라가, 개울에 맞닿은 덤불을 밀고 지나간다
    const chest = await obj(page, "chest_hidden_grove");
    const wc = await obj(page, "npc_woodcutter");
    const bush = hiddenBush();
    // 쉼터는 덤불을 지나지 않고는 닿을 수 없다(덤불 바로 아래 칸까지만 길이 있다)
    await walkTo(page, bush.x, bush.y + 1);
    expect(bush.y).toBeLessThan(wc.y);
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: bush.x, y: bush.y });
    await step(page, "up");
    await walkTo(page, chest.x, chest.y + 1);
    const gold0 = (await save(page)).player.gold;
    await interact(page, "chest_hidden_grove");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("chest_hidden_grove");
    expect((await save(page)).player.gold).toBe(gold0 + 60);
    // 숨겨진 쉼터의 선택 몬스터
    await fightAndWin(page, "m_P0208", "P0208");

    await fightAndWin(page, "m_P0207", "P0207");
    await lesson(page, "rune_L2-4", "n");
    await interact(page, "campfire_stream");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("campfire_rest");
    expect((await save(page)).lastCampfire.regionId).toBe("r02");
  });

  test("수호목: P0209 → 보스 앞 트리거 → P0210 느린 풀이 1페이즈 통과·2페이즈 TLE → √N 풀이 승리 → 클리어 → 실전 추천 → 동쪽 문", async () => {
    test.setTimeout(400_000);
    await fightAndWin(page, "m_P0209", "P0209");

    const boss = await obj(page, "m_P0210");
    const n0 = (await said(page)).length;
    await bump(page, "m_P0210");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();
    // 1..N 반복: 1페이즈(N ≤ 1000) 통과
    const slow = code("P0210", "slow.py");
    await typeCode(page, slow);
    await cast(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();
    // 2페이즈: 같은 코드 → TLE, 시간 게이지 초과, 누리 진단
    await cast(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".battle-msg-text")).toContainText("너무 느려.");
    await expect(page.locator(".battle-msg-text")).not.toContainText("폭발");
    await shot(page, "r02-play-boss-phase2.png");
    // 완전제곱수를 두 번 센 풀이 → WA(숨김 테스트)와 진단
    await typeCode(page, code("P0210", "wrong_a.py"));
    await cast(page);
    await expect(page.locator(".battle-msg-text")).toContainText("짝의 두 수가 같아.");
    // √N 풀이 → 승리
    await typeCode(page, solution("P0210"));
    await cast(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
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
    // 실전 추천: 지역 2는 백준 6개(재개 전이라 링크 비활성)
    await expect(page.locator(".recommend-modal")).toContainText("갈림길 숲");
    await expect(page.locator(".recommend-item")).toHaveCount(6);
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(6);
    await expect(page.locator(".recommend-item a")).toHaveCount(0);
    await expect(page.locator(".recommend-note")).toBeVisible();
    await shot(page, "r02-play-clear.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    const s = await save(page);
    expect(s.flags["region.r02.clear"]).toBe(true);
    for (const id of ["m_P0201", "m_P0203", "m_P0204", "m_P0206", "m_P0207", "m_P0208", "m_P0209", "m_P0210", "chest_loop", "chest_hidden_grove"]) {
      expect(s.removedObjects, id).toContain(id);
    }
    for (const id of ["m_P0202", "m_P0205"]) expect(s.removedObjects, id).not.toContain(id);
    expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.branch", "scroll.loop", "scroll.while", "scroll.gather"]));
    for (const p of ["P0201", "P0203", "P0204", "P0206", "P0207", "P0208", "P0209", "P0210"]) expect(s.problems[p].solved, p).toBe(true);

    // 새로고침해도 클리어 연출이 다시 나오지 않는다
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    expect((await save(page)).location.regionId).toBe("r02");

    // 보스가 있던 칸을 지나 동쪽 끝 문(target=r03, targetSpawn=spawn_west).
    // 지역 3 콘텐츠(region.json)가 있으면 고블린 동굴로 건너가고, 아직 없으면 to_be_continued만 보여 주고 머문다
    await walkTo(page, boss.x, boss.y);
    if (HAS_R03) {
      await interact(page, "warp_east");
      await settle(page);
      expect(await said(page)).toEqual(["to_be_continued", "region_intro", "cave_intro"]);
      expect((await save(page)).location.regionId).toBe("r03");
      await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
      // 동굴 서쪽 문 → 갈림길 숲 동쪽 문 옆(이번에는 대사 없이)
      await interact(page, "warp_west");
      await settle(page);
      await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
      expect((await save(page)).location.regionId).toBe("r02");
      const gate = await obj(page, "warp_east");
      const back = await where(page);
      expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
      expect((await said(page)).slice(3)).toEqual([]);
    } else {
      for (let k = 0; k < 2; k++) {
        const n = (await said(page)).length;
        await interact(page, "warp_east");
        await settle(page);
        expect((await said(page)).slice(n)).toEqual(["to_be_continued"]);
        expect((await save(page)).location.regionId).toBe("r02");
        await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
      }
    }
  });
});

test.describe("지역 2 실패와 잠긴 문", () => {
  test("쓰러짐: 갈림길 숲 캠프파이어에서 HP 가득으로 다시 시작(에코 마을로 돌아가지 않는다)", async ({ page }) => {
    test.setTimeout(240_000);
    await seedRegion1Cleared(page);
    await crossToForest(page);
    // 레슨만 끝낸 상태로 첫 길목 앞
    await interact(page, "campfire_entrance");
    await settle(page);
    const camp = (await save(page)).lastCampfire;
    expect(camp.regionId).toBe("r02");
    await lesson(page, "rune_L2-1", "elif");
    const maxHp = (await save(page)).player.hp;

    await bump(page, "m_P0201");
    await settle(page, ".battle-modal");
    const wrong = code("P0201", "wrong_b.py");
    await typeCode(page, wrong);
    for (let i = 0; i < 10 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
    await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("knockout");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
    await expect(page.locator(".hud-region")).toHaveText("갈림길 숲");
    const s = await save(page);
    expect(s.location.regionId).toBe("r02");
    expect(s.player.hp).toBe(maxHp);
    expect(s.problems.P0201).toMatchObject({ knockouts: 1, draft: wrong, solved: false });
  });

  test("동쪽 문: 수호목을 쓰러뜨리기 전에는 뿌리에 막혀 있다", async ({ page }) => {
    test.setTimeout(180_000);
    await seedRegion1Cleared(page);
    await crossToForest(page);
    // 보스 뒤 공터에 서 있는 저장(보스는 아직 살아 있음). 보스가 1칸 통로를 막아 걸어서는 갈 수 없다
    const gate = await obj(page, "warp_east");
    const boss = await obj(page, "m_P0210");
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [gate.x - 1, gate.y])).toBeNull();
    await seedAndReload(page, {
      lessons: ["L2-1", "L2-2", "L2-3", "L2-4"],
      removed: ["m_P0201", "m_P0203", "m_P0204", "m_P0206", "m_P0207", "m_P0209"],
      at: { x: gate.x - 1, y: gate.y, facing: "right" },
    });
    expect((await save(page)).location.regionId).toBe("r02");
    await interact(page, "warp_east");
    await settle(page);
    expect(await said(page)).toEqual(["east_gate_locked"]);
    expect((await obj(page, "warp_east")).removed).toBe(false);
    expect((await save(page)).location.regionId).toBe("r02");
    // 보스 뒤쪽에서 부딪혀도 보스전이 열린다(뒤로 돌아온 경우)
    expect((await obj(page, "m_P0210")).removed).toBe(false);
    expect(boss.x).toBeLessThan(gate.x);
  });
});
