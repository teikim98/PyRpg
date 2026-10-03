// 지역 5(교역항) 클리어 E2E(docs/phase3/region05-spec.md §8).
// 지역 1~4를 끝낸 저장에서 시작해 실제 방향키·대화·레슨·CodeMirror·Pyodide 채점으로 지역 5를 끝까지 플레이한다.
// 대도서관 동쪽 문 → 레슨 5개 → 필수 몬스터(오답 진단 포함) → 항구 상점에서 물건 사기 → 길드장 귀띔 →
// 숨겨진 길(밧줄 더미 바로 북쪽의 빈 상자) → 보스 1·2페이즈(시전 진행 표시) → 클리어 → to_be_continued.
// 도우미는 region4.spec.ts와 같은 방식이다(window.__pyrpg 훅은 좌표·진행도·길찾기만, 이동은 실제 키).
// PW_PORT=4194 npx playwright test tests/e2e/region5.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const PROBLEMS = "content/regions/r05-trade-port/problems";
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

/** 맵(map.tmj)에서 빈 상자 칸(crate_gap, 지나갈 수 있는 숨겨진 길 입구)과 그 남쪽 칸에 보이는 타일 이름 */
function crateGap(): { x: number; y: number; south: string; ropes: number } {
  const map = JSON.parse(readFileSync("content/regions/r05-trade-port/map.tmj", "utf8"));
  const ts = map.tilesets[0];
  const nameOf = (gid: number) => (gid ? ts.tiles.find((t: any) => t.id === gid - ts.firstgid)?.type ?? "" : "");
  const layer = (n: string) => map.layers.find((l: any) => l.name === n).data as number[];
  const ground = layer("ground");
  const deco = layer("deco");
  const col = layer("collision");
  // 그 칸에 보이는 타일(데코가 있으면 데코)
  const seen = (i: number) => nameOf(deco[i]) || nameOf(ground[i]);
  const cells = ground.map((_, i) => (seen(i) === "crate_gap" ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  expect(col[cells[0]]).toBe(0);
  const x = cells[0] % map.width;
  const y = Math.floor(cells[0] / map.width);
  const ropes = ground.filter((_, i) => seen(i) === "rope_coil").length;
  return { x, y, south: seen((y + 1) * map.width + x), ropes };
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
const codexLink = (page: Page) => page.locator(".battle-msg-text .codex-link");

async function typeCode(page: Page, text: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(text);
  await expect.poll(() => editorText(page)).toBe(text);
}

/** timeoutMs: 시전 결과를 기다리는 시간 */
async function cast(page: Page, timeoutMs = 180_000): Promise<void> {
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

interface StageLog {
  wallMs: number;
  /** 진행 문구가 바뀔 때마다(시전 시작부터 ms, 문구, 보이는지) */
  stages: { t: number; text: string; visible: boolean }[];
  /** 진행 문구가 처음 보인 시각(ms). 보이지 않았으면 null */
  firstVisibleMs: number | null;
  /** 보였다가 다시 숨은 횟수(깜빡임) */
  hides: number;
  /** 시전 중 화면 그리기(requestAnimationFrame) 사이 가장 긴 간격 */
  maxFrameGapMs: number;
  /** 테스트 결과 연출('빗나감'·'-1'·명중)이 뜬 시각들(시전 시작부터, ms) */
  floatsMs: number[];
}

/**
 * 시전하면서 진행 표시(.cast-progress)의 변화·프레임 간격·결과 연출 시각을 페이지 안에서 기록한다(battle-feedback.spec.ts와 같은 방식).
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
      floats: [] as number[],
      obs: null as MutationObserver | null,
    };
    (window as any).__stages = m;
    const look = (recs: MutationRecord[]) => {
      for (const r of recs)
        for (const n of Array.from(r.addedNodes))
          if (n instanceof HTMLElement && (n.classList.contains("float-miss") || n.classList.contains("float-hit"))) m.floats.push(Math.round(performance.now() - m.start));
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
    return { stages: m.stages, hides: m.hides, maxGap: m.maxGap, floats: m.floats };
  });
  const first = (m.stages as StageLog["stages"]).find((s) => s.visible);
  return { wallMs, stages: m.stages, firstVisibleMs: first ? first.t : null, hides: m.hides, maxFrameGapMs: Math.round(m.maxGap), floatsMs: m.floats };
}

const visibleTexts = (log: StageLog) => [...new Set(log.stages.filter((s) => s.visible).map((s) => s.text))];
const allTexts = (log: StageLog) => [...new Set(log.stages.map((s) => s.text).filter(Boolean))];

/** 오답을 시전하고 판정·진단을 확인한다 */
async function castWrong(page: Page, pid: string, file: string, expectText: (string | RegExp)[]): Promise<void> {
  await castCode(page, code(pid, file), expectText);
}

async function castCode(page: Page, wrong: string, expectText: (string | RegExp)[]): Promise<void> {
  await typeCode(page, wrong);
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeHidden();
  for (const t of expectText) await expect(msg(page)).toContainText(t);
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

async function finishWin(page: Page, monster: string, pid: string): Promise<void> {
  await winCurrent(page, pid);
  await settle(page);
  expect((await obj(page, monster)).removed).toBe(true);
  expect((await save(page)).problems[pid].solved).toBe(true);
}

/** 진단이 본문이고 일반 Traceback 해설은 [자세히]로 접혀 있으며, 안경의 바로가기가 머리 줄에 있다 */
async function expectDiagWithCodex(page: Page, lessonTitle: string): Promise<void> {
  await expect(msg(page).locator(".diag")).toBeVisible();
  await expect(msg(page).locator(".err-explain")).toBeHidden();
  await expect(msg(page).locator(".err-head .codex-link")).toHaveText(`📖 코덱스: ${lessonTitle}`);
}

/** 바로가기 버튼이 메시지 칸 안에 스크롤 없이 다 보이는지 */
async function codexLinkInView(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const box = document.querySelector<HTMLElement>(".battle-msg")!;
    const link = document.querySelector<HTMLElement>(".battle-msg-text .codex-link")!;
    const b = box.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    return box.scrollTop === 0 && l.top >= b.top - 1 && l.bottom <= b.bottom + 1;
  });
}

/** 캠프파이어에서 쉬고, 복귀 지점이 그 캠프파이어 옆으로 옮겨졌는지 확인한다 */
async function rest(page: Page, campfire: string): Promise<void> {
  expect(await talk(page, campfire)).toBe("campfire_rest");
  const camp = await obj(page, campfire);
  const s = await save(page);
  expect(s.lastCampfire.regionId).toBe("r05");
  expect(Math.abs(s.lastCampfire.x - camp.x) + Math.abs(s.lastCampfire.y - camp.y)).toBe(1);
  await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);
}

// ───────────── 준비: 지역 1~4를 끝낸 저장 ─────────────

const R01_LESSONS = ["L1-1", "L1-2", "L1-3", "L1-4"];
const R01_FLAGS = ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r01.clear"];
const R02_LESSONS = ["L2-1", "L2-2", "L2-3", "L2-4"];
const R02_FLAGS = ["region.r02.clear", "trigger.r02.t_boss_intro"];
const R03_LESSONS = ["L3-1", "L3-2", "L3-3", "L3-4", "L3-5"];
const R03_FLAGS = ["region.r03.clear", "trigger.r03.t_boss_intro"];
const R04_LESSONS = ["L4-1", "L4-2", "L4-3", "L4-4"];
const R04_FLAGS = ["region.r04.clear", "trigger.r04.t_boss_intro"];

/**
 * 새 게임으로 부팅 → 에코 마을·갈림길 숲·고블린 동굴을 끝낸 저장으로 차례로 실제로 걸어 들어간 뒤,
 * 대도서관도 다 끝내고(몬스터·상자 제거, 레슨 4개) 도서관 동쪽 문 바로 앞에 선 저장으로 다시 시작한다.
 * 지역 4 상자에서 받는 기록관의 안경은 장착한 채로 둔다(지역 5 Traceback 해설의 코덱스 바로가기 확인용)
 */
async function seedRegion4Cleared(page: Page): Promise<void> {
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
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");

  const removed3 = [...(await objIds(page, "monster")), ...(await objIds(page, "chest")), ...(await objIds(page, "door"))];
  const gate3 = await obj(page, "warp_east");
  await seedAndReload(page, { lessons: R03_LESSONS, removed: removed3, at: { x: gate3.x - 1, y: gate3.y, facing: "right" }, flags: R03_FLAGS });
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");

  const removed4 = [...(await objIds(page, "monster")), ...(await objIds(page, "chest")), ...(await objIds(page, "door"))];
  const gate4 = await obj(page, "warp_east");
  const cur = await save(page);
  await seedAndReload(page, {
    lessons: R04_LESSONS,
    removed: removed4,
    at: { x: gate4.x - 1, y: gate4.y, facing: "right" },
    flags: R04_FLAGS,
    patch: { inventory: { ...cur.inventory, "archivist-glasses": 1 }, equipment: ["archivist-glasses"] },
  });
  const w = await where(page);
  expect({ x: w.x, y: w.y }).toEqual({ x: gate4.x - 1, y: gate4.y });
  const s = await save(page);
  expect(s.location.regionId).toBe("r04");
  expect(s.problems.P0411.solved).toBe(true);
  expect(s.equipment).toContain("archivist-glasses");
  expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.string", "scroll.strmethods", "scroll.splitjoin", "scroll.ascii"]));
  expect(await said(page)).toEqual([]);
  await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
}

/** 대도서관 동쪽 문으로 교역항에 처음 들어간다 */
async function crossToPort(page: Page): Promise<void> {
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("교역항");
}

const REQUIRED = ["m_P0501", "m_P0502", "m_P0504", "m_P0506", "m_P0507", "m_P0509", "m_P0510", "m_P0511", "m_P0512", "m_P0513"];
const OPTIONAL = ["m_P0503", "m_P0505", "m_P0508"];

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 5 교역항 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("입장: 대도서관 동쪽 문 → 첫 대사·항구 트리거 → 복귀 지점이 항구 입구 → 서쪽 문으로 돌아갔다가 다시 오기", async () => {
    test.setTimeout(300_000);
    await seedRegion4Cleared(page);
    const campBefore = (await save(page)).lastCampfire;
    expect(campBefore.regionId).toBe("r04");

    // 처음 건널 때: 도서관 문의 openDialogue(누리의 연결 대사, 한 번) → 지역 첫 대사 → spawn 옆 트리거(도착 칸)
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "port_intro"]);
    for (const t of texts) expect(t).not.toMatch(/준비 중|여기까지입니다/);
    const all = texts.join(" ");
    expect(texts[0]).toContain("짭짤한 바람");
    expect(all).toContain("해안 길");
    expect(all).toContain("교역항");
    expect(all).toContain("유리처럼 굳어");
    // 이름(할트)은 지역 7에서 처음 나온다
    expect(all).not.toContain("할트");
    await expect(page.locator(".hud-region")).toHaveText("교역항");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    const spawn = await obj(page, "spawn_west");
    const trig = await obj(page, "t_port_intro");
    expect(st.save.location.regionId).toBe("r05");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: trig.x, y: trig.y });
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    expect(st.save.flags["trigger.r05.t_port_intro"]).toBe(true);
    expect(st.save.flags["region.r05.intro"]).toBe(true);
    // 쓰러졌을 때의 복귀 지점이 항구 입구로 옮겨졌다
    expect(st.save.lastCampfire).toEqual({ regionId: "r05", x: trig.x, y: trig.y });
    // 시장 안으로 몇 칸 들어가서 입구를 찍는다
    await walkTo(page, trig.x + 4, trig.y);
    await shot(page, "r05-entrance.png");

    // 서쪽 문 → 대도서관 동쪽 문 옆
    await interact(page, "warp_west");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
    expect((await save(page)).location.regionId).toBe("r04");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await said(page)).slice(3)).toEqual([]);

    // 다시 건너면 대사 없이 바로(openDialogue·once 트리거·지역 첫 대사 모두 한 번만)
    await interact(page, "warp_east");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("교역항");
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "port_intro"]);
    const again = await where(page);
    expect(Math.abs(again.x - spawn.x) + Math.abs(again.y - spawn.y)).toBeLessThanOrEqual(1);
  });

  test("해안 시장: 주문서 없이 막힘 → L5-1 → 항구 상인 → P0501 오답(튜플 출력) → 승리 → 상점에서 회복약 사기 → 화로 → P0502 오답(return 두 번) → 승리", async () => {
    test.setTimeout(300_000);
    await bump(page, "m_P0501");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L5-1", "b, a", "scroll.tuple", "r05-lesson.png");

    await interact(page, "npc_port_merchant");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_port_merchant");
    expect(texts.join(" ")).toContain("길드장");

    await openBattle(page, "m_P0501", "P0501");
    const maxHp = (await save(page)).player.hp;
    await castWrong(page, "P0501", "wrong_c.py", ["괄호와 쉼표", "print(a, b)"]);
    await expect(msg(page).locator(".counter")).toContainText("HP −20");
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 20}/${maxHp}`);
    await finishWin(page, "m_P0501", "P0501");
    expect((await save(page)).problems.P0501).toMatchObject({ solved: true, attempts: 2 });

    // 항구 상점(상인 곁의 좌판): 실제로 하나 사면 골드가 줄고 가방에 들어온다
    const before = await save(page);
    const gold0 = before.player.gold;
    const potions0 = before.inventory.potion ?? 0;
    expect(gold0).toBeGreaterThanOrEqual(30);
    await interact(page, "shop_port");
    await settle(page, ".shop-modal");
    await expect(page.locator(".shop-gold")).toHaveText(`${gold0} G`);
    await expect(page.locator('.shop-item[data-item="potion"]')).toHaveAttribute("data-state", "available");
    await page.locator('.shop-buy[data-buy="potion"]').click();
    await expect(page.locator(".shop-status")).toHaveText(`회복약을 샀어! (보유 ${potions0 + 1})`);
    await expect(page.locator(".shop-gold")).toHaveText(`${gold0 - 30} G`);
    await shot(page, "r05-shop.png");
    for (let i = 0; i < 4 && (await page.locator(".ui-modal").count()); i++) await page.keyboard.press("Escape");
    await settle(page);
    const after = await save(page);
    expect(after.player.gold).toBe(gold0 - 30);
    expect(after.inventory.potion).toBe(potions0 + 1);
    await expect(page.locator(".shop-modal")).toHaveCount(0);

    await rest(page, "campfire_market");

    await openBattle(page, "m_P0502", "P0502");
    await castWrong(page, "P0502", "wrong_c.py", ["이름이 하나만 돌아왔어", "return lo_name, hi_name"]);
    await finishWin(page, "m_P0502", "P0502");
  });

  test("상인 길드: 길드장(마지막 배·숨겨진 길 귀띔) → 그림자 게시판 → P0503은 장부의 주문서가 있어야(비석 뒤) → L5-2 → P0504 KeyError 진단(코덱스: 장부의 주문) → 승리", async () => {
    test.setTimeout(300_000);
    await interact(page, "npc_guild_master");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_guild_master");
    const all = texts.join(" ");
    expect(all).toContain("마지막 배");
    expect(all).toContain("밧줄 더미 바로 북쪽의 빈 상자");
    expect(all).toContain("모든 주문을 제시간에 끝내도록 지키던 자");
    expect(all).toContain("사막");
    expect(all).not.toContain("할트");

    await interact(page, "board_shadow_r05");
    await settle(page, ".board-modal");
    await expect(page.locator(".board-modal")).toBeVisible();
    await page.locator(".board-modal .sys-close").click();
    await expect(page.locator(".board-modal")).toHaveCount(0);
    await settle(page);

    // 선택 몬스터 P0503(시세표 조회)은 장부의 주문서가 필요하다: 비석 전에는 막히고 전투가 열리지 않는다
    await bump(page, "m_P0503");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);
    await bump(page, "m_P0504");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");

    await lesson(page, "rune_L5-2", "0", "scroll.dict");

    await openBattle(page, "m_P0504", "P0504");
    // count[w] += 1 → KeyError(4번째 줄), 진단이 본문, 바로가기는 머리 줄
    await castWrong(page, "P0504", "wrong_a.py", ["KeyError", "count.get(w, 0)"]);
    await expect(msg(page).locator(".err-line")).toHaveText("4번째 줄");
    await expectDiagWithCodex(page, "장부의 주문: 딕셔너리");
    await shot(page, "r05-battle-diag.png");
    await finishWin(page, "m_P0504", "P0504");
  });

  test("창고 거리: 표지판(샛길 귀띔) → L5-3 → P0506 오답({}로 만든 빈 set) → 승리 → 밧줄 더미 바로 북쪽 빈 상자로 숨겨진 창고 → 80골드 → P0507 오답(합집합) → 승리", async () => {
    test.setTimeout(300_000);
    await interact(page, "sign_warehouses");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_warehouses");
    expect(texts.join(" ")).toContain("밧줄 더미 바로 북쪽의 빈 상자");

    await lesson(page, "rune_L5-3", "&", "scroll.set");
    await openBattle(page, "m_P0506", "P0506");
    await castWrong(page, "P0506", "wrong_a.py", ["AttributeError", "빈 dict야", "set()"]);
    await expect(msg(page).locator(".err-line")).toHaveText("6번째 줄");
    await expectDiagWithCodex(page, "짐 검사의 주문: 집합");
    await finishWin(page, "m_P0506", "P0506");

    // 귀띔대로: 밧줄 더미(맵에 하나뿐) 바로 북쪽의 빈 상자 칸
    const gap = crateGap();
    expect(gap.south).toBe("rope_coil");
    expect(gap.ropes).toBe(1);
    const chest = await obj(page, "chest_hidden_crates");
    expect(chest.y).toBeLessThan(gap.y);
    // 빈 상자 칸을 지나지 않고는 상자에 닿을 수 없다(칸 바로 앞에서 상자 옆까지의 길이 반드시 그 칸을 지난다)
    await walkTo(page, gap.x, gap.y + 1);
    const p = await where(page);
    expect({ x: p.x, y: p.y }).toEqual({ x: gap.x, y: gap.y + 1 });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y - 1 });
    await shot(page, "r05-hidden-crates.png");
    const gold0 = (await save(page)).player.gold;
    await interact(page, "chest_hidden_crates");
    const chestTexts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("chest_hidden_crates");
    expect(chestTexts.join(" ")).toContain("80골드");
    expect((await save(page)).player.gold).toBe(gold0 + 80);
    expect((await obj(page, "chest_hidden_crates")).removed).toBe(true);

    await openBattle(page, "m_P0507", "P0507");
    await castWrong(page, "P0507", "wrong_c.py", ["교집합", "sorted(ship_a & ship_b)"]);
    await finishWin(page, "m_P0507", "P0507");
  });

  test("새로고침: 교역항의 위치·진행이 그대로", async () => {
    test.setTimeout(120_000);
    const p0 = await where(page);
    const s0 = await save(page);
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    await expect(page.locator(".hud-region")).toHaveText("교역항");
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    for (const id of ["m_P0501", "m_P0502", "m_P0504", "m_P0506", "m_P0507", "chest_hidden_crates"]) expect((await obj(page, id)).removed, id).toBe(true);
  });

  test("부두: L5-4 → 화로 → P0509 진단 없는 KeyError(일반 해설·바로가기가 스크롤 없이 보임)·import 누락 → 승리 → P0510 오답(dict에 append) → 승리 → P0511 오답(집합 빼기) → 승리", async () => {
    test.setTimeout(400_000);
    await lesson(page, "rune_L5-4", '"a"', "scroll.counter");
    await rest(page, "campfire_docks");

    await openBattle(page, "m_P0509", "P0509");
    // 문제 전용 진단이 없는 KeyError → KeyError 기본 해설(장부의 주문), 바로가기는 해설 위에 있어 스크롤 없이 보인다
    const keyErr = [
      "def solution(cargo):",
      "    count = {}",
      "    for c in cargo:",
      "        count[c] += 1",
      "    top = max(count.values())",
      "    return min([name for name, n in count.items() if n == top])",
    ].join("\n");
    await castCode(page, keyErr, ["KeyError", "장부(dict)에 없는 키", "d.get(k, 0)"]);
    await expect(msg(page).locator(".diag")).toHaveCount(0);
    await expect(msg(page).locator(".err-line")).toHaveText("4번째 줄");
    await expect(msg(page).locator(".err-lead .codex-link")).toHaveText("📖 코덱스: 장부의 주문: 딕셔너리");
    expect(await codexLinkInView(page)).toBe(true);
    // 바로가기 → L5-2를 펼친 코덱스 → Esc로 닫으면 전투로(코드 그대로)
    await codexLink(page).click();
    await expect(page.locator(".codex-modal")).toBeVisible();
    await expect(page.locator('.codex-item[data-lesson="L5-2"]')).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator(".codex-modal")).toHaveCount(0);
    await expect(page.locator(".battle-modal")).toBeVisible();
    expect(await editorText(page)).toBe(keyErr);

    // from collections import Counter를 빠뜨림 → NameError 진단
    await castWrong(page, "P0509", "wrong_b.py", ["NameError", "from collections import Counter"]);
    await expectDiagWithCodex(page, "셈의 주문: Counter와 defaultdict");
    await finishWin(page, "m_P0509", "P0509");

    await openBattle(page, "m_P0510", "P0510");
    await castWrong(page, "P0510", "wrong_a.py", ["KeyError", "defaultdict(list)"]);
    await finishWin(page, "m_P0510", "P0510");

    await openBattle(page, "m_P0511", "P0511");
    await castWrong(page, "P0511", "wrong_a.py", ["Counter(departed) - Counter(returned)"]);
    await finishWin(page, "m_P0511", "P0511");
  });

  test("등대 앞·밀수선 갑판: 항해 일지 → L5-5 → 마지막 화로 → P0512 오답(빈 deque) → 승리 → 보스 P0513 1페이즈 오답(KeyError)·느린 풀이 통과 → 2페이즈 진행 표시·시간 결계 TLE → 모범답안 승리 → 클리어 → 실전 추천 → 동쪽 문", async () => {
    test.setTimeout(900_000);
    await interact(page, "sign_lighthouse");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_lighthouse");
    const all = texts.join(" ");
    expect(all).toContain("항해 일지");
    expect(all).toContain("파도가 멈췄다");
    expect(all).not.toContain("할트");

    await lesson(page, "rune_L5-5", "popleft", "scroll.deque");
    await rest(page, "campfire_lighthouse");

    await openBattle(page, "m_P0512", "P0512");
    await castWrong(page, "P0512", "wrong_a.py", ["IndexError", "if q:"]);
    await finishWin(page, "m_P0512", "P0512");

    const boss = await obj(page, "m_P0513");
    const n0 = (await said(page)).length;
    await bump(page, "m_P0513");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0513");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();
    // 첫 대사의 조사(받침 있는 '선장이')
    await expect(msg(page)).toContainText("밀수꾼 선장이 나타났어!");

    // 1페이즈: 없는 화물을 dict에서 바로 찾음 → KeyError 진단
    await castWrong(page, "P0513", "wrong_a.py", ["KeyError", "count.get(name, 0)"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expectDiagWithCodex(page, "장부의 주문: 딕셔너리");

    // 질문마다 cargo.count: 1페이즈(N, Q ≤ 1000)는 통과
    const slow = code("P0513", "slow.py");
    await typeCode(page, slow);
    const p1 = await castWithStages(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();
    for (const t of allTexts(p1)) expect(t).toMatch(/^1페이즈 · 시험 [1-8]\/8$/);
    expect(p1.hides).toBe(0);

    // 2페이즈: 같은 코드 → 큰 입력 1개를 만들고(1/4) 시험 1/4에서 시간 결계 TLE(나머지는 stopOnTle로 건너뜀), 진단이 먼저
    const slowLog = await castWithStages(page, [{ when: /2페이즈 · 시험/, path: `${SCREENS}/r05-boss-progress.png` }]);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".fb")).toContainText("통과 0/4");
    await expect(msg(page).locator(".cast-progress")).toHaveCount(0);
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("cargo.count(name)");
    await expect(msg(page).locator(".diag")).toContainText("Counter(cargo)");
    await expect(msg(page)).not.toContainText("폭발");
    const slowAll = allTexts(slowLog);
    expect(slowAll[0]).toBe("큰 입력 준비 중… (1/4)");
    expect(slowAll).toContain("2페이즈 · 시험 1/4");
    for (const t of slowAll) expect(t).toMatch(/^(큰 입력 준비 중… \(1\/4\)|2페이즈 · 시험 1\/4( · 한 번 더 재는 중)?)$/);
    // 느린 풀이는 시간 결계에 걸릴 때까지 오래 돌므로 진행이 화면에 보인다
    expect(visibleTexts(slowLog).some((t) => t.startsWith("2페이즈 · 시험 1/4"))).toBe(true);
    expect(slowLog.firstVisibleMs).not.toBeNull();
    expect(slowLog.firstVisibleMs!).toBeLessThan(1_500);
    expect(slowLog.hides).toBe(0);
    expect(slowLog.maxFrameGapMs).toBeLessThan(1_000);
    await shot(page, "r05-boss-phase2.png");

    // 모범답안(Counter): 남은 큰 입력 3개(1/3 … 3/3)를 만들며 시험 1/4 → 4/4. 결과 연출은 테스트마다
    await typeCode(page, solution("P0513"));
    const okLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    console.log(
      `P0513 2페이즈 시전(벽시계): slow.py=${slowLog.wallMs} ms(TLE, 진행 ${JSON.stringify(slowLog.stages)}, 최대 프레임 간격 ${slowLog.maxFrameGapMs} ms) / ` +
        `모범답안=${okLog.wallMs} ms(나머지 생성기 포함, 진행 ${JSON.stringify(okLog.stages)}, 결과 연출 ${JSON.stringify(okLog.floatsMs)} ms, 최대 프레임 간격 ${okLog.maxFrameGapMs} ms)`,
    );
    // 단계는 빠짐없이 차례로 지나간다(짧게 끝난 단계는 400 ms 지연 때문에 화면에는 안 보일 수 있다)
    expect(allTexts(okLog)).toEqual([
      "2페이즈 · 시험 1/4",
      "큰 입력 준비 중… (1/3)",
      "2페이즈 · 시험 2/4",
      "큰 입력 준비 중… (2/3)",
      "2페이즈 · 시험 3/4",
      "큰 입력 준비 중… (3/3)",
      "2페이즈 · 시험 4/4",
    ]);
    expect(okLog.hides).toBe(0);
    expect(okLog.maxFrameGapMs).toBeLessThan(1_000);
    expect(okLog.floatsMs.length).toBeGreaterThanOrEqual(4);
    // 승리: 받침에 맞는 조사
    await expect(msg(page)).toHaveText("해냈어! 밀수꾼 선장을 정화했어!");
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
    // 실전 추천: 프로그래머스 4개(링크, 먼저) + 백준 2개(재개 전이라 비활성)
    await expect(page.locator(".recommend-modal")).toContainText("교역항");
    await expect(page.locator(".recommend-item")).toHaveCount(6);
    const links = page.locator(".recommend-item.site-programmers a.recommend-link");
    await expect(links).toHaveCount(4);
    const ids = [42576, 1845, 92334, 42578];
    for (let i = 0; i < 4; i++) {
      await expect(page.locator(".recommend-item").nth(i)).toHaveAttribute("data-site", "programmers");
      await expect(links.nth(i)).toHaveAttribute("href", `https://school.programmers.co.kr/learn/courses/30/lessons/${ids[i]}`);
    }
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(2);
    await expect(page.locator(".recommend-item.site-boj a")).toHaveCount(0);
    await shot(page, "r05-clear.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    const s = await save(page);
    expect(s.flags["region.r05.clear"]).toBe(true);
    for (const id of [...REQUIRED, "chest_hidden_crates"]) expect(s.removedObjects, id).toContain(id);
    for (const id of OPTIONAL) expect(s.removedObjects, id).not.toContain(id);
    expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.tuple", "scroll.dict", "scroll.set", "scroll.counter", "scroll.deque"]));
    for (const p of ["P0501", "P0502", "P0504", "P0506", "P0507", "P0509", "P0510", "P0511", "P0512", "P0513"]) expect(s.problems[p].solved, p).toBe(true);

    // 새로고침해도 클리어 연출이 다시 나오지 않는다
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    expect((await save(page)).location.regionId).toBe("r05");

    // 보스가 있던 칸을 지나 동쪽 끝 문: 지역 6 거울 호수의 spawn_west로 이어진다
    // (처음 건널 때 누리의 연결 대사 → 지역 첫 대사 → spawn 옆 트리거. 대사 문구 검사는 지역 6 E2E에서)
    await walkTo(page, boss.x, boss.y);
    const n = (await said(page)).length;
    await interact(page, "warp_east");
    await readAll(page);
    expect((await said(page)).slice(n)).toEqual(["to_be_continued", "region_intro", "lake_intro"]);
    await expect(page.locator(".hud-region")).toHaveText("거울 호수");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    expect(st.save.location.regionId).toBe("r06");
    const spawn = await obj(page, "spawn_west");
    expect(Math.abs(st.pos.x - spawn.x) + Math.abs(st.pos.y - spawn.y)).toBeLessThanOrEqual(1);
  });
});

