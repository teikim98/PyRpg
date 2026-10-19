// 지역 7(모래시계 사막) 클리어 E2E(docs/phase3/region07-spec.md §12).
// 지역 1~6을 끝낸 저장에서 시작해 실제 방향키·대화·레슨·CodeMirror·Pyodide 채점으로 지역 7을 끝까지 플레이한다.
// 거울 호수 동쪽 나루 → 마른 나루(연결 대사, desert_intro) → 레슨 5개(L7-1~L7-5 순서) → 연습 몬스터(P0701·P0708)와 필수 몬스터(오답 진단 포함) →
// 숨겨진 길(낙타 해골 바로 북쪽의 사암 벽 → 상자) → 중간 보스 1·2페이즈(복잡도 예측 질문, 지역 클리어가 아님) → 중간 보스 바로 뒤 캠프파이어 →
// 고장 난 다리 퍼즐 Z0701 → 응용 전투(통합형) P0712 → 최종 보스 1·2페이즈(복잡도 예측, 모래시계 부적) → 클리어(실전 추천) → 동쪽 문 to_be_continued.
// 도우미는 region06.spec.ts와 같은 방식이다(window.__pyrpg 훅은 좌표·진행도·길찾기만, 이동은 실제 키).
// PW_PORT=4331 npx playwright test tests/e2e/region07.spec.ts
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Facing = "up" | "down" | "left" | "right";
const KEY: Record<Facing, string> = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };

const REGION = "content/regions/r07-hourglass-desert";
const PROBLEMS = `${REGION}/problems`;
const code = (pid: string, file: string) => readFileSync(`${PROBLEMS}/${pid}/${file}`, "utf8");
const solution = (pid: string) => code(pid, "solution.py");
const puzzleFile = (file: string) => readFileSync(`${REGION}/puzzles/Z0701/${file}`, "utf8");

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
const pathTo = (page: Page, x: number, y: number) => page.evaluate(([x, y]) => (window as any).__pyrpg.path(x, y), [x, y]) as Promise<Facing[] | null>;

