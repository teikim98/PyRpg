// 임시(커밋하지 않음): 지역 1 몬스터·보스 전투 화면 스크린샷
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const OUT = "C:/Users/teiki/AppData/Local/Temp/claude/C--Users-teiki-OneDrive-Desktop-sample-PyRpg/e9472b2c-10f0-4bbb-be13-743fd3864471/scratchpad/mon/shots";

const where = (page: Page) => page.evaluate(() => (window as any).__pyrpg.where());

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

test("지역 1 몬스터 전투 화면", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?e2e");
  await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
  await settle(page);
  for (const id of ["m_P0101", "m_P0102", "m_P0103", "m_P0104", "m_P0106", "m_P0107", "m_P0105"]) {
    await page.evaluate(() =>
      (window as any).__pyrpg.seed({ lessons: ["L1-1", "L1-2", "L1-3", "L1-4"], removed: ["gate_well"], flags: ["trigger.r01.t_prologue"] }),
    );
    await page.reload();
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), id);
    if (!a) {
      console.log("cannot approach", id);
      continue;
    }
    await page.evaluate((at) => (window as any).__pyrpg.seed({ at }), { x: a.end.x, y: a.end.y, facing: a.face });
    await page.reload();
    await page.waitForFunction(() => (window as any).__pyrpg?.ready === true, null, { timeout: 60_000 });
    await settle(page);
    await page.keyboard.press(KEY[a.face as Facing]);
    await settle(page, ".battle-modal");
    await page.waitForTimeout(600);
    await expect(page.locator(".enemy-sprite-wrap .sprite.is-animated")).toHaveCount(1);
    const info = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".enemy-sprite-wrap .sprite")!;
      const cs = getComputedStyle(el);
      return { frames: el.style.getPropertyValue("--frames"), anim: cs.animationName, dur: cs.animationDuration, tf: cs.animationTimingFunction };
    });
    console.log(id, JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/${id}-full.png` });
    for (let i = 0; i < 4; i++) {
      await page.locator(".enemy-sprite-wrap").screenshot({ path: `${OUT}/${id}-f${i}.png` });
      await page.waitForTimeout(250);
    }
  }
});
