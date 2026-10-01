// E2E 전용 테스트 훅(design.md §12.3). main.ts가 ?e2e일 때만 불러와 window.__pyrpg에 붙인다.
// 캔버스 안은 DOM으로 찾을 수 없으므로 좌표·진행도·길찾기만 알려 주고, 이동은 테스트가 실제 키로 보낸다.
import type { GameContent } from "../contracts/content";
import type { Facing, SaveData } from "../contracts/state";
import type { MapObjectDef } from "../contracts/world";
import { DIRS } from "../game/grid";
import type { PythonRunnerHandle } from "../python/runner";
import type { SaveStore } from "../state";
import { completeLesson, emptyRecord } from "../systems";
import type { UiServicesExt } from "../ui";
import type { App } from "./app";
import { walkableFn } from "./travel";
import { fixtureRegionR99 } from "../../tests/fixtures/regions/r99";

export interface E2eSeed {
  /** 완료 처리할 레슨(주문서·XP 포함) */
  lessons?: string[];
  /** 이미 사라진 오브젝트(처치한 몬스터·열린 문). 해당 문제는 solved로 기록 */
  removed?: string[];
  at?: { x: number; y: number; facing?: Facing };
  hp?: number;
  flags?: string[];
}

export interface E2eHook {
  ready: boolean;
  app: App;
  runner: PythonRunnerHandle;
  content: GameContent;
  ui: UiServicesExt;
  store: SaveStore;
  crossOriginIsolated: boolean;
  /** 지금까지 재생한 대사 ID(순서대로) */
  said: string[];
  /** 현재 위치와 바쁨 여부(가벼워서 자주 불러도 된다) */
  where(): { x: number; y: number; facing: Facing; busy: boolean; modal: boolean };
  /** 저장 데이터 사본과 현재 위치 */
  state(): { save: SaveData; pos: { x: number; y: number; facing: Facing }; busy: boolean; modal: boolean };
  objects(): (MapObjectDef & { removed: boolean })[];
  /** 지금 위치에서 (x, y)까지 걸어갈 방향 목록. 갈 수 없으면 null */
  path(x: number, y: number): Facing[] | null;
  /** 오브젝트 옆 칸까지의 길과, 도착해서 바라볼 방향 */
  approach(id: string): { path: Facing[]; face: Facing; end: { x: number; y: number } } | null;
  /** 저장 데이터를 고쳐 저장한다(테스트 준비용). 반영하려면 새로고침 */
  seed(seed: E2eSeed): Promise<SaveData>;
}

/**
 * ?e2e&fixtures: 지역 간 이동 시험용 지역 r99(tests/fixtures/regions/r99.ts)를 넣고, 에코 마을 warp_east가
 * r99의 spawn_west로 이어지게 바꾼다. 앱이 시작하기 전에 불러야 한다
 */
export function addE2eFixtures(content: GameContent): void {
  if (content.regions.some((r) => r.id === "r99")) return;
  content.regions.push(fixtureRegionR99());
  const r01 = content.regions.find((r) => r.id === "r01");
  for (const layer of (r01?.map.layers ?? []) as { objects?: { name?: string; properties?: { name: string; value: unknown }[] }[] }[]) {
    for (const o of layer.objects ?? []) {
      if (o.name !== "warp_east") continue;
      for (const p of o.properties ?? []) {
        if (p.name === "target") p.value = "r99";
        if (p.name === "targetSpawn") p.value = "spawn_west";
      }
    }
  }
}