/** 맵(map.tmj)에서 사암 벽 틈 칸(sandstone_gap, 지나갈 수 있는 숨겨진 길 입구)과 그 남쪽 칸에 보이는 타일 이름 */
function sandstoneGap(): { x: number; y: number; south: string; skulls: number } {
  const map = JSON.parse(readFileSync(`${REGION}/map.tmj`, "utf8"));
  const ts = map.tilesets[0];
  const nameOf = (gid: number) => (gid ? ts.tiles.find((t: any) => t.id === gid - ts.firstgid)?.type ?? "" : "");
  const layer = (n: string) => map.layers.find((l: any) => l.name === n).data as number[];
  const ground = layer("ground");
  const deco = layer("deco");
  const col = layer("collision");
  const seen = (i: number) => nameOf(deco[i]) || nameOf(ground[i]);
  const cells = ground.map((_, i) => (seen(i) === "sandstone_gap" ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  expect(col[cells[0]]).toBe(0);
  const x = cells[0] % map.width;
  const y = Math.floor(cells[0] / map.width);
  const skulls = ground.filter((_, i) => seen(i) === "camel_skull").length;
  return { x, y, south: seen((y + 1) * map.width + x), skulls };
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

/** 대화가 끝날 때까지(until이 있으면 그 요소가 나올 때까지) 넘기면서 화면에 나온 대사 글을 모은다 */
async function readAll(page: Page, until?: string): Promise<string[]> {
  const texts: string[] = [];
  const deadline = Date.now() + 60_000;
  let idleSince = 0;
  let lastKey = "";
  while (Date.now() < deadline) {
    if (until && (await page.locator(until).count())) return texts;
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
    if (!until && !w.busy && !w.modal) {
      if (!idleSince) idleSince = Date.now();
      else if (Date.now() - idleSince > 150) return texts;
    } else idleSince = 0;
    await page.waitForTimeout(40);
  }
  throw new Error(`readAll timeout (until=${until})`);
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
    const path = await pathTo(page, x, y);
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

/** 오브젝트와 상호작용하고 대화가 끝나면 마지막 대사 ID(일일 퀘스트로 레벨이 올라 붙는 level_up은 빼고) */
async function talk(page: Page, id: string): Promise<string | undefined> {
  await interact(page, id);
  await settle(page);
  return (await said(page)).filter((d) => d !== "level_up").at(-1);
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

/** 시전하면서 진행 표시(.cast-progress)의 변화를 기록한다(region06.spec.ts와 같음) */
async function castWithStages(page: Page, timeoutMs = 300_000): Promise<StageLog> {
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
  for (;;) {
    const done = await page.evaluate(() => {
      const root = document.querySelector(".battle");
      const banner = document.querySelector(".battle-banner") as HTMLElement | null;
      return !root || (banner !== null && !banner.hidden) || !root.classList.contains("is-busy");
    });
    if (done) break;
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

async function winCurrent(page: Page, pid: string, reward = { xp: 100, gold: 50 }): Promise<void> {
  await typeCode(page, solution(pid));
  await cast(page);
  await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
  await page.locator(".banner-ok").click();
  await settle(page, ".reward-modal");
  await expect(page.locator(".reward-xp .reward-value")).toHaveText(`+${reward.xp} XP`);
  await expect(page.locator(".reward-gold .reward-value")).toHaveText(`+${reward.gold} G`);
  // 일반 전투에는 복잡도 예측 줄이 없다
  await expect(page.locator(".reward-complexity")).toHaveCount(0);
  await page.locator(".reward-ok").click();
}

async function openBattle(page: Page, monster: string, pid: string): Promise<void> {
  await bump(page, monster);
  await settle(page, ".battle-modal");
  await expect(page.locator(".battle")).toHaveAttribute("data-problem", pid);
}

async function finishWin(page: Page, monster: string, pid: string, reward?: { xp: number; gold: number }): Promise<void> {
  await winCurrent(page, pid, reward);
  await settle(page);
  expect((await obj(page, monster)).removed).toBe(true);
  expect((await save(page)).problems[pid].solved).toBe(true);
}

/** 캠프파이어에서 쉬고, 복귀 지점이 그 캠프파이어 옆으로 옮겨졌는지 확인한다 */
async function rest(page: Page, campfire: string): Promise<void> {
  expect(await talk(page, campfire)).toBe("campfire_rest");
  const camp = await obj(page, campfire);
  const s = await save(page);
  expect(s.lastCampfire.regionId).toBe("r07");
  expect(Math.abs(s.lastCampfire.x - camp.x) + Math.abs(s.lastCampfire.y - camp.y)).toBe(1);
  await expect(page.locator(".hud-hp-text")).toHaveText(`${s.player.hp}/${s.player.hp}`);
}

/** 복잡도 예측 질문(region07-spec.md §9.2): 2페이즈 시작 대사 바로 뒤. 고르기 전에는 시전을 막는다 */
async function expectComplexityAsk(page: Page, choices: string[]): Promise<void> {
  await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
  await expect(page.locator(".battle-msg-text .phase-intro")).toBeVisible();
  await expect(page.locator(".complexity-ask")).toContainText("입력 크기로 보아 목표 복잡도는?");
  await expect(page.locator(".complexity-choice")).toHaveText(choices);
  await expect(page.locator(".complexity-skip")).toHaveText("건너뛰기");
  await expect(page.locator(".act-cast")).toBeDisabled();
}

/** 예측을 고른다: 누리는 받기만 하고 맞았는지·목표가 무엇인지는 말하지 않는다(결정 30) */
async function chooseComplexity(page: Page, pid: string, choice: string, target: string): Promise<void> {
  await page.locator(`.complexity-choice[data-choice="${choice}"]`).click();
  const answer = page.locator(".complexity-answer");
  await expect(answer).toContainText("그 목표로 가 보자");
  await expect(answer).not.toContainText("맞");
  if (choice !== target) await expect(answer).not.toContainText(target);
  await expect(page.locator(".act-cast")).toBeEnabled();
  await expect.poll(async () => (await save(page)).flags[`complexity.guess:${pid}`]).toBe(choice === target);
}

// ───────────── 준비: 지역 1~6을 끝낸 저장 ─────────────

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
const R06_LESSONS = ["L6-1", "L6-2", "L6-3", "L6-4", "L6-5"];
const R06_FLAGS = ["region.r06.clear", "trigger.r06.t_midboss_intro", "trigger.r06.t_boss_intro"];
const R07_LESSONS = ["L7-1", "L7-2", "L7-3", "L7-4", "L7-5"];

/** 지금 지역의 몬스터·상자·문을 모두 치운 저장으로 동쪽 문 바로 앞에 선다 */
async function seedClearedAtEastGate(page: Page, lessons: string[], flags: string[], patch?: Record<string, unknown>): Promise<void> {
  const removed = [...(await objIds(page, "monster")), ...(await objIds(page, "chest")), ...(await objIds(page, "door"))];
  const gate = await obj(page, "warp_east");
  await seedAndReload(page, { lessons, removed, at: { x: gate.x - 1, y: gate.y, facing: "right" }, flags, ...(patch ? { patch } : {}) });
}

async function crossEast(page: Page, regionName: string): Promise<void> {
  await interact(page, "warp_east");
  await settle(page);
  await expect(page.locator(".hud-region")).toHaveText(regionName);
}

/**
 * 새 게임으로 부팅 → 지역 1~5를 끝낸 저장으로 차례로 실제로 걸어 들어간 뒤(region06.spec.ts와 같은 방식),
 * 거울 호수도 다 끝내고(몬스터·상자 제거, 레슨 5개) 호수 동쪽 나루 바로 앞에 선 저장으로 다시 시작한다.
 * 시드는 전투 보상을 주지 않으므로 지역 1~6에서 모았을 골드 대신 500 G를 쥐여 준다.
 * 지역 4 상자에서 받는 기록관의 안경은 장착한 채로 둔다
 */
async function seedRegion6Cleared(page: Page): Promise<void> {
  await boot(page);
  await settle(page);
  await seedClearedAtEastGate(page, R01_LESSONS, R01_FLAGS);
  await crossEast(page, "갈림길 숲");
  await seedClearedAtEastGate(page, R02_LESSONS, R02_FLAGS);
  await crossEast(page, "고블린 동굴");
  await seedClearedAtEastGate(page, R03_LESSONS, R03_FLAGS);
  await crossEast(page, "무너진 대도서관");
  const cur4 = await save(page);
  await seedClearedAtEastGate(page, R04_LESSONS, R04_FLAGS, { inventory: { ...cur4.inventory, "archivist-glasses": 1 }, equipment: ["archivist-glasses"] });
  await crossEast(page, "교역항");
  await seedClearedAtEastGate(page, R05_LESSONS, R05_FLAGS);
  await crossEast(page, "거울 호수");
  const cur6 = await save(page);
  await seedClearedAtEastGate(page, R06_LESSONS, R06_FLAGS, { player: { ...cur6.player, gold: 500 } });

  const gate6 = await obj(page, "warp_east");
  const w = await where(page);
  expect({ x: w.x, y: w.y }).toEqual({ x: gate6.x - 1, y: gate6.y });
  const s = await save(page);
  expect(s.location.regionId).toBe("r06");
  expect(s.problems.P0614.solved).toBe(true);
  expect(s.flags["region.r06.clear"]).toBe(true);
  expect(s.player.gold).toBe(500);
  expect(s.equipment).toEqual(["archivist-glasses"]);
  expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.function", "scroll.unpack", "scroll.sort", "scroll.recursion", "scroll.memo"]));
  expect(await said(page)).toEqual([]);
  await expect(page.locator(".hud-region")).toHaveText("거울 호수");
}

/** 거울 호수 동쪽 나루로 모래시계 사막에 처음 들어간다 */
async function crossToDesert(page: Page): Promise<void> {
  await crossEast(page, "모래시계 사막");
}

const REQUIRED = ["m_P0702", "m_P0704", "m_P0706", "m_P0707", "m_P0709", "m_P0711", "m_P0712", "m_P0714"];
const PRACTICE_PLAYED = ["m_P0701", "m_P0708"];
const OPTIONAL_LEFT = ["m_P0703", "m_P0705", "m_P0710", "m_P0713"];

// ═════════════ 시나리오 ═════════════

test.describe.serial("지역 7 모래시계 사막 전체 플레이", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("입장: 거울 호수 동쪽 나루 → 강이 모래에 삼켜지는 연결 대사 → 첫 대사·마른 나루 트리거 → 복귀 지점이 나루 → 서쪽 문으로 돌아갔다가 다시 오기", async () => {
    test.setTimeout(300_000);
    await seedRegion6Cleared(page);
    expect((await save(page)).lastCampfire.regionId).not.toBe("r07");

    // 처음 건널 때: 호수 문의 openDialogue(연결 대사, 한 번) → 지역 첫 대사 → spawn 옆 트리거(도착 칸)
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "desert_intro"]);
    for (const t of texts) expect(t).not.toMatch(/준비 중|여기까지입니다/);
    const all = texts.join(" ");
    expect(all).toContain("모래 속으로 삼켜지는");
    expect(all).toContain("모래시계 사막");
    expect(all).not.toContain("할트");
    await expect(page.locator(".hud-region")).toHaveText("모래시계 사막");
    const st = await page.evaluate(() => (window as any).__pyrpg.state());
    const spawn = await obj(page, "spawn_west");
    const trig = await obj(page, "t_desert_intro");
    expect({ x: spawn.x, y: spawn.y }).toEqual({ x: 1, y: 11 });
    expect(st.save.location.regionId).toBe("r07");
    expect({ x: st.pos.x, y: st.pos.y }).toEqual({ x: trig.x, y: trig.y });
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    expect(st.save.flags["trigger.r07.t_desert_intro"]).toBe(true);
    expect(st.save.flags["region.r07.intro"]).toBe(true);
    expect(st.save.lastCampfire).toEqual({ regionId: "r07", x: trig.x, y: trig.y });
    await shot(page, "r07-entrance.png");

    // 서쪽 문 → 거울 호수 동쪽 나루 옆
    await interact(page, "warp_west");
    await settle(page);
    await expect(page.locator(".hud-region")).toHaveText("거울 호수");
    expect((await save(page)).location.regionId).toBe("r06");
    const gate = await obj(page, "warp_east");
    const back = await where(page);
    expect(Math.abs(back.x - gate.x) + Math.abs(back.y - gate.y)).toBe(1);
    expect((await said(page)).slice(3)).toEqual([]);

    // 다시 건너면 대사 없이 바로
    await crossToDesert(page);
    expect(await said(page)).toEqual(["to_be_continued", "region_intro", "desert_intro"]);
    const again = await where(page);
    expect(Math.abs(again.x - spawn.x) + Math.abs(again.y - spawn.y)).toBeLessThanOrEqual(1);
  });

  test("마른 나루: 주문서 없이 막힘 → L7-1 → 대상 길잡이(숨겨진 길 귀띔) → 사막 상점(부적은 팔지 않음) → 화로 → 연습 P0701 오답(EOFError) → 승리 → P0702 오답(이름 없는 except:) → 승리", async () => {
    test.setTimeout(300_000);
    await bump(page, "m_P0702");
    await settle(page);
    expect((await said(page)).at(-1)).toBe("need_scroll");
    await expect(page.locator(".battle-modal")).toHaveCount(0);

    await lesson(page, "rune_L7-1", "EOFError", "scroll.stream", "r07-lesson.png");

    await interact(page, "npc_caravan_guide");
    const texts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_caravan_guide");
    const all = texts.join(" ");
    expect(all).toContain("낙타 해골 바로 북쪽의 사암 벽");
    expect(all).toContain("제시간에 끝나는 주문");
    expect(all).not.toContain("할트");

    // 사막 상점: 지금 상점과 같은 품목, 모래시계 부적은 팔지 않는다(보스 보상)
    await interact(page, "shop_desert");
    await settle(page, ".shop-modal");
    await expect(page.locator(".shop-item").first()).toBeVisible();
    await expect(page.locator('.shop-item[data-item="echo-ring"]')).toBeVisible();
    await expect(page.locator('.shop-item[data-item="hourglass-charm"]')).toHaveCount(0);
    await closeAll(page);

    await rest(page, "campfire_ferry_r07");

    // 연습 몬스터(비석과 첫 필수 몬스터 사이 곁길)
    const p701 = await obj(page, "m_P0701");
    expect({ x: p701.x, y: p701.y }).toEqual({ x: 17, y: 7 });
    await openBattle(page, "m_P0701", "P0701");
    await castWrong(page, "P0701", "wrong_a.py", ["EOFError", "except EOFError: break"]);
    await finishWin(page, "m_P0701", "P0701");

    await openBattle(page, "m_P0702", "P0702");
    await castWrong(page, "P0702", "wrong_b.py", ["멀쩡한 줄까지", "NameError", "except ValueError:"]);
    await shot(page, "r07-battle-diag.png");
    await finishWin(page, "m_P0702", "P0702");
  });

  test("바람 협곡: L7-2 → 그림자 게시판 → 표지(숨겨진 길 귀띔) → 낙타 해골 바로 북쪽 사암 벽 틈으로 상자 → 100골드 → P0704 숨은 O(N) 풀이는 숨김 테스트에서 TLE → 승리", async () => {
    test.setTimeout(400_000);
    await lesson(page, "rune_L7-2", "//=", "scroll.complexity");

    await interact(page, "board_shadow_r07");
    await settle(page, ".board-modal");
    await expect(page.locator(".board-modal")).toBeVisible();
    await page.locator(".board-modal .sys-close").click();
    await expect(page.locator(".board-modal")).toHaveCount(0);
    await settle(page);

    await interact(page, "sign_canyon");
    const signTexts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_canyon");
    expect(signTexts.join(" ")).toContain("낙타 해골 바로 북쪽의 사암 벽");

    // 귀띔대로: 낙타 해골(맵에 하나뿐) 바로 북쪽의 사암 벽 틈
    const gap = sandstoneGap();
    expect({ x: gap.x, y: gap.y }).toEqual({ x: 31, y: 7 });
    expect(gap.south).toBe("camel_skull");
    expect(gap.skulls).toBe(1);
    const chest = await obj(page, "chest_hidden_canyon");
    expect({ x: chest.x, y: chest.y }).toEqual({ x: 31, y: 5 });
    await walkTo(page, gap.x, gap.y + 1);
    const p = await where(page);
    expect({ x: p.x, y: p.y }).toEqual({ x: gap.x, y: gap.y + 1 });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y });
    await step(page, "up");
    expect(await where(page)).toMatchObject({ x: gap.x, y: gap.y - 1 });
    await shot(page, "r07-hidden-canyon.png");
    const gold0 = (await save(page)).player.gold;
    await interact(page, "chest_hidden_canyon");
    const chestTexts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("chest_hidden_canyon");
    expect(chestTexts.join(" ")).toContain("100골드");
    expect((await save(page)).player.gold).toBe(gold0 + 100);
    expect((await obj(page, "chest_hidden_canyon")).removed).toBe(true);

    // 보스가 아니어도 숨김 테스트의 큰 입력에서 TLE(timeLimitMs)로 숨은 O(N)을 막는다
    await openBattle(page, "m_P0704", "P0704");
    await castWrong(page, "P0704", "wrong_count.py", ["숨은 O(N)", "O(N²)"]);
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".time-gauge")).toBeHidden();
    await finishWin(page, "m_P0704", "P0704");
  });

  test("신기루 시장: L7-3 → 모래시계지기 → P0706 오답(set으로 있는지만) → 승리 → 검문소 팻말 → 화로 → 중간 보스 P0707 1페이즈 오답(True/False)·느린 풀이 통과 → 복잡도 예측 질문 → 2페이즈 TLE → 모범답안 승리 → 보상 창에 예측·목표 → midboss_defeated, 지역 클리어 아님", async () => {
    test.setTimeout(900_000);
    await lesson(page, "rune_L7-3", "for", "scroll.lookup");

    await interact(page, "npc_hourglass_keeper");
    const keeper = await readAll(page);
    expect((await said(page)).at(-1)).toBe("npc_hourglass_keeper");
    expect(keeper.join(" ")).toContain("느린 주문은 시계를 되돌리지 못해");
    expect(keeper.join(" ")).not.toContain("할트");

    await openBattle(page, "m_P0706", "P0706");
    await castWrong(page, "P0706", "wrong_set.py", ["짝 수가 모자라", "count.get(K - w, 0)"]);
    await finishWin(page, "m_P0706", "P0706");

    // 보스 직전 표지판은 문제 상황만(풀이 방향 없음, 결정 25)
    await interact(page, "sign_bazaar_gate");
    const gateTexts = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_bazaar_gate");
    expect(gateTexts.join(" ")).toContain("명부");
    expect(gateTexts.join(" ")).not.toMatch(/set|dict|해시/);

    await rest(page, "campfire_bazaar");

    // 중간 보스 앞: 두 칸 앞 트리거(midboss_intro)를 지나 한 칸 길목의 전갈에 부딪친다
    const mid = await obj(page, "m_P0707");
    expect({ x: mid.x, y: mid.y }).toEqual({ x: 59, y: 11 });
    const midTrig = await obj(page, "t_midboss_intro");
    expect({ x: midTrig.x, y: midTrig.y }).toEqual({ x: 57, y: 11 });
    // 전갈을 쓰러뜨리기 전에는 별자리 유적(L7-4 비석, 바로 뒤 캠프파이어)으로 갈 수 없다
    const rune4 = await obj(page, "rune_L7-4");
    expect(await pathTo(page, rune4.x, rune4.y + 1)).toBeNull();
    expect(await page.evaluate(() => (window as any).__pyrpg.approach("campfire_ruins"))).toBeNull();
    const n0 = (await said(page)).length;
    // 트리거 칸을 밟으면(피할 수 없음) 시작 대사
    await walkTo(page, midTrig.x - 1, midTrig.y);
    await step(page, "right");
    const introTexts = await readAll(page);
    expect((await said(page)).slice(n0)).toEqual(["midboss_intro"]);
    // 시작 대사는 문제 상황만(풀이 방향 없음)
    expect(introTexts.join(" ")).toContain("명부");
    expect(introTexts.join(" ")).not.toMatch(/set|dict/);
    await bump(page, "m_P0707");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["midboss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0707");
    await expect(page.locator(".battle")).toHaveClass(/is-midboss/);
    await expect(page.locator(".battle")).toHaveClass(/is-boss/);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".time-gauge")).toBeHidden();
    await expect(page.locator(".complexity-ask")).toHaveCount(0);
    await expect(msg(page)).toContainText("중간 보스 모래 전갈이 나타났어!");

    // 1페이즈: 1/0 대신 True/False
    await castWrong(page, "P0707", "wrong_bool.py", ["출력이 True"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(page.locator(".complexity-ask")).toHaveCount(0);

    // list에서 x in names(N × Q): 1페이즈(N, Q ≤ 1000)는 통과
    await typeCode(page, code("P0707", "slow.py"));
    const p1 = await castWithStages(page);
    for (const t of allTexts(p1)) expect(t).toMatch(/^1페이즈 · 시험 [1-7]\/7$/);
    await expect(page.locator(".time-gauge")).toBeVisible();

    // 2페이즈 시작 대사 바로 뒤: 복잡도 예측 질문(선택지 3개 + 건너뛰기). 일부러 틀린 예측을 고른다
    await expectComplexityAsk(page, ["O(N × Q)", "O(N + Q)", "O(N²)"]);
    await expect(msg(page)).toContainText("20만 명으로 늘었어");
    await shot(page, "r07-midboss-complexity.png");
    await chooseComplexity(page, "P0707", "O(N × Q)", "O(N + Q)");

    // 2페이즈: 같은 코드 → 큰 입력(1/3)을 만들고 시험 1/3에서 시간 결계 TLE(나머지는 stopOnTle로 건너뜀)
    const slowLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-text")).toHaveText("초과!");
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".fb")).toContainText("통과 0/3");
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("O(N + Q)");
    await expect(msg(page).locator(".diag")).toContainText("set(...)");
    // 모래시계 부적이 없으므로 목표는 공개되지 않는다
    await expect(page.locator(".hourglass-note")).toHaveCount(0);
    expect(allTexts(slowLog)[0]).toBe("큰 입력 준비 중… (1/3)");
    expect(allTexts(slowLog)).toContain("2페이즈 · 시험 1/3");
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "2");
    await shot(page, "r07-midboss-phase2.png");

    // 모범답안: 남은 큰 입력 2개를 만들며 시험 1/3 → 3/3
    await typeCode(page, solution("P0707"));
    const okLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    expect(allTexts(okLog)).toEqual(["2페이즈 · 시험 1/3", "큰 입력 준비 중… (1/2)", "2페이즈 · 시험 2/3", "큰 입력 준비 중… (2/2)", "2페이즈 · 시험 3/3"]);
    console.log(`P0707 2페이즈 시전(벽시계): slow.py=${slowLog.wallMs} ms(TLE) / 모범답안=${okLog.wallMs} ms(나머지 생성기 포함)`);
    await expect(msg(page)).toHaveText("해냈어! 모래 전갈을 정화했어!");
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("중간 보스 격파!");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+400 XP");
    await expect(page.locator(".reward-gold .reward-value")).toHaveText("+200 G");
    // 결정 30: 2페이즈를 통과한 뒤 보상 창에서 예측과 목표를 함께
    await expect(page.locator(".reward-complexity .reward-value")).toHaveText("예측: O(N × Q) / 목표: O(N + Q)");
    await expect(page.locator(".reward-complexity")).not.toHaveClass(/is-match/);
    await shot(page, "r07-midboss-reward.png");
    const n1 = (await said(page)).length;
    await page.locator(".reward-ok").click();
    const after = await readAll(page);
    const lines = (await said(page)).slice(n1);
    expect(lines).toContain("midboss_defeated");
    // 지역 클리어가 아니다: 클리어 대사·실전 추천 창이 없다
    expect(lines).not.toContain("boss_defeated");
    expect(lines).not.toContain("region_clear");
    await expect(page.locator(".recommend-modal")).toHaveCount(0);
    expect(after.join(" ")).toContain("별자리 유적");
    const s = await save(page);
    expect(s.flags["region.r07.clear"]).toBeUndefined();
    expect(s.flags["complexity.guess:P0707"]).toBe(false);
    expect(s.problems.P0707.solved).toBe(true);
    expect(s.inventory["hourglass-charm"] ?? 0).toBe(0);
    expect((await obj(page, "m_P0707")).removed).toBe(true);
    // 길목이 열려 별자리 유적으로 갈 수 있다
    expect(await pathTo(page, rune4.x, rune4.y + 1)).not.toBeNull();
  });

  test("새로고침: 중간 보스 뒤 위치·진행이 그대로이고 midboss_defeated·클리어 연출이 다시 나오지 않는다", async () => {
    test.setTimeout(120_000);
    const p0 = await where(page);
    const s0 = await save(page);
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    await expect(page.locator(".hud-region")).toHaveText("모래시계 사막");
    await expect(page.locator(".recommend-modal")).toHaveCount(0);
    const p1 = await where(page);
    expect({ x: p1.x, y: p1.y, facing: p1.facing }).toEqual({ x: p0.x, y: p0.y, facing: p0.facing });
    const s1 = await save(page);
    expect({ ...s1, updatedAt: "" }).toEqual({ ...s0, updatedAt: "" });
    expect(s1.flags["region.r07.clear"]).toBeUndefined();
    for (const id of ["m_P0701", "m_P0702", "m_P0704", "m_P0706", "m_P0707", "chest_hidden_canyon"]) expect((await obj(page, id)).removed, id).toBe(true);
  });

  test("별자리 유적: 중간 보스 바로 뒤 화로 → L7-4 → 연습 P0708 오답(i * i < n) → 승리 → P0709 오답(p = q 빠뜨림) → 승리 → 고장 난 다리: 막힘 → 퍼즐 창(시작 코드 실패, 반격 없음) → < 를 <= 로 고쳐 통과 → 다리가 이어지고 지나감 → 새로고침해도 이어진 채", async () => {
    test.setTimeout(400_000);
    // 중간 보스가 있던 길목 바로 뒤의 캠프파이어(design.md §6.3)
    const camp = await obj(page, "campfire_ruins");
    const mid = await obj(page, "m_P0707");
    expect(Math.abs(camp.x - mid.x) + Math.abs(camp.y - mid.y)).toBeLessThanOrEqual(2);
    expect(camp.x).toBeGreaterThan(mid.x);
    await rest(page, "campfire_ruins");

    await lesson(page, "rune_L7-4", "i", "scroll.sieve");

    // 연습 몬스터(중간 보스 뒤 '짧은 선택 전투'를 겸함)
    await openBattle(page, "m_P0708", "P0708");
    await castWrong(page, "P0708", "wrong_a.py", ["49 = 7 × 7", "i * i <= n"]);
    await finishWin(page, "m_P0708", "P0708");

    await openBattle(page, "m_P0709", "P0709");
    await castWrong(page, "P0709", "wrong_half.py", ["같은 소수 두 개", "range(2, n // 2 + 1)"]);
    await finishWin(page, "m_P0709", "P0709");

    // 고장 난 다리: 다리 칸과 그 너머(해시계 광장)는 퍼즐 전에는 막혀 있다
    const door = await obj(page, "bridge_r07");
    expect({ x: door.x, y: door.y }).toEqual({ x: 76, y: 11 });
    expect(door.removed).toBe(false);
    expect(await pathTo(page, door.x, door.y)).toBeNull();
    const rune5 = await obj(page, "rune_L7-5");
    expect(await pathTo(page, rune5.x, rune5.y + 1)).toBeNull();

    const n0 = (await said(page)).length;
    await interact(page, "bridge_r07");
    const brokenTexts = await readAll(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["bridge_broken"]);
    expect(brokenTexts.join(" ")).toContain("다리");
    await settle(page, ".battle-modal");
    const battle = page.locator(".battle");
    await expect(battle).toHaveClass(/is-puzzle/);
    await expect(battle).not.toHaveClass(/is-boss/);
    await expect(page.locator(".enemy-name")).toHaveText("부서진 수로 다리");
    await expect(page.locator(".player-info")).toBeHidden();
    await expect(page.locator(".act-solution")).toBeHidden();
    await expect(page.locator(".act-potion")).toBeHidden();
    await expect(msg(page)).toContainText("장치 코드에 버그가 있어");
    // 시작 코드는 빈 틀이 아니라 P0708 wrong_a.py와 같은 버그가 든 starter.py
    const starter = puzzleFile("starter.py");
    await expect.poll(async () => (await editorText(page)).trimEnd()).toBe(starter.trimEnd());
    expect(starter).toContain("while i * i < n:");

    // 힌트는 확인 창 없이(대가 없음) 열린다
    await page.locator(".act-hint-1").click();
    await expect(page.locator(".confirm-modal")).toHaveCount(0);
    await expect(page.locator(".act-hint-1")).toHaveText("힌트 1 ✓");

    // 시작 코드 그대로 시전: 49 등에서 실패, 반격 없음
    const hp0 = (await save(page)).player.hp;
    await cast(page);
    await expect(page.locator(".counter")).toContainText("장치는 반격하지 않아");
    await expect(page.locator(".battle-banner")).toBeHidden();
    await shot(page, "r07-puzzle-fail.png");

    // 실제 키로 한 글자: 5번째 줄 `while i * i < n:`의 `<` 뒤에 `=`
    await editor(page).click();
    await page.keyboard.press("Control+Home");
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.type("=");
    await expect.poll(async () => (await editorText(page)).trimEnd()).toBe(puzzleFile("solution.py").trimEnd());
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory.is-puzzle")).toBeVisible();
    await expect(page.locator(".banner-title")).toHaveText("수리 완료!");
    await shot(page, "r07-puzzle-solved.png");
    // 배너를 누르기 전에 이미 저장되어 있다
    await expect.poll(async () => (await save(page)).flags["puzzle.solved:Z0701"]).toBe(true);
    const n1 = (await said(page)).length;
    await page.locator(".banner-ok").click();
    const fixedTexts = await readAll(page);
    expect((await said(page)).slice(n1)).toEqual(["bridge_fixed"]);
    expect(fixedTexts.join(" ")).toContain("다리가 이어진다");
    await expect(page.locator(".reward-modal")).toHaveCount(0);

    // 보상·문제 기록·HP 손실 없음
    let s = await save(page);
    expect(s.removedObjects).toContain("bridge_r07");
    expect(s.problems.Z0701).toBeUndefined();
    expect(s.player.hp).toBe(hp0);
    expect((await obj(page, "bridge_r07")).removed).toBe(true);
    // 이어진 다리(canal_bridge 3칸)를 건너 해시계 광장으로
    await walkTo(page, door.x + 1, door.y);
    expect(await where(page)).toMatchObject({ x: door.x + 1, y: door.y });
    await shot(page, "r07-bridge-fixed.png");
    expect(await pathTo(page, rune5.x, rune5.y + 1)).not.toBeNull();

    // 새로고침: 다리는 이어진 채
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    s = await save(page);
    expect(s.flags["puzzle.solved:Z0701"]).toBe(true);
    expect((await obj(page, "bridge_r07")).removed).toBe(true);
    expect(await pathTo(page, door.x, door.y)).not.toBeNull();
    expect(await pathTo(page, door.x - 1, door.y)).not.toBeNull();
  });

  test("해시계 광장 → 제단: L7-5 → P0711 오답(0을 빈 문자열로) → 승리 → 응용 전투 P0712 오답(겹친 이름) → 승리(200 XP) → 제단 돌판 → 화로 → 최종 보스 P0714 1페이즈 오답(체 칸 모자람)·느린 풀이 통과 → 복잡도 예측 → 2페이즈 TLE → 모범답안 승리 → 예측·목표 → 클리어 → 실전 추천 → 모래시계 부적 → 장착 → 동쪽 문 '준비 중'", async () => {
    test.setTimeout(900_000);
    await lesson(page, "rune_L7-5", "%", "scroll.remainder");

    await openBattle(page, "m_P0711", "P0711");
    await castWrong(page, "P0711", "wrong_zero.py", ["빈 문자열", 'if value == 0: return "0"']);
    await finishWin(page, "m_P0711", "P0711");

    // 응용 전투(통합형): 주문서에 묶이지 않은 몬스터, 지역 주문서 5개가 모두 있어야 한다
    await openBattle(page, "m_P0712", "P0712");
    await expect(page.locator(".enemy-name")).toHaveText("낙타 유령");
    await castWrong(page, "P0712", "wrong_dup.py", ["salt", "seen = set()"]);
    await finishWin(page, "m_P0712", "P0712", { xp: 200, gold: 100 });

    await interact(page, "sign_altar");
    const altar = await readAll(page);
    expect((await said(page)).at(-1)).toBe("sign_altar");
    expect(altar.join(" ")).toContain("스핑크스의 수수께끼");
    expect(altar.join(" ")).not.toMatch(/체|에라토스테네스/);

    await rest(page, "campfire_altar");

    // 최종 보스 전에는 동쪽 문으로 갈 수 없다
    const gate = await obj(page, "warp_east");
    expect({ x: gate.x, y: gate.y }).toEqual({ x: 109, y: 11 });
    expect(await pathTo(page, gate.x - 1, gate.y)).toBeNull();

    const boss = await obj(page, "m_P0714");
    expect({ x: boss.x, y: boss.y }).toEqual({ x: 104, y: 11 });
    const trig = await obj(page, "t_boss_intro");
    expect({ x: trig.x, y: trig.y }).toEqual({ x: 102, y: 11 });
    const n0 = (await said(page)).length;
    await walkTo(page, trig.x - 1, trig.y);
    await step(page, "right");
    const introTexts = await readAll(page);
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    // 할트의 이름이 이 지역에서 처음 나온다(풀이 방향은 없음)
    expect(introTexts.join(" ")).toContain("할트");
    expect(introTexts.join(" ")).not.toMatch(/에라토스테네스|체를/);
    await bump(page, "m_P0714");
    await settle(page, ".battle-modal");
    expect((await said(page)).slice(n0)).toEqual(["boss_intro"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-problem", "P0714");
    await expect(page.locator(".battle")).toHaveClass(/is-boss/);
    await expect(page.locator(".battle")).not.toHaveClass(/is-midboss/);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");
    await expect(msg(page)).toContainText("보스 모래시계 스핑크스가 나타났어!");
    await expect(msg(page)).not.toContainText("중간 보스");

    // 1페이즈: 체를 [True] * m으로 만들어 m번 칸이 없음 → IndexError 진단
    await castWrong(page, "P0714", "wrong_small.py", ["IndexError", "체의 칸이 모자라"]);
    await expect(page.locator(".battle")).toHaveAttribute("data-phase", "1");

    // 수마다 √n까지 나눠 보기: 1페이즈(Q ≤ 100, 수 ≤ 10,000)는 통과
    await typeCode(page, code("P0714", "slow.py"));
    const p1 = await castWithStages(page);
    for (const t of allTexts(p1)) expect(t).toMatch(/^1페이즈 · 시험 [1-8]\/8$/);

    // 복잡도 예측: 이번에는 맞는 예측
    await expectComplexityAsk(page, ["O(Q × M)", "O(Q√M)", "O(M log log M + Q)"]);
    await chooseComplexity(page, "P0714", "O(M log log M + Q)", "O(M log log M + Q)");

    // 2페이즈: 같은 코드 → 시험 1/3에서 시간 결계 TLE
    const slowLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".fb")).toContainText("TLE");
    await expect(page.locator(".fb")).toContainText("통과 0/3");
    await expect(msg(page).locator(":scope > :first-child")).toHaveClass(/diag/);
    await expect(msg(page).locator(".diag")).toContainText("에라토스테네스의 체");
    await expect(page.locator(".hourglass-note")).toHaveCount(0);
    expect(allTexts(slowLog)[0]).toBe("큰 입력 준비 중… (1/3)");
    await shot(page, "r07-boss-phase2.png");

    // 모범답안(입력 최댓값까지 체)
    await typeCode(page, solution("P0714"));
    const okLog = await castWithStages(page);
    await expect(page.locator(".time-gauge")).not.toHaveClass(/is-over/);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    expect(allTexts(okLog)).toEqual(["2페이즈 · 시험 1/3", "큰 입력 준비 중… (1/2)", "2페이즈 · 시험 2/3", "큰 입력 준비 중… (2/2)", "2페이즈 · 시험 3/3"]);
    console.log(`P0714 2페이즈 시전(벽시계): slow.py=${slowLog.wallMs} ms(TLE) / 모범답안=${okLog.wallMs} ms(나머지 생성기 포함)`);
    await expect(msg(page)).toHaveText("해냈어! 모래시계 스핑크스를 정화했어!");
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("보스 격파!");
    await expect(page.locator(".reward-xp .reward-value")).toHaveText("+1000 XP");
    await expect(page.locator(".reward-gold .reward-value")).toHaveText("+500 G");
    await expect(page.locator(".reward-complexity .reward-value")).toHaveText("예측: O(M log log M + Q) / 목표: O(M log log M + Q)");
    await expect(page.locator(".reward-complexity")).toHaveClass(/is-match/);
    await page.locator(".reward-ok").click();
    const clearTexts = await readAll(page, ".recommend-modal");
    await settle(page, ".recommend-modal");
    const lines = await said(page);
    expect(lines.indexOf("boss_defeated")).toBeGreaterThan(-1);
    expect(lines.indexOf("region_clear")).toBeGreaterThan(lines.indexOf("boss_defeated"));
    expect(clearTexts.join(" ")).toContain("모래시계 부적");
    // 실전 추천: 프로그래머스 4개(링크, 먼저) + 백준 2개(재개 전이라 비활성)
    await expect(page.locator(".recommend-modal")).toContainText("모래시계 사막");
    await expect(page.locator(".recommend-item")).toHaveCount(6);
    const links = page.locator(".recommend-item.site-programmers a.recommend-link");
    await expect(links).toHaveCount(4);
    const ids = [42577, 12921, 12940, 68935];
    for (let i = 0; i < 4; i++) {
      await expect(page.locator(".recommend-item").nth(i)).toHaveAttribute("data-site", "programmers");
      await expect(links.nth(i)).toHaveAttribute("href", `https://school.programmers.co.kr/learn/courses/30/lessons/${ids[i]}`);
    }
    await expect(page.locator(".recommend-item.site-boj .recommend-link.is-disabled")).toHaveCount(2);
    await expect(page.locator(".recommend-item.site-boj a")).toHaveCount(0);
    await shot(page, "r07-clear.png");
    // 알림 토스트는 한꺼번에 여러 개 뜨고 몇 초 뒤 사라지므로 나타나는 대로 모은다
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as any).__toasts = seen;
      new MutationObserver(() => {
        for (const t of document.querySelectorAll(".toast")) if (!seen.includes(t.textContent ?? "")) seen.push(t.textContent ?? "");
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.locator(".reward-ok").click();
    await settle(page);
    // 보스 보상 장신구: 모래시계 부적(처음 이겼을 때 한 번)
    const toasts: string[] = await page.evaluate(() => (window as any).__toasts);
    expect(toasts.some((t) => t.includes("모래시계 부적을 얻었다!"))).toBe(true);

    let s = await save(page);
    expect(s.flags["region.r07.clear"]).toBe(true);
    expect(s.flags["complexity.guess:P0714"]).toBe(true);
    expect(s.inventory["hourglass-charm"]).toBe(1);
    for (const id of [...REQUIRED, ...PRACTICE_PLAYED, "chest_hidden_canyon", "bridge_r07"]) expect(s.removedObjects, id).toContain(id);
    for (const id of OPTIONAL_LEFT) expect(s.removedObjects, id).not.toContain(id);
    expect(s.scrolls).toEqual(expect.arrayContaining(["scroll.stream", "scroll.complexity", "scroll.lookup", "scroll.sieve", "scroll.remainder"]));
    for (const p of ["P0701", "P0702", "P0704", "P0706", "P0707", "P0708", "P0709", "P0711", "P0712", "P0714"]) expect(s.problems[p].solved, p).toBe(true);
    expect(s.lessonsCompleted).toEqual(expect.arrayContaining(R07_LESSONS));

    // 장비: 장신구 칸이 하나면 기록관의 안경을 빼고 모래시계 부적을 낀다
    await openMenu(page, ".menu-equipment", ".equip-modal");
    for (const other of s.equipment as string[]) {
      await page.locator(`.equip-toggle[data-item="${other}"]`).click();
      await expect(page.locator(`.equip-item[data-item="${other}"]`)).not.toHaveClass(/is-equipped/);
    }
    await page.locator('.equip-toggle[data-item="hourglass-charm"]').click();
    await expect(page.locator('.equip-item[data-item="hourglass-charm"]')).toHaveClass(/is-equipped/);
    await shot(page, "r07-hourglass-equip.png");
    await closeAll(page);
    expect((await save(page)).equipment).toEqual(["hourglass-charm"]);

    // 새로고침해도 클리어 연출이 다시 나오지 않는다
    await reloadReady(page);
    await settle(page);
    expect(await said(page)).toEqual([]);
    expect((await save(page)).location.regionId).toBe("r07");

    // 보스가 있던 칸을 지나 동쪽 모래 언덕: 지역 8이 아직 없으므로 '준비 중' 안내만 하고 머문다
    await walkTo(page, boss.x, boss.y);
    const n = (await said(page)).length;
    await interact(page, "warp_east");
    const endTexts = await readAll(page);
    expect((await said(page)).slice(n)).toEqual(["to_be_continued"]);
    expect(endTexts.join(" ")).toContain("준비 중");
    await expect(page.locator(".hud-region")).toHaveText("모래시계 사막");
    s = await save(page);
    expect(s.location.regionId).toBe("r07");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: gate.x - 1, y: gate.y });
    await shot(page, "r07-to-be-continued.png");
  });
});

