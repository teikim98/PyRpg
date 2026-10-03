// 지역 4(무너진 대도서관) 클리어 E2E(docs/phase3/region04-spec.md §8).
// 지역 1~3을 끝낸 저장에서 시작해 실제 방향키·대화·레슨·CodeMirror·Pyodide 채점으로 지역 4를 끝까지 플레이한다.
// 레슨 4개 → 필수 몬스터 → 숨겨진 길(빈 책장 칸) → 기록관의 안경(상자 → 장비 → 코덱스 바로가기) → 보스 1·2페이즈 → 클리어.
// 도우미는 region3.spec.ts와 같은 방식이다(window.__pyrpg 훅은 좌표·진행도·길찾기만, 이동은 실제 키).
// PW_PORT=4184 npx playwright test tests/e2e/region4.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const PROBLEMS = "content/regions/r04-grand-library/problems";
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

/** 맵(map.tmj)의 ground 레이어에서 빈 책장 칸(shelf_gap, 지나갈 수 있는 숨겨진 길 입구)과 그 이웃 타일 이름 */
function shelfGap(): { x: number; y: number; below: string[] } {
  const map = JSON.parse(readFileSync("content/regions/r04-grand-library/map.tmj", "utf8"));
  const ts = map.tilesets[0];
  const nameOf = (gid: number) => ts.tiles.find((t: any) => t.id === gid - ts.firstgid)?.type ?? "";
  const gid = ts.firstgid + ts.tiles.find((t: any) => t.type === "shelf_gap").id;
  const ground = map.layers.find((l: any) => l.name === "ground").data as number[];
  const col = map.layers.find((l: any) => l.name === "collision").data as number[];
  const cells = ground.map((g, i) => (g === gid ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  expect(col[cells[0]]).toBe(0);
  const x = cells[0] % map.width;
  const y = Math.floor(cells[0] / map.width);
  return { x, y, below: [1, 2].map((d) => nameOf(ground[(y + d) * map.width + x])) };
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

interface CastMeasure {
  wallMs: number;
  /** 시전 중 화면 그리기(requestAnimationFrame) 사이 가장 긴 간격 */
  maxFrameGapMs: number;
  frames: number;
  /** 시전 중 테스트 쪽에서 page.evaluate가 돌아오는 데 걸린 가장 긴 시간(메인 스레드가 막히면 길어진다) */
  maxEvalMs: number;
  /** 시전 중 메시지 칸에 나온 글(순서대로, 중복 제거) */
  messages: string[];
  /** 테스트 결과 연출('빗나감'·'-1')이 뜬 시각들(시전 시작부터, ms) */
  floatsMs: number[];
}

/** 시전하면서 화면이 멈추지 않는지(프레임 간격·메시지 변화)를 잰다 */
async function castMeasured(page: Page, timeoutMs = 300_000): Promise<CastMeasure> {
  await expect(page.locator(".act-cast")).toBeEnabled({ timeout: 60_000 });
  await page.evaluate(() => {
    const m = { maxGap: 0, frames: 0, last: performance.now(), start: performance.now(), on: true, floats: [] as number[], obs: null as MutationObserver | null };
    (window as any).__fm = m;
    const tick = (t: number) => {
      if (!m.on) return;
      m.maxGap = Math.max(m.maxGap, t - m.last);
      m.last = t;
      m.frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // 테스트 하나의 결과가 나올 때마다 뜨는 '빗나감'·'-1' 연출(onProgress)의 시각
    m.obs = new MutationObserver((recs) => {
      for (const r of recs)
        for (const n of Array.from(r.addedNodes))
          if (n instanceof HTMLElement && (n.classList.contains("float-miss") || n.classList.contains("float-hit"))) m.floats.push(Math.round(performance.now() - m.start));
    });
    m.obs.observe(document.body, { childList: true, subtree: true });
  });
  const t0 = Date.now();
  await page.locator(".act-cast").click();
  const messages: string[] = [];
  let maxEvalMs = 0;
  for (;;) {
    const e0 = Date.now();
    const st = await page.evaluate(() => {
      const root = document.querySelector(".battle");
      const banner = document.querySelector(".battle-banner") as HTMLElement | null;
      return {
        done: !root || (banner !== null && !banner.hidden) || !root.classList.contains("is-busy"),
        text: (document.querySelector(".battle-msg-text")?.textContent ?? "").trim().slice(0, 60),
      };
    });
    maxEvalMs = Math.max(maxEvalMs, Date.now() - e0);
    if (st.text && messages.at(-1) !== st.text) messages.push(st.text);
    if (st.done) break;
    if (Date.now() - t0 > timeoutMs) throw new Error(`cast timeout ${timeoutMs} ms`);
    await page.waitForTimeout(100);
  }
  const wallMs = Date.now() - t0;
  const fm = await page.evaluate(() => {
    const m = (window as any).__fm;
    m.on = false;
    m.obs?.disconnect();
    return { maxGap: m.maxGap, frames: m.frames, floats: m.floats as number[] };
  });
  return { wallMs, maxFrameGapMs: Math.round(fm.maxGap), frames: fm.frames, maxEvalMs, messages, floatsMs: fm.floats };
}

/** 오답을 시전하고 판정·진단을 확인한다 */
async function castWrong(page: Page, pid: string, file: string, expectText: (string | RegExp)[]): Promise<void> {
  const wrong = code(pid, file);
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

/** 캠프파이어에서 쉬고, 복귀 지점이 그 캠프파이어 옆으로 옮겨졌는지 확인한다 */
async function rest(page: Page, campfire: string): Promise<void> {
  expect(await talk(page, campfire)).toBe("campfire_rest");
  const camp = await obj(page, campfire);
  const s = await save(page);
  expect(s.lastCampfire.regionId).toBe("r04");
  expect(Math.abs(s.lastCampfire.x - camp.x) + Math.abs(s.lastCampfire.y - camp.y)).toBe(1);
  await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);
}

// ───────────── 준비: 지역 1~3을 끝낸 저장 ─────────────

const R01_LESSONS = ["L1-1", "L1-2", "L1-3", "L1-4"];
const R01_FLAGS = ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r01.clear"];
const R02_LESSONS = ["L2-1", "L2-2", "L2-3", "L2-4"];
const R02_FLAGS = ["region.r02.clear", "trigger.r02.t_boss_intro"];
const R03_LESSONS = ["L3-1", "L3-2", "L3-3", "L3-4", "L3-5"];
const R03_FLAGS = ["region.r03.clear", "trigger.r03.t_boss_intro"];

/**
 * 새 게임으로 부팅 → 에코 마을·갈림길 숲을 끝낸 저장으로 고블린 동굴에 실제로 걸어 들어간 뒤,
 * 지역 3도 다 끝내고(몬스터·상자 제거, 레슨 5개) 동굴 동쪽 문 바로 앞에 선 저장으로 다시 시작한다
 */
async function seedRegion3Cleared(page: Page): Promise<void> {
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
  const w = await where(page);
  expect({ x: w.x, y: w.y }).toEqual({ x: gate3.x - 1, y: gate3.y });
  const s = await save(page);
  expect(s.location.regionId).toBe("r03");
  expect(s.problems.P0311.solved).toBe(true);
  expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.list", "scroll.slice", "scroll.methods", "scroll.comprehension", "scroll.grid"]));
  expect(await said(page)).toEqual([]);
  await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
}

/** 고블린 동굴 동쪽 문으로 대도서관에 처음 들어간다 */
async function crossToLibrary(page: Page): Promise<void> {
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
}

const REQUIRED = ["m_P0401", "m_P0402", "m_P0404", "m_P0406", "m_P0407", "m_P0408", "m_P0409", "m_P0411"];
const OPTIONAL = ["m_P0403", "m_P0405", "m_P0410"];

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 4 무너진 대도서관 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("입장: 고블린 동굴 동쪽 문 → 첫 대사·도서관 트리거 → 복귀 지점이 도서관 입구 → 서쪽 문으로 돌아갔다가 다시 오기", async () => {
    test.setTimeout(300_000);
    await seedRegion3Cleared(page);
    const campBefore = (await save(page)).lastCampfire;
    expect(campBefore.regionId).toBe("r03");

    // 처음 건널 때: 동굴 문의 openDialogue(누리의 연결 대사, 한 번) → 지역 첫 대사 → spawn 옆 트리거(도착 칸)
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "library_intro"]);
    for (const t of texts) expect(t).not.toMatch(/준비 중|여기까지입니다/);
    const all = texts.join(" ");
    expect(texts[0]).toContain("오래된 종이 냄새");
    expect(all).toContain("무너진 대도서관");
    expect(all).toContain("처음부터 그려져 있었어");
    // 이름(할트)은 2막에서 나온다
    expect(all).not.toContain("할트");
    await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    const spawn = await obj(page, "spawn_west");
    const trig = await obj(page, "t_library_intro");
    expect(st.save.location.regionId).toBe("r04");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: trig.x, y: trig.y });
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    expect(st.save.flags["trigger.r04.t_library_intro"]).toBe(true);
    expect(st.save.flags["region.r04.intro"]).toBe(true);
    // 쓰러졌을 때의 복귀 지점이 도서관 입구로 옮겨졌다
    expect(st.save.lastCampfire).toEqual({ regionId: "r04", x: trig.x, y: trig.y });
    // 카펫 위로 몇 칸 들어가서 정문 홀을 찍는다
    await walkTo(page, trig.x + 3, trig.y);
    await shot(page, "r04-entrance.png");

    // 서쪽 문 → 고블린 동굴 동쪽 문 옆
    await interact(page, "warp_west");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("고블린 동굴");
    expect((await save(page)).location.regionId).toBe("r03");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await said(page)).slice(3)).toEqual([]);

    // 다시 건너면 대사 없이 바로(openDialogue·once 트리거·지역 첫 대사 모두 한 번만)
    await interact(page, "warp_east");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "library_intro"]);
    const again = await where(page);
    expect(Math.abs(again.x - spawn.x) + Math.abs(again.y - spawn.y)).toBeLessThanOrEqual(1);
  });

  test("정문 홀: 주문서 없이 막힘 → L4-1 → P0401 오답 2번(JS식 s.length·readline 줄바꿈 진단) → 승리 → 화로 → P0402 오답(문자열 reverse) → 승리", async () => {
    test.setTimeout(300_000);
    await bump(page, "m_P0401");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L4-1", "::-1", "scroll.string", "r04-lesson.png");

    await openBattle(page, "m_P0401", "P0401");
    const maxHp = (await save(page)).player.hp;
    // s.length → AttributeError, 5번째 줄, JS 말투 진단
    await castWrong(page, "P0401", "wrong_c.py", ["AttributeError", "JS 말투", "len(s)"]);
    await expect(msg(page).locator(".err-line")).toHaveText("5번째 줄");
    // 진단이 본문, 일반 Traceback 해설은 [자세히]로 접힘
    await expect(msg(page).locator(".diag")).toBeVisible();
    await expect(msg(page).locator(".err-explain")).toBeHidden();
    await expect(msg(page).locator(".counter")).toContainText("HP −20");
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 20}/${maxHp}`);
    // 안경이 없으면 코덱스 바로가기는 없다
    await expect(codexLink(page)).toHaveCount(0);
    await shot(page, "r04-battle-diag.png");
    // readline의 줄바꿈을 떼지 않음 → WA 진단
    await castWrong(page, "P0401", "wrong_a.py", ["줄바꿈", "rstrip"]);
    await finishWin(page, "m_P0401", "P0401");
    expect((await save(page)).problems.P0401).toMatchObject({ solved: true, attempts: 3 });

    await rest(page, "campfire_hall");

    await openBattle(page, "m_P0402", "P0402");
    await castWrong(page, "P0402", "wrong_b.py", ["AttributeError", "reverse()", "title[::-1]"]);
    await finishWin(page, "m_P0402", "P0402");
  });

  test("열람실: 유령 사서(빈 책장 칸·안경 귀띔) → 그림자 게시판 → L4-2 → P0404 오답(메서드 결과를 담지 않음) → 승리", async () => {
    test.setTimeout(300_000);
    await interact(page, "npc_ghost_librarian");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_ghost_librarian");
    const all = texts.join(" ");
    expect(all).toContain("책이 군데군데 빠진 칸");
    expect(all).toContain("그 바로 위 칸");
    expect(all).toContain("기록관이 쓰던 안경");

    await interact(page, "board_shadow_r04");
    await settle(page, ".board-modal");
    await expect(page.locator(".board-modal")).toBeVisible();
    await page.locator(".board-modal .sys-close").click();
    await expect(page.locator(".board-modal")).toHaveCount(0);
    await settle(page);

    await bump(page, "m_P0404");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await lesson(page, "rune_L4-2", "strip", "scroll.strmethods");
    await openBattle(page, "m_P0404", "P0404");
    await castWrong(page, "P0404", "wrong_a.py", ["새 문자열을 돌려줘", "title = title.strip()"]);
    await finishWin(page, "m_P0404", "P0404");
  });

  test("서고 미로: 표지판 → L4-3 → P0406 오답(print(words.reverse())) → 승리 → 떠 있는 낱장 위 빈 책장 칸으로 숨겨진 서고 → 상자 → P0407 오답(권수 서식) → 승리", async () => {
    test.setTimeout(300_000);
    await interact(page, "sign_stacks");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_stacks");
    expect(texts.join(" ")).toContain("책이 빠진 한 칸");
    await lesson(page, "rune_L4-3", '"-"', "scroll.splitjoin");
    await openBattle(page, "m_P0406", "P0406");
    await castWrong(page, "P0406", "wrong_b.py", ["None", '" ".join(words)']);
    await finishWin(page, "m_P0406", "P0406");

    // 귀띔대로: 떠 있는 낱장 두 칸 바로 위의 빈 책장 칸
    const gap = shelfGap();
    expect(gap.below).toEqual(["floating_pages", "floating_pages"]);
    const chest = await obj(page, "chest_hidden_stacks");
    expect(chest.y).toBeLessThan(gap.y);
    await walkTo(page, gap.x, gap.y + 1);
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y - 1 });
    await shot(page, "r04-hidden-stacks.png");
    const gold0 = (await save(page)).player.gold;
    expect(await talk(page, "chest_hidden_stacks")).toBe("chest_hidden_stacks");
    expect((await save(page)).player.gold).toBe(gold0 + 70);
    expect((await obj(page, "chest_hidden_stacks")).removed).toBe(true);

    await openBattle(page, "m_P0407", "P0407");
    await castWrong(page, "P0407", "wrong_a.py", ["세 자리", "{n:03d}"]);
    await finishWin(page, "m_P0407", "P0407");
  });

  test("새로고침: 대도서관의 위치·진행이 그대로", async () => {
    test.setTimeout(120_000);
    const p0 = await where(page);
    const s0 = await save(page);
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    for (const id of ["m_P0401", "m_P0402", "m_P0404", "m_P0406", "m_P0407", "chest_hidden_stacks"]) expect((await obj(page, id)).removed, id).toBe(true);
  });

  test("필사실: L4-4 → 기록관의 안경 상자(토스트) → 장비에서 장착 → P0408에서 s[0] = 'x' TypeError의 📖 코덱스(L4-1) 왕복 → 승리 → 캠프파이어 → P0409", async () => {
    test.setTimeout(400_000);
    await lesson(page, "rune_L4-4", "3", "scroll.ascii");

    // 길목(P0408) 바로 앞 필수 경로 옆의 상자
    await interact(page, "chest_archivist");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("chest_archivist");
    expect(texts.join(" ")).toContain("장비");
    await expect(page.locator(".toast", { hasText: "기록관의 안경을 얻었다!" })).toBeVisible();
    let s = await save(page);
    expect(s.inventory["archivist-glasses"]).toBe(1);
    expect(s.equipment).not.toContain("archivist-glasses");
    expect((await obj(page, "chest_archivist")).removed).toBe(true);

    // 누리 말대로 Esc → 장비에서 낀다
    await page.keyboard.press("Escape");
    await expect(page.locator(".menu-modal")).toBeVisible();
    await page.locator(".menu-equipment").click();
    await expect(page.locator(".equip-modal")).toBeVisible();
    const glasses = page.locator('.equip-item[data-item="archivist-glasses"]');
    await expect(glasses).not.toContainText("준비 중");
    await page.locator('.equip-toggle[data-item="archivist-glasses"]').click();
    await expect(glasses).toHaveClass(/is-equipped/);
    for (let i = 0; i < 4 && (await page.locator(".ui-modal").count()); i++) await page.keyboard.press("Escape");
    await settle(page);
    s = await save(page);
    expect(s.equipment).toContain("archivist-glasses");

    // 지역 4 문제에서 문자열 칸에 대입 → TypeError, 해설 아래 '📖 코덱스: 글자 읽기의 주문'
    await openBattle(page, "m_P0408", "P0408");
    const assign = 'import sys\ninput = sys.stdin.readline\n\ns = input().rstrip()\ns[0] = "x"\nprint(s)';
    await typeCode(page, assign);
    await cast(page);
    await expect(msg(page)).toContainText("TypeError");
    // 진단이 없는 RE: 'str' object does not support item assignment의 일반 해설(불변)
    await expect(msg(page)).toContainText("글자를 바꿀 수 없어");
    await expect(msg(page).locator(".err-line")).toHaveText("5번째 줄");
    await expect(codexLink(page)).toHaveText("📖 코덱스: 글자 읽기의 주문: 문자열");
    // 일반 해설이 길어서 바로가기는 메시지 칸 아래쪽에 걸려 있다('▼ 더 있어'). 그 표시를 눌러 칸을 내려서 찍는다
    await expect(page.locator(".battle-msg-more")).toBeVisible();
    for (let i = 0; i < 4 && (await page.locator(".battle-msg-more").isVisible()); i++) {
      await page.locator(".battle-msg-more").click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator(".battle-msg-more")).toBeHidden();
    await shot(page, "r04-glasses-codex.png");
    // 키보드로 바로가기 → L4-1을 펼친 코덱스 → Esc로 닫으면 전투로(코드·HP·포커스 그대로)
    const hp = await page.locator(".player-hp-text").textContent();
    await codexLink(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".codex-modal")).toBeVisible();
    await expect(page.locator('.codex-item[data-lesson="L4-1"]')).toHaveAttribute("aria-current", "true");
    await expect(page.locator(".codex-lesson-title")).toHaveText("글자 읽기의 주문: 문자열");
    await expect(page.locator(".codex-modal")).toContainText("TypeError");
    await expect(page.locator(".battle-modal")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".codex-modal")).toHaveCount(0);
    await expect(page.locator(".battle-modal")).toBeVisible();
    expect(await editorText(page)).toBe(assign);
    expect(await page.locator(".player-hp-text").textContent()).toBe(hp);
    await expect(codexLink(page)).toBeFocused();

    // " ".join(정수 리스트) → 진단이 먼저, 바로가기는 머리 줄(엮고 푸는 주문)
    await castWrong(page, "P0408", "wrong_a.py", ["join", "map(str, cnt)"]);
    await expect(msg(page).locator(".diag")).toBeVisible();
    await expect(msg(page).locator(".err-explain")).toBeHidden();
    await expect(msg(page).locator(".err-head .codex-link")).toBeVisible();
    await expect(codexLink(page)).toHaveText("📖 코덱스: 엮고 푸는 주문: split, join, f-string");
    await finishWin(page, "m_P0408", "P0408");

    await rest(page, "campfire_scriptorium");

    await openBattle(page, "m_P0409", "P0409");
    await castWrong(page, "P0409", "wrong_a.py", ["% 26"]);
    await finishWin(page, "m_P0409", "P0409");
  });

  test("봉인 서고·골렘의 열람대: 봉인 기록 → 보스 앞 트리거 → P0411 느린 풀이 1페이즈 통과·2페이즈 시간 결계 TLE → 모범답안 승리 → 클리어 → 실전 추천 → 동쪽 문", async () => {
    test.setTimeout(900_000);
    await interact(page, "sign_sealed_record");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_sealed_record");
    const all = texts.join(" ");
    expect(all).toContain("사고가 아니었다");
    expect(all).toContain("일부러");
    expect(all).not.toContain("할트");

    const boss = await obj(page, "m_P0411");
    const n0 = (await said(page)).length;
    await bump(page, "m_P0411");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0411");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();

    // 1페이즈: 문자열 칸에 바로 대입 → TypeError 진단, 안경의 바로가기는 머리 줄(글자 읽기의 주문)
    await castWrong(page, "P0411", "wrong_d.py", ["불변", "list(s)"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(msg(page).locator(".err-head .codex-link")).toHaveText("📖 코덱스: 글자 읽기의 주문: 문자열");

    // 명령마다 s[:i] + c + s[i + 1:]: 1페이즈(N, Q ≤ 1000) 통과
    const slow = code("P0411", "slow.py");
    await typeCode(page, slow);
    await cast(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();

    // 2페이즈: 같은 코드 → 시간 결계 TLE(생성기가 만든 N = 150,000, Q = 800,000 입력), 진단이 먼저
    const slowM = await castMeasured(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".fb")).toContainText("통과 0/4");
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("s[:i] + c + s[i + 1:]");
    await expect(msg(page).locator(".diag")).toContainText('"".join(arr)');
    await expect(msg(page)).not.toContainText("폭발");
    await shot(page, "r04-boss-phase2.png");

    // O(N + Q) 풀이 → 승리(느린 풀이는 stopOnTle로 첫 테스트만 만들었으므로 나머지 3개 생성기도 이 시전에 돈다)
    await typeCode(page, solution("P0411"));
    const modelM = await castMeasured(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    console.log(
      `P0411 2페이즈 시전(벽시계): slow.py=${slowM.wallMs} ms(TLE, 테스트 결과 연출 ${JSON.stringify(slowM.floatsMs)} ms, 최대 프레임 간격 ${slowM.maxFrameGapMs} ms, ` +
        `프레임 ${slowM.frames}, evaluate 최대 ${slowM.maxEvalMs} ms, 메시지 ${JSON.stringify(slowM.messages)}) / ` +
        `모범답안=${modelM.wallMs} ms(나머지 생성기 포함, 테스트 결과 연출 ${JSON.stringify(modelM.floatsMs)} ms, 최대 프레임 간격 ${modelM.maxFrameGapMs} ms, ` +
        `프레임 ${modelM.frames}, evaluate 최대 ${modelM.maxEvalMs} ms, 메시지 ${JSON.stringify(modelM.messages)})`,
    );
    // 시전 중 화면이 멈추지 않는다(채점은 워커에서)
    expect(slowM.maxFrameGapMs).toBeLessThan(1_000);
    expect(modelM.maxFrameGapMs).toBeLessThan(1_000);
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
    await expect(page.locator(".recommend-modal")).toContainText("무너진 대도서관");
    await expect(page.locator(".recommend-item")).toHaveCount(6);
    const links = page.locator(".recommend-item.site-programmers a.recommend-link");
    await expect(links).toHaveCount(3);
    const ids = [12926, 72410, 60057];
    for (let i = 0; i < 3; i++) {
      await expect(page.locator(".recommend-item").nth(i)).toHaveAttribute("data-site", "programmers");
      await expect(links.nth(i)).toHaveAttribute("href", `https://school.programmers.co.kr/learn/courses/30/lessons/${ids[i]}`);
    }
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(3);
    await expect(page.locator(".recommend-item.site-boj a")).toHaveCount(0);
    await shot(page, "r04-clear.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    const s = await save(page);
    expect(s.flags["region.r04.clear"]).toBe(true);
    for (const id of [...REQUIRED, "chest_hidden_stacks", "chest_archivist"]) expect(s.removedObjects, id).toContain(id);
    for (const id of OPTIONAL) expect(s.removedObjects, id).not.toContain(id);
    expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.string", "scroll.strmethods", "scroll.splitjoin", "scroll.ascii"]));
    for (const p of ["P0401", "P0402", "P0404", "P0406", "P0407", "P0408", "P0409", "P0411"]) expect(s.problems[p].solved, p).toBe(true);

    // 새로고침해도 클리어 연출이 다시 나오지 않는다
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    expect((await save(page)).location.regionId).toBe("r04");

    // 보스가 있던 칸을 지나 동쪽 끝 문: 지역 5 교역항의 spawn_west로 이어진다
    // (처음 건널 때 누리의 연결 대사 → 지역 첫 대사 → spawn 옆 트리거. '준비 중'이라고 말하지 않는다)
    await walkTo(page, boss.x, boss.y);
    await interact(page, "warp_east");
    const crossTexts = await readAll(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "port_intro"]);
    for (const t of crossTexts) expect(t).not.toMatch(/준비 중|여기까지입니다/);
    expect(crossTexts[0]).toContain("짭짤한 바람");
    await expect(page.locator(".hud-region")).toHaveText("교역항");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    expect(st.save.location.regionId).toBe("r05");
    const spawn = await obj(page, "spawn_west");
    expect(Math.abs(st.pos.x - spawn.x) + Math.abs(st.pos.y - spawn.y)).toBeLessThanOrEqual(1);
  });
});

