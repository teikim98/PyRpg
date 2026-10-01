// 통합 E2E(design.md §12.3, §13 단위 8): 실제 게임(/?e2e)을 실제 키 입력·대화·레슨·CodeMirror·Pyodide 채점으로 플레이한다.
// window.__pyrpg 훅(src/app/e2e.ts)은 좌표·진행도·길찾기만 알려 주고, 이동은 실제 방향키로 보낸다.
// PW_PORT=4178 npx playwright test tests/e2e/game.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const OPP: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

const PROBLEMS = "content/regions/r01-echo-village/problems";
const code = (pid: string, file: string) => readFileSync(`${PROBLEMS}/${pid}/${file}`, "utf8");
const solution = (pid: string) => code(pid, "solution.py");

const SCREENS = "docs/phase2/screens";

/** 화면 기록(docs/phase2/screens). 등장·타격 연출이 끝난 뒤 찍는다 */
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

async function boot(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?e2e");
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
}

/** 저장 데이터를 고쳐 넣고 새로고침해서 그 상태로 시작한다(실패 처리 등 중간 상황 준비용) */
async function seedAndReload(page: Page, seed: Record<string, unknown>): Promise<void> {
  await settle(page);
  await page.evaluate((s) => (window as any).__pyrpg.seed(s), seed);
  await page.reload();
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
  await settle(page);
}

// ───────────── 대화 ─────────────

/**
 * 대화가 떠 있으면 Space로 끝까지 넘기고, 앱이 한가해질 때까지(또는 until 선택자가 보일 때까지) 기다린다.
 * Space는 대화가 떠 있는 것을 확인한 뒤에만 누른다(월드로 새면 상호작용이 되어 버린다).
 */
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
      // 대사가 이어서 나올 수 있으므로 잠깐 더 본다
      if (!idleSince) idleSince = Date.now();
      else if (Date.now() - idleSince > 150) return;
    } else idleSince = 0;
    await page.waitForTimeout(40);
  }
  throw new Error(`settle timeout (until=${until}) said=${(await said(page)).join(",")}`);
}

// ───────────── 이동 ─────────────

/** 실제 방향키 한 번. 한 칸 이동을 마치거나(또는 트리거로 앱이 바빠지거나) 할 때까지 기다린다 */
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

/** BFS 경로를 따라 실제 방향키로 걷는다. 도중에 트리거 대사가 나오면 넘긴다 */
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

/** 오브젝트 옆까지 걸어가서 그쪽을 바라본다. 몬스터는 바라보는 순간 부딪혀 전투가 시작된다 */
async function approach(page: Page, id: string): Promise<Facing> {
  const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), id);
  if (!a) throw new Error(`cannot approach ${id}`);
  await walkTo(page, a.end.x, a.end.y);
  return a.face;
}

async function face(page: Page, dir: Facing): Promise<void> {
  await page.keyboard.press(KEY[dir]);
  await page.waitForFunction((d) => (window as any).__pyrpg.where().facing === d, dir);
}

/** 오브젝트를 바라보고 Space */
async function interact(page: Page, id: string): Promise<void> {
  const dir = await approach(page, id);
  await face(page, dir);
  await page.keyboard.press("Space");
}

/** 몬스터에게 걸어 들어가 전투를 연다 */
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
  // 첫 실행은 Pyodide 부팅을 기다린다
  await expect(page.locator(".lesson-claim")).toBeEnabled({ timeout: 60_000 });
  await expect(page.locator(".exercise .nuri-row")).toHaveAttribute("data-emotion", "happy");
  await page.locator(".lesson-claim").click();
  await page.locator(".scroll-ok").click();
  await settle(page);
}

// ───────────── 전투 ─────────────

const count = (text: string | null, needle: string) => (text ?? "").split(needle).length - 1;

const editor = (page: Page) => page.locator(".battle-editor .cm-content");
/** 에디터에 보이는 코드(짧은 코드라 모든 줄이 그려져 있다) */
const editorText = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll(".battle-editor .cm-line"), (l) => l.textContent ?? "").join("\n"));