test.describe("지역 7 쓰러짐·칭호·잠긴 문·모래시계 부적", () => {
  test("쓰러짐: 사막 안에서 쓰러지면 나루 캠프파이어에서 HP 가득으로 다시 시작(호수로 돌아가지 않는다)", async ({ page }) => {
    test.setTimeout(300_000);
    await seedRegion6Cleared(page);
    await crossToDesert(page);
    expect((await save(page)).lastCampfire.regionId).toBe("r07");
    await lesson(page, "rune_L7-1", "EOFError", "scroll.stream");
    await rest(page, "campfire_ferry_r07");
    const camp = (await save(page)).lastCampfire;
    const maxHp = (await save(page)).player.hp;

    await openBattle(page, "m_P0702", "P0702");
    const wrong = code("P0702", "wrong_c.py");
    await typeCode(page, wrong);
    for (let i = 0; i < 20 && !(await page.locator(".battle-banner.is-knockout").isVisible()); i++) await cast(page);
    await expect(page.locator(".battle-banner.is-knockout")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page);
    expect((await said(page)).at(-1)).toBe("knockout");
    const w = await where(page);
    expect({ x: w.x, y: w.y }).toEqual({ x: camp.x, y: camp.y });
    await expect(page.locator(".hud-region")).toHaveText("모래시계 사막");
    const s = await save(page);
    expect(s.location.regionId).toBe("r07");
    expect(s.player.hp).toBe(maxHp);
    expect(s.problems.P0702).toMatchObject({ knockouts: 1, draft: wrong, solved: false });
    expect((await obj(page, "m_P0702")).removed).toBe(false);
  });

  test("중간 보스의 시간 결계를 첫 시전에 통과하면 칭호 '시간을 돌린 자'(복잡도 질문은 건너뛰어도 됨, 지역 클리어는 아님)", async ({ page }) => {
    test.setTimeout(300_000);
    await seedRegion6Cleared(page);
    await crossToDesert(page);
    const mid = await obj(page, "m_P0707");
    await seedAndReload(page, {
      lessons: ["L7-1", "L7-2", "L7-3"],
      removed: ["m_P0702", "m_P0704", "m_P0706"],
      at: { x: mid.x - 1, y: mid.y, facing: "right" },
      flags: ["trigger.r07.t_midboss_intro"],
    });
    expect((await save(page)).titles).not.toContain("time-turner");
    await bump(page, "m_P0707");
    await settle(page, ".battle-modal");
    await expect(page.locator(".battle")).toHaveClass(/is-midboss/);
    await typeCode(page, solution("P0707"));
    await cast(page);
    await expectComplexityAsk(page, ["O(N × Q)", "O(N + Q)", "O(N²)"]);
    await page.locator(".complexity-skip").click();
    await expect(page.locator(".complexity-answer")).toContainText("바로 도전해 보자");
    await cast(page);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-caption")).toHaveText("중간 보스 격파!");
    // 건너뛰었으면 보상 창에 예측 줄이 없다
    await expect(page.locator(".reward-complexity")).toHaveCount(0);
    await page.locator(".reward-ok").click();
    await settle(page);
    const s = await save(page);
    expect(s.flags["feat.timeBarrierFirstTry"]).toBe(true);
    expect(s.flags["complexity.guess:P0707"]).toBeUndefined();
    expect(s.titles).toContain("time-turner");
    expect(s.flags["region.r07.clear"]).toBeUndefined();
    expect(await said(page)).toContain("midboss_defeated");
    await expect(page.locator(".recommend-modal")).toHaveCount(0);
  });

  test("동쪽 문: 모래시계 스핑크스를 정화하기 전에는 모래 장막에 막혀 있다(중간 보스만으로는 열리지 않음)", async ({ page }) => {
    test.setTimeout(240_000);
    await seedRegion6Cleared(page);
    await crossToDesert(page);
    const gate = await obj(page, "warp_east");
    expect(await pathTo(page, gate.x - 1, gate.y)).toBeNull();
    await seedAndReload(page, {
      lessons: R07_LESSONS,
      removed: [...REQUIRED.filter((id) => id !== "m_P0714"), "bridge_r07"],
      at: { x: gate.x - 1, y: gate.y, facing: "right" },
    });
    expect((await save(page)).location.regionId).toBe("r07");
    expect((await save(page)).problems.P0707.solved).toBe(true);
    await interact(page, "warp_east");
    const texts = await readAll(page);
    expect(await said(page)).toEqual(["east_gate_locked"]);
    expect(texts.join(" ")).toContain("모래 장막");
    expect((await save(page)).location.regionId).toBe("r07");
    expect((await save(page)).flags["region.r07.clear"]).toBeUndefined();
    expect((await obj(page, "m_P0714")).removed).toBe(false);
  });

  test("모래시계 부적: 장착하고 중간 보스 2페이즈에서 TLE가 확정되면 목표 복잡도와 함께 예측도 공개(보상 창에는 다시 나오지 않음)", async ({ page }) => {
    test.setTimeout(400_000);
    await seedRegion6Cleared(page);
    await crossToDesert(page);
    const mid = await obj(page, "m_P0707");
    const cur = await save(page);
    await seedAndReload(page, {
      lessons: ["L7-1", "L7-2", "L7-3"],
      removed: ["m_P0702", "m_P0704", "m_P0706"],
      at: { x: mid.x - 1, y: mid.y, facing: "right" },
      flags: ["trigger.r07.t_midboss_intro"],
      patch: { inventory: { ...cur.inventory, "hourglass-charm": 1 }, equipment: ["hourglass-charm"] },
    });
    await bump(page, "m_P0707");
    await settle(page, ".battle-modal");
    await typeCode(page, code("P0707", "slow.py"));
    await cast(page);
    await expectComplexityAsk(page, ["O(N × Q)", "O(N + Q)", "O(N²)"]);
    await chooseComplexity(page, "P0707", "O(N²)", "O(N + Q)");
    // 부적이 있어도 TLE가 확정되기 전에는 목표를 숨긴다
    await expect(page.locator(".time-gauge-target")).toBeHidden();

    await cast(page, 300_000);
    await expect(page.locator(".time-gauge")).toHaveClass(/is-over/);
    await expect(page.locator(".time-gauge-target")).toBeVisible();
    await expect(page.locator(".time-gauge-target")).toHaveText("목표 O(N + Q)");
    await expect(page.locator(".hourglass-note .complexity-reveal")).toHaveText("예측: O(N²) / 목표: O(N + Q)");
    await shot(page, "r07-hourglass-reveal.png");
    expect((await save(page)).flags["hourglass.revealed:P0707"]).toBe(true);

    await typeCode(page, solution("P0707"));
    await cast(page, 300_000);
    await expect(page.locator(".battle-banner.is-victory")).toBeVisible();
    await page.locator(".banner-ok").click();
    await settle(page, ".reward-modal");
    await expect(page.locator(".reward-complexity")).toHaveCount(0);
    await page.locator(".reward-ok").click();
    await settle(page);
    expect((await save(page)).problems.P0707.solved).toBe(true);
  });
});
