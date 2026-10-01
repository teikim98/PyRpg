// 앱 계층(src/app/app.ts)을 가짜 월드·UI·저장소로 돌려 본다(docs/phase3/plan.md §1 5·6·9, region02-spec §4 지역 간 이동).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, COMPANION_FLAG } from "../../src/app/app";
import { loadContent } from "../../src/content/loader";
import type { DialogueLine, GameContent, Region } from "../../src/contracts/content";
import type { BattleOutcome, Facing, SaveData } from "../../src/contracts/state";
import type { BattleContext, HudState, UiServices } from "../../src/contracts/ui";
import type { MapObjectDef, WorldCallbacks, WorldController } from "../../src/contracts/world";
import { parseTiledMap } from "../../src/game/tiled";
import { createNewSave } from "../../src/state/newGame";
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
  battle: { open: (ctx: BattleContext) => Promise<BattleOutcome> };
}

function makeContent(withR99: boolean): GameContent {
  const c = loadContent();
  return withR99 ? { ...c, regions: [...c.regions, fixtureRegionR99()] } : c;
}

function harness(content: GameContent, store: MemoryStore): Harness {
  const world = new FakeWorld();
  const said: string[] = [];
  const hud: HudState[] = [];
  const recommended: string[] = [];
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
    codex: { open: async () => undefined },
    battle: { open: (ctx: BattleContext) => battle.open(ctx) },
    hud: { update: (s: HudState) => void hud.push(s), toast: () => undefined },
    menu: { open: async () => void said.push("menu") },
    reward: {
      show: async () => undefined,
      showRecommended: async (name: string) => void recommended.push(name),
    },
  } as unknown as UiServices;
  let callbacks!: WorldCallbacks;
  const app = new App({
    content,
    runner: { init: async () => undefined, isReady: () => true } as never,
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
    battle,
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
    const content = makeContent(false);
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
    const content = makeContent(false);
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
  });
});