/** 에디터 내용을 실제 키 입력으로 바꾼다(전체 선택 → insertText. 자동 들여쓰기의 영향을 받지 않는다) */
async function typeCode(page: Page, text: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
  await expect.poll(() => editorText(page)).toBe(text);
}

/** [시전] 후 판정이 끝날 때까지 */
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

/** 모범답안으로 이기고 보상 창까지 닫는다 */
async function winBattle(page: Page, pid: string): Promise<void> {
  await settle(page, ".battle-modal");
  await expect(page.locator(".battle")).toHaveAttribute("data-problem", pid);
  await typeCode(page, solution(pid));
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  await page.locator(".reward-ok").click();
  await settle(page);
}

async function fightAndWin(page: Page, monster: string, pid: string): Promise<void> {
  await bump(page, monster);
  await winBattle(page, pid);
  expect((await obj(page, monster)).removed).toBe(true);
}

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 1 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("핵심 루프: 새 게임 → 프롤로그 → L1-1 → 문 → L1-2 → P0101 WA/AC → 보상 → 길목 통과", async () => {
    test.setTimeout(240_000);
    await boot(page);
    // 지역 첫 대사가 먼저 뜬다
    await expect(page.locator(".dlg-modal")).toBeVisible();
    await expect(page.locator(".dlg-text")).toContainText("물소리가 들리지 않는다");
    await shot(page, "01-intro.png");
    await settle(page);
    const spawn = await obj(page, "spawn");
    expect(await where(page)).toMatchObject({ x: spawn.x, y: spawn.y, facing: "down" });
    // HUD
    await expect(page.locator(".hud-level")).toHaveText("Lv 1");
    await expect(page.locator(".hud-gold")).toHaveText("0 G");

    // 시작 칸 바로 아래의 프롤로그 트리거
    await step(page, "down");
    await settle(page);
    expect(await said(page)).toEqual(["region_intro", "prologue"]);
    // once 트리거: 다시 밟아도 나오지 않는다
    await step(page, "up");
    await step(page, "down");
    await settle(page);
    expect(await said(page)).toEqual(["region_intro", "prologue"]);

    // 레슨 전에는 문이 잠겨 있다
    await interact(page, "gate_well");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("gate_well_locked");
    expect((await obj(page, "gate_well")).removed).toBe(false);

    // 우물가 비석 → 레슨을 Esc로 닫으면 완료되지 않고, 그 Esc가 메뉴를 열지도 않는다
    await interact(page, "rune_L1-1");
    await settle(page, ".lesson-modal");
    await page.keyboard.press("Escape");
    await expect(page.locator(".lesson-modal")).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.locator(".menu-modal")).toHaveCount(0);
    expect((await save(page)).lessonsCompleted).toEqual([]);
    // 다시 열어 완료
    await interact(page, "rune_L1-1");
    await doLesson(page, "input()", "02-lesson.png");
    expect((await said(page)).slice(-2)).toEqual(["lesson_L1-1_intro", "lesson_L1-1_done"]);
    let s = await save(page);
    expect(s.lessonsCompleted).toEqual(["L1-1"]);
    expect(s.scrolls).toEqual(["scroll.voice"]);
    expect(s.player.xp).toBe(30);
    await expect(page.locator(".hud-scrolls")).toHaveText("주문서 1");

    // 문이 열린다(마주 보고 Space)
    await interact(page, "gate_well");
    await settle(page);
    expect((await obj(page, "gate_well")).removed).toBe(true);
    const gate = await obj(page, "gate_well");
    await walkTo(page, gate.x, gate.y - 1);

    // 주문서 없이 몬스터에 부딪히면 막힌다
    await bump(page, "m_P0101");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    // 광장 비석 → L1-2
    await interact(page, "rune_L1-2");
    await doLesson(page, "int");
    expect((await save(page)).scrolls).toEqual(["scroll.voice", "scroll.convert"]);

    // 전투 P0101: 오답 → WA, HP 감소, 누리 진단, 코드 보존
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    const maxHp = (await save(page)).player.hp;
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp}/${maxHp}`);
    const wrong = code("P0101", "wrong_a.py");
    await typeCode(page, wrong);
    await cast(page);
    await expect(page.locator(".fb-test.verdict-WA").first()).toBeVisible();
    await expect(page.locator(".battle-msg-text")).toContainText("input()은 문자열을 돌려줘요");
    await expect(page.locator(".battle-msg-text .counter")).toContainText("HP −20");
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 20}/${maxHp}`);
    expect(await editorText(page)).toBe(wrong);
    await shot(page, "03-battle-wa.png");

    // 모범답안 → AC → 보상
    await typeCode(page, solution("P0101"));
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+100 XP");
    await expect(page.locator(".reward-gold .reward-value")).toHaveText("+50 G");
    await shot(page, "04-reward.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    s = await save(page);
    expect(s.removedObjects).toContain("m_P0101");
    expect(s.problems.P0101).toMatchObject({ solved: true, attempts: 2, knockouts: 0 });
    expect(s.player.xp).toBe(160); // 레슨 2개(30×2) + 전투 100
    expect(s.player.gold).toBe(50);
    await expect(page.locator(".hud-gold")).toHaveText("50 G");
    await expect(page.locator(".hud-group .hud-small").first()).toContainText("160/");
    // 몬스터가 사라지고 길목을 지나갈 수 있다
    const m = await obj(page, "m_P0101");
    expect(m.removed).toBe(true);
    await walkTo(page, m.x, m.y);
    expect(await where(page)).toMatchObject({ x: m.x, y: m.y });
  });

  test("지역 전체: 필수 몬스터·레슨 → 숨겨진 방 → 보스 P0105(2페이즈 TLE → 공식) → 클리어 → 실전 추천 → 동쪽 문", async () => {
    test.setTimeout(600_000);
    await fightAndWin(page, "m_P0106", "P0106");

    // 상점 거리
    await interact(page, "npc_shopkeeper");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("npc_shopkeeper");
    await interact(page, "rune_L1-3");
    await doLesson(page, "//");
    await interact(page, "chest_shop");
    await settle(page);
    expect((await obj(page, "chest_shop")).removed).toBe(true);
    await fightAndWin(page, "m_P0102", "P0102");
    await fightAndWin(page, "m_P0103", "P0103");

    // 메아리 골목
    await interact(page, "rune_L1-4");
    await doLesson(page, "strip");
    // 숨겨진 방(표지판에서 동쪽 7, 북쪽 4의 덤불은 지나갈 수 있다)
    await interact(page, "sign_alley_riddle");
    await settle(page);
    const sign = await obj(page, "sign_alley_riddle");
    await walkTo(page, sign.x + 7, sign.y - 4);
    const gold0 = (await save(page)).player.gold;
    await interact(page, "chest_hidden");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("chest_hidden");
    expect((await save(page)).player.gold).toBe(gold0 + 50);
    // 숨겨진 방의 선택 몬스터
    await fightAndWin(page, "m_P0110", "P0110");
    await interact(page, "npc_echo_child");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("npc_echo_child");

    await fightAndWin(page, "m_P0104", "P0104");
    await interact(page, "campfire_alley");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("campfire_rest");
    await fightAndWin(page, "m_P0107", "P0107");

    // 보스 전에 동쪽 문은 잠겨 있다? 보스가 계단을 막고 있어 닿을 수 없으므로 보스부터
    const before = await save(page);
    const boss = await obj(page, "m_P0105");
    await bump(page, "m_P0105");
    await settle(page, ".battle-modal");
    expect(await said(page)).toContain("boss_intro");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();
    // 느린 반복문: 1페이즈(정확성)는 통과
    const slow = code("P0105", "slow.py");
    await typeCode(page, slow);
    await cast(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();
    // 2페이즈: 같은 코드 → TLE, 시간 게이지 초과
    await cast(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".battle-msg-text")).toContainText("너무 느려요");
    // TLE를 '폭발'(RE)로 말하지 않는다
    await expect(page.locator(".battle-msg-text")).not.toContainText("폭발");
    await expect(page.locator(".battle-msg-text .err-line")).toHaveText("4번째 줄");
    expect(count(await page.locator(".battle-msg-text").textContent(), "4번째 줄")).toBe(1);
    await shot(page, "05-boss-tle.png");
    // 공식 → 승리
    await typeCode(page, solution("P0105"));
    await cast(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("보스 격파!");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+1000 XP");
    await page.locator(".reward-ok").click();
    // 보스 대사 → 지역 클리어 대사 → 실전 추천
    await settle(page, ".recommend-modal");
    const lines = await said(page);
    expect(lines.indexOf("boss_defeated")).toBeGreaterThan(-1);
    expect(lines.indexOf("region_clear")).toBeGreaterThan(lines.indexOf("boss_defeated"));
    const links = page.locator(".recommend-item.site-programmers a.recommend-link");
    await expect(links).toHaveCount(2);
    await expect(links.first()).toHaveAttribute("href", /^https:\/\/school\.programmers\.co\.kr\/learn\/courses\/30\/lessons\/\d+$/);
    await expect(page.locator(".recommend-item.site-boj a")).toHaveCount(0);
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(4);
    await expect(page.locator(".recommend-item").first()).toHaveAttribute("data-site", "programmers");
    await shot(page, "06-recommended.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    const s = await save(page);
    expect(s.flags["region.r01.clear"]).toBe(true);
    // HUD XP는 지금 레벨 구간 안의 진행도
    const [cur, need] = (await page.locator(".hud-group .hud-small").first().textContent())!.split("/").map(Number);
    expect(cur).toBeLessThan(need);
    await expect(page.locator(".hud-level")).not.toHaveText("Lv 1");
    expect(s.problems.P0105.solved).toBe(true);
    expect(s.player.xp).toBeGreaterThan(before.player.xp + 999);
    for (const id of ["m_P0101", "m_P0106", "m_P0102", "m_P0103", "m_P0104", "m_P0107", "m_P0105", "gate_well", "chest_shop", "chest_hidden"]) {
      expect(s.removedObjects, id).toContain(id);
    }
    // 선택 몬스터는 남아 있다
    for (const id of ["m_P0108", "m_P0109"]) expect(s.removedObjects).not.toContain(id);

    // 메뉴(M) → 코덱스: 얻은 주문서 4개, 예제 실행
    await page.keyboard.press("KeyM");
    await expect(page.locator(".menu-modal")).toBeVisible();
    await page.locator(".menu-codex").click();
    await expect(page.locator(".codex-item")).toHaveCount(4);
    await page.locator('.codex-item[data-lesson="L1-3"]').click();
    await page.locator(".codex-detail .md-run-btn").first().click();
    await expect(page.locator(".codex-detail .md-run-out").first()).not.toHaveText(/실행 중|^$/);
    await page.keyboard.press("Escape");
    await expect(page.locator(".codex-modal")).toHaveCount(0);
    await expect(page.locator(".menu-modal")).toBeVisible();
    // 메뉴를 닫은 Esc가 메뉴를 다시 열지 않는다
    await page.keyboard.press("Escape");
    await expect(page.locator(".menu-modal")).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.locator(".menu-modal")).toHaveCount(0);
    await settle(page);

    // 보스가 있던 칸을 지나 동쪽 문
    await walkTo(page, boss.x, boss.y);
    const n = (await said(page)).length;
    await interact(page, "warp_east");
    await settle(page);
    // 처음 건널 때 openDialogue(다음 지역이 있으면 이어서 그 지역 대사)
    expect((await said(page))[n]).toBe("to_be_continued");
  });

  test("저장/불러오기: 새로고침하면 위치·진행·처치한 몬스터가 그대로, 내보내기 → 초기화 → 불러오기", async () => {
    test.setTimeout(180_000);
    // 한 칸 움직이고 자동 저장(800ms 디바운스)을 기다리지 않고 바로 새로고침해도 위치가 남는다
    const w0 = await where(page);
    const back = (await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x - 1, y), [w0.x, w0.y])) ? "left" : "up";
    await step(page, back as Facing);
    const s0 = await save(page);
    const p0 = await where(page);

    await page.reload();
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    // 지역 첫 대사는 다시 나오지 않는다
    expect(await said(page)).toEqual([]);
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    // 처치한 몬스터는 맵에도 없다(그 칸을 지나갈 수 있다)
    const m = await obj(page, "m_P0105");
    expect(m.removed).toBe(true);
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [m.x, m.y])).not.toBeNull();
    await expect(page.locator(".hud-gold")).toHaveText(`${s1.player.gold} G`);

    // 메뉴 → 내보내기
    await page.keyboard.press("Escape");
    await expect(page.locator(".menu-modal")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator(".menu-export").click()]);
    expect(download.suggestedFilename()).toMatch(/^pyrpg-save-\d{8}-\d{4}\.json$/);
    const file = await download.path();
    const exported = JSON.parse(readFileSync(file!, "utf8"));
    expect(exported.removedObjects).toEqual(s1.removedObjects);

    // 처음부터 → 새 게임
    await page.locator(".menu-reset").click();
    await page.locator(".confirm-yes").click();
    await page.waitForEvent("load");
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    const fresh = await save(page);
    expect(fresh.lessonsCompleted).toEqual([]);
    expect(fresh.removedObjects).toEqual([]);
    expect((await obj(page, "m_P0101")).removed).toBe(false);

    // 불러오기
    await page.keyboard.press("Escape");
    await expect(page.locator(".menu-modal")).toBeVisible();
    await page.locator(".menu-file").setInputFiles(file!);
    await page.waitForEvent("load");
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    const s2 = await save(page);
    expect({ ...s2, updatedAt: "", streak: null }).toEqual({ ...s1, updatedAt: "", streak: null });
    const p2 = await where(page);
    expect({ x: p2.x, y: p2.y }).toEqual({ x: p0.x, y: p0.y });
    expect((await obj(page, "m_P0105")).removed).toBe(true);
  });
});

