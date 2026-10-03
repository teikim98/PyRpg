// 전투 메시지 칸 다듬기 E2E(단위 3-5, docs/phase3/region05-spec.md §7):
// 1) 보스 시전 진행 표시(큰 입력 준비 k/n → 2페이즈 · 시험 k/n), 느린 풀이 TLE까지 진행이 보이는지, 일반 전투에서 깜빡이지 않는지
// 2) 승리 문구의 조사("사서 골렘을 정화했어!")
// 3) 진단 없는 RE에서 해설이 길어도 "📖 코덱스" 버튼이 스크롤 없이 보이는지(1280×800, 1280×720, 1024×640)
// PW_PORT=4193 npx playwright test tests/e2e/battle-feedback.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const SCREENS = "docs/phase3/screens";
const P0411 = "content/regions/r04-grand-library/problems/P0411";
const code = (file: string) => readFileSync(`${P0411}/${file}`, "utf8");

const where = (page: Page) => page.evaluate(() => (window as any).__pyrpg.where()) as Promise<{ x: number; y: number; facing: Facing; busy: boolean; modal: boolean }>;
const save = (page: Page) => page.evaluate(() => (window as any).__pyrpg.state().save);
const obj = (page: Page, id: string) =>
  page.evaluate((id) => (window as any).__pyrpg.objects().find((o: any) => o.id === id), id) as Promise<{ id: string; x: number; y: number; removed: boolean; type: string }>;
const objIds = (page: Page, type: string) =>
  page.evaluate((t) => (window as any).__pyrpg.objects().filter((o: any) => o.type === t).map((o: any) => o.id), type) as Promise<string[]>;

