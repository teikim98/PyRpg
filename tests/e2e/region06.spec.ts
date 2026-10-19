// 지역 6(거울 호수) 클리어 E2E(docs/phase3/region06-spec.md §9).
// 지역 1~5를 끝낸 저장에서 시작해 실제 방향키·대화·레슨·CodeMirror·Pyodide 채점으로 지역 6을 끝까지 플레이한다.
// 교역항 동쪽 문 → 레슨 5개 → 필수 몬스터(오답 진단 포함) → 호수 상점에서 메아리 고리 사기·끼기·[예제 실행] 줄별 횟수 →
// 호수지기 귀띔 → 숨겨진 길(조약돌 더미 바로 북쪽의 갈대) → 중간 보스 1·2페이즈(지역 클리어가 아님) →
// 최종 보스 1·2페이즈 → 클리어(실전 추천) → 동쪽 문 to_be_continued.
// 도우미는 region5.spec.ts와 같은 방식이다(window.__pyrpg 훅은 좌표·진행도·길찾기만, 이동은 실제 키).
// PW_PORT=4371 npx playwright test tests/e2e/region06.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const PROBLEMS = "content/regions/r06-mirror-lake/problems";
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

/** 맵(map.tmj)에서 갈대 빈틈 칸(reed_gap, 지나갈 수 있는 숨겨진 길 입구)과 그 남쪽 칸에 보이는 타일 이름 */
function reedGap(): { x: number; y: number; south: string; cairns: number } {
  const map = JSON.parse(readFileSync("content/regions/r06-mirror-lake/map.tmj", "utf8"));
  const ts = map.tilesets[0];
  const nameOf = (gid: number) => (gid ? ts.tiles.find((t: any) => t.id === gid - ts.firstgid)?.type ?? "" : "");
  const layer = (n: string) => map.layers.find((l: any) => l.name === n).data as number[];
  const ground = layer("ground");
  const deco = layer("deco");
  const col = layer("collision");
  const seen = (i: number) => nameOf(deco[i]) || nameOf(ground[i]);
  const cells = ground.map((_, i) => (seen(i) === "reed_gap" ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  expect(col[cells[0]]).toBe(0);
  const x = cells[0] % map.width;
  const y = Math.floor(cells[0] / map.width);
  const cairns = ground.filter((_, i) => seen(i) === "pebble_cairn").length;
  return { x, y, south: seen((y + 1) * map.width + x), cairns };
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

async function closeAll(page: Page): Promise<void> {
  for (let i = 0; i < 4 && (await page.locator(".ui-modal").count()); i++) await page.keyboard.press("Escape");
  await settle(page);
}

async function openMenu(page: Page, item: string, modal: string): Promise<void> {
  await settle(page);
  await page.keyboard.press("KeyM");
  await expect(page.locator(".menu-modal")).toBeVisible();
  await page.locator(item).click();
  await expect(page.locator(modal)).toBeVisible();
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
  stages: { t: number; text: string; visible: boolean }[];
  hides: number;
}

/** 시전하면서 진행 표시(.cast-progress)의 변화를 기록한다(region5.spec.ts의 castWithStages를 줄인 것) */
async function castWithStages(page: Page, shots: { when: RegExp; path: string }[] = [], timeoutMs = 300_000): Promise<StageLog> {
  await expect(page.locator(".act-cast")).toBeEnabled({ timeout: 60_000 });
  await page.evaluate(() => {
    const m = { start: performance.now(), stages: [] as { t: number; text: string; visible: boolean }[], hides: 0, obs: null as MutationObserver | null };
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
    m.obs?.disconnect();
    return { stages: m.stages, hides: m.hides };
  });
  return { wallMs, stages: m.stages, hides: m.hides };
}

const allTexts = (log: StageLog) => [...new Set(log.stages.map((s) => s.text).filter(Boolean))];

async function castWrong(page: Page, pid: string, file: string, expectText: (string | RegExp)[]): Promise<void> {
  const wrong = code(pid, file);
  await typeCode(page, wrong);
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeHidden();
  for (const t of expectText) await expect(msg(page)).toContainText(t);
  expect(await editorText(page)).toBe(wrong);
}

async function winCurrent(page: Page, pid: string): Promise<void> {
  await typeCode(page, solution(pid));
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  await expect(page.locator(".reward-xp .reward-value")).toHaveText("+100 XP");
  await expect(page.locator(".reward-gold .reward-value")).toHaveText("+50 G");
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
  expect(s.lastCampfire.regionId).toBe("r06");
  expect(Math.abs(s.lastCampfire.x - camp.x) + Math.abs(s.lastCampfire.y - camp.y)).toBe(1);
  await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);
}

/** 메아리 고리의 거터 표시: 줄 번호 → 문구(systems.spec.ts와 같은 방식) */
const gutterCounts = (page: Page) =>
  page.evaluate(() => {
    const out: Record<number, string> = {};
    const lines = Array.from(document.querySelectorAll(".battle-editor .cm-lineNumbers .cm-gutterElement")) as HTMLElement[];
    const marks = Array.from(document.querySelectorAll(".battle-editor .cm-echo-gutter .cm-gutterElement")) as HTMLElement[];
    for (const m of marks) {
      const text = m.textContent ?? "";
      if (!text) continue;
      const top = m.getBoundingClientRect().top;
      const ln = lines.find((l) => Math.abs(l.getBoundingClientRect().top - top) < 2 && /^\d+$/.test(l.textContent ?? ""));
      if (ln) out[Number(ln.textContent)] = text;
    }
    return out;
  }) as Promise<Record<number, string>>;

/** [예제 실행]을 누르고 메아리 고리의 줄별 횟수가 뜰 때까지 기다린다 */
async function runPublicWithRing(page: Page): Promise<Record<number, string>> {
  await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(0);
  await expect(page.locator(".act-public")).toBeEnabled({ timeout: 60_000 });
  await page.locator(".act-public").click();
  await expect(page.locator(".battle-editor .cm-echo-count").first()).toBeVisible({ timeout: 60_000 });
  await expect(msg(page).locator(".echo-note")).toContainText("메아리 고리");
  return gutterCounts(page);
}

// ───────────── 준비: 지역 1~5를 끝낸 저장 ─────────────

const R01_LESSONS = ["L1-1", "L1-2", "L1-3", "L1-4"];
const R01_FLAGS = ["trigger.r01.t_prologue", "companion.joined", "region.r01.intro", "region.r01.clear"];
const R02_LESSONS = ["L2-1", "L2-2", "L2-3", "L2-4"];
const R02_FLAGS = ["region.r02.clear", "trigger.r02.t_boss_intro"];
const R03_LESSONS = ["L3-1", "L3-2", "L3-3", "L3-4", "L3-5"];
const R03_FLAGS = ["region.r03.clear", "trigger.r03.t_boss_intro"];
const R04_LESSONS = ["L4-1", "L4-2", "L4-3", "L4-4"];
const R04_FLAGS = ["region.r04.clear", "trigger.r04.t_boss_intro"];
const R05_LESSONS = ["L5-1", "L5-2", "L5-3", "L5-4", "L5-5"];
const R05_FLAGS = ["region.r05.clear", "trigger.r05.t_boss_intro"];

/**
 * 새 게임으로 부팅 → 에코 마을·갈림길 숲·고블린 동굴·대도서관을 끝낸 저장으로 차례로 실제로 걸어 들어간 뒤,
 * 교역항도 다 끝내고(몬스터·상자 제거, 레슨 5개) 항구 동쪽 문 바로 앞에 선 저장으로 다시 시작한다.
 * 시드는 전투 보상을 주지 않으므로, 지역 1~5에서 모았을 골드 대신 500 G를 쥐여 준다(메아리 고리 200 G).
 * 지역 4 상자에서 받는 기록관의 안경은 장착한 채로 둔다
 */
async function seedRegion5Cleared(page: Page): Promise<void> {
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
  const cur4 = await save(page);
  await seedAndReload(page, {
    lessons: R04_LESSONS,
    removed: removed4,
    at: { x: gate4.x - 1, y: gate4.y, facing: "right" },
    flags: R04_FLAGS,
    patch: { inventory: { ...cur4.inventory, "archivist-glasses": 1 }, equipment: ["archivist-glasses"] },
  });
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("교역항");

  const removed5 = [...(await objIds(page, "monster")), ...(await objIds(page, "chest")), ...(await objIds(page, "door"))];
  const gate5 = await obj(page, "warp_east");
  const cur5 = await save(page);
  await seedAndReload(page, {
    lessons: R05_LESSONS,
    removed: removed5,
    at: { x: gate5.x - 1, y: gate5.y, facing: "right" },
    flags: R05_FLAGS,
    patch: { player: { ...cur5.player, gold: 500 } },
  });
  const w = await where(page);
  expect({ x: w.x, y: w.y }).toEqual({ x: gate5.x - 1, y: gate5.y });
  const s = await save(page);
  expect(s.location.regionId).toBe("r05");
  expect(s.problems.P0513.solved).toBe(true);
  expect(s.player.gold).toBe(500);
  expect(s.equipment).toEqual(["archivist-glasses"]);
  expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.tuple", "scroll.dict", "scroll.set", "scroll.counter", "scroll.deque"]));
  expect(await said(page)).toEqual([]);
  await expect(page.locator(".hud-region")).toHaveText("교역항");
}

/** 교역항 동쪽 문으로 거울 호수에 처음 들어간다 */
async function crossToLake(page: Page): Promise<void> {
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText("거울 호수");
}

const REQUIRED = ["m_P0601", "m_P0602", "m_P0603", "m_P0605", "m_P0606", "m_P0608", "m_P0609", "m_P0610", "m_P0612", "m_P0613", "m_P0614"];
const OPTIONAL = ["m_P0604", "m_P0607", "m_P0611"];

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 6 거울 호수 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("입장: 교역항 동쪽 문 → 배가 강을 거슬러 오르는 연결 대사 → 첫 대사·호숫가 트리거 → 복귀 지점이 나루 → 서쪽 문으로 돌아갔다가 다시 오기", async () => {
    test.setTimeout(300_000);
    await seedRegion5Cleared(page);
    expect((await save(page)).lastCampfire.regionId).toBe("r05");

    // 처음 건널 때: 항구 문의 openDialogue(연결 대사, 한 번) → 지역 첫 대사 → spawn 옆 트리거(도착 칸)
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "lake_intro"]);
    for (const t of texts) expect(t).not.toMatch(/준비 중|여기까지입니다/);
    const all = texts.join(" ");
    expect(all).toContain("강을 거슬러");
    expect(all).toContain("거울 호수");
    expect(all).not.toContain("할트");
    await expect(page.locator(".hud-region")).toHaveText("거울 호수");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    const spawn = await obj(page, "spawn_west");
    const trig = await obj(page, "t_lake_intro");
    expect({ x: spawn.x, y: spawn.y }).toEqual({ x: 1, y: 12 });
    expect(st.save.location.regionId).toBe("r06");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: trig.x, y: trig.y });
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    expect(st.save.flags["trigger.r06.t_lake_intro"]).toBe(true);
    expect(st.save.flags["region.r06.intro"]).toBe(true);
    expect(st.save.lastCampfire).toEqual({ regionId: "r06", x: trig.x, y: trig.y });

    // 서쪽 문 → 교역항 동쪽 문 옆
    await interact(page, "warp_west");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("교역항");
    expect((await save(page)).location.regionId).toBe("r05");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await said(page)).slice(3)).toEqual([]);

    // 다시 건너면 대사 없이 바로
    await interact(page, "warp_east");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("거울 호수");
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "lake_intro"]);
    const again = await where(page);
    expect(Math.abs(again.x - spawn.x) + Math.abs(again.y - spawn.y)).toBeLessThanOrEqual(1);
  });

  test("호숫가 나루: 주문서 없이 막힘 → L6-1 → 상인(메아리 고리) → 상점에서 메아리 고리 사기(200 G) → 장비에서 끼기 → 화로 → P0601 오답(return 대신 print) → 승리 → P0602 [예제 실행]에 줄별 횟수 → 고치면 지움 → 승리", async () => {
    test.setTimeout(300_000);
    await bump(page, "m_P0601");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L6-1", "return", "scroll.function", "r06-lesson.png");

    await interact(page, "npc_lake_merchant");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_lake_merchant");
    expect(texts.join(" ")).toContain("메아리 고리");

    // 호수 상점: 메아리 고리가 처음으로 목록에 나온다(200 G)
    const before = await save(page);
    const gold0 = before.player.gold;
    expect(gold0).toBeGreaterThanOrEqual(200);
    expect(before.inventory["echo-ring"] ?? 0).toBe(0);
    await interact(page, "shop_lake");
    await settle(page, ".shop-modal");
    await expect(page.locator(".shop-gold")).toHaveText(`${gold0} G`);
    const ring = page.locator('.shop-item[data-item="echo-ring"]');
    await expect(ring).toBeVisible();
    await expect(ring).toContainText("200 G");
    await expect(ring).not.toContainText("준비 중");
    await expect(ring).toHaveAttribute("data-state", "available");
    await page.locator('.shop-buy[data-buy="echo-ring"]').click();
    await expect(page.locator(".shop-status")).toContainText("메아리 고리");
    await expect(ring).toHaveAttribute("data-state", "owned");
    await expect(page.locator(".shop-gold")).toHaveText(`${gold0 - 200} G`);
    await closeAll(page);
    const bought = await save(page);
    expect(bought.player.gold).toBe(gold0 - 200);
    expect(bought.inventory["echo-ring"]).toBe(1);

    // 장비: 장신구 칸이 하나면 기록관의 안경을 빼고 메아리 고리를 낀다
    await openMenu(page, ".menu-equipment", ".equip-modal");
    if (bought.equipment.includes("archivist-glasses")) {
      await page.locator('.equip-toggle[data-item="archivist-glasses"]').click();
      await expect(page.locator('.equip-item[data-item="archivist-glasses"]')).not.toHaveClass(/is-equipped/);
    }
    await page.locator('.equip-toggle[data-item="echo-ring"]').click();
    await expect(page.locator('.equip-item[data-item="echo-ring"]')).toHaveClass(/is-equipped/);
    await closeAll(page);
    expect((await save(page)).equipment).toEqual(["echo-ring"]);

    await rest(page, "campfire_ferry");

    await openBattle(page, "m_P0601", "P0601");
    const maxHp = (await save(page)).player.hp;
    await castWrong(page, "P0601", "wrong_c.py", ["None을 돌려줬어", "return"]);
    await expect(msg(page).locator(".counter")).toContainText("HP −20");
    await expect(page.locator(".player-hp-text")).toHaveText(`${maxHp - 20}/${maxHp}`);
    await finishWin(page, "m_P0601", "P0601");

    // P0602: 모범답안으로 [예제 실행](공개 예제: 말뚝 3개) → 줄 번호 옆에 줄마다 실행 횟수
    await openBattle(page, "m_P0602", "P0602");
    const sol = solution("P0602");
    const lines = sol.split("\n");
    const lineOf = (s: string) => lines.findIndex((l) => l.includes(s)) + 1;
    await typeCode(page, sol);
    const counts = await runPublicWithRing(page);
    await expect(msg(page)).toContainText("예제는 전부 통과");
    expect(counts[lineOf("return abs(")]).toBe("×2"); // dist를 두 번 부름
    expect(counts[lineOf("points.append")]).toBe("×3"); // 말뚝 3개
    expect(counts[lineOf("total += dist")]).toBe("×2");
    expect(counts[lineOf("print(total)")]).toBe("×1");
    expect(counts[lineOf("n = int(input())")]).toBe("×1");
    // 정확한 횟수는 마우스를 올리면(title)
    await expect(page.locator(`.battle-editor .cm-echo-count[title="${lineOf("points.append")}번째 줄: 3번 실행"]`)).toHaveText("×3");
    await shot(page, "r06-echo-ring.png");
    // 코드를 고치면 지운다
    await editor(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" ");
    await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(0);
    await finishWin(page, "m_P0602", "P0602");
  });

  test("버드나무 둑: 호수지기(숨겨진 길 귀띔·복선) → 그림자 게시판 → 주문서 없이 막힘 → L6-2 → P0603 오답(0부터 번호) → 승리 → P0605 오답(map 두 번) → 승리", async () => {
    test.setTimeout(300_000);
    await interact(page, "npc_lake_keeper");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_lake_keeper");
    const all = texts.join(" ");
    expect(all).toContain("조약돌 더미 바로 북쪽의 갈대");
    expect(all).toContain("거울 쌍둥이");
    expect(all).toContain("끝나지 않는 메아리");
    expect(all).not.toContain("할트");

    await interact(page, "board_shadow_r06");
    await settle(page, ".board-modal");
    await expect(page.locator(".board-modal")).toBeVisible();
    await page.locator(".board-modal .sys-close").click();
    await expect(page.locator(".board-modal")).toHaveCount(0);
    await settle(page);

    await bump(page, "m_P0603");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L6-2", "zip", "scroll.unpack");

    await openBattle(page, "m_P0603", "P0603");
    await castWrong(page, "P0603", "wrong_a.py", ["0부터 나왔어", "enumerate(depths, 1)"]);
    await finishWin(page, "m_P0603", "P0603");

    await openBattle(page, "m_P0605", "P0605");
    await castWrong(page, "P0605", "wrong_b.py", ["max가 비어 있대"]);
    await finishWin(page, "m_P0605", "P0605");
  });

  test("거울 다리: L6-3 → 다리 난간 글 → P0606 오답(sort의 반환값) → 승리 → 화로 → 중간 보스 P0608 1페이즈 오답(이름에 -)·느린 풀이 통과 → 2페이즈 TLE → 모범답안 승리 → '중간 보스 격파!' → midboss_defeated, 지역 클리어 아님", async () => {
    test.setTimeout(900_000);
    await lesson(page, "rune_L6-3", "-b[1]", "scroll.sort");

    await interact(page, "sign_mirror_bridge");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_mirror_bridge");
    expect(texts.join(" ")).toContain("거울 쌍둥이의 줄 세우기");

    await openBattle(page, "m_P0606", "P0606");
    await castWrong(page, "P0606", "wrong_a.py", ["None", "제자리에서"]);
    await finishWin(page, "m_P0606", "P0606");

    await rest(page, "campfire_bridge");

    // 중간 보스 앞: 두 칸 앞 트리거(midboss_intro)를 지나 다리 끝 길목의 쌍둥이에 부딪친다
    const mid = await obj(page, "m_P0608");
    expect({ x: mid.x, y: mid.y }).toEqual({ x: 59, y: 10 });
    const midTrig = await obj(page, "t_midboss_intro");
    expect({ x: midTrig.x, y: midTrig.y }).toEqual({ x: 57, y: 10 });
    // 쌍둥이를 쓰러뜨리기 전에는 안개 갈대밭(L6-4 비석)으로 갈 수 없다
    const rune4 = await obj(page, "rune_L6-4");
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [rune4.x, rune4.y + 1])).toBeNull();
    const n0 = (await said(page)).length;
    await bump(page, "m_P0608");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["midboss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0608");
    await expect(page.locator(".battle")).toHaveClass(/is-midboss/);
    await expect(page.locator(".battle")).toHaveClass(/is-boss/);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();
    await expect(msg(page)).toContainText("중간 보스 거울 쌍둥이가 나타났어!");

    // 1페이즈: 이름(문자열)에 - → TypeError 진단
    await castWrong(page, "P0608", "wrong_minus.py", ["TypeError", "글자에는 -를 붙일 수 없어"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");

    // 선택 정렬(N²): 1페이즈(N ≤ 1000)는 통과
    await typeCode(page, code("P0608", "slow.py"));
    const p1 = await castWithStages(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();
    for (const t of allTexts(p1)) expect(t).toMatch(/^1페이즈 · 시험 [1-7]\/7$/);
    expect(p1.hides).toBe(0);

    // 2페이즈: 같은 코드 → 큰 입력(1/3)을 만들고 시험 1/3에서 시간 결계 TLE(나머지는 stopOnTle로 건너뜀)
    const slowLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".fb")).toContainText("통과 0/3");
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("선택 정렬");
    await expect(msg(page).locator(".diag")).toContainText("people.sort(key=lambda p: (-p[1], p[2], -p[3], p[0]))");
    expect(allTexts(slowLog)[0]).toBe("큰 입력 준비 중… (1/3)");
    expect(allTexts(slowLog)).toContain("2페이즈 · 시험 1/3");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await shot(page, "r06-midboss-phase2.png");

    // 모범답안: 남은 큰 입력 2개를 만들며 시험 1/3 → 3/3
    await typeCode(page, solution("P0608"));
    const okLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    expect(allTexts(okLog)).toEqual(["2페이즈 · 시험 1/3", "큰 입력 준비 중… (1/2)", "2페이즈 · 시험 2/3", "큰 입력 준비 중… (2/2)", "2페이즈 · 시험 3/3"]);
    console.log(`P0608 2페이즈 시전(벽시계): slow.py=${slowLog.wallMs} ms(TLE) / 모범답안=${okLog.wallMs} ms(나머지 생성기 포함)`);
    await expect(msg(page)).toHaveText("해냈어! 거울 쌍둥이를 정화했어!");
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("중간 보스 격파!");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+400 XP");
    await expect(page.locator(".reward-gold .reward-value")).toHaveText("+200 G");
    const n1 = (await said(page)).length;
    await page.locator(".reward-ok").click();
    const after = await readAll(page);
    const lines = (await said(page)).slice(n1);
    expect(lines).toContain("midboss_defeated");
    // 지역 클리어가 아니다: 클리어 대사·실전 추천 창이 없다
    expect(lines).not.toContain("boss_defeated");
    expect(lines).not.toContain("region_clear");
    await expect(page.locator(".recommend-modal")).toHaveCount(0);
    expect(after.join(" ")).toContain("안개 갈대밭");
    const s = await save(page);
    expect(s.flags["region.r06.clear"]).toBeUndefined();
    expect(s.problems.P0608.solved).toBe(true);
    expect((await obj(page, "m_P0608")).removed).toBe(true);
    // 다리 끝 길목이 열려 안개 갈대밭으로 갈 수 있다
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [rune4.x, rune4.y + 1])).not.toBeNull();
  });

  test("새로고침: 중간 보스 뒤 위치·진행이 그대로이고 midboss_defeated·클리어 연출이 다시 나오지 않는다", async () => {
    test.setTimeout(120_000);
    const p0 = await where(page);
    const s0 = await save(page);
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    await expect(page.locator(".hud-region")).toHaveText("거울 호수");
    await expect(page.locator(".recommend-modal")).toHaveCount(0);
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    expect(s1.flags["region.r06.clear"]).toBeUndefined();
    for (const id of ["m_P0601", "m_P0602", "m_P0603", "m_P0605", "m_P0606", "m_P0608"]) expect((await obj(page, id)).removed, id).toBe(true);
  });

  test("안개 갈대밭: 표지(숨겨진 길 귀띔) → L6-4 → P0609 기저 조건 누락(RecursionError, 런타임 유지) → 승리 → 조약돌 더미 바로 북쪽 갈대 빈틈으로 상자 → 80골드 → P0610 오답(size / 2) → 승리", async () => {
    test.setTimeout(400_000);
    await interact(page, "sign_reeds");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_reeds");
    expect(texts.join(" ")).toContain("조약돌 더미 바로 북쪽의 갈대");

    await lesson(page, "rune_L6-4", "0", "scroll.recursion");

    await openBattle(page, "m_P0609", "P0609");
    await castWrong(page, "P0609", "wrong_nobase.py", ["RecursionError", "기저 조건"]);
    // RecursionError 뒤에도 Python 런타임이 살아 있어 바로 다시 채점된다
    await finishWin(page, "m_P0609", "P0609");

    // 귀띔대로: 조약돌 더미(맵에 하나뿐) 바로 북쪽의 갈대 빈틈
    const gap = reedGap();
    expect({ x: gap.x, y: gap.y }).toEqual({ x: 72, y: 4 });
    expect(gap.south).toBe("pebble_cairn");
    expect(gap.cairns).toBe(1);
    const chest = await obj(page, "chest_hidden_reeds");
    expect({ x: chest.x, y: chest.y }).toEqual({ x: 72, y: 2 });
    await walkTo(page, gap.x, gap.y + 1);
    const p = await where(page);
    expect({ x: p.x, y: p.y }).toEqual({ x: gap.x, y: gap.y + 1 });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y - 1 });
    const gold0 = (await save(page)).player.gold;
    await interact(page, "chest_hidden_reeds");
    const chestTexts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("chest_hidden_reeds");
    expect(chestTexts.join(" ")).toContain("80골드");
    expect((await save(page)).player.gold).toBe(gold0 + 80);
    expect((await obj(page, "chest_hidden_reeds")).removed).toBe(true);

    await openBattle(page, "m_P0610", "P0610");
    await castWrong(page, "P0610", "wrong_float.py", ["size / 2"]);
    await finishWin(page, "m_P0610", "P0610");
  });

  test("메아리 여울: L6-5 → 여울의 노래 → P0612 메아리 고리로 메모 없는 재귀와 메모 재귀의 호출 횟수 비교 → 승리 → 화로 → P0613 오답(격자 밖) → 승리 → 최종 보스 P0614 1페이즈 오답(기저 n == 1)·느린 풀이 통과 → 2페이즈 TLE → 모범답안 승리 → 클리어 → 실전 추천 → 동쪽 문", async () => {
    test.setTimeout(900_000);
    await lesson(page, "rune_L6-5", "memo", "scroll.memo");

    await interact(page, "sign_echo_shoal");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_echo_shoal");
    expect(texts.join(" ")).toContain("n // 2와 n // 3");

    // 메아리 고리: 공개 예제 n = 4에서 ways가 불린 횟수(함수 첫 줄 `if k < 0:`의 실행 횟수)
    await openBattle(page, "m_P0612", "P0612");
    const naive = code("P0612", "wrong_naive.py");
    await typeCode(page, naive);
    const naiveCounts = await runPublicWithRing(page);
    const naiveLine = naive.split("\n").findIndex((l) => l.includes("if k < 0:")) + 1;
    // 메모 없이: C(k) = 1 + C(k-1) + C(k-2) + C(k-3), C(0) = C(음수) = 1 → C(4) = 25
    expect(naiveCounts[naiveLine]).toBe("×25");
    const sol = solution("P0612");
    await typeCode(page, sol);
    await expect(page.locator(".battle-editor .cm-echo-count")).toHaveCount(0);
    const memoCounts = await runPublicWithRing(page);
    const memoLine = sol.split("\n").findIndex((l) => l.includes("if k < 0:")) + 1;
    // 메모: 처음 1번 + 계산한 k(4, 3, 2, 1)마다 3번 = 13
    expect(memoCounts[memoLine]).toBe("×13");
    console.log(`P0612 메아리 고리(n = 4): 메모 없음 ${JSON.stringify(naiveCounts)} / 메모 ${JSON.stringify(memoCounts)}`);
    await finishWin(page, "m_P0612", "P0612");

    // 화로는 여울 길목(P0612) 너머, 보스 앞 마지막 회복
    await rest(page, "campfire_shoal");

    await openBattle(page, "m_P0613", "P0613");
    await castWrong(page, "P0613", "wrong_bounds.py", ["IndexError", "격자 밖"]);
    await finishWin(page, "m_P0613", "P0613");

    const boss = await obj(page, "m_P0614");
    expect({ x: boss.x, y: boss.y }).toEqual({ x: 94, y: 11 });
    const trig = await obj(page, "t_boss_intro");
    expect({ x: trig.x, y: trig.y }).toEqual({ x: 92, y: 11 });
    const n0 = (await said(page)).length;
    await bump(page, "m_P0614");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0614");
    await expect(page.locator(".battle")).toHaveClass(/is-boss/);
    await expect(page.locator(".battle")).not.toHaveClass(/is-midboss/);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(msg(page)).toContainText("보스 호수의 메아리가 나타났어!");
    await expect(msg(page)).not.toContainText("중간 보스");

    // 1페이즈: 기저 조건을 n == 1로 → RecursionError 진단(런타임은 살아 있음)
    await castWrong(page, "P0614", "wrong_base.py", ["RecursionError", "if n == 0: return 1"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");

    // 메모 없는 재귀: 1페이즈(n ≤ 10,000)는 통과
    await typeCode(page, code("P0614", "slow.py"));
    const p1 = await castWithStages(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await expect(page.locator(".time-gauge")).toBeVisible();
    for (const t of allTexts(p1)) expect(t).toMatch(/^1페이즈 · 시험 [1-6]\/6$/);

    // 2페이즈: 같은 코드 → 시험 1/3에서 시간 결계 TLE
    const slowLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".fb")).toContainText("통과 0/3");
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("memo = {}");
    await expect(msg(page).locator(".diag")).toContainText("lru_cache(maxsize=None)");
    expect(allTexts(slowLog)[0]).toBe("큰 입력 준비 중… (1/3)");
    await shot(page, "r06-boss-phase2.png");

    // 모범답안(dict 메모)
    await typeCode(page, solution("P0614"));
    const okLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    expect(allTexts(okLog)).toEqual(["2페이즈 · 시험 1/3", "큰 입력 준비 중… (1/2)", "2페이즈 · 시험 2/3", "큰 입력 준비 중… (2/2)", "2페이즈 · 시험 3/3"]);
    console.log(`P0614 2페이즈 시전(벽시계): slow.py=${slowLog.wallMs} ms(TLE) / 모범답안=${okLog.wallMs} ms(나머지 생성기 포함)`);
    await expect(msg(page)).toHaveText("해냈어! 호수의 메아리를 정화했어!");
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
    // 실전 추천: 프로그래머스 4개(링크, 먼저) + 백준 3개(재개 전이라 비활성)
    await expect(page.locator(".recommend-modal")).toContainText("거울 호수");
    await expect(page.locator(".recommend-item")).toHaveCount(7);
    const links = page.locator(".recommend-item.site-programmers a.recommend-link");
    await expect(links).toHaveCount(4);
    const ids = [12915, 68936, 12946, 12945];
    for (let i = 0; i < 4; i++) {
      await expect(page.locator(".recommend-item").nth(i)).toHaveAttribute("data-site", "programmers");
      await expect(links.nth(i)).toHaveAttribute("href", `https://school.programmers.co.kr/learn/courses/30/lessons/${ids[i]}`);
    }
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(3);
    await expect(page.locator(".recommend-item.site-boj a")).toHaveCount(0);
    await shot(page, "r06-clear.png");
    await page.locator(".reward-ok").click();
    await settle(page);

    const s = await save(page);
    expect(s.flags["region.r06.clear"]).toBe(true);
    for (const id of [...REQUIRED, "chest_hidden_reeds"]) expect(s.removedObjects, id).toContain(id);
    for (const id of OPTIONAL) expect(s.removedObjects, id).not.toContain(id);
    expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.function", "scroll.unpack", "scroll.sort", "scroll.recursion", "scroll.memo"]));
    for (const p of ["P0601", "P0602", "P0603", "P0605", "P0606", "P0608", "P0609", "P0610", "P0612", "P0613", "P0614"]) expect(s.problems[p].solved, p).toBe(true);

    // 새로고침해도 클리어 연출이 다시 나오지 않는다
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    expect((await save(page)).location.regionId).toBe("r06");

    // 보스가 있던 칸을 지나 섬 동쪽 나루: 지역 7 모래시계 사막의 spawn_west로 이어진다
    // (처음 건널 때 누리의 연결 대사 → 지역 첫 대사 → spawn 옆 트리거. 대사 문구 검사는 지역 7 E2E에서)
    await walkTo(page, boss.x, boss.y);
    const gate = await obj(page, "warp_east");
    expect({ x: gate.x, y: gate.y }).toEqual({ x: 105, y: 11 });
    const n = (await said(page)).length;
    await interact(page, "warp_east");
    const endTexts = await readAll(page);
    expect((await said(page)).slice(n)).toEqual(["to_be_continued", "region_intro", "desert_intro"]);
    expect(endTexts.join(" ")).not.toContain("준비 중");
    await expect(page.locator(".hud-region")).toHaveText("모래시계 사막");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    expect(st.save.location.regionId).toBe("r07");
    const spawn = await obj(page, "spawn_west");
    expect(Math.abs(st.pos.x - spawn.x) + Math.abs(st.pos.y - spawn.y)).toBeLessThanOrEqual(1);
  });
});