test.describe("실패와 복구", () => {
  test("쓰러짐: 마지막 캠프파이어에서 HP 가득, 코드 보존. RE 해설. 세 번 쓰러지면 해설서", async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page);
    await settle(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, { lessons: ["L1-1", "L1-2"], removed: ["gate_well"], at: { x: gate.x, y: gate.y - 1 }, flags: ["trigger.r01.t_prologue"] });

    await interact(page, "campfire_plaza");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("campfire_rest");
    const camp = (await save(page)).lastCampfire;
    const fire = await obj(page, "campfire_plaza");
    expect(Math.abs(camp.x - fire.x) + Math.abs(camp.y - fire.y)).toBe(1);
    const maxHp = (await save(page)).player.hp;

    const re = "a, b = input().split()\nprint(a + int(b))";
    const wrong = code("P0101", "wrong_a.py");
    for (let k = 1; k <= 3; k++) {
      await bump(page, "m_P0101");
      await settle(page, ".battle-modal");
      // 이전 시도의 코드가 그대로 남아 있다
      if (k > 1) expect(await editorText(page)).toBe(wrong);
      await expect(page.locator(".act-solution")).toBeDisabled();
      // RE: 줄 번호와 Traceback 해설
      await typeCode(page, re);
      await cast(page);
      await expect(page.locator(".battle-msg-text")).toContainText("주문이 폭발했어");
      await expect(page.locator(".battle-msg-text .err-line")).toHaveText("2번째 줄");
      // 줄 번호는 한 번만(해설 본문에 'n번째 줄:'이 다시 붙지 않는다)
      expect(count(await page.locator(".battle-msg-text").textContent(), "2번째 줄")).toBe(1);
      await expect(page.locator(".battle-msg-text code").first()).toHaveText("TypeError");
      await expect(page.locator(".cm-error-line")).toHaveCount(1);
      await typeCode(page, wrong);
      for (let i = 0; i < 10 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
      await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
      await expect(page.locator(".player-hp-text")).toHaveText(`0/${maxHp}`);
      await page.locator(".banner-ok").click();
      await settle(page);
      expect((await said(page)).includes("knockout")).toBe(true);
      const w = await where(page);
      expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
      const s = await save(page);
      expect(s.player.hp).toBe(maxHp);
      expect(s.problems.P0101.knockouts).toBe(k);
      expect(s.problems.P0101.draft).toBe(wrong);
      await expect(page.locator(".hud-hp-text")).toHaveText(`${maxHp}/${maxHp}`);
    }
    expect(await said(page)).toContain("solution_unlocked");
    expect((await save(page)).flags["solution.unlocked:P0101"]).toBe(true);

    // 해설서가 열린다(보상 0)
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    await expect(page.locator(".act-solution")).toBeEnabled();
    await page.locator(".act-solution").click();
    await page.locator(".confirm-yes").click();
    await expect(page.locator(".solution-code")).toHaveText(solution("P0101").trimEnd());
    await typeCode(page, solution("P0101"));
    await cast(page);
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+0 XP");
    await page.locator(".reward-ok").click();
    await settle(page);
    expect((await save(page)).shadows.map((x: any) => x.concept)).toContain("scroll.convert");
  });

  test("무한루프: while True: pass → TLE, 후퇴 후 이동·메뉴가 반응, 다음 시전은 정상 채점", async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page);
    await settle(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, { lessons: ["L1-1", "L1-2"], removed: ["gate_well"], at: { x: gate.x, y: gate.y - 1 }, flags: ["trigger.r01.t_prologue"] });
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    await typeCode(page, "while True: pass");
    const t0 = Date.now();
    await cast(page);
    expect(Date.now() - t0).toBeLessThan(20_000);
    await expect(page.locator(".fb-test.verdict-TLE").first()).toBeVisible();
    await expect(page.locator(".battle-msg-text")).toContainText("시간이 다 됐어");
    await expect(page.locator(".battle-msg-text")).not.toContainText("폭발");
    // 바로 다음 시전도 정상 채점(WA)
    await typeCode(page, code("P0101", "wrong_a.py"));
    await cast(page);
    await expect(page.locator(".fb-test.verdict-WA").first()).toBeVisible();
    await typeCode(page, "while True: pass");
    await cast(page);
    await expect(page.locator(".fb-test.verdict-TLE").first()).toBeVisible();

    // 후퇴 → 게임이 계속 반응한다
    const at = await where(page);
    await page.locator(".act-retreat").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("retreat");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: at.x, y: at.y });
    // 몬스터 반대쪽을 보고 서 있다(바로 Space를 눌러도 전투가 다시 열리지 않음)
    expect(w.facing).toBe(OPP[at.facing]);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    await expect(page.locator(".battle-modal")).toHaveCount(0);
    await step(page, w.facing);
    await page.keyboard.press("Escape");
    await expect(page.locator(".menu-modal")).toBeVisible();
    await page.locator(".menu-close").click();
    await expect(page.locator(".menu-modal")).toHaveCount(0);
    expect((await save(page)).problems.P0101.draft).toBe("while True: pass");

    // 다시 붙으면 다음 시전은 정상 채점
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    expect(await editorText(page)).toBe("while True: pass");
    await winBattle(page, "P0101");
    expect((await obj(page, "m_P0101")).removed).toBe(true);
  });

  test("치명적 재귀: 깊은 lru_cache → 누리의 특별 안내, 다음 시전 정상", async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page);
    await settle(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, { lessons: ["L1-1", "L1-2"], removed: ["gate_well"], at: { x: gate.x, y: gate.y - 1 }, flags: ["trigger.r01.t_prologue"] });
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    const deep = [
      "import sys",
      "from functools import lru_cache",
      "sys.setrecursionlimit(10**6)",
      "@lru_cache(maxsize=None)",
      "def f(n):",
      "    return 0 if n == 0 else f(n - 1) + 1",
      "a, b = map(int, input().split())",
      "print(f(2000) - 2000 + a + b)",
    ].join("\n");
    await typeCode(page, deep);
    await cast(page);
    // 공통 대사 fatal_recursion(content/common/dialogue.json)
    await expect(page.locator(".battle-msg-text")).toContainText("룬 엔진이 통째로 꺼졌다가 다시 켜졌어");
    await expect(page.locator(".battle-msg-text")).toContainText("재귀가 너무 깊어");
    expect(await editorText(page)).toBe(deep);
    await typeCode(page, solution("P0101"));
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  });
});