async function boot(page: Page, width = 1280, height = 800): Promise<void> {
  await page.setViewportSize({ width, height });
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

/** 몬스터 옆 칸에 선 저장으로 다시 시작한 뒤, 실제 방향키로 부딪혀 전투를 연다 */
async function openBattleNextTo(page: Page, monster: string, pid: string): Promise<void> {
  const a = await page.evaluate((id) => (window as any).__pyrpg.approach(id), monster);
  if (!a) throw new Error(`cannot approach ${monster}`);
  await seedAndReload(page, { at: { x: a.end.x, y: a.end.y, facing: a.face } });
  await page.keyboard.press(KEY[a.face as Facing]);
  await settle(page, ".battle-modal");
  await expect(page.locator(".battle")).toHaveAttribute("data-problem", pid);
}

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

interface StageLog {
  wallMs: number;
  /** 진행 문구가 바뀔 때마다(시전 시작부터 ms, 문구, 보이는지) */
  stages: { t: number; text: string; visible: boolean }[];
  /** 진행 문구가 처음 보인 시각(ms). 보이지 않았으면 null */
  firstVisibleMs: number | null;
  /** 보였다가 다시 숨은 횟수(깜빡임) */
  hides: number;
  maxFrameGapMs: number;
}

/**
 * 시전하면서 진행 표시(.cast-progress)의 변화를 페이지 안에서 기록한다.
 * shots: 보이는 진행 문구가 정규식에 처음 맞을 때 찍을 스크린샷
 */
async function castWithStages(page: Page, shots: { when: RegExp; path: string }[] = [], timeoutMs = 300_000): Promise<StageLog> {
  await expect(page.locator(".act-cast")).toBeEnabled({ timeout: 60_000 });
  await page.evaluate(() => {
    const m = {
      start: performance.now(),
      stages: [] as { t: number; text: string; visible: boolean }[],
      hides: 0,
      maxGap: 0,
      last: performance.now(),
      on: true,
      obs: null as MutationObserver | null,
    };
    (window as any).__stages = m;
    const look = () => {
      const el = document.querySelector<HTMLElement>(".battle-msg-text .cast-progress");
      if (!el) return;
      const text = el.textContent ?? "";
      const visible = !el.hidden && el.offsetParent !== null;
      const prev = m.stages.at(-1);
      if (prev && prev.visible && !visible) m.hides++;
      if (!prev || prev.text !== text || prev.visible !== visible) m.stages.push({ t: Math.round(performance.now() - m.start), text, visible });
    };
    m.obs = new MutationObserver(look);
    m.obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
    const tick = (t: number) => {
      if (!m.on) return;
      m.maxGap = Math.max(m.maxGap, t - m.last);
      m.last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await page.locator(".act-cast").click();
  const pending = [...shots];
  for (;;) {
    const st = await page.evaluate(() => {
      const root = document.querySelector(".battle");
      const banner = document.querySelector(".battle-banner") as HTMLElement | null;
      const el = document.querySelector<HTMLElement>(".battle-msg-text .cast-progress");
      return {
        done: !root || (banner !== null && !banner.hidden) || !root.classList.contains("is-busy"),
        progress: el && !el.hidden ? el.textContent ?? "" : "",
      };
    });
    if (st.done) break;
    const i = pending.findIndex((s) => s.when.test(st.progress));
    if (i >= 0) {
      await page.screenshot({ path: pending[i].path });
      pending.splice(i, 1);
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`cast timeout ${timeoutMs} ms`);
    await page.waitForTimeout(50);
  }
  const wallMs = Date.now() - t0;
  const m = await page.evaluate(() => {
    const m = (window as any).__stages;
    m.on = false;
    m.obs?.disconnect();
    return { stages: m.stages, hides: m.hides, maxGap: m.maxGap };
  });
  const first = (m.stages as StageLog["stages"]).find((s) => s.visible);
  return { wallMs, stages: m.stages, firstVisibleMs: first ? first.t : null, hides: m.hides, maxFrameGapMs: Math.round(m.maxGap) };
}

const visibleTexts = (log: StageLog) => [...new Set(log.stages.filter((s) => s.visible).map((s) => s.text))];
const allTexts = (log: StageLog) => [...new Set(log.stages.map((s) => s.text).filter(Boolean))];

test.describe("시전 진행 표시와 조사(단위 3-5)", () => {
  test("보스 P0411: 2페이즈 큰 입력 준비 k/n → 시험 k/n이 바뀌어 가고, 느린 풀이는 TLE까지 진행이 보인다. 승리 문구는 '사서 골렘을'", async ({ page }) => {
    test.setTimeout(600_000);
    await boot(page);
    const spawn = { x: 1, y: 11 };
    // 지역 1~3 클리어(주문서는 레슨으로) 뒤 대도서관 입구에서 시작
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2", "L1-3", "L1-4", "L2-1", "L2-2", "L2-3", "L2-4", "L3-1", "L3-2", "L3-3", "L3-4", "L3-5", "L4-1", "L4-2", "L4-3", "L4-4"],
      flags: ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r01.clear", "region.r02.clear", "region.r03.clear"],
      patch: { location: { regionId: "r04", x: spawn.x, y: spawn.y, facing: "right" } },
    });
    await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
    // 보스 말고는 다 치웠다(길이 열리게)
    const removed = [...(await objIds(page, "monster")), ...(await objIds(page, "chest")), ...(await objIds(page, "door"))].filter((id) => id !== "m_P0411");
    await seedAndReload(page, { removed });
    expect((await obj(page, "m_P0411")).removed).toBe(false);
    await openBattleNextTo(page, "m_P0411", "P0411");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    // 첫 대사의 조사
    await expect(msg(page)).toContainText("보스 사서 골렘이 나타났어!");
    await expect(msg(page)).not.toContainText("이(가)");

    // 1페이즈: 작은 입력이라 금방 끝난다(진행 표시가 보이더라도 '1페이즈 · 시험 k/7'뿐)
    const slow = code("slow.py");
    await typeCode(page, slow);
    const p1 = await castWithStages(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    for (const t of allTexts(p1)) expect(t).toMatch(/^1페이즈 · 시험 [1-7]\/7$/);
    expect(p1.hides).toBe(0);

    // 2페이즈 느린 풀이: 큰 입력 1개를 만들고(1/4) 시험 1/4 → 한 번 더 재는 중 → TLE(나머지는 stopOnTle로 건너뜀)
    const slowLog = await castWithStages(page, [{ when: /큰 입력 준비 중/, path: `${SCREENS}/systems-cast-progress.png` }]);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(msg(page).locator(".cast-progress")).toHaveCount(0);
    console.log(`P0411 2페이즈 느린 풀이: ${slowLog.wallMs} ms, 진행 ${JSON.stringify(slowLog.stages)}, 최대 프레임 간격 ${slowLog.maxFrameGapMs} ms`);
    expect(visibleTexts(slowLog)).toEqual(["큰 입력 준비 중… (1/4)", "2페이즈 · 시험 1/4", "2페이즈 · 시험 1/4 · 한 번 더 재는 중"]);
    expect(slowLog.firstVisibleMs).not.toBeNull();
    expect(slowLog.firstVisibleMs!).toBeLessThan(1_500);
    expect(slowLog.hides).toBe(0);
    expect(slowLog.maxFrameGapMs).toBeLessThan(1_000);

    // 모범답안: 남은 큰 입력 3개(1/3 … 3/3)를 만들며 시험 1/4 → 4/4. 결과 연출은 테스트마다
    await typeCode(page, code("solution.py"));
    const okLog = await castWithStages(page);
    console.log(`P0411 2페이즈 모범답안: ${okLog.wallMs} ms, 진행 ${JSON.stringify(okLog.stages)}, 최대 프레임 간격 ${okLog.maxFrameGapMs} ms`);
    // 첫 테스트(입력이 이미 있음)가 400 ms 안에 끝나는 빠른 기기에서는 '시험 1/4'가 보이기 전에 지나갈 수 있다
    expect(visibleTexts(okLog).filter((t) => t !== "2페이즈 · 시험 1/4")).toEqual([
      "큰 입력 준비 중… (1/3)",
      "2페이즈 · 시험 2/4",
      "큰 입력 준비 중… (2/3)",
      "2페이즈 · 시험 3/4",
      "큰 입력 준비 중… (3/3)",
      "2페이즈 · 시험 4/4",
    ]);
    expect(okLog.hides).toBe(0);
    expect(okLog.maxFrameGapMs).toBeLessThan(1_000);

    // 승리: 받침에 맞는 조사
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await expect(msg(page)).toHaveText("해냈어! 사서 골렘을 정화했어!");
    await expect(page.locator(".banner-sub")).toHaveText("사서 골렘이 빛이 되어 흩어졌다.");
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    expect((await save(page)).problems.P0411.solved).toBe(true);
  });

  test("일반 전투: 짧은 시전에는 진행 표시가 깜빡이지 않는다", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2"],
      removed: ["gate_well"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
    });
    await openBattleNextTo(page, "m_P0101", "P0101");
    // 첫 시전 전에 실행기를 깨워 둔다(깨우는 시간은 진행 표시와 무관)
    await page.evaluate(() => (window as any).__pyrpg.runner.init());
    await expect(msg(page)).toContainText("길을 막고 있어!");
    await expect(msg(page)).not.toContainText("이(가)");
    await typeCode(page, "a, b = input().split()\nprint(a + b)");
    const log = await castWithStages(page);
    console.log(`P0101 오답 시전: ${log.wallMs} ms, 진행 ${JSON.stringify(log.stages)}`);
    // 보스가 아니라 페이즈 없이 '시험 k/n'. 400 ms 안에 끝나면 아예 보이지 않는다
    for (const t of allTexts(log)) expect(t).toMatch(/^시험 \d+\/\d+$/);
    if (log.wallMs < 400) expect(log.firstVisibleMs).toBeNull();
    else if (log.firstVisibleMs !== null) expect(log.firstVisibleMs).toBeGreaterThanOrEqual(380);
    expect(log.hides).toBe(0);
    // 결과 메시지에는 진행 표시가 남지 않는다
    await expect(page.locator(".fb")).toContainText("WA");
    await expect(msg(page).locator(".cast-progress")).toHaveCount(0);
  });
});

test.describe("코덱스 바로가기 위치(단위 3-5)", () => {
  /** 바로가기 버튼이 메시지 칸 안에 스크롤 없이 다 보이는지 */
  async function linkInView(page: Page) {
    return page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".battle-msg")!;
      const link = document.querySelector<HTMLElement>(".battle-msg-text .codex-link")!;
      const b = box.getBoundingClientRect();
      const l = link.getBoundingClientRect();
      return {
        scrollTop: box.scrollTop,
        overflow: box.scrollHeight - box.clientHeight,
        inside: l.top >= b.top - 1 && l.bottom <= b.bottom + 1 && l.left >= b.left - 1 && l.right <= b.right + 1,
        box: { top: Math.round(b.top), bottom: Math.round(b.bottom) },
        link: { top: Math.round(l.top), bottom: Math.round(l.bottom) },
      };
    });
  }

  test("진단 없는 RE에서 일반 해설이 길어도 📖 코덱스 버튼은 해설 위에 있어 스크롤 없이 보인다(1280×800, 1280×720, 1024×640)", async ({ page }) => {
    test.setTimeout(240_000);
    await boot(page);
    const gate = await obj(page, "gate_well");
    await seedAndReload(page, {
      lessons: ["L1-1", "L1-2"],
      removed: ["gate_well"],
      at: { x: gate.x, y: gate.y - 1 },
      flags: ["trigger.r01.t_prologue", "companion.joined"],
      patch: { inventory: { "archivist-glasses": 1 }, equipment: ["archivist-glasses"] },
    });
    await openBattleNextTo(page, "m_P0101", "P0101");
    // '1 2'를 통째로 int()에: ValueError(문제 전용 진단 없음) → 긴 일반 해설(L1-2 변환의 주문)
    await typeCode(page, "a = int(input())\nprint(a)");
    await page.locator(".act-cast").click();
    await expect(page.locator(".act-cast")).toBeEnabled({ timeout: 90_000 });
    await expect(msg(page)).toContainText("ValueError");
    await expect(msg(page).locator(".diag")).toHaveCount(0);
    await expect(msg(page).locator(".err-lead .codex-link")).toHaveText("📖 코덱스: 변환의 주문: 문자열과 숫자");
    // 버튼은 해설 본문보다 앞(첫 줄)
    const order = await page.evaluate(() => {
      const t = document.querySelector(".battle-msg-text")!.textContent ?? "";
      return { link: t.indexOf("📖 코덱스"), explain: t.indexOf("int()") };
    });
    expect(order.link).toBeGreaterThan(-1);
    expect(order.link).toBeLessThan(order.explain);

    for (const [w, h] of [
      [1280, 800],
      [1280, 720],
      [1024, 640],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(300);
      const v = await linkInView(page);
      console.log(`${w}×${h}: 메시지 칸 ${JSON.stringify(v.box)}, 버튼 ${JSON.stringify(v.link)}, 넘친 높이 ${v.overflow}px`);
      expect(v.scrollTop, `${w}×${h}`).toBe(0);
      expect(v.inside, `${w}×${h}`).toBe(true);
      await expect(msg(page).locator(".codex-link")).toBeVisible();
      if (w === 1024) await page.screenshot({ path: `${SCREENS}/systems-glasses-link-1024.png` });
    }
    // 바로가기는 그대로 동작한다(코덱스 왕복)
    await msg(page).locator(".codex-link").click();
    await expect(page.locator(".codex-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".codex-modal")).toHaveCount(0);
    await expect(page.locator(".battle-modal")).toBeVisible();
  });
});
