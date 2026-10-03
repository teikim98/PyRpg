// 시스템 화면 E2E(단위 3-1, design.md §7.2~§7.6): 실제 게임(/?e2e)에서 실제 키·클릭으로
// 그림자 게시판 → 그림자전, 일일 퀘스트와 상자, 상점, 장비(망토·깃털), 칭호를 확인한다.
// 단위 3-4: 기록관의 안경(Traceback 해설의 코덱스 바로가기, region04-spec.md §6. 단위 3-5부터 해설 위)
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
    // 메아리 고리는 지역 6 상점부터(앞 지역에는 실루엣도 없다, region06-spec.md §7.2)
    await expect(page.locator('.shop-item[data-item="echo-ring"]')).toHaveCount(0);
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
    // 메아리 고리: 준비 중이 아니고, 아직 없으면 얻는 곳(지역 6 상점)
    await expect(page.locator('.equip-item[data-item="echo-ring"]')).not.toContainText("준비 중");
    await expect(page.locator('.equip-item[data-item="echo-ring"]')).toContainText("지역 6 상점");
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

test.describe.serial("기록관의 안경(단위 3-4)", () => {
  const msgText = (page: Page) => page.locator(".battle-msg-text");
  const codexLink = (page: Page) => page.locator(".battle-msg-text .codex-link");
  const hpText = (page: Page) => page.locator(".player-hp-text").textContent();

  /** 바로가기 → 그 레슨을 펼친 코덱스 → Esc로 닫으면 전투로 돌아와 코드·HP·포커스가 그대로 */
  async function roundTrip(page: Page, lessonId: string, title: string, code: string): Promise<void> {
    const hp = await hpText(page);
    // 키보드로: 버튼에 포커스를 두고 Enter
    await codexLink(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".codex-modal")).toBeVisible();
    await expect(page.locator(`.codex-item[data-lesson="${lessonId}"]`)).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".codex-lesson-title")).toHaveText(title);
    await expect(page.locator(`.codex-item[data-lesson="${lessonId}"]`)).toBeFocused();
    // 전투 창은 코덱스 아래에 그대로 있다
    await expect(page.locator(".battle-modal")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".codex-modal")).toHaveCount(0);
    await expect(page.locator(".battle-modal")).toBeVisible();
    expect(await editorText(page)).toBe(code);
    expect(await hpText(page)).toBe(hp);
    await expect(codexLink(page)).toBeFocused();
  }

  test("장비에서 안경을 끼면 RE 해설 아래에 배운 레슨의 코덱스 바로가기, 코덱스를 닫으면 전투로. 빼면 없음", async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2"],
      removed: ["gate_well"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
      patch: { inventory: { "archivist-glasses": 1 } },
    });

    // 장비: 안경은 '준비 중'이 아니고 낄 수 있다
    await openMenu(page, ".menu-equipment", ".equip-modal");
    const glasses = page.locator('.equip-item[data-item="archivist-glasses"]');
    await expect(glasses).not.toContainText("준비 중");
    await page.locator('.equip-toggle[data-item="archivist-glasses"]').click();
    await expect(glasses).toHaveClass(/is-equipped/);
    await closeAll(page);
    expect((await save(page)).equipment).toEqual(["archivist-glasses"]);

    // 진단이 없는 RE: 해설 위(첫 줄)에 바로가기(L1-2 변환의 주문)
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    const concat = "a, b = input().split()\nprint(a + 1)";
    await typeCode(page, concat);
    await cast(page);
    await expect(msgText(page)).toContainText("TypeError");
    await expect(codexLink(page)).toHaveText("📖 코덱스: 변환의 주문: 문자열과 숫자");
    // 바로가기는 해설 위(첫 줄 끝)에 있다(해설이 길어도 스크롤 없이 보이게, 단위 3-5)
    await expect(page.locator(".battle-msg-text .err-lead .codex-link")).toBeVisible();
    await shot(page, "systems-glasses-link.png");
    await roundTrip(page, "L1-2", "변환의 주문: 문자열과 숫자", concat);

    // 아직 배우지 않은 레슨(IndexError → L3-1)이면 바로가기 없음
    const index = "print([][1])";
    await typeCode(page, index);
    await cast(page);
    await expect(msgText(page)).toContainText("IndexError");
    await expect(codexLink(page)).toHaveCount(0);
    // 직접 실행(예제 밖)의 에러 해설에도 붙는다
    await typeCode(page, concat);
    await page.locator(".custom-run-box summary").click();
    await page.locator(".custom-stdin").fill("1 2");
    await page.locator(".custom-run").click();
    await expect(codexLink(page)).toBeVisible({ timeout: 60_000 });
    await page.locator(".act-retreat").click();
    await settle(page);
    // 전투 중에 연 코덱스로 작성 코드가 지워지지 않았다
    expect((await save(page)).problems.P0101.draft).toBe(concat);

    // 안경을 빼면 지금과 똑같다(바로가기 없음)
    await openMenu(page, ".menu-equipment", ".equip-modal");
    await page.locator('.equip-toggle[data-item="archivist-glasses"]').click();
    await expect(glasses).not.toHaveClass(/is-equipped/);
    await closeAll(page);
    await bump(page, "m_P0101");
    await settle(page, ".battle-modal");
    expect(await editorText(page)).toBe(concat);
    await cast(page);
    await expect(msgText(page)).toContainText("TypeError");
    await expect(codexLink(page)).toHaveCount(0);
    await page.locator(".act-retreat").click();
    await settle(page);
  });

  test("진단이 먼저 나오고 일반 해설이 접혀 있어도 바로가기는 머리 줄의 [자세히] 옆에 보인다", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2", "L1-3", "L1-4"],
      removed: ["gate_well", "m_P0101", "m_P0106", "m_P0102", "m_P0103"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
      patch: { inventory: { "archivist-glasses": 1 }, equipment: ["archivist-glasses"] },
    });
    await bump(page, "m_P0104");
    await settle(page, ".battle-modal");
    // 문제 전용 진단이 있는 RE(str * str): 진단이 본문, 일반 해설은 [자세히]로 접힘
    const code = readFileSync("content/regions/r01-echo-village/problems/P0104/wrong_b.py", "utf8").replace(/\r\n/g, "\n").replace(/\n$/, "");
    await typeCode(page, code);
    await cast(page);
    await expect(page.locator(".battle-msg-text .diag")).toBeVisible();
    await expect(page.locator(".battle-msg-text .err-explain")).toBeHidden();
    await expect(page.locator(".battle-msg-text .err-head .codex-link")).toBeVisible();
    await expect(codexLink(page)).toHaveText("📖 코덱스: 빠른 귀의 주문: sys.stdin.readline");
    await shot(page, "systems-glasses-collapsed.png");
    await roundTrip(page, "L1-4", "빠른 귀의 주문: sys.stdin.readline", code);
    // [자세히]는 그대로 동작한다
    await page.locator(".battle-msg-text .err-more").click();
    await expect(page.locator(".battle-msg-text .err-explain")).toBeVisible();
    await page.locator(".act-retreat").click();
    await settle(page);
  });
});