test.describe("지역 5 실패·잠긴 문·시간 측정", () => {
  test("쓰러짐: 항구 안에서 쓰러지면 항구 캠프파이어(복귀 지점)에서 HP 가득으로 다시 시작(도서관으로 돌아가지 않는다)", async ({ page }) => {
    test.setTimeout(300_000);
    await seedRegion4Cleared(page);
    await crossToPort(page);
    expect((await save(page)).lastCampfire.regionId).toBe("r05");
    await lesson(page, "rune_L5-1", "b, a", "scroll.tuple");
    await rest(page, "campfire_market");
    const camp = (await save(page)).lastCampfire;
    const maxHp = (await save(page)).player.hp;

    await openBattle(page, "m_P0501", "P0501");
    const wrong = code("P0501", "wrong_c.py");
    await typeCode(page, wrong);
    for (let i = 0; i < 20 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
    await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("knockout");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
    await expect(page.locator(".hud-region")).toHaveText("교역항");
    const s = await save(page);
    expect(s.location.regionId).toBe("r05");
    expect(s.player.hp).toBe(maxHp);
    await expect(page.locator(".hud-hp-text")).toHaveText(`${maxHp}/${maxHp}`);
    expect(s.problems.P0501).toMatchObject({ knockouts: 1, draft: wrong, solved: false });
    expect((await obj(page, "m_P0501")).removed).toBe(false);
  });

  test("동쪽 문: 밀수꾼 선장을 쓰러뜨리기 전에는 밀수품 상자 벽에 막혀 있다", async ({ page }) => {
    test.setTimeout(240_000);
    await seedRegion4Cleared(page);
    await crossToPort(page);
    const gate = await obj(page, "warp_east");
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [gate.x - 1, gate.y])).toBeNull();
    await seedAndReload(page, {
      lessons: ["L5-1", "L5-2", "L5-3", "L5-4", "L5-5"],
      removed: REQUIRED.filter((id) => id !== "m_P0513"),
      at: { x: gate.x - 1, y: gate.y, facing: "right" },
    });
    expect((await save(page)).location.regionId).toBe("r05");
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["east_gate_locked"]);
    expect(texts.join(" ")).toContain("장부 미기재");
    expect((await save(page)).location.regionId).toBe("r05");
    expect((await obj(page, "m_P0513")).removed).toBe(false);
  });

  test("시간 측정: P0513 2페이즈 생성기·모범답안·다른 풀이·느린 풀이 채점 시간", async ({ page }) => {
    test.setTimeout(600_000);
    await boot(page);
    const m = await page.evaluate(async () => {
      const W = (window as any).__pyrpg;
      await W.runner.init();
      const p = W.content.regions.find((r: any) => r.id === "r05").problems.find((q: any) => q.id === "P0513");
      const idx = p.tests.map((t: any, i: number) => (t.gen ? i : -1)).filter((i: number) => i >= 0);
      const gen: number[] = [];
      const sizes: number[] = [];
      for (const i of idx) {
        const t0 = performance.now();
        const d = await W.runner.testData(p, i);
        gen.push(performance.now() - t0);
        sizes.push(d.in.length);
      }
      return { idx, gen, sizes, refMs: W.runner.referenceMs() };
    });
    expect(m.idx).toHaveLength(4);
    const judge = (c: string) =>
      page.evaluate(async (code) => {
        const W = (window as any).__pyrpg;
        const p = W.content.regions.find((r: any) => r.id === "r05").problems.find((q: any) => q.id === "P0513");
        const t0 = performance.now();
        const res = await W.runner.judge(p, code, { scope: "all", phase: 2 });
        return { wall: performance.now() - t0, verdict: res.verdict, limitMs: res.limitMs, times: res.tests.map((t: any) => t.timeMs), verdicts: res.tests.map((t: any) => t.verdict) };
      }, c);
    const r = await judge(solution("P0513"));
    const altDict = await judge(code("P0513", "alt_dict.py"));
    const altSort = await judge(code("P0513", "alt_sort.py"));
    const slow = await judge(code("P0513", "slow.py"));
    const f = (xs: number[]) => xs.map((g) => g.toFixed(0)).join("/");
    console.log(
      `P0513 2페이즈: ref=${m.refMs.toFixed(1)} ms, 제한=${r.limitMs} ms, 입력 크기=${m.sizes.map((s: number) => (s / 1e6).toFixed(2)).join("/")} MB, ` +
        `생성기=${f(m.gen)} ms, 모범답안 테스트별=${f(r.times)} ms(채점 전체 ${r.wall.toFixed(0)} ms), ` +
        `alt_dict=${f(altDict.times)} ms(${altDict.verdict}), alt_sort=${f(altSort.times)} ms(${altSort.verdict}), slow.py=${slow.verdicts.join("/")} ${slow.wall.toFixed(0)} ms`,
    );
    expect(r.verdict).toBe("AC");
    expect(altDict.verdict).toBe("AC");
    expect(altSort.verdict).toBe("AC");
    expect(slow.verdict).toBe("TLE");
    for (const t of r.times) expect(t * 3).toBeLessThanOrEqual(r.limitMs);
    for (const s of m.sizes) expect(s).toBeLessThan(10_000_000);
  });
});
