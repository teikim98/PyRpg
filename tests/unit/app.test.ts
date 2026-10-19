// 앱 계층(src/app/app.ts)을 가짜 월드·UI·저장소로 돌려 본다(docs/phase3/plan.md §1 5·6·9, region02-spec §4 지역 간 이동).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, COMPANION_FLAG, hourglassFlag } from "../../src/app/app";
import { loadContent } from "../../src/content/loader";
import { manifest } from "../../src/contracts/assets";
import type { DialogueLine, GameContent, Lesson, Region } from "../../src/contracts/content";
import type { PythonRunner } from "../../src/contracts/runner";
import type { BattleOutcome, Facing, RewardSummary, SaveData } from "../../src/contracts/state";
import type {
  BattleContext,
  BoardView,
  EquipmentActions,
  EquipmentView,
  HudState,
  MenuActions,
  ShopView,
  TitlesView,
  UiServices,
} from "../../src/contracts/ui";
import type { MapObjectDef, WorldCallbacks, WorldController } from "../../src/contracts/world";
import { parseTiledMap } from "../../src/game/tiled";
import { createNewSave } from "../../src/state/newGame";
import { addDays, studyDate } from "../../src/systems/time";
import { fixtureRegionR99 } from "../fixtures/regions/r99";

const NOW = new Date("2026-10-01T09:00:00Z");

class FakeWorld implements WorldController {
  log: string[] = [];
  region: Region | null = null;
  objects: MapObjectDef[] = [];
  pos = { x: 0, y: 0, facing: "down" as Facing };
  companion = false;
  inputEnabled = true;
  /** loadRegion 도중에 부를 함수(시작 중 입력 시험용) */
  duringLoad: (() => void) | null = null;

  async loadRegion(region: Region, spawn: { x: number; y: number; facing: Facing }, removed: ReadonlySet<string>): Promise<void> {
    this.log.push(`load:${region.id}`);
    this.region = region;
    this.objects = parseTiledMap(region.map).objects.filter((o) => !removed.has(o.id));
    this.pos = { x: spawn.x, y: spawn.y, facing: spawn.facing };
    this.duringLoad?.();
  }
  async removeObject(id: string): Promise<void> {
    this.objects = this.objects.filter((o) => o.id !== id);
  }
  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    this.log.push(`input:${enabled}`);
  }
  getPlayerPosition() {
    return { ...this.pos };
  }
  teleport(x: number, y: number, facing: Facing): void {
    this.pos = { x, y, facing };
  }
  setCompanionVisible(visible: boolean): void {
    this.companion = visible;
  }
  getObjects(): MapObjectDef[] {
    return this.objects.map((o) => ({ ...o, props: { ...o.props } }));
  }
  obj(id: string): MapObjectDef {
    const o = this.objects.find((d) => d.id === id);
    if (!o) throw new Error(`no object ${id}`);
    return o;
  }
}

class MemoryStore {
  data: SaveData | null = null;
  saves = 0;
  async load() {
    return this.data ? structuredClone(this.data) : null;
  }
  async save(d: SaveData) {
    this.saves++;
    const out = { ...d, updatedAt: new Date(NOW.getTime() + this.saves).toISOString() };
    this.data = structuredClone(out);
    return out;
  }
  async clear() {
    this.data = null;
  }
}

interface Harness {
  app: App;
  world: FakeWorld;
  store: MemoryStore;
  callbacks: WorldCallbacks;
  said: string[];
  hud: HudState[];
  recommended: string[];
  /** 보상 창에 넘긴 요약(순서대로) */
  rewards: RewardSummary[];
  battle: { open: (ctx: BattleContext) => Promise<BattleOutcome> };
  toasts: string[];
  /** 시스템 화면 대본(단위 3-1). 화면이 열리면 부른다 */
  sys: {
    board?: (view: BoardView) => Promise<string | null>;
    shop?: (view: () => ShopView, buy: (id: string) => Promise<string>) => Promise<void>;
    equipment?: (view: () => EquipmentView, actions: EquipmentActions) => Promise<void>;
    titles?: (view: () => TitlesView, select: (id: string | null) => Promise<void>) => Promise<void>;
    menu?: (actions: MenuActions) => Promise<void>;
    codex?: (lessons: Lesson[], runner: PythonRunner, names: unknown, extra?: { purified?: unknown[]; lesson?: string }) => Promise<void>;
  };
}

function makeContent(withR99: boolean): GameContent {
  // 테스트마다 맵 props를 바꾸는 경우가 있어서, 공유 모듈 객체가 아니라 깊은 복사본을 쓴다
  const c = structuredClone(loadContent());
  return withR99 ? { ...c, regions: [...c.regions, fixtureRegionR99()] } : c;
}

function harness(content: GameContent, store: MemoryStore): Harness {
  const world = new FakeWorld();
  const said: string[] = [];
  const hud: HudState[] = [];
  const recommended: string[] = [];
  const rewards: RewardSummary[] = [];
  const toasts: string[] = [];
  const sys: Harness["sys"] = {};
  const tables = [...content.regions.map((r) => r.dialogues), content.commonDialogues];
  const idOf = (lines: DialogueLine[]) => {
    for (const t of tables) for (const [id, v] of Object.entries(t)) if (v === lines) return id;
    return "?";
  };
  const battle = {
    open: async (): Promise<BattleOutcome> => {
      throw new Error("battle not scripted");
    },
  } as Harness["battle"];
  const ui = {
    dialogue: { play: async (lines: DialogueLine[]) => void said.push(idOf(lines)) },
    lesson: { open: async () => ({ completed: false }) },
    codex: { open: async (...a: Parameters<NonNullable<Harness["sys"]["codex"]>>) => sys.codex?.(...a) },
    battle: { open: (ctx: BattleContext) => battle.open(ctx) },
    hud: { update: (s: HudState) => void hud.push(s), toast: (m: string) => void toasts.push(m) },
    menu: { open: async (a: MenuActions) => (sys.menu ? sys.menu(a) : void said.push("menu")) },
    board: {
      open: async (v: BoardView) => (sys.board ? sys.board(v) : null),
      openQuests: async () => undefined,
    },
    shop: { open: async (v: () => ShopView, buy: (id: string) => Promise<string>) => sys.shop?.(v, buy) },
    equipment: { open: async (v: () => EquipmentView, a: EquipmentActions) => sys.equipment?.(v, a) },
    titles: { open: async (v: () => TitlesView, sel: (id: string | null) => Promise<void>) => sys.titles?.(v, sel) },
    reward: {
      show: async (s: RewardSummary) => void rewards.push(s),
      showRecommended: async (name: string) => void recommended.push(name),
    },
  } as unknown as UiServices;
  let callbacks!: WorldCallbacks;
  const app = new App({
    content,
    runner: { init: async () => undefined, isReady: () => true, run: async () => ({ stdout: "", stderr: "", timeMs: 1 }) } as never,
    ui,
    worldFactory: {
      create: async (_el, cb) => {
        callbacks = cb;
        return world;
      },
    },
    store: store as never,
    bojBaseUrl: null,
    now: () => NOW,
  });
  return {
    app,
    world,
    store,
    get callbacks() {
      return callbacks;
    },
    said,
    hud,
    recommended,
    rewards,
    battle,
    toasts,
    sys,
  };
}

/** 앱이 한가해질 때까지(대사·전투·트리거가 이어지는 동안) 기다린다 */
async function idle(app: App): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await vi.waitFor(() => expect(app.busy).toBe(false));
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** r01에서 시작하는 저장(누리 합류, 지역 첫 대사 본 상태) */
function r01Save(content: GameContent, mutate: (s: SaveData) => void = () => undefined): SaveData {
  const r01 = content.regions.find((r) => r.id === "r01")!;
  const spawn = parseTiledMap(r01.map).objects.find((o) => o.type === "spawn")!;
  const s = createNewSave(NOW, { spawn: { x: spawn.x, y: spawn.y } });
  s.flags[COMPANION_FLAG] = true;
  s.flags["trigger.r01.t_prologue"] = true;
  s.flags["region.r01.intro"] = true;
  s.scrolls = r01.lessons.map((l) => l.scroll.id);
  s.lessonsCompleted = r01.lessons.map((l) => l.id);
  mutate(s);
  return s;
}

/** 보스(P0105)를 쓰러뜨리고 지역을 클리어한 뒤 warp_east 서쪽 칸에 선 저장 */
function atEastGate(content: GameContent): SaveData {
  const r01 = content.regions.find((r) => r.id === "r01")!;
  const warp = parseTiledMap(r01.map).objects.find((o) => o.id === "warp_east")!;
  return r01Save(content, (s) => {
    s.problems.P0105 = { ...emptyRec(), solved: true };
    s.removedObjects.push("m_P0105");
    s.flags["region.r01.clear"] = true;
    s.location = { regionId: "r01", x: warp.x - 1, y: warp.y, facing: "right" };
  });
}