test.describe("지역 4 실패·잠긴 문·시간 측정", () => {
  test("쓰러짐: 도서관 안에서 쓰러지면 도서관 캠프파이어(복귀 지점)에서 HP 가득으로 다시 시작(동굴로 돌아가지 않는다)", async ({ page }) => {
    test.setTimeout(300_000);
    await seedRegion3Cleared(page);
    await crossToLibrary(page);
    expect((await save(page)).lastCampfire.regionId).toBe("r04");
    await lesson(page, "rune_L4-1", "::-1", "scroll.string");
    await rest(page, "campfire_hall");
    const camp = (await save(page)).lastCampfire;
    const maxHp = (await save(page)).player.hp;

    await openBattle(page, "m_P0401", "P0401");
    const wrong = code("P0401", "wrong_b.py");
    await typeCode(page, wrong);
    for (let i = 0; i < 20 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
    await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("knockout");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
    await expect(page.locator(".hud-region")).toHaveText("무너진 대도서관");
    const s = await save(page);
    expect(s.location.regionId).toBe("r04");
    expect(s.player.hp).toBe(maxHp);
    await expect(page.locator(".hud-hp-text")).toHaveText(`${maxHp}/${maxHp}`);
    expect(s.problems.P0401).toMatchObject({ knockouts: 1, draft: wrong, solved: false });
    expect((await obj(page, "m_P0401")).removed).toBe(false);
  });

  test("동쪽 문: 사서 골렘을 쓰러뜨리기 전에는 책장 벽에 막혀 있다", async ({ page }) => {
    test.setTimeout(240_000);
    await seedRegion3Cleared(page);
    await crossToLibrary(page);
    const gate = await obj(page, "warp_east");
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [gate.x - 1, gate.y])).toBeNull();
    await seedAndReload(page, {
      lessons: ["L4-1", "L4-2", "L4-3", "L4-4"],
      removed: REQUIRED.filter((id) => id !== "m_P0411"),
      at: { x: gate.x - 1, y: gate.y, facing: "right" },
    });
    expect((await save(page)).location.regionId).toBe("r04");
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["east_gate_locked"]);
    expect(texts.join(" ")).toContain("열람 금지");
    expect((await save(page)).location.regionId).toBe("r04");
    expect((await obj(page, "m_P0411")).removed).toBe(false);
  });

  test("시간 측정: P0411 2페이즈 생성기·모범답안·느린 풀이 채점 시간", async ({ page }) => {
    test.setTimeout(600_000);
    await boot(page);
    const m = await page.evaluate(async () => {
      const W = (window as any).__pyrpg;
      await W.runner.init();
      const p = W.content.regions.find((r: any) => r.id === "r04").problems.find((q: any) => q.id === "P0411");
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
        const p = W.content.regions.find((r: any) => r.id === "r04").problems.find((q: any) => q.id === "P0411");
        const t0 = performance.now();
        const res = await W.runner.judge(p, code, { scope: "all", phase: 2 });
        return { wall: performance.now() - t0, verdict: res.verdict, limitMs: res.limitMs, times: res.tests.map((t: any) => t.timeMs), verdicts: res.tests.map((t: any) => t.verdict) };
      }, c);
    const r = await judge(solution("P0411"));
    const alt = await judge(code("P0411", "alt_concat.py"));
    const slow = await judge(code("P0411", "slow.py"));
    // 처음부터(생성기 캐시 없이) 시전 한 번에 드는 전체 시간: 새 페이지에서 다시 잰다
    const page2 = await page.context().newPage();
    await boot(page2);
    const cold = await page2.evaluate(async (code) => {
      const W = (window as any).__pyrpg;
      await W.runner.init();
      const p = W.content.regions.find((r: any) => r.id === "r04").problems.find((q: any) => q.id === "P0411");
      const t0 = performance.now();
      const res = await W.runner.judge(p, code, { scope: "all", phase: 2 });
      return { wall: performance.now() - t0, verdict: res.verdict };
    }, solution("P0411"));
    const coldSlow = await page2.evaluate(async (code) => {
      const W = (window as any).__pyrpg;
      const p = W.content.regions.find((r: any) => r.id === "r04").problems.find((q: any) => q.id === "P0411");
      // 생성기 캐시를 비운 채로 다시 재기 위해 새 문제 객체(테스트 객체가 다르면 캐시가 없다)
      const fresh = structuredClone(p);
      const t0 = performance.now();
      const res = await W.runner.judge(fresh, code, { scope: "all", phase: 2 });
      return { wall: performance.now() - t0, verdict: res.verdict, verdicts: res.tests.map((t: any) => t.verdict) };
    }, code("P0411", "slow.py"));
    await page2.close();
    const f = (xs: number[]) => xs.map((g) => g.toFixed(0)).join("/");
    console.log(
      `P0411 2페이즈: ref=${m.refMs.toFixed(1)} ms, 제한=${r.limitMs} ms, 입력 크기=${m.sizes.map((s: number) => (s / 1e6).toFixed(1)).join("/")} MB, ` +
        `생성기=${f(m.gen)} ms, 모범답안 테스트별=${f(r.times)} ms(채점 전체 캐시 후 ${r.wall.toFixed(0)} ms), ` +
        `alt_concat 테스트별=${f(alt.times)} ms(${alt.verdict}), slow.py=${slow.verdicts.join("/")} ${slow.wall.toFixed(0)} ms(캐시 후), ` +
        `새 페이지(생성 포함): 모범답안 ${cold.wall.toFixed(0)} ms(${cold.verdict}), slow.py ${coldSlow.wall.toFixed(0)} ms(${coldSlow.verdicts.join("/")})`,
    );
    expect(r.verdict).toBe("AC");
    expect(alt.verdict).toBe("AC");
    expect(cold.verdict).toBe("AC");
    expect(slow.verdict).toBe("TLE");
    expect(coldSlow.verdict).toBe("TLE");
    for (const t of r.times) expect(t * 3).toBeLessThanOrEqual(r.limitMs);
  });
});