test.describe("지역 6 쓰러짐·칭호·잠긴 문", () => {
  test("쓰러짐: 호수 안에서 쓰러지면 나루 캠프파이어에서 HP 가득으로 다시 시작(교역항으로 돌아가지 않는다)", async ({ page }) => {
    test.setTimeout(300_000);
    await seedRegion5Cleared(page);
    await crossToLake(page);
    expect((await save(page)).lastCampfire.regionId).toBe("r06");
    await lesson(page, "rune_L6-1", "return", "scroll.function");
    await rest(page, "campfire_ferry");
    const camp = (await save(page)).lastCampfire;
    const maxHp = (await save(page)).player.hp;

    await openBattle(page, "m_P0601", "P0601");
    const wrong = code("P0601", "wrong_c.py");
    await typeCode(page, wrong);
    for (let i = 0; i < 20 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
    await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("knockout");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
    await expect(page.locator(".hud-region")).toHaveText("거울 호수");
    const s = await save(page);
    expect(s.location.regionId).toBe("r06");
    expect(s.player.hp).toBe(maxHp);
    expect(s.problems.P0601).toMatchObject({ knockouts: 1, draft: wrong, solved: false });
    expect((await obj(page, "m_P0601")).removed).toBe(false);
  });

  test("중간 보스의 시간 결계를 첫 시전에 통과하면 칭호 '시간을 돌린 자'(지역 클리어는 아님)", async ({ page }) => {
    test.setTimeout(300_000);
    await seedRegion5Cleared(page);
    await crossToLake(page);
    const mid = await obj(page, "m_P0608");
    await seedAndReload(page, {
      lessons: ["L6-1", "L6-2", "L6-3"],
      removed: ["m_P0601", "m_P0602", "m_P0603", "m_P0605", "m_P0606"],
      at: { x: mid.x - 1, y: mid.y, facing: "right" },
    });
    expect((await save(page)).titles).not.toContain("time-turner");
    await bump(page, "m_P0608");
    await settle(page, ".battle-modal");
    await expect(page.locator(".battle")).toHaveClass(/is-midboss/);
    await typeCode(page, solution("P0608"));
    await cast(page);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("중간 보스 격파!");
    await page.locator(".reward-ok").click();
    await settle(page);
    const s = await save(page);
    expect(s.flags["feat.timeBarrierFirstTry"]).toBe(true);
    expect(s.titles).toContain("time-turner");
    expect(s.flags["region.r06.clear"]).toBeUndefined();
    expect(await said(page)).toContain("midboss_defeated");
    await expect(page.locator(".recommend-modal")).toHaveCount(0);
  });

  test("동쪽 문: 호수의 메아리를 정화하기 전에는 섬 동쪽 나루가 굳어 있다(중간 보스만으로는 열리지 않음)", async ({ page }) => {
    test.setTimeout(240_000);
    await seedRegion5Cleared(page);
    await crossToLake(page);
    const gate = await obj(page, "warp_east");
    expect(await page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [gate.x - 1, gate.y])).toBeNull();
    await seedAndReload(page, {
      lessons: ["L6-1", "L6-2", "L6-3", "L6-4", "L6-5"],
      removed: REQUIRED.filter((id) => id !== "m_P0614"),
      at: { x: gate.x - 1, y: gate.y, facing: "right" },
    });
    expect((await save(page)).location.regionId).toBe("r06");
    expect((await save(page)).problems.P0608.solved).toBe(true);
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["east_gate_locked"]);
    expect(texts.join(" ")).toContain("거울처럼 굳어");
    expect((await save(page)).location.regionId).toBe("r06");
    expect((await save(page)).flags["region.r06.clear"]).toBeUndefined();
    expect((await obj(page, "m_P0614")).removed).toBe(false);
  });
});