export function createE2eHook(
  app: App,
  deps: { runner: PythonRunnerHandle; content: GameContent; ui: UiServicesExt; store: SaveStore },
): E2eHook {
  if (new URLSearchParams(location.search).has("fixtures")) addE2eFixtures(deps.content);
  const walkable = () => walkableFn(app.region, new Set(app.save.removedObjects));

  /** 너비 우선 탐색. goal(x, y)가 true인 첫 칸까지의 방향 목록 */
  const bfs = (goal: (x: number, y: number) => boolean): { path: Facing[]; end: { x: number; y: number } } | null => {
    const ok = walkable();
    const start = app.world.getPlayerPosition();
    const key = (x: number, y: number) => `${x},${y}`;
    const prev = new Map<string, { from: string; dir: Facing } | null>([[key(start.x, start.y), null]]);
    const queue: [number, number][] = [[start.x, start.y]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      if (goal(x, y)) {
        const path: Facing[] = [];
        let k = key(x, y);
        for (let p = prev.get(k); p; p = prev.get(k)) {
          path.unshift(p.dir);
          k = p.from;
        }
        return { path, end: { x, y } };
      }
      for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Facing, readonly [number, number]][]) {
        const nx = x + dx;
        const ny = y + dy;
        const nk = key(nx, ny);
        if (prev.has(nk) || !ok(nx, ny)) continue;
        prev.set(nk, { from: key(x, y), dir });
        queue.push([nx, ny]);
      }
    }
    return null;
  };

  // 어떤 대사가 나왔는지 기록한다(대사 배열은 콘텐츠 객체를 그대로 넘겨받으므로 참조로 ID를 찾는다)
  const said: string[] = [];
  const dialogueId = (lines: unknown): string => {
    const tables = [...deps.content.regions.map((r) => r.dialogues), deps.content.commonDialogues];
    for (const t of tables) for (const [id, v] of Object.entries(t)) if (v === lines) return id;
    return "?";
  };
  const play = deps.ui.dialogue.play.bind(deps.ui.dialogue);
  deps.ui.dialogue.play = (lines, names) => {
    said.push(dialogueId(lines));
    return play(lines, names);
  };

  return {
    ready: false,
    app,
    ...deps,
    crossOriginIsolated: self.crossOriginIsolated,
    said,
    where: () => ({ ...app.world.getPlayerPosition(), busy: app.busy, modal: deps.ui.isModalOpen() }),
    state: () => ({
      save: structuredClone(app.save),
      pos: app.world.getPlayerPosition(),
      busy: app.busy,
      modal: deps.ui.isModalOpen(),
    }),
    objects: () => app.world.getObjects().map((o) => ({ ...o, removed: app.save.removedObjects.includes(o.id) })),
    path: (x, y) => bfs((cx, cy) => cx === x && cy === y)?.path ?? null,
    approach(id) {
      const o = app.world.getObjects().find((d) => d.id === id);
      if (!o) return null;
      const r = bfs((x, y) => Math.abs(x - o.x) + Math.abs(y - o.y) === 1);
      if (!r) return null;
      const dx = o.x - r.end.x;
      const dy = o.y - r.end.y;
      const face: Facing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
      return { path: r.path, face, end: r.end };
    },
    async seed(seed) {
      let s = structuredClone(app.save);
      for (const id of seed.lessons ?? []) {
        const lesson = deps.content.regions.flatMap((r) => r.lessons).find((l) => l.id === id);
        if (!lesson) throw new Error(`레슨 없음: ${id}`);
        s = completeLesson(s, lesson).save;
      }
      for (const id of seed.removed ?? []) {
        if (!s.removedObjects.includes(id)) s.removedObjects.push(id);
        const obj = app.world.getObjects().find((o) => o.id === id);
        const pid = obj?.type === "monster" ? String(obj.props.problem) : null;
        if (pid) s.problems[pid] = { ...(s.problems[pid] ?? emptyRecord()), solved: true };
      }
      for (const f of seed.flags ?? []) s.flags[f] = true;
      if (seed.at) s.location = { regionId: app.region.id, x: seed.at.x, y: seed.at.y, facing: seed.at.facing ?? "down" };
      if (seed.hp !== undefined) s.player.hp = seed.hp;
      return app.overwriteSave(s);
    },
  };
}