test.describe("지역 간 이동", () => {
  // ?e2e&fixtures: 시험 지역 r99를 넣고 에코 마을 warp_east를 r99의 spawn_west로 잇는다(src/app/e2e.ts addE2eFixtures)
  test("동쪽 문 → r99 spawn 옆(등지는 방향), 첫 대사·트리거·HUD·저장, 새로고침해도 r99, 돌아오기", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/?e2e&fixtures");
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    const boss = await obj(page, "m_P0105");
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2", "L1-3", "L1-4"],
      removed: ["m_P0105"],
      at: { x: boss.x, y: boss.y },
      flags: ["trigger.r01.t_prologue", "companion.joined", "region.r01.clear"],
    });
    expect(await said(page)).toEqual([]);

    await interact(page, "warp_east");
    await settle(page);
    expect(await said(page)).toEqual(["to_be_continued", "r99_intro", "r99_hello"]);
    let st = await page.evaluate(() => (window as any).__pyrpg.state());
    expect(st.save.location).toEqual({ regionId: "r99", x: 2, y: 2, facing: "right" });
    expect(st.pos).toEqual({ x: 2, y: 2, facing: "right" });
    await expect(page.locator(".hud-region")).toHaveText("시험의 들판");
    // 새 지역에서도 실제 키로 움직인다
    await step(page, "right");
    await step(page, "down");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: 3, y: 3 });

    // 새로고침: r99의 같은 칸에서 시작하고 첫 대사·트리거는 다시 나오지 않는다
    await page.reload();
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    expect(await said(page)).toEqual([]);
    st = await page.evaluate(() => (window as any).__pyrpg.state());
    expect(st.save.location.regionId).toBe("r99");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: 3, y: 3 });
    await expect(page.locator(".hud-region")).toHaveText("시험의 들판");

    // 돌아가기: warp_west → 에코 마을 warp_east 옆, 문을 등진다
    await interact(page, "warp_west");
    await settle(page);
    expect(await said(page)).toEqual(["r99_back"]);
    await expect(page.locator(".hud-region")).toHaveText("에코 마을");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await save(page)).location.regionId).toBe("r01");

    // 두 번째로 건널 때는 openDialogue 없이 바로
    await interact(page, "warp_east");
    await settle(page);
    expect(await said(page)).toEqual(["r99_back"]);
    await expect(page.locator(".hud-region")).toHaveText("시험의 들판");
  });
});

