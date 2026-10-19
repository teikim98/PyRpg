// 지역 7 시스템 E2E(docs/phase3/region07-spec.md §9.1·§9.2): 시험 지역 r99(?e2e&fixtures, tests/fixtures/regions/r99.ts)에서
// 실제 키·클릭으로 고장 난 다리 퍼즐(Z9901)과 보스 복잡도 예측 질문(중간 보스 P9901)을 확인한다.
// 실제 지역 7 데이터로 하는 확인은 통합 뒤 지역 7 클리어 E2E가 한다.
// PW_PORT=4326 npx playwright test tests/e2e/region07-system.spec.ts
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

// 스크린샷은 커밋하지 않는 test-results 아래에(눈으로 확인용)
const SHOTS = "test-results/region07-system";
mkdirSync(SHOTS, { recursive: true });

const where = (page: Page) => page.evaluate(() => (window as any).__pyrpg.where()) as Promise<{ x: number; y: number; facing: Facing; busy: boolean; modal: boolean }>;
const save = (page: Page) => page.evaluate(() => (window as any).__pyrpg.state().save);
const said = (page: Page) => page.evaluate(() => (window as any).__pyrpg.said.slice()) as Promise<string[]>;
const obj = (page: Page, id: string) =>
  page.evaluate((id) => (window as any).__pyrpg.objects().find((o: any) => o.id === id), id) as Promise<{ id: string; x: number; y: number; removed: boolean } | undefined>;
const pathTo = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [x, y]) as Promise<Facing[] | null>;

async function ready(page: Page): Promise<void> {
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

/** r99의 (x, y)에 선 저장으로 다시 시작한다(지역 첫 대사·트리거는 본 상태) */
async function bootR99(page: Page, x: number, y: number, patch: Record<string, unknown> = {}): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?e2e&fixtures");
  await ready(page);
  await page.evaluate(
    (s) => (window as any).__pyrpg.seed(s),
    {
      flags: ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r99.intro", "trigger.r99.t_r99_hello"],
      patch: { location: { regionId: "r99", x, y, facing: "down" }, ...patch },
    },
  );
  await page.reload();
  await ready(page);
  expect((await save(page)).location.regionId).toBe("r99");
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
  for (let i = 0; i < 100; i++) {
    await settle(page);
    const path = await pathTo(page, x, y);
    if (!path) throw new Error(`no path to ${x},${y}`);
    if (path.length === 0) return;
    await step(page, path[0]);
  }
  throw new Error("walkTo: too many steps");
}

async function interact(page: Page, id: string): Promise<void> {
  const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), id);
  if (!a) throw new Error(`cannot approach ${id}`);
  await walkTo(page, a.end.x, a.end.y);
  await page.keyboard.press(KEY[a.face as Facing]);
  await page.waitForFunction((d) => (window as any).__pyrpg.where().facing === d, a.face);
  await page.keyboard.press("Space");
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

const STARTER =
  "def solution(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i < n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True";
const FIXED = STARTER.replace("i * i < n", "i * i <= n");
const SUM_FAST = "def solution(n):\n    return n * (n + 1) // 2";
const SUM_SLOW = "def solution(n):\n    s = 0\n    for i in range(n + 1):\n        s += i\n    return s";