test.describe.serial("메아리 고리(단위 3-6, region06-spec.md §7.2)", () => {
  /** 거터의 줄별 표시: 줄 번호 → 문구 */
  const gutterCounts = (page: Page) =>
    page.evaluate(() => {
      const out: Record<number, string> = {};
      const lines = Array.from(document.querySelectorAll(".battle-editor .cm-lineNumbers .cm-gutterElement")) as HTMLElement[];
      const marks = Array.from(document.querySelectorAll(".battle-editor .cm-echo-gutter .cm-gutterElement")) as HTMLElement[];
      // 같은 높이(top)의 줄 번호와 짝짓는다
      for (const m of marks) {
        const text = m.textContent ?? "";
        if (!text) continue;
        const top = m.getBoundingClientRect().top;
        const ln = lines.find((l) => Math.abs(l.getBoundingClientRect().top - top) < 2 && /^\d+$/.test(l.textContent ?? ""));
        if (ln) out[Number(ln.textContent)] = text;
      }
      return out;
    });

  test("지역 6 상점에서 사서 끼면 [예제 실행]에서 줄 번호 옆에 줄별 실행 횟수, 코드를 고치면 지워지고, 시전은 그대로", async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    const cur = await save(page);
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2", "L1-3"],
      removed: ["gate_well", "m_P0101", "m_P0106"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
      patch: { player: { ...cur.player, gold: 300, hp: 100 } },
    });

    // 에코 마을(지역 1) 상점: 메아리 고리가 없다
    await interact(page, "shop_echo");
    await settle(page, ".shop-modal");
    await expect(page.locator(".shop-item").first()).toBeVisible();
    await expect(page.locator('.shop-item[data-item="echo-ring"]')).toHaveCount(0);
    await closeAll(page);

    // 이 worktree에는 지역 6이 없으므로, 지금 지역의 순서만 6으로 바꿔 '지역 6 상점'을 흉내 낸다
    await page.evaluate(() => ((window as any).__pyrpg.app.region.order = 6));
    await interact(page, "shop_echo");
    await settle(page, ".shop-modal");
    const ring = page.locator('.shop-item[data-item="echo-ring"]');
    await expect(ring).toBeVisible();
    await expect(ring).toContainText("200 G");
    await expect(ring).not.toContainText("준비 중");
    await page.locator('.shop-buy[data-buy="echo-ring"]').click();
    await expect(page.locator(".shop-status")).toContainText("메아리 고리");
    await expect(ring).toHaveAttribute("data-state", "owned");
    await closeAll(page);
    expect((await save(page)).inventory["echo-ring"]).toBe(1);

    await openMenu(page, ".menu-equipment", ".equip-modal");
    await page.locator('.equip-toggle[data-item="echo-ring"]').click();
    await expect(page.locator('.equip-item[data-item="echo-ring"]')).toHaveClass(/is-equipped/);
    await closeAll(page);
    expect((await save(page)).equipment).toEqual(["echo-ring"]);

    // 지역 1 문제에서 [예제 실행](공개 예제 '7 2' 하나)
    await bump(page, "m_P0102");
    await settle(page, ".battle-modal");
    const code = [
      "a, b = map(int, input().split())",
      "steps = 0",
      "for i in range(10000):",
      "    for j in range(b + 1):",
      "        steps += 1",
      "print(a // b, a % b)",
    ].join("\n");
    await typeCode(page, code);
    await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(0);
    await page.locator(".act-public").click();
    await expect(page.locator(".battle-editor .cm-echo-count").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".battle-msg-text")).toContainText("예제는 전부 통과");
    await expect(page.locator(".battle-msg-text .echo-note")).toContainText("메아리 고리");
    const counts = await gutterCounts(page);
    // 몸통 줄: 1만 × (2 + 1) = 3만, 바깥 반복의 안쪽 for는 1만 × (3 + 1) = 4만(끝 확인 한 번씩 포함)
    expect(counts[1]).toBe("×1");
    expect(counts[2]).toBe("×1");
    expect(counts[5]).toBe("×3만");
    expect(counts[6]).toBe("×1");
    expect(counts[3]).toMatch(/^×1(\.0)?만$/);
    expect(counts[4]).toMatch(/^×[34](\.\d)?만$/);
    // 정확한 횟수는 마우스를 올리면(title)
    await expect(page.locator(".battle-editor .cm-echo-count", { hasText: "×3만" })).toHaveAttribute("title", "5번째 줄: 30,000번 실행");
    await shot(page, "systems-echo-ring.png");

    // 코드를 고치면 지운다
    await editor(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" ");
    await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(0);

    // 무한루프(시간 초과): 횟수 없이 지금처럼 TLE, 그 뒤 [예제 실행]은 다시 센다
    await typeCode(page, "a, b = map(int, input().split())\nwhile True:\n    a += 1");
    await page.locator(".act-public").click();
    await expect(page.locator(".battle-msg-details")).toContainText("TLE", { timeout: 120_000 });
    await expect(page.locator(".act-public")).toBeEnabled({ timeout: 30_000 });
    await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(0);
    await typeCode(page, solution("P0102").replace(/\r\n/g, "\n").replace(/\n$/, ""));
    await page.locator(".act-public").click();
    await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(2, { timeout: 60_000 });
    expect(await gutterCounts(page)).toEqual({ 1: "×1", 2: "×1" });

    // [시전]은 그대로(채점·판정 영향 없음)
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await page.locator(".reward-ok").click();
    await settle(page);
    expect((await save(page)).problems.P0102.solved).toBe(true);
  });
});