test.describe("키보드와 오프라인", () => {
  test("키보드 분리: 전투 에디터 입력은 캐릭터를 움직이지 않고, 캔버스를 누르면 다시 이동", async ({ page }) => {
    test.setTimeout(120_000);
    await boot(page);
    await settle(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, { lessons: ["L1-1", "L1-2"], removed: ["gate_well"], at: { x: gate.x, y: gate.y - 1 }, flags: ["trigger.r01.t_prologue"] });
    // 방향키를 누른 채로 몬스터에 부딪혀 전투를 연다(키를 떼지 않음)
    const dir = await approach(page, "m_P0101");
    await page.keyboard.down(KEY[dir]);
    await settle(page, ".battle-modal");
    const before = await where(page);
    await editor(page).click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    // 이동·상호작용·메뉴 키를 섞어서 입력
    await page.keyboard.type("def f(a, b):");
    await page.keyboard.press("Enter");
    await page.keyboard.type("return a + b  # wasd zm");
    for (const k of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "Space", "KeyW", "KeyS", "KeyA", "KeyD", "KeyM"]) await page.keyboard.press(k);
    await page.waitForTimeout(400);
    const typed = await editorText(page);
    expect(typed).toContain("def f(a, b):\n    return a");
    expect(typed).toContain("wsadm");
    const after = await where(page);
    expect({ x: after.x, y: after.y }).toEqual({ x: before.x, y: before.y });
    await expect(page.locator(".battle-modal")).toBeVisible();
    await expect(page.locator(".menu-modal")).toHaveCount(0);

    // 방향키를 누른 채로 후퇴. 키 자동 반복으로는 같은 몬스터와 다시 싸우지 않는다
    // (위에서 같은 키를 press로 뗐으므로 여기서 다시 누른다. 이 keydown은 에디터가 받는다)
    await page.keyboard.down(KEY[dir]);
    await page.locator(".act-retreat").click();
    await settle(page);
    for (let i = 0; i < 5; i++) await page.keyboard.down(KEY[dir]); // repeat=true
    await page.waitForTimeout(400);
    await expect(page.locator(".battle-modal")).toHaveCount(0);
    expect(await where(page)).toMatchObject({ x: before.x, y: before.y });
    await page.keyboard.up(KEY[dir]);
    // 캔버스를 누르면(에디터 포커스 없이) 방향키로 다시 움직인다
    await page.locator("#game canvas").click({ position: { x: 20, y: 400 } });
    expect(await page.evaluate(() => document.activeElement?.closest?.(".cm-editor") ?? null)).toBeNull();
    await step(page, OPP[dir]);
    expect(await where(page)).not.toMatchObject({ x: before.x, y: before.y });
    // 새로 누르면 다시 붙는다
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    expect(await editorText(page)).toContain("def f(a, b):");
  });

  test("오프라인: 외부 요청 없이 부팅(Pyodide는 같은 출처), 네트워크를 끊은 뒤에도 레슨 채점·무한루프 중단이 동작", async ({ page, context }) => {
    test.setTimeout(180_000);
    // 같은 출처가 아닌 요청은 하나도 없어야 한다(CDN 의존 없음)
    const external: string[] = [];
    await context.route(/^(?!http:\/\/localhost[:/]).*/, (route) => {
      external.push(route.request().url());
      return route.abort();
    });
    await boot(page);
    await settle(page);
    await page.evaluate(() => (window as any).__pyrpg.runner.init());
    await context.setOffline(true);
    try {
      await step(page, "down");
      await settle(page);
      await interact(page, "rune_L1-1");
      await doLesson(page, "input()");
      expect((await save(page)).lessonsCompleted).toEqual(["L1-1"]);
      const r = await page.evaluate(() => (window as any).__pyrpg.runner.run({ code: "print(6 * 7)" }));
      expect(r.stdout).toBe("42\n");
      // 무한루프는 소프트 중단(워커 재사용)이라 오프라인에서도 바로 다음 실행이 된다
      const loop = await page.evaluate(() => (window as any).__pyrpg.runner.run({ code: "while True: pass", timeoutMs: 800 }));
      expect(loop.timedOut).toBe(true);
      const next = await page.evaluate(() => (window as any).__pyrpg.runner.run({ code: "print('ok')" }));
      expect(next.stdout).toBe("ok\n");
    } finally {
      await context.setOffline(false);
    }
    expect(external).toEqual([]);

    // 이 테스트의 첫 방문은 service worker가 아직 제어하지 않으므로, 오프라인에서 워커를 다시 만들면 Pyodide를 못 받을 수 있다.
    // 다시 연결되면 스스로 복구하는지만 확인한다. 오프라인 새로고침·재생성은 offline.spec.ts에서 확인한다.
    const deep = "import sys\nfrom functools import lru_cache\nsys.setrecursionlimit(10**6)\n@lru_cache(maxsize=None)\ndef f(n):\n    return 0 if n == 0 else f(n - 1) + 1\nprint(f(2000))";
    await context.setOffline(true);
    try {
      const fatal = await page.evaluate((c) => (window as any).__pyrpg.runner.run({ code: c }), deep);
      expect(fatal.fatal).toBe(true);
    } finally {
      await context.setOffline(false);
    }
    await expect
      .poll(() => page.evaluate(() => (window as any).__pyrpg.runner.run({ code: "print('alive')" }).then((r: any) => r.stdout, () => "")), { timeout: 60_000 })
      .toBe("alive\n");
  });
});