function emptyRec() {
  return { solved: false, attempts: 0, knockouts: 0, maxHintLevel: 0 as const, solutionViewed: false };
}

beforeEach(() => {
  vi.stubGlobal("addEventListener", () => undefined);
  vi.stubGlobal("document", { visibilityState: "visible" });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("앱 시작", () => {
  it("6: 시작이 끝날 때까지 월드 입력을 막고, 그 사이의 입력 콜백은 무시한다", async () => {
    const content = makeContent(false);
    const store = new MemoryStore();
    store.data = r01Save(content);
    const h = harness(content, store);
    h.world.duringLoad = () => {
      h.callbacks.onMenu();
      h.callbacks.onInteract(h.world.objects.find((o) => o.type === "sign")!);
    };
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    const log = h.world.log;
    expect(log[0]).toBe("input:false");
    expect(log.indexOf("load:r01")).toBeGreaterThan(0);
    expect(log.indexOf("input:true")).toBeGreaterThan(log.indexOf("load:r01"));
    expect(h.world.inputEnabled).toBe(true);
    expect(h.said).toEqual([]);
  });
});

describe("지역 간 이동(warp target/targetSpawn)", () => {
  it("대상 지역이 없으면 openDialogue만 보여 주고 머문다", async () => {
    // 동쪽 문의 대상(r02)을 콘텐츠에서 빼서 '아직 없는 지역'을 만든다
    const full = makeContent(false);
    const content = { ...full, regions: full.regions.filter((r) => r.id !== "r02") };
    const store = new MemoryStore();
    store.data = atEastGate(content);
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    h.callbacks.onInteract(h.world.obj("warp_east"));
    await idle(h.app);
    expect(h.said).toEqual(["to_be_continued"]);
    expect(h.app.region.id).toBe("r01");
    expect(h.world.log.filter((l) => l.startsWith("load:"))).toEqual(["load:r01"]);
  });

  it("조건을 만족하지 못하면 lockedDialogue", async () => {
    const content = makeContent(true);
    const r01 = content.regions.find((r) => r.id === "r01")!;
    (r01.map.layers as { objects?: { name: string; properties: { name: string; value: unknown }[] }[] }[]).forEach((l) =>
      l.objects?.forEach((o) => {
        if (o.name === "warp_east") o.properties.find((p) => p.name === "target")!.value = "r99";
      }),
    );
    const store = new MemoryStore();
    store.data = atEastGate(content);
    store.data.problems.P0105.solved = false;
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    h.callbacks.onInteract(h.world.obj("warp_east"));
    await idle(h.app);
    expect(h.said).toEqual(["east_gate_locked"]);
    expect(h.app.region.id).toBe("r01");
  });

  it("건너가면 대상 지역의 targetSpawn 옆(등지는 방향)에 서고, 저장·HUD·첫 대사·누리·새로고침이 맞다", async () => {
    const content = makeContent(true);
    const r01 = content.regions.find((r) => r.id === "r01")!;
    // 시험용: 에코 마을 동쪽 문이 r99로 이어지게
    for (const l of r01.map.layers as { objects?: { name: string; properties: { name: string; value: unknown }[] }[] }[]) {
      for (const o of l.objects ?? []) if (o.name === "warp_east") o.properties.find((p) => p.name === "target")!.value = "r99";
    }
    const store = new MemoryStore();
    store.data = atEastGate(content);
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);

    h.callbacks.onInteract(h.world.obj("warp_east"));
    await idle(h.app);
    // 처음 건널 때 openDialogue → 새 지역 첫 대사 → 도착 칸의 once 트리거
    expect(h.said).toEqual(["to_be_continued", "r99_intro", "r99_hello"]);
    expect(h.app.region.id).toBe("r99");
    // spawn_west(1, 2)의 동쪽 칸, spawn을 등지고 동쪽을 본다
    expect(h.world.getPlayerPosition()).toEqual({ x: 2, y: 2, facing: "right" });
    expect(h.world.companion).toBe(true);
    expect(h.hud.at(-1)!.regionName).toBe("시험의 들판");
    expect(store.data!.location).toEqual({ regionId: "r99", x: 2, y: 2, facing: "right" });
    expect(store.data!.flags["warp.r01.warp_east"]).toBe(true);
    expect(store.data!.flags["region.r99.intro"]).toBe(true);
    expect(store.data!.flags["trigger.r99.t_r99_hello"]).toBe(true);

    // 새로고침: r99에서 그대로 시작하고 첫 대사는 다시 나오지 않는다
    const h2 = harness(content, store);
    await h2.app.start({} as HTMLElement);
    await idle(h2.app);
    expect(h2.app.region.id).toBe("r99");
    expect(h2.world.getPlayerPosition()).toEqual({ x: 2, y: 2, facing: "right" });
    expect(h2.world.companion).toBe(true);
    expect(h2.hud.at(-1)!.regionName).toBe("시험의 들판");
    expect(h2.said).toEqual([]);

    // 돌아가기: r99 warp_west → r01 warp_east 옆
    h2.callbacks.onInteract(h2.world.obj("warp_west"));
    await idle(h2.app);
    expect(h2.said).toEqual(["r99_back"]);
    expect(h2.app.region.id).toBe("r01");
    const warp = parseTiledMap(r01.map).objects.find((o) => o.id === "warp_east")!;
    const at = h2.world.getPlayerPosition();
    expect(Math.abs(at.x - warp.x) + Math.abs(at.y - warp.y)).toBe(1);
    // 문을 등진다
    const away: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
    expect([warp.x + away[at.facing][0], warp.y + away[at.facing][1]]).toEqual([at.x, at.y]);
    expect(h2.hud.at(-1)!.regionName).toBe("에코 마을");
    expect(store.data!.location.regionId).toBe("r01");

    // 다시 건너면 openDialogue와 첫 대사 없이 바로 이동
    h2.callbacks.onInteract(h2.world.obj("warp_east"));
    await idle(h2.app);
    expect(h2.said).toEqual(["r99_back"]);
    expect(h2.app.region.id).toBe("r99");
  });

  it("처음 들어간 지역에서는 복귀 지점이 그 지역 입구로 바뀐다(다시 들어갈 때는 그대로)", async () => {
    const content = makeContent(false);
    const store = new MemoryStore();
    store.data = atEastGate(content);
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    expect(store.data!.lastCampfire.regionId).toBe("r01");
    h.callbacks.onInteract(h.world.obj("warp_east"));
    await idle(h.app);
    expect(h.app.region.id).toBe("r02");
    const arrived = store.data!.location;
    expect(store.data!.lastCampfire).toEqual({ regionId: "r02", x: arrived.x, y: arrived.y });
    // 에코 마을 캠프파이어에서 쉰 뒤 다시 건너가면 복귀 지점은 바뀌지 않는다
    h.callbacks.onInteract(h.world.obj("warp_west"));
    await idle(h.app);
    expect(h.app.region.id).toBe("r01");
    store.data!.lastCampfire = { regionId: "r01", x: 1, y: 1 };
    h.app.save.lastCampfire = { regionId: "r01", x: 1, y: 1 };
    h.callbacks.onInteract(h.world.obj("warp_east"));
    await idle(h.app);
    expect(h.app.region.id).toBe("r02");
    expect(store.data!.lastCampfire.regionId).toBe("r01");
  });

  it("다른 지역에서 쓰러지면 마지막 캠프파이어가 있는 지역으로 돌아간다", async () => {
    const content = makeContent(true);
    const store = new MemoryStore();
    const camp = parseTiledMap(content.regions[0].map).objects.find((o) => o.type === "campfire")!;
    store.data = r01Save(content, (s) => {
      s.location = { regionId: "r99", x: 2, y: 3, facing: "down" };
      s.flags["region.r99.intro"] = true;
      s.flags["trigger.r99.t_r99_hello"] = true;
      s.lastCampfire = { regionId: "r01", x: camp.x, y: camp.y };
    });
    // r99에 몬스터를 하나 둔다(r01 문제를 빌려 씀)
    const r99 = content.regions.find((r) => r.id === "r99")!;
    r99.problems = [content.regions[0].problems.find((p) => p.id === "P0101")!];
    (r99.map.layers as { objects?: unknown[] }[])[1].objects!.push({
      id: 99, name: "m_r99", type: "monster", x: 32, y: 64, width: 16, height: 16,
      properties: [{ name: "problem", type: "string", value: "P0101" }],
    });
    const h = harness(content, store);
    h.battle.open = async (ctx) => ({ problemId: ctx.problem.id, result: "knockout", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "", hpLeft: 0, elapsedMs: 1 });
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    expect(h.app.region.id).toBe("r99");
    h.callbacks.onInteract(h.world.obj("m_r99"));
    await idle(h.app);
    expect(h.said).toContain("knockout");
    expect(h.app.region.id).toBe("r01");
    expect(store.data!.location).toMatchObject({ regionId: "r01", x: camp.x, y: camp.y });
  });
});

describe("전투", () => {
  async function battleHarness() {
    // 일일 퀘스트 보상이 섞이지 않게 퀘스트 풀을 비운다(퀘스트는 아래 '시스템 화면'에서 따로 본다)
    const base = makeContent(false);
    const content = { ...base, quests: { ...base.quests, pool: [] } };
    const store = new MemoryStore();
    const r01 = content.regions[0];
    const m = parseTiledMap(r01.map).objects.find((o) => o.id === "m_P0101")!;
    store.data = r01Save(content, (s) => {
      s.removedObjects.push("gate_well");
      s.location = { regionId: "r01", x: m.x, y: m.y - 1, facing: "down" };
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    return { h, store, content };
  }

  it("5: AC 순간(배너 전)에 승리를 저장하고, 전투가 끝나도 보상은 한 번만", async () => {
    const { h, store, content } = await battleHarness();
    const xp0 = store.data!.player.xp;
    let release!: () => void;
    const banner = new Promise<void>((r) => (release = r));
    let ctxSeen!: BattleContext;
    let atAc: SaveData | null = null;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      const outcome: BattleOutcome = { problemId: ctx.problem.id, result: "victory", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "print(1)", hpLeft: 100, elapsedMs: 5 };
      ctx.onVictory?.(outcome);
      // 승리 직후에도 타자기 디바운스로 작성 코드가 들어올 수 있다
      ctx.onDraft("print(2)");
      await new Promise((r) => setTimeout(r, 0));
      await vi.waitFor(() => expect(store.data!.problems.P0101?.solved).toBe(true));
      atAc = structuredClone(store.data!);
      await banner;
      return { ...outcome, finalCode: "print(3)", elapsedMs: 9 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await vi.waitFor(() => expect(atAc).not.toBeNull());
    // 배너를 누르기 전: 이미 저장됨(새로고침해도 남는다)
    expect(atAc!.removedObjects).toContain("m_P0101");
    expect(atAc!.player.xp).toBe(xp0 + 100);

    // 배너를 누르기 전에 새로고침한 것처럼 새 앱으로 시작
    const reload = harness(content, store);
    await reload.app.start({} as HTMLElement);
    await idle(reload.app);
    expect(reload.world.objects.some((o) => o.id === "m_P0101")).toBe(false);
    expect(reload.app.save.player.xp).toBe(xp0 + 100);

    release();
    await idle(h.app);
    const s = store.data!;
    expect(s.player.xp).toBe(xp0 + 100);
    expect(s.removedObjects.filter((id) => id === "m_P0101")).toHaveLength(1);
    expect(s.history.filter((l) => l.problemId === "P0101")).toHaveLength(1);
    expect(s.problems.P0101.draft).toBe("print(3)");
    // 9: 공통 대사를 전투 UI에 넘긴다
    expect(ctxSeen.companionLines?.fatalRecursion).toBe(content.commonDialogues.fatal_recursion);
    expect(ctxSeen.companionLines?.practiceSuggest).toBe(content.commonDialogues.practice_suggest);
    expect(ctxSeen.companionLines?.practiceSuggestMonster).toBe(content.commonDialogues.practice_suggest_monster);
    expect(ctxSeen.companionLines?.practiceSuggestWarmup).toBe(content.commonDialogues.practice_suggest_warmup);
    expect(ctxSeen.companionLines?.practiceSuggestApplied).toBe(content.commonDialogues.practice_suggest_applied);
    expect(ctxSeen.companionLines?.solutionUnlockedHint).toBe(content.commonDialogues.solution_unlocked_hint);
    expect(content.commonDialogues.solution_unlocked_hint).toHaveLength(2);
  });

  it("경과 시간(단위 3-E1): 전투 중 임시 저장에 elapsedMs를 싣고, 다음 전투에 priorElapsedMs로 넘긴다", async () => {
    const { h, store } = await battleHarness();
    const priors: (number | undefined)[] = [];
    let saved = false;
    h.battle.open = async (ctx) => {
      priors.push(ctx.priorElapsedMs);
      // 탭이 숨겨질 때의 임시 저장(진행 상태는 그대로, 시간만)
      ctx.onProgress?.({ attempts: 0, maxHintLevel: 0, solutionViewed: false, hp: 100, elapsedMs: 90_000 });
      await vi.waitFor(() => expect(store.data!.problems.P0101?.elapsedTotalMs).toBe(90_000));
      saved = true;
      return { problemId: ctx.problem.id, result: "retreat", attempts: 0, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: 100, elapsedMs: 120_000 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(saved).toBe(true);
    // 임시 저장이 아니라 후퇴 결과(120초)가 한 번만 더해진다
    expect(store.data!.problems.P0101.elapsedTotalMs).toBe(120_000);
    h.battle.open = async (ctx) => {
      priors.push(ctx.priorElapsedMs);
      return { problemId: ctx.problem.id, result: "retreat", attempts: 0, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: 100, elapsedMs: 1_000 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(priors).toEqual([0, 120_000]);
    expect(store.data!.problems.P0101.elapsedTotalMs).toBe(121_000);
  });

  it("연습 전투(단위 3-E3): [연습 전투]로 끝나면 원래 전투는 후퇴, 연습은 보상·기록·퀘스트 없이 스트릭만 인정", async () => {
    const { h, store, content } = await battleHarness();
    // 같은 개념(scroll.convert)의 P0109를 이미 풀었다 → 연습 상대 ①
    h.app.save.problems.P0109 = { ...emptyRec(), solved: true, solvedAt: "2026-09-30T09:00:00.000Z" };
    h.app.save.removedObjects.push("m_P0109");
    h.app.save.quests = { date: studyDate(NOW), ids: ["anywin-2", "win-nohint-1", "rest-1"], progress: [0, 0, 0], claimed: [false, false, false], chest: false };
    const before = structuredClone(h.app.save);
    const ctxs: BattleContext[] = [];
    h.battle.open = async (ctx) => {
      ctxs.push(ctx);
      if (ctxs.length === 1) {
        return { problemId: ctx.problem.id, result: "retreat", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "draft", hpLeft: 80, elapsedMs: 700_000, startPractice: true };
      }
      ctx.onDraft("print(9)");
      return { problemId: ctx.problem.id, result: "victory", attempts: 3, maxHintLevel: 3, solutionViewed: false, finalCode: "print(9)", hpLeft: 80, elapsedMs: 60_000 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(ctxs).toHaveLength(2);
    const [orig, prac] = ctxs;
    expect(orig.practice).toBeUndefined();
    expect(orig.practiceOffer).toMatchObject({ kind: "variant", sourceId: "P0109" });
    expect(orig.companionLines?.practiceSuggestNone).toBe(content.commonDialogues.practice_suggest_none);
    // 연습 전투: P0109의 변형, 빈 틀, 반격·회복약·제안 없음
    expect(prac.practice).toBe(true);
    expect(prac.problem.id).toMatch(/^P0109-v[12]$/);
    expect(prac.problem.starter).toBe(content.regions[0].problems.find((p) => p.id === "P0109")!.starter);
    expect(prac.draft).toBeUndefined();
    expect(prac.potions).toBeUndefined();
    expect(prac.practiceOffer).toBeUndefined();
    expect(prac.knockouts).toBe(0);
    expect(prac.hintLevel).toBe(0);
    const s = store.data!;
    // 원래 전투는 후퇴(시간·시도·작성 코드), 후퇴 대사 없이 바로 연습
    expect(s.problems.P0101).toMatchObject({ solved: false, attempts: 1, draft: "draft", elapsedTotalMs: 700_000 });
    expect(h.said).not.toContain("retreat");
    // 연습 전투는 보상·기록·그림자·history·퀘스트를 바꾸지 않는다
    expect(s.player.xp).toBe(before.player.xp);
    expect(s.player.gold).toBe(before.player.gold);
    expect(s.problems.P0109).toEqual(before.problems.P0109);
    expect(Object.keys(s.problems).some((id) => id.includes("-v"))).toBe(false);
    expect(s.history).toEqual(before.history);
    expect(s.shadows).toEqual(before.shadows);
    expect(s.quests).toEqual(before.quests);
    // 스트릭: 그날 인정, 오늘 처치 수는 그대로
    expect(s.streak.activeDays).toContain(studyDate(NOW));
    expect(s.streak.todayCount).toBe(before.streak.todayDate === studyDate(NOW) ? before.streak.todayCount : 0);
    expect(h.toasts.some((t) => t.includes("오늘 공부한 날로 인정"))).toBe(true);
  });

  it("연습 제안(단위 3-E3): 그림자전·연습 몬스터 전투에는 offer가 없고, 같은 개념을 푼 문제가 없으면 ③·④", async () => {
    const { h } = await battleHarness();
    const ctxs: BattleContext[] = [];
    h.battle.open = async (ctx) => {
      ctxs.push(ctx);
      return { problemId: ctx.problem.id, result: "retreat", attempts: 0, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: 100, elapsedMs: 1 };
    };
    // 아무것도 안 풀었으면 ④
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(ctxs.at(-1)!.practiceOffer).toEqual({ kind: "none" });
    // 다른 개념(scroll.arith) P0102만 풀었으면 ③ 몸풀기
    h.app.save.problems.P0102 = { ...emptyRec(), solved: true, solvedAt: "2026-09-30T09:00:00.000Z" };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(ctxs.at(-1)!.practiceOffer).toMatchObject({ kind: "warmup", sourceId: "P0102" });
    // 연습 몬스터(P0109) 전투에는 제안하지 않는다
    h.callbacks.onInteract(h.world.obj("m_P0109"));
    await idle(h.app);
    expect(ctxs.at(-1)!.problem.id).toBe("P0109");
    expect(ctxs.at(-1)!.practiceOffer).toBeUndefined();
    // 그림자전에도 없다
    h.app.save.problems.P0101 = { ...emptyRec(), solved: true, solvedAt: "2026-09-29T09:00:00.000Z" };
    h.app.save.shadows = [{ concept: "scroll.convert", problemId: "P0101", box: 1, due: studyDate(NOW), purified: false, createdAt: "2026-09-01T00:00:00Z" }];
    await (h.app as unknown as { fightShadow(c: string): Promise<void> }).fightShadow("scroll.convert");
    expect(ctxs.at(-1)!.shadow).toBe(true);
    expect(ctxs.at(-1)!.practiceOffer).toBeUndefined();
  });

  it("새 레슨 첫 완료(단위 3-E3)는 그날을 스트릭 학습일로 인정하고 오늘 처치 수는 올리지 않는다", async () => {
    const { h, store, content } = await battleHarness();
    h.app.save.lessonsCompleted = h.app.save.lessonsCompleted.filter((id) => id !== "L1-1");
    h.app.save.streak = { ...h.app.save.streak, activeDays: [], todayCount: 0 };
    (h.app as unknown as { deps: { ui: { lesson: { open: () => Promise<{ completed: boolean }> } } } }).deps.ui.lesson.open = async () => ({ completed: true });
    const rune = h.world.objects.find((o) => o.type === "rune" && o.props.lesson === "L1-1")!;
    h.callbacks.onInteract(rune);
    await idle(h.app);
    expect(store.data!.lessonsCompleted).toContain("L1-1");
    expect(store.data!.streak.activeDays).toEqual([studyDate(NOW)]);
    expect(store.data!.streak.todayCount).toBe(0);
    expect(content.regions[0].lessons.some((l) => l.id === "L1-1")).toBe(true);
  });

  it("보스 승리를 저장한 뒤 클리어 연출 전에 새로고침하면 다시 시작할 때 클리어 연출을 보여 준다", async () => {
    const content = makeContent(false);
    const store = new MemoryStore();
    store.data = atEastGate(content);
    delete store.data.flags["region.r01.clear"];
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    expect(h.said).toContain("boss_defeated");
    expect(h.recommended).toEqual(["에코 마을"]);
    expect(store.data!.flags["region.r01.clear"]).toBe(true);
    // 지역 해방자 칭호(§7.4)
    expect(store.data!.titles).toContain("liberator-r01");
  });
});

describe("시스템 화면(단위 3-1: 그림자 게시판·퀘스트·상점·장비·칭호)", () => {
  const today = studyDate(NOW);
  const yesterday = addDays(today, -1);

  async function sysHarness(mutate: (s: SaveData) => void) {
    const content = makeContent(false);
    const store = new MemoryStore();
    store.data = r01Save(content, (s) => {
      s.removedObjects.push("gate_well");
      mutate(s);
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    return { h, store, content };
  }

  const win = (ctx: BattleContext, over: Partial<BattleOutcome> = {}): BattleOutcome => ({
    problemId: ctx.problem.id, result: "victory", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: ctx.player.hp, elapsedMs: 1, ...over,
  });

  it("게시판에서 고른 그림자와 싸우면 그림자전(50% 보상, 칸 상승)이고 퀘스트가 오른다", async () => {
    const { h, store } = await sysHarness((s) => {
      s.problems.P0101 = { ...emptyRec(), solved: true };
      s.removedObjects.push("m_P0101");
      s.shadows = [{ concept: "scroll.convert", problemId: "P0101", box: 2, due: yesterday, purified: false, createdAt: "2026-09-01T00:00:00Z" }];
      s.quests = { date: today, ids: ["shadow-1", "rest-1", "anywin-2"], progress: [0, 0, 0], claimed: [false, false, false], chest: false };
    });
    const xp0 = store.data!.player.xp;
    let seen: BoardView | null = null;
    h.sys.board = async (v) => {
      seen = v;
      return v.shadows[0].concept;
    };
    let ctxSeen!: BattleContext;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      return win(ctx);
    };
    h.callbacks.onInteract(h.world.obj("board_shadow"));
    await idle(h.app);
    expect(seen!.shadows).toHaveLength(1);
    expect(seen!.shadows[0]).toMatchObject({ concept: "scroll.convert", box: 2, overdueDays: 1, nextIntervalDays: 7 });
    expect(seen!.shadows[0].name).not.toBe("scroll.convert");
    expect(seen!.quests.quests.map((q) => q.id)).toEqual(["shadow-1", "rest-1", "anywin-2"]);
    expect(ctxSeen.shadow).toBe(true);
    expect(ctxSeen.problem.concept).toBe("scroll.convert");
    expect(ctxSeen.knockouts).toBe(0);
    expect(ctxSeen.hintLevel).toBe(0);
    const s = store.data!;
    expect(s.shadows[0].box).toBe(3);
    // 그림자 보상 50 + 퀘스트(shadow-1) 30
    expect(s.player.xp).toBe(xp0 + 50 + 30);
    expect(s.quests!.progress).toEqual([1, 0, 1]);
    expect(s.history.at(-1)).toMatchObject({ shadow: true, concept: "scroll.convert" });
    expect(h.toasts.some((t) => t.includes("퀘스트 완료: 그림자 몬스터 1마리 처치"))).toBe(true);
    expect(h.hud.at(-1)!.quests).toEqual({ done: 1, total: 3 });
    // 오늘 상대했으니 다시 열면 없다
    h.sys.board = async (v) => {
      seen = v;
      return null;
    };
    h.callbacks.onInteract(h.world.obj("board_shadow"));
    await idle(h.app);
    expect(seen!.shadows).toHaveLength(0);
    expect(seen!.foughtToday).toBe(1);
  });

  it("하루 계획(단위 3-E2): 대표 문제를 못 이긴 그림자는 대기로만 보이고, 대기만 있으면 그림자 퀘스트를 내지 않는다", async () => {
    const { h, store } = await sysHarness((s) => {
      s.shadows = [{ concept: "scroll.convert", problemId: "P0101", box: 1, due: yesterday, purified: false, createdAt: "2026-09-01T00:00:00Z" }];
      delete s.quests;
    });
    let seen: BoardView | null = null;
    h.sys.board = async (v) => {
      seen = v;
      return null;
    };
    h.callbacks.onInteract(h.world.obj("board_shadow"));
    await idle(h.app);
    expect(seen!.shadows).toEqual([]);
    expect(seen!.pending).toEqual([{ concept: "scroll.convert", name: expect.not.stringMatching(/scroll\./), box: 1, anonymous: false, reason: "unsolved" }]);
    expect(seen!.plannedMinutes).toBe(0);
    expect((h.app as unknown as { questContext(): { shadowDue: boolean } }).questContext().shadowDue).toBe(false);
    expect(store.data!.quests!.ids).not.toContain("shadow-1");
    // 고를 수 없는 그림자와는 싸우지 않는다
    let opened = false;
    h.battle.open = async (ctx) => {
      opened = true;
      return win(ctx);
    };
    await (h.app as unknown as { fightShadow(c: string): Promise<void> }).fightShadow("scroll.convert");
    expect(opened).toBe(false);
  });

  it("칸 3 이상 보스 그림자(단위 3-E2): 게시판·전투는 이름 없는 그림자, 2페이즈까지, 보상 50 XP·25골드, 이긴 뒤 공개", async () => {
    const { h, store, content } = await sysHarness((s) => {
      s.problems.P0105 = { ...emptyRec(), solved: true, solvedAt: "2026-09-20T09:00:00.000Z" };
      s.shadows = [{ concept: "scroll.arith", problemId: "P0105", box: 3, due: yesterday, purified: false, createdAt: "2026-09-01T00:00:00Z" }];
      s.quests = { date: today, ids: ["rest-1", "anywin-2", "win-nohint-1"], progress: [0, 0, 0], claimed: [false, false, false], chest: false };
    });
    const boss = content.regions[0].problems.find((p) => p.id === "P0105")!;
    let seen: BoardView | null = null;
    h.sys.board = async (v) => {
      seen = v;
      return v.shadows[0].concept;
    };
    let ctxSeen!: BattleContext;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      return win(ctx);
    };
    const rewards: { summary: { xp: number; gold: number; shadowNote?: string }; problem: { title: string; enemy: { name: string } } }[] = [];
    (h.app as unknown as { deps: { ui: UiServices } }).deps.ui.reward.show = async (summary, problem) => void rewards.push({ summary, problem });
    const gold0 = store.data!.player.gold;
    const recommended0 = h.recommended.length;
    h.callbacks.onInteract(h.world.obj("board_shadow"));
    await idle(h.app);
    expect(seen!.shadows).toHaveLength(1);
    expect(seen!.shadows[0]).toMatchObject({ concept: "scroll.arith", name: "이름 없는 그림자", anonymous: true, minutes: boss.estimatedMinutes });
    expect(seen!.plannedMinutes).toBe(boss.estimatedMinutes);
    // 전투: 이름 숨김, 보스 2페이즈(원래 2페이즈 테스트·예산), 해설서·연습 제안 없음
    expect(ctxSeen.shadow).toBe(true);
    expect(ctxSeen.shadowAnonymous).toBe(true);
    expect(ctxSeen.problem.enemy.name).toBe("이름 없는 그림자");
    expect(ctxSeen.problem.title).toBe("이름 없는 그림자");
    expect(ctxSeen.problem.id).toMatch(/^P0105-v\d$/);
    expect(ctxSeen.problem.boss).toBe(true);
    expect(ctxSeen.problem.budgetUnits).toBe(boss.budgetUnits);
    expect(ctxSeen.problem.tests.filter((t) => t.phase === 2)).toEqual(boss.tests.filter((t) => t.phase === 2));
    expect(ctxSeen.practiceOffer).toBeUndefined();
    // 보상: 일반 전투 기준 50%
    const s = store.data!;
    expect(rewards).toHaveLength(1);
    expect(rewards[0]!.summary).toMatchObject({ xp: 50, gold: 25 });
    expect(s.player.gold).toBe(gold0 + 25);
    // 이긴 뒤 공개: 원래 몬스터 이름과 주문서
    expect(rewards[0]!.problem.enemy.name).toBe(`${boss.enemy.name}의 그림자`);
    expect(rewards[0]!.summary.shadowNote).toContain(boss.enemy.name);
    expect(s.history.at(-1)).toMatchObject({ shadow: true, concept: "scroll.arith", budgetMinutes: boss.estimatedMinutes });
    expect(s.shadows[0].box).toBe(4);
    // 그림자전은 지역 클리어 연출을 하지 않는다
    expect(h.recommended).toHaveLength(recommended0);
  });

  it("퀘스트 3개를 다 하면 상자(금화 + 회복약)", async () => {
    const { h, store, content } = await sysHarness((s) => {
      s.quests = { date: today, ids: ["rest-1", "anywin-2", "win-nohint-1"], progress: [0, 1, 0], claimed: [false, false, false], chest: false };
    });
    h.battle.open = async (ctx) => win(ctx);
    const gold0 = store.data!.player.gold;
    h.callbacks.onInteract(h.world.obj("campfire_plaza"));
    await idle(h.app);
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    const s = store.data!;
    expect(s.quests!.claimed).toEqual([true, true, true]);
    expect(s.quests!.chest).toBe(true);
    // 전투 50 + 퀘스트 3 × 20 + 상자
    expect(s.player.gold).toBe(gold0 + 50 + 60 + content.quests.chest.gold);
    expect(s.inventory.potion).toBe(1);
    expect(h.toasts.some((t) => t.includes("모두 끝냈어"))).toBe(true);
  });

  it("상점에서 망토를 사서 장착하면 최대 HP +20, 깃털을 끼면 전투의 힌트 2가 무료, 회복약을 쓰면 줄어든다", async () => {
    const { h, store } = await sysHarness((s) => {
      s.player.gold = 500;
      s.inventory = { "guide-feather": 1, potion: 2 };
    });
    h.sys.shop = async (view, buy) => {
      expect(view().entries.find((e) => e.id === "sturdy-cloak")!.state).toBe("available");
      expect(view().entries.find((e) => e.id === "dye-nuri-starlight")!.state).toBe("locked");
      expect(view().entries.some((e) => e.id === "guide-feather")).toBe(false);
      expect(await buy("sturdy-cloak")).toContain("튼튼한 망토");
      expect(view().entries.find((e) => e.id === "sturdy-cloak")!.state).toBe("owned");
      await expect(buy("sturdy-cloak")).rejects.toThrow("이미");
    };
    h.callbacks.onInteract(h.world.obj("shop_echo"));
    await idle(h.app);
    expect(store.data!.player.gold).toBe(350);
    expect(store.data!.inventory["sturdy-cloak"]).toBe(1);

    h.sys.menu = async (a) => a.openEquipment!();
    h.sys.equipment = async (view, actions) => {
      expect(view().slots).toBe(1);
      await actions.toggleAccessory("sturdy-cloak");
      expect(view().maxHp).toBe(120);
      await expect(actions.toggleAccessory("guide-feather")).rejects.toThrow("슬롯");
    };
    h.callbacks.onMenu();
    await idle(h.app);
    expect(h.hud.at(-1)!.maxHp).toBe(120);
    expect(store.data!.equipment).toEqual(["sturdy-cloak"]);

    h.sys.equipment = async (_view, actions) => {
      await actions.toggleAccessory("sturdy-cloak");
      await actions.toggleAccessory("guide-feather");
    };
    h.callbacks.onMenu();
    await idle(h.app);
    expect(store.data!.equipment).toEqual(["guide-feather"]);
    expect(h.hud.at(-1)!.maxHp).toBe(100);

    let ctxSeen!: BattleContext;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      ctx.onUsePotion?.();
      return { ...win(ctx), result: "retreat" };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(ctxSeen.perks?.freeHint2).toBe(true);
    expect(ctxSeen.potions).toEqual({ count: 2, heal: 40, name: "회복약" });
    expect(store.data!.inventory.potion).toBe(1);
  });

  it("이미 이룬 칭호는 시작할 때 받고, 고르면 HUD에 보인다", async () => {
    const { h, store } = await sysHarness((s) => {
      s.problems.P0101 = { ...emptyRec(), solved: true };
      s.removedObjects.push("m_P0101");
    });
    expect(store.data!.titles).toEqual(["first-spell"]);
    expect(h.toasts.some((t) => t.includes("「첫 주문」"))).toBe(true);
    h.sys.menu = async (a) => a.openTitles!();
    h.sys.titles = async (view, select) => {
      expect(view().titles.find((t) => t.id === "first-spell")!.earned).toBe(true);
      await select("first-spell");
      expect(view().active).toBe("first-spell");
    };
    h.callbacks.onMenu();
    await idle(h.app);
    expect(store.data!.activeTitle).toBe("first-spell");
    expect(h.hud.at(-1)!.title).toBe("첫 주문");
  });
});

describe("기록관의 안경과 상자 아이템(단위 3-4, region04-spec §4.1·§6)", () => {
  /** 맵 오브젝트의 Tiled 속성을 바꾼다(테스트용 콘텐츠 사본) */
  function setProp(content: GameContent, regionId: string, objectId: string, name: string, value: string): void {
    const region = content.regions.find((r) => r.id === regionId)!;
    for (const layer of (region.map.layers ?? []) as { objects?: { name?: string; properties?: { name: string; type?: string; value: unknown }[] }[] }[]) {
      for (const o of layer.objects ?? []) {
        if (o.name !== objectId) continue;
        o.properties = [...(o.properties ?? []).filter((p) => p.name !== name), { name, type: "string", value }];
      }
    }
  }

  it("상자의 item: 열면 인벤토리에 넣고 토스트, 금화도 함께, 새로고침해도 남고, 이미 가진 장신구는 다시 주지 않는다", async () => {
    const content = makeContent(false);
    setProp(content, "r01", "chest_shop", "item", "archivist-glasses");
    setProp(content, "r01", "chest_hidden", "item", "archivist-glasses");
    const store = new MemoryStore();
    store.data = r01Save(content, (s) => s.removedObjects.push("gate_well"));
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    const gold0 = store.data!.player.gold;
    const gold = Number(h.world.obj("chest_shop").props.gold);

    h.callbacks.onInteract(h.world.obj("chest_shop"));
    await idle(h.app);
    let s = store.data!;
    expect(s.inventory["archivist-glasses"]).toBe(1);
    expect(s.player.gold).toBe(gold0 + gold);
    expect(s.removedObjects).toContain("chest_shop");
    expect(h.toasts).toContain("기록관의 안경을 얻었다!");
    expect(h.toasts).toContain(`금화 ${gold}개를 얻었다!`);
    expect(h.said).toContain("chest_shop");

    // 새로고침: 인벤토리와 열린 상자가 남는다. 장비 화면에서 '준비 중'이 아니고 장착할 수 있다
    const reload = harness(content, store);
    await reload.app.start({} as HTMLElement);
    await idle(reload.app);
    expect(reload.app.save.inventory["archivist-glasses"]).toBe(1);
    expect(reload.world.objects.some((o) => o.id === "chest_shop")).toBe(false);
    const glasses = reload.app.equipmentView().accessories.find((a) => a.id === "archivist-glasses")!;
    expect(glasses).toMatchObject({ owned: true, pending: false, equipped: false });

    // 같은 장신구가 든 다른 상자: 금화만 받고 상자는 열린다
    const toasts0 = reload.toasts.length;
    const hiddenGold = Number(reload.world.obj("chest_hidden").props.gold);
    reload.callbacks.onInteract(reload.world.obj("chest_hidden"));
    await idle(reload.app);
    s = store.data!;
    expect(s.inventory["archivist-glasses"]).toBe(1);
    expect(s.player.gold).toBe(gold0 + gold + hiddenGold);
    expect(s.removedObjects).toContain("chest_hidden");
    expect(reload.toasts.slice(toasts0)).toEqual([`금화 ${hiddenGold}개를 얻었다!`]);
  });

  it("안경을 끼면 전투에 코덱스 바로가기(배운 레슨만)를 넘기고, 누르면 그 레슨을 펼친 코덱스. 안경이 없으면 없음", async () => {
    const base = makeContent(false);
    const content = { ...base, quests: { ...base.quests, pool: base.quests.pool.filter((q) => q.id === "codex-run-1"), perDay: 1 } };
    const store = new MemoryStore();
    const today = studyDate(NOW);
    store.data = r01Save(content, (s) => {
      s.removedObjects.push("gate_well");
      s.inventory["archivist-glasses"] = 1;
      s.equipment = ["archivist-glasses"];
      s.quests = { date: today, ids: ["codex-run-1"], progress: [0], claimed: [false], chest: false };
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    const xp0 = store.data!.player.xp;

    const concat = { type: "TypeError", message: 'can only concatenate str (not "int") to str', traceback: "" };
    const listIndex = { type: "IndexError", message: "list index out of range", traceback: "" };
    const codexCalls: { lessons: string[]; lesson?: string }[] = [];
    h.sys.codex = async (lessons, runner, _names, extra) => {
      codexCalls.push({ lessons: lessons.map((l) => l.id), lesson: extra?.lesson });
      // 코덱스에서 예제를 하나 실행했다(일일 퀘스트)
      await runner.run({ code: "print(1)" });
    };
    let seen: Awaited<ReturnType<NonNullable<NonNullable<BattleContext["perks"]>["codexLink"]>["lessonFor"]>>[] = [];
    h.battle.open = async (ctx) => {
      const link = ctx.perks?.codexLink;
      expect(link).toBeDefined();
      seen = [link!.lessonFor(concat), link!.lessonFor(listIndex)];
      // 전투 중 진행(반격)을 임시 저장한 뒤 코덱스를 연다
      ctx.onProgress?.({ attempts: 1, maxHintLevel: 0, solutionViewed: false, hp: 80 });
      await link!.open("L1-2");
      return { problemId: ctx.problem.id, result: "retreat", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: 80, elapsedMs: 1 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    const l12 = content.regions[0].lessons.find((l) => l.id === "L1-2")!;
    // L1-2(배움)는 바로가기, IndexError의 L3-1(안 배움)은 없음
    expect(seen).toEqual([{ id: "L1-2", title: l12.title }, undefined]);
    expect(codexCalls).toEqual([{ lessons: ["L1-1", "L1-2", "L1-3", "L1-4"], lesson: "L1-2" }]);
    // 코덱스 예제 실행 → 퀘스트 완료(보상은 전투가 끝난 뒤 저장에 남는다)
    const s = store.data!;
    expect(s.quests!.claimed).toEqual([true]);
    expect(s.player.xp).toBe(xp0 + content.quests.reward.xp);
    expect(s.player.hp).toBe(80);
    expect(h.toasts.some((t) => t.includes("퀘스트 완료: 코덱스"))).toBe(true);

    // 메뉴의 코덱스는 펼칠 레슨 없이 연다
    h.sys.menu = async (a) => a.openCodex();
    h.callbacks.onMenu();
    await idle(h.app);
    expect(codexCalls.at(-1)!.lesson).toBeUndefined();

    // 안경을 빼면 바로가기를 넘기지 않는다
    h.sys.equipment = async (_v, actions) => void (await actions.toggleAccessory("archivist-glasses"));
    h.sys.menu = async (a) => a.openEquipment!();
    h.callbacks.onMenu();
    await idle(h.app);
    expect(store.data!.equipment).toEqual([]);
    let perks: BattleContext["perks"] | null = null;
    h.battle.open = async (ctx) => {
      perks = ctx.perks ?? {};
      return { problemId: ctx.problem.id, result: "retreat", attempts: 0, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: 80, elapsedMs: 1 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(perks!.codexLink).toBeUndefined();
  });
});

describe("메아리 고리(region06-spec §7.2)", () => {
  it("지역 5 이하 상점에는 없고, 지역 6 상점에서는 산다. 끼면 전투에 lineCounts를 넘긴다", async () => {
    const base = makeContent(false);
    const content = { ...base, quests: { ...base.quests, pool: [] } };
    const store = new MemoryStore();
    store.data = r01Save(content, (s) => {
      s.removedObjects.push("gate_well");
      s.player.gold = 500;
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    // 지역 1 상점: 실루엣도 없다
    let ids: string[] = [];
    h.sys.shop = async (view, buy) => {
      expect(view().regionOrder).toBe(1);
      ids = view().entries.map((e) => e.id);
      await expect(buy("echo-ring")).rejects.toThrow("파는 물건이 아니야");
    };
    h.callbacks.onInteract(h.world.obj("shop_echo"));
    await idle(h.app);
    expect(ids).toContain("sturdy-cloak");
    expect(ids).not.toContain("echo-ring");
    expect(store.data!.inventory["echo-ring"]).toBeUndefined();

    // 같은 상점이 지역 6에 있다고 치면(지역 순서만 바꿈) 목록에 나오고 살 수 있다
    h.app.region.order = 6;
    h.sys.shop = async (view, buy) => {
      const e = view().entries.find((x) => x.id === "echo-ring")!;
      expect(e).toMatchObject({ price: 200, state: "available" });
      expect(e.pending).toBeUndefined();
      expect(await buy("echo-ring")).toContain("메아리 고리");
    };
    h.callbacks.onInteract(h.world.obj("shop_echo"));
    await idle(h.app);
    expect(store.data!.inventory["echo-ring"]).toBe(1);
    expect(store.data!.player.gold).toBe(300);

    // 장착 → 전투에 lineCounts
    h.sys.menu = async (a) => a.openEquipment!();
    h.sys.equipment = async (view, actions) => {
      expect(view().accessories.find((a) => a.id === "echo-ring")).toMatchObject({ owned: true, pending: false });
      await actions.toggleAccessory("echo-ring");
    };
    h.callbacks.onMenu();
    await idle(h.app);
    let perks: BattleContext["perks"] | null = null;
    h.battle.open = async (ctx) => {
      perks = ctx.perks ?? {};
      return { problemId: ctx.problem.id, result: "retreat", attempts: 0, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: 100, elapsedMs: 1 };
    };
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(perks!.lineCounts).toBe(true);
  });
});

describe("중간 보스(midBoss, region06-spec §7.1)", () => {
  /** r01의 P0101을 중간 보스로 바꾸고, 지역 대사 midboss_defeated를 넣은 콘텐츠 사본 */
  function midBossContent(withDialogue = true): GameContent {
    const base = makeContent(false);
    const content = { ...base, quests: { ...base.quests, pool: [] } };
    const r01 = content.regions[0];
    const p = r01.problems.find((q) => q.id === "P0101")!;
    p.boss = true;
    p.midBoss = true;
    p.reward = { xp: 400, gold: 200 };
    if (withDialogue) r01.dialogues.midboss_defeated = [{ speaker: "companion", text: "다리 너머로 길이 열렸어!" }];
    return content;
  }

  const win = (ctx: BattleContext, over: Partial<BattleOutcome> = {}): BattleOutcome => ({
    problemId: ctx.problem.id, result: "victory", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: ctx.player.hp, elapsedMs: 1, ...over,
  });

  async function start(content: GameContent, mutate: (s: SaveData) => void = () => undefined) {
    const store = new MemoryStore();
    store.data = r01Save(content, (s) => {
      s.removedObjects.push("gate_well");
      mutate(s);
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    return { h, store };
  }

  it("처음 이기면 보상 뒤 midboss_defeated, 지역 클리어·클리어 연출은 없다. 시간 결계 첫 통과면 '시간을 돌린 자'", async () => {
    const content = midBossContent();
    const { h, store } = await start(content);
    let ctxSeen!: BattleContext;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      return win(ctx, { timeBarrierFirstTry: true });
    };
    const xp0 = store.data!.player.xp;
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(ctxSeen.problem.midBoss).toBe(true);
    expect(h.said).toContain("midboss_defeated");
    expect(h.said).not.toContain("boss_defeated");
    expect(h.recommended).toEqual([]);
    const s = store.data!;
    expect(s.flags["region.r01.clear"]).toBeUndefined();
    expect(s.titles).not.toContain("liberator-r01");
    expect(s.player.xp).toBe(xp0 + 400);
    expect(s.removedObjects).toContain("m_P0101");
    expect(s.titles).toContain("time-turner");

    // 새로고침해도 지역 클리어 연출을 이어 보이지 않는다(중간 보스는 클리어가 아님)
    const reload = harness(content, store);
    await reload.app.start({} as HTMLElement);
    await idle(reload.app);
    expect(reload.said).toEqual([]);
    expect(reload.recommended).toEqual([]);
    expect(store.data!.flags["region.r01.clear"]).toBeUndefined();
  });

  it("midboss_defeated 대사가 없는 지역이면 대사 없이 넘어간다(경고 없이)", async () => {
    const content = midBossContent(false);
    const { h, store } = await start(content);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    h.battle.open = async (ctx) => win(ctx);
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(h.said).not.toContain("midboss_defeated");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(store.data!.flags["region.r01.clear"]).toBeUndefined();
  });

  it("최종 보스 승리를 저장한 뒤 클리어 연출 전에 닫혔으면 다시 열 때 이어 보인다(중간 보스와 상관없이 최종 보스 기준)", async () => {
    const content = midBossContent();
    const { h, store } = await start(content, (s) => {
      s.problems.P0101 = { ...emptyRec(), solved: true };
      s.removedObjects.push("m_P0101");
      s.problems.P0105 = { ...emptyRec(), solved: true };
      s.removedObjects.push("m_P0105");
    });
    expect(h.said).toContain("boss_defeated");
    expect(h.said).not.toContain("midboss_defeated");
    expect(h.recommended).toEqual(["에코 마을"]);
    expect(store.data!.flags["region.r01.clear"]).toBe(true);
  });

  it("중간 보스만 이긴 저장으로 시작하면 클리어 연출이 나오지 않는다", async () => {
    const content = midBossContent();
    const { h, store } = await start(content, (s) => {
      s.problems.P0101 = { ...emptyRec(), solved: true };
      s.removedObjects.push("m_P0101");
    });
    expect(h.said).toEqual([]);
    expect(h.recommended).toEqual([]);
    expect(store.data!.flags["region.r01.clear"]).toBeUndefined();
  });
});

describe("메뉴 상점과 모래시계 부적(단위 3-E5)", () => {
  async function e5Harness(mutate: (s: SaveData) => void, tweak: (c: GameContent) => void = () => undefined) {
    const base = makeContent(false);
    const content = { ...base, quests: { ...base.quests, pool: [] } };
    tweak(content);
    const store = new MemoryStore();
    store.data = r01Save(content, (s) => {
      s.removedObjects.push("gate_well");
      mutate(s);
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    return { h, store, content };
  }

  /** 지역 3 상점부터 파는 시험용 품목(회복약 복사본) */
  const addR3Item = (c: GameContent) => {
    const potion = c.items.find((i) => i.id === "potion")!;
    c.items.push({ ...potion, id: "test-r3-potion", name: "시험 물약", shopFromRegion: 3 });
  };

  it("메뉴의 '상점'은 가 본 가장 먼 지역(region.<id>.intro) 기준: 그 지역 품목은 보이고 사지며, 더 뒤 지역 전용 품목은 안 보인다", async () => {
    const { h, store } = await e5Harness((s) => {
      s.player.gold = 500;
      s.flags["region.r02.intro"] = true;
      s.flags["region.r03.intro"] = true;
    }, addR3Item);
    expect(h.app.region.order).toBe(1);
    expect(h.app.farthestRegionOrder()).toBe(3);

    let ids: string[] = [];
    let order = 0;
    h.sys.menu = async (a) => {
      expect(a.openShop).toBeTypeOf("function");
      await a.openShop!();
    };
    h.sys.shop = async (view, buy) => {
      order = view().regionOrder;
      ids = view().entries.map((e) => e.id);
      expect(await buy("test-r3-potion")).toContain("시험 물약");
      await expect(buy("echo-ring")).rejects.toThrow("파는 물건이 아니야");
    };
    h.callbacks.onMenu();
    await idle(h.app);
    expect(order).toBe(3);
    expect(ids).toContain("test-r3-potion");
    expect(ids).toContain("potion");
    expect(ids).not.toContain("echo-ring");
    expect(store.data!.inventory["test-r3-potion"]).toBe(1);
    expect(store.data!.player.gold).toBe(470);

    // 맵의 상점(에코 마을)은 지금처럼 그 지역(1) 기준
    h.sys.shop = async (view) => {
      order = view().regionOrder;
      ids = view().entries.map((e) => e.id);
    };
    h.callbacks.onInteract(h.world.obj("shop_echo"));
    await idle(h.app);
    expect(order).toBe(1);
    expect(ids).not.toContain("test-r3-potion");

    // 지역 6을 가 봤으면 메뉴 상점에 메아리 고리
    h.app.save.flags["region.r06.intro"] = true;
    h.sys.shop = async (view) => {
      order = view().regionOrder;
      ids = view().entries.map((e) => e.id);
    };
    h.callbacks.onMenu();
    await idle(h.app);
    expect(order).toBe(6);
    expect(ids).toContain("echo-ring");
  });

  const charmTweak = (c: GameContent) => {
    for (const r of c.regions) for (const p of r.problems) if (p.id === "P0105") p.targetComplexity = "O(1)";
  };
  const retreat = (ctx: BattleContext): BattleOutcome => ({
    problemId: ctx.problem.id, result: "retreat", attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode: "x", hpLeft: ctx.player.hp, elapsedMs: 1,
  });

  it("모래시계 부적: 목표는 숨긴 채 넘기고, 첫 TLE 공개를 저장해 같은 문제의 다음 전투에서는 처음부터 보인다", async () => {
    const { h, store, content } = await e5Harness((s) => {
      s.inventory["hourglass-charm"] = 1;
      s.equipment = ["hourglass-charm"];
    }, charmTweak);
    const perks: NonNullable<BattleContext["perks"]>[] = [];
    let lines: BattleContext["companionLines"];
    h.battle.open = async (ctx) => {
      perks.push(ctx.perks!);
      lines = ctx.companionLines;
      if (perks.length === 1) {
        // 시간 결계 TLE가 확정된 순간(전투 UI가 부른다): 바로 저장된다
        ctx.perks!.onTargetRevealed!();
        await vi.waitFor(() => expect(store.data!.flags[hourglassFlag("P0105")]).toBe(true));
      }
      return retreat(ctx);
    };
    h.callbacks.onInteract(h.world.obj("m_P0105"));
    await idle(h.app);
    expect(perks[0]).toMatchObject({ targetComplexity: "O(1)", targetRevealed: false });
    expect(lines?.hourglassReveal).toBe(content.commonDialogues.hourglass_reveal);
    expect(content.commonDialogues.hourglass_reveal.length).toBeGreaterThan(0);
    expect(store.data!.flags["hourglass.revealed:P0105"]).toBe(true);

    h.callbacks.onInteract(h.world.obj("m_P0105"));
    await idle(h.app);
    expect(perks[1]).toMatchObject({ targetComplexity: "O(1)", targetRevealed: true });

    // 다른 보스는 따로(P0105의 공개가 번지지 않는다): 목표가 없는 문제는 부적 정보도 없다
    h.callbacks.onInteract(h.world.obj("m_P0101"));
    await idle(h.app);
    expect(perks[2].targetComplexity).toBeUndefined();
    expect(perks[2].targetRevealed).toBeUndefined();
  });

  it("모래시계 부적을 끼지 않으면 목표도 공개 콜백도 없다", async () => {
    const { h } = await e5Harness(() => undefined, charmTweak);
    let perks: BattleContext["perks"];
    h.battle.open = async (ctx) => {
      perks = ctx.perks;
      return retreat(ctx);
    };
    h.callbacks.onInteract(h.world.obj("m_P0105"));
    await idle(h.app);
    expect(perks?.targetComplexity).toBeUndefined();
    expect(perks?.onTargetRevealed).toBeUndefined();
  });

  it("그림자전의 변형도 원래 보스 ID로 공개 상태를 읽고 쓴다", async () => {
    const today = studyDate(NOW);
    const { h, store } = await e5Harness((s) => {
      s.inventory["hourglass-charm"] = 1;
      s.equipment = ["hourglass-charm"];
      s.problems.P0105 = { ...emptyRec(), solved: true, solvedAt: "2026-09-01T00:00:00Z" };
      s.removedObjects.push("m_P0105");
      s.shadows = [{ concept: "scroll.arith", problemId: "P0105", box: 3, due: addDays(today, -1), purified: false, createdAt: "2026-09-01T00:00:00Z" }];
    }, charmTweak);
    h.sys.board = async (v) => v.shadows[0]?.concept ?? null;
    let ctxSeen: BattleContext | null = null;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      expect(ctx.perks?.targetRevealed).toBe(false);
      ctx.perks!.onTargetRevealed!();
      return retreat(ctx);
    };
    h.callbacks.onInteract(h.world.obj("board_shadow"));
    await idle(h.app);
    expect(ctxSeen).not.toBeNull();
    expect(ctxSeen!.shadow).toBe(true);
    expect(ctxSeen!.problem.id).not.toBe("P0105");
    expect(store.data!.flags[hourglassFlag("P0105")]).toBe(true);
    expect(store.data!.flags[hourglassFlag(ctxSeen!.problem.id)]).toBeUndefined();
  });
});

describe("고장 난 다리 퍼즐과 복잡도 예측 질문(region07-spec.md §9.1·§9.2, 시험 지역 r99)", () => {
  /** r99의 (x, y)에 서서 facing을 본 저장으로 시작한다 */
  async function r99Harness(x: number, y: number, facing: Facing, mutate: (s: SaveData) => void = () => undefined) {
    const base = makeContent(true);
    const content = { ...base, quests: { ...base.quests, pool: [] } };
    const store = new MemoryStore();
    store.data = r01Save(content, (s) => {
      s.location = { regionId: "r99", x, y, facing };
      s.flags["region.r99.intro"] = true;
      s.flags["trigger.r99.t_r99_hello"] = true;
      mutate(s);
    });
    const h = harness(content, store);
    await h.app.start({} as HTMLElement);
    await idle(h.app);
    return { h, store, content };
  }
  const outcome = (ctx: BattleContext, result: BattleOutcome["result"], finalCode = ""): BattleOutcome => ({
    problemId: ctx.problem.id, result, attempts: 1, maxHintLevel: 0, solutionViewed: false, finalCode, hpLeft: ctx.player.hp, elapsedMs: 1000,
  });

  it("퍼즐: 다리 앞 대사 → 퍼즐 모드 → 후퇴(코드는 기억) → 통과하면 플래그·door 제거·풀었을 때 대사, 전투 기록·보상·스트릭은 그대로", async () => {
    const { h, store, content } = await r99Harness(7, 1, "right");
    const before = structuredClone(store.data!);
    const seen: BattleContext[] = [];
    h.battle.open = async (ctx) => {
      seen.push(ctx);
      if (seen.length === 1) return outcome(ctx, "retreat", "고친 중");
      // 배너를 누르기 전(AC 순간)에 바로 저장된다
      ctx.onVictory?.(outcome(ctx, "victory"));
      await vi.waitFor(() => expect(store.data!.flags["puzzle.solved:Z9901"]).toBe(true));
      expect(store.data!.removedObjects).toContain("bridge_r99");
      return outcome(ctx, "victory");
    };
    h.callbacks.onInteract(h.world.obj("bridge_r99"));
    await idle(h.app);
    const c1 = seen[0];
    expect(h.said).toEqual(["r99_bridge_broken"]);
    expect(c1.puzzle).toBe(true);
    expect(c1.problem.id).toBe("Z9901");
    expect(c1.problem.starter).toContain("while i * i < n:");
    expect(c1.draft).toBeUndefined();
    // obj_bridge_broken이 아직 manifest에 없으면 맵과 같이 obj_door
    expect(c1.problem.enemy.sprite).toBe("obj_bridge_broken" in manifest.sprites ? "obj_bridge_broken" : "obj_door");
    expect(c1.problem.enemy.attack).toBe(0);
    expect(c1.potions).toBeUndefined();
    expect(c1.practiceOffer).toBeUndefined();
    expect(c1.complexityQuestion).toBeUndefined();
    // 후퇴: door는 그대로, 다리를 등지게 돌아선다
    expect(h.world.objects.some((o) => o.id === "bridge_r99")).toBe(true);
    expect(h.world.pos.facing).toBe("left");
    expect(store.data!.flags["puzzle.solved:Z9901"]).toBeUndefined();

    h.callbacks.onInteract(h.world.obj("bridge_r99"));
    await idle(h.app);
    expect(seen[1].draft).toBe("고친 중");
    expect(h.said).toEqual(["r99_bridge_broken", "r99_bridge_broken", "r99_bridge_fixed"]);
    expect(h.world.objects.some((o) => o.id === "bridge_r99")).toBe(false);
    const after = store.data!;
    expect(after.flags["puzzle.solved:Z9901"]).toBe(true);
    expect(after.removedObjects).toContain("bridge_r99");
    expect(after.problems.Z9901).toBeUndefined();
    expect(after.player.xp).toBe(before.player.xp);
    expect(after.player.gold).toBe(before.player.gold);
    expect(after.streak).toEqual(before.streak);
    expect(after.history).toEqual(before.history);
    expect(after.shadows).toEqual(before.shadows);
    expect(h.rewards).toEqual([]);

    // 새로고침: 다리는 이어진 채
    const h2 = harness(content, store);
    await h2.app.start({} as HTMLElement);
    await idle(h2.app);
    expect(h2.world.objects.some((o) => o.id === "bridge_r99")).toBe(false);
  });

  it("복잡도 예측: 맵의 보스전에 선택지를 넘기고, 고른 답(맞았는가)을 저장, 보상 창에서 예측과 목표를 함께 보인다", async () => {
    const { h, store } = await r99Harness(4, 1, "right");
    let ctxSeen: BattleContext | undefined;
    h.battle.open = async (ctx) => {
      ctxSeen = ctx;
      ctx.complexityQuestion!.onAnswer("O(N)");
      await vi.waitFor(() => expect(store.data!.flags["complexity.guess:P9901"]).toBe(false));
      return outcome(ctx, "victory");
    };
    h.callbacks.onInteract(h.world.obj("m_P9901"));
    await idle(h.app);
    expect(ctxSeen!.complexityQuestion!.choices).toEqual(["O(N)", "O(1)", "O(N²)"]);
    expect(h.rewards).toHaveLength(1);
    expect(h.rewards[0].complexityReveal).toEqual({ guess: "O(N)", target: "O(1)" });
    // 중간 보스: 지역 클리어는 없다
    expect(store.data!.flags["region.r99.clear"]).toBeUndefined();
  });

  it("복잡도 예측: 모래시계 부적이 전투 중에 먼저 공개했으면 보상 창에는 다시 보이지 않고, 건너뛰면 저장·공개가 없다", async () => {
    const { h, store } = await r99Harness(4, 1, "right");
    h.battle.open = async (ctx) => {
      ctx.complexityQuestion!.onAnswer("O(1)");
      expect(ctx.complexityQuestion!.takeReveal()).toEqual({ guess: "O(1)", target: "O(1)" });
      expect(ctx.complexityQuestion!.takeReveal()).toBeNull();
      return outcome(ctx, "victory");
    };
    h.callbacks.onInteract(h.world.obj("m_P9901"));
    await idle(h.app);
    expect(store.data!.flags["complexity.guess:P9901"]).toBe(true);
    expect(h.rewards[0].complexityReveal).toBeUndefined();

    const s = await r99Harness(4, 1, "right");
    s.h.battle.open = async (ctx) => {
      ctx.complexityQuestion!.onAnswer(null);
      return outcome(ctx, "victory");
    };
    s.h.callbacks.onInteract(s.h.world.obj("m_P9901"));
    await idle(s.h.app);
    expect(s.store.data!.flags["complexity.guess:P9901"]).toBeUndefined();
    expect(s.h.rewards[0].complexityReveal).toBeUndefined();
  });

  it("복잡도 예측: 모래시계 부적이 이미 목표를 보여 준 보스와 선택지가 없는 보스(지역 1~6)는 묻지 않는다", async () => {
    const { h } = await r99Harness(4, 1, "right", (s) => {
      s.flags[hourglassFlag("P9901")] = true;
    });
    let q: BattleContext["complexityQuestion"] | "unset" = "unset";
    h.battle.open = async (ctx) => {
      q = ctx.complexityQuestion;
      return outcome(ctx, "retreat");
    };
    h.callbacks.onInteract(h.world.obj("m_P9901"));
    await idle(h.app);
    expect(q).toBeUndefined();
    for (const r of makeContent(false).regions.filter((r) => r.order < 7)) for (const p of r.problems) expect(p.complexityChoices, p.id).toBeUndefined();
  });
});