test.describe("중간 보스 화면(단위 3-6, region06-spec.md §7.1)", () => {
  // 지역 6 콘텐츠가 아직 없으므로 UI 하네스(dev/ui.html, 가짜 실행기)에 보스 문제를 중간 보스로 바꿔 넣는다.
  // 실제 지역 6 중간 보스 E2E는 통합 뒤 tests/e2e/region06.spec.ts에서 한다
  test("전투·보상 문구가 '중간 보스'이고, 보스와 같은 페이즈·시간 결계·판정만 공개", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.goto("/dev/ui.html?speed=0");
    await page.waitForFunction(() => (window as any).__uiReady === true);
    await page.evaluate(() => {
      const ui = (window as any).__ui;
      const boss = ui.problems.P0105;
      ui.problems.P0608 = {
        ...boss,
        id: "P0608",
        title: "[중간 보스] 거울 쌍둥이",
        midBoss: true,
        enemy: { ...boss.enemy, name: "거울 쌍둥이" },
        reward: { xp: 400, gold: 200 },
        // 페이즈 소개가 없을 때의 기본 문구를 본다
        phases: boss.phases.map((p: any) => ({ phase: p.phase, name: p.name })),
      };
    });
    const done = page.evaluate(() => (window as any).__ui.battle("P0608", { regionOrder: 6 }));
    const msg = page.locator(".battle-msg-text");
    await expect(page.locator(".battle.is-boss.is-midboss")).toBeVisible();
    await expect(msg).toContainText("중간 보스 거울 쌍둥이가 나타났어!");
    await expect(page.locator(".phase-label")).toHaveText("1페이즈 · 정확성");
    await expect(page.locator(".time-gauge")).toBeHidden();

    const queue = (spec: Record<string, unknown>) => page.evaluate((s) => (window as any).__ui.fake.queueJudge(s), spec);
    await queue({ verdict: "AC" });
    await page.locator(".act-cast").click();
    await expect(page.locator(".phase-label")).toHaveText("2페이즈 · 시간 결계");
    await expect(msg).toContainText("중간 보스가 시간 결계를 펼쳤어!");
    await expect(page.locator(".time-gauge")).toBeVisible();

    // 시간 결계 실패: 판정과 통과 개수만(테스트 내용은 감춤)
    await queue({ verdict: "TLE", fail: [3] });
    await page.locator(".act-cast").click();
    const details = page.locator(".battle-msg-details");
    await expect(details).toContainText("시간 초과(TLE) · 통과 2/3");
    await expect(details.locator(".fb-test")).toHaveCount(0);
    await expect(details).toContainText("판정과 통과 개수만");

    await queue({ verdict: "AC", timeMs: 300 });
    await page.locator(".act-cast").click();
    await page.locator(".banner-ok").click();
    expect(await done).toMatchObject({ result: "victory", attempts: 3, timeBarrierFirstTry: false });

    // 보상 창: '중간 보스 격파!'
    await page.evaluate(() => {
      const ui = (window as any).__ui;
      void ui.ui.reward.show({ xp: 400, gold: 200, penalty: 0, levelBefore: 5, levelAfter: 5 }, ui.problems.P0608);
    });
    await expect(page.locator(".reward-caption")).toHaveText("중간 보스 격파!");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+400 XP");
    await page.locator(".reward-ok").click();
    // 최종 보스는 그대로 '보스 격파!'
    await page.evaluate(() => {
      const ui = (window as any).__ui;
      void ui.ui.reward.show({ xp: 1000, gold: 500, penalty: 0, levelBefore: 5, levelAfter: 5 }, ui.problems.P0105);
    });
    await expect(page.locator(".reward-caption")).toHaveText("보스 격파!");
    await page.locator(".reward-ok").click();
  });
});