test.describe("지역 7 시스템(시험 지역 r99)", () => {
  test("고장 난 다리: 막힌 다리 → 퍼즐 창(시작 코드 실패, 반격 없음) → 고쳐 통과 → 다리가 사라지고 지나감 → 새로고침해도 유지", async ({ page }) => {
    test.setTimeout(240_000);
    await bootR99(page, 6, 2);
    const door = (await obj(page, "bridge_r99"))!;
    expect(door.removed).toBe(false);
    // 문 칸은 막혀 있다
    expect(await pathTo(page, door.x, door.y)).toBeNull();

    await interact(page, "bridge_r99");
    await settle(page, ".battle-modal");
    expect(await said(page)).toEqual(["r99_bridge_broken"]);
    const battle = page.locator(".battle");
    await expect(battle).toHaveClass(/is-puzzle/);
    await expect(page.locator(".enemy-name")).toHaveText("시험 다리");
    await expect(page.locator(".player-info")).toBeHidden();
    await expect(page.locator(".act-solution")).toBeHidden();
    await expect(page.locator(".act-potion")).toBeHidden();
    await expect(page.locator(".act-hint-2")).toHaveText("힌트 2");
    await expect(page.locator(".battle-msg-text")).toContainText("장치 코드에 버그가 있어");
    // 시작 코드는 빈 틀이 아니라 버그가 든 starter
    await expect.poll(() => editorText(page)).toBe(`${STARTER}\n`);

    // 힌트는 확인 창 없이(대가 없음) 열린다
    await page.locator(".act-hint-1").click();
    await page.locator(".act-hint-2").click();
    await expect(page.locator(".confirm-modal")).toHaveCount(0);
    await expect(page.locator(".act-hint-2")).toHaveText("힌트 2 ✓");

    // 시작 코드 그대로 시전: 49·9에서 실패, 반격 없음
    await cast(page);
    await expect(page.locator(".counter")).toContainText("장치는 반격하지 않아");
    await expect(page.locator(".battle-banner")).toBeHidden();
    await page.screenshot({ path: `${SHOTS}/puzzle-fail.png` });

    // 한 글자 고쳐 통과
    await typeCode(page, FIXED);
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory.is-puzzle")).toBeVisible();
    await expect(page.locator(".banner-title")).toHaveText("수리 완료!");
    await page.screenshot({ path: `${SHOTS}/puzzle-solved.png` });
    // 배너를 누르기 전에 이미 저장되어 있다
    await expect.poll(async () => (await save(page)).flags["puzzle.solved:Z9901"]).toBe(true);
    await page.locator(".banner-ok").click();
    await settle(page);
    expect(await said(page)).toEqual(["r99_bridge_broken", "r99_bridge_fixed"]);
    await expect(page.locator(".reward-modal")).toHaveCount(0);

    let s = await save(page);
    expect(s.removedObjects).toContain("bridge_r99");
    expect(s.problems.Z9901).toBeUndefined();
    expect(s.history).toEqual([]);
    expect((await obj(page, "bridge_r99"))?.removed).toBe(true);
    // 다리 칸을 지나간다
    await walkTo(page, door.x, door.y);
    const at = await where(page);
    expect({ x: at.x, y: at.y }).toEqual({ x: door.x, y: door.y });

    // 새로고침: 다리는 이어진 채
    await page.reload();
    await ready(page);
    s = await save(page);
    expect(s.flags["puzzle.solved:Z9901"]).toBe(true);
    expect((await obj(page, "bridge_r99"))?.removed).toBe(true);
    expect(await pathTo(page, door.x, door.y)).not.toBeNull();
  });

  test("복잡도 예측 질문: 1페이즈 통과 뒤 묻기 → 건너뛰기 → 후퇴 → 다시 묻기 → 고르기(결과는 말하지 않음) → 2페이즈 통과 뒤 보상 창에 예측·목표", async ({ page }) => {
    test.setTimeout(240_000);
    await bootR99(page, 3, 1);
    await interact(page, "m_P9901");
    await settle(page, ".battle-modal");
    await typeCode(page, SUM_FAST);
    await cast(page);
    // 2페이즈 시작 대사 바로 뒤에 질문. 고르기 전에는 시전·예제 실행·힌트를 막는다
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".battle-msg-text .phase-intro")).toBeVisible();
    await expect(page.locator(".complexity-ask")).toContainText("입력 크기로 보아 목표 복잡도는?");
    await expect(page.locator(".complexity-choice")).toHaveText(["O(N)", "O(1)", "O(N²)"]);
    await expect(page.locator(".complexity-skip")).toHaveText("건너뛰기");
    await expect(page.locator(".act-cast")).toBeDisabled();
    await expect(page.locator(".act-public")).toBeDisabled();
    await expect(page.locator(".act-hint-1")).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/complexity-ask.png` });

    await page.locator(".complexity-skip").click();
    await expect(page.locator(".complexity-answer")).toContainText("바로 도전해 보자");
    await expect(page.locator(".act-cast")).toBeEnabled();
    expect((await save(page)).flags["complexity.guess:P9901"]).toBeUndefined();

    // 후퇴하고 다시 붙으면 2페이즈에서 다시 묻는다
    await page.locator(".act-retreat").click();
    await settle(page);
    await interact(page, "m_P9901");
    await settle(page, ".battle-modal");
    await typeCode(page, SUM_FAST);
    await cast(page);
    await expect(page.locator(".complexity-ask")).toBeVisible();
    await page.locator('.complexity-choice[data-choice="O(N)"]').click();
    const answer = page.locator(".complexity-answer");
    await expect(answer).toContainText("그 목표로 가 보자");
    await expect(answer).not.toContainText("맞");
    await expect(answer).not.toContainText("O(1)");
    await expect.poll(async () => (await save(page)).flags["complexity.guess:P9901"]).toBe(false);

    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-complexity .reward-value")).toHaveText("예측: O(N) / 목표: O(1)");
    await page.screenshot({ path: `${SHOTS}/complexity-reward.png` });
    await page.locator(".reward-ok").click();
    await settle(page);
    expect((await save(page)).problems.P9901.solved).toBe(true);
  });

  test("복잡도 예측 질문 + 모래시계 부적: 시간 결계 TLE로 목표가 공개될 때 예측도 함께, 보상 창에는 다시 보이지 않음", async ({ page }) => {
    test.setTimeout(240_000);
    await bootR99(page, 3, 1, { inventory: { "hourglass-charm": 1 }, equipment: ["hourglass-charm"] });
    await interact(page, "m_P9901");
    await settle(page, ".battle-modal");
    await typeCode(page, SUM_FAST);
    await cast(page);
    await page.locator('.complexity-choice[data-choice="O(N²)"]').click();
    await expect(page.locator(".time-gauge-target")).toBeHidden();

    // 반복문 풀이: 2페이즈에서 TLE → 부적이 목표를 공개하며 예측도 함께
    await typeCode(page, SUM_SLOW);
    await cast(page);
    await expect(page.locator(".time-gauge-target")).toBeVisible();
    await expect(page.locator(".time-gauge-target")).toHaveText("목표 O(1)");
    await expect(page.locator(".hourglass-note .complexity-reveal")).toHaveText("예측: O(N²) / 목표: O(1)");
    await page.screenshot({ path: `${SHOTS}/complexity-hourglass.png` });
    expect((await save(page)).flags["hourglass.revealed:P9901"]).toBe(true);

    await typeCode(page, SUM_FAST);
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-complexity")).toHaveCount(0);
    await page.locator(".reward-ok").click();
    await settle(page);
  });
});
