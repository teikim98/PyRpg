// 지역 3(고블린 동굴) 맵: docs/phase3/region03-spec.md §4의 오브젝트·속성, 충돌, 구역 진행 순서,
// 숨겨진 바위 틈, 트리거를 엔진의 해석기(parseTiledMap)와 격자·길찾기(buildCollisionGrid, reachableTiles)로 확인한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { manifest, tileIndex } from "../../src/contracts/assets";
import type { MapObjectDef } from "../../src/contracts/world";
import { ObjectIndex, buildCollisionGrid, reachableTiles } from "../../src/game/grid";
import { parseTiledMap } from "../../src/game/tiled";

const MAP_PATH = resolve(__dirname, "../../content/regions/r03-goblin-cave/map.tmj");
const raw = JSON.parse(readFileSync(MAP_PATH, "utf-8")) as Record<string, unknown>;
const map = parseTiledMap(raw);
const ts = manifest.tilesets.overworld;
const grid = buildCollisionGrid(map, ts);
const objById = new Map(map.objects.map((o) => [o.id, o]));
const obj = (id: string): MapObjectDef => {
  const o = objById.get(id);
  if (!o) throw new Error(`missing object ${id}`);
  return o;
};
const at = (x: number, y: number) => y * map.width + x;

/** region03-spec.md §4 */
const SPEC: Record<string, { type: string; props: Record<string, string | number | boolean> }> = {
  spawn_west: { type: "spawn", props: {} },
  warp_west: { type: "warp", props: { target: "r02", targetSpawn: "warp_east" } },
  t_cave_intro: { type: "trigger", props: { dialogue: "cave_intro", once: true } },
  "rune_L3-1": { type: "rune", props: { lesson: "L3-1" } },
  campfire_entrance: { type: "campfire", props: {} },
  m_P0301: { type: "monster", props: { problem: "P0301" } },
  m_P0303: { type: "monster", props: { problem: "P0303" } },
  m_P0302: { type: "monster", props: { problem: "P0302" } },
  "rune_L3-2": { type: "rune", props: { lesson: "L3-2" } },
  sign_tunnels: { type: "sign", props: { dialogue: "sign_tunnels" } },
  m_P0305: { type: "monster", props: { problem: "P0305" } },
  m_P0304: { type: "monster", props: { problem: "P0304" } },
  "rune_L3-3": { type: "rune", props: { lesson: "L3-3" } },
  npc_goblin_clerk: { type: "npc", props: { dialogue: "npc_goblin_clerk", sprite: "npc_goblin" } },
  chest_storeroom: { type: "chest", props: { gold: 50, dialogue: "chest_storeroom" } },
  board_shadow_r03: { type: "board", props: {} },
  campfire_storeroom: { type: "campfire", props: {} },
  m_P0306: { type: "monster", props: { problem: "P0306" } },
  m_P0307: { type: "monster", props: { problem: "P0307" } },
  "rune_L3-4": { type: "rune", props: { lesson: "L3-4" } },
  m_P0309: { type: "monster", props: { problem: "P0309" } },
  chest_hidden_pool: { type: "chest", props: { gold: 70, dialogue: "chest_hidden_pool" } },
  m_P0308: { type: "monster", props: { problem: "P0308" } },
  "rune_L3-5": { type: "rune", props: { lesson: "L3-5" } },
  sign_mural: { type: "sign", props: { dialogue: "sign_mural" } },
  m_P0310: { type: "monster", props: { problem: "P0310" } },
  t_boss_intro: { type: "trigger", props: { dialogue: "boss_intro", once: true } },
  m_P0311: { type: "monster", props: { problem: "P0311" } },
  warp_east: {
    type: "warp",
    props: { requires: "problem:P0311", lockedDialogue: "east_gate_locked", openDialogue: "to_be_continued" },
  },
};

/** 구역(서 → 동)과 그 구역에서 처음 닿는 오브젝트. 앞 구역 출구 몬스터를 치워야 다음 구역이 열린다 */
const STAGES: [string | null, string[]][] = [
  [null, ["warp_west", "t_cave_intro", "rune_L3-1", "campfire_entrance", "m_P0301"]],
  ["m_P0301", ["m_P0303", "m_P0302"]],
  ["m_P0302", ["rune_L3-2", "sign_tunnels", "m_P0305", "m_P0304"]],
  // 창고 길목의 m_P0306은 scroll.methods를 요구하므로 rune_L3-3은 길목 앞(통로 북쪽 벽감)에 있다
  ["m_P0304", ["rune_L3-3", "m_P0306"]],
  ["m_P0306", ["npc_goblin_clerk", "chest_storeroom", "board_shadow_r03", "campfire_storeroom", "m_P0307"]],
  ["m_P0307", ["rune_L3-4", "m_P0309", "chest_hidden_pool", "m_P0308"]],
  ["m_P0308", ["rune_L3-5", "sign_mural", "m_P0310"]],
  ["m_P0310", ["t_boss_intro", "m_P0311"]],
  ["m_P0311", ["warp_east"]],
];
const OPTIONAL = ["m_P0303", "m_P0305", "m_P0309"];
const CHOKEPOINTS = ["m_P0301", "m_P0302", "m_P0304", "m_P0306", "m_P0307", "m_P0308", "m_P0310", "m_P0311"];
const CAVE_TILES = [
  "cave_floor",
  "cave_wall",
  "cave_wall_top",
  "torch_frozen",
  "crystal",
  "rubble",
  "treasure_pile",
  "cave_pool",
  "mural_wall",
  "cave_crack",
  "minecart_rail",
  "bone_pile",
];

function indexWithout(removed: Set<string>): ObjectIndex {
  const idx = new ObjectIndex(map.width);
  for (const o of map.objects) if (!removed.has(o.id)) idx.add(o);
  return idx;
}

const D4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 오브젝트 칸이나 그 이웃 칸에 닿을 수 있는지 */
function touches(area: Set<number>, o: MapObjectDef): boolean {
  return [[0, 0], ...D4].some(([dx, dy]) => area.has(at(o.x + dx, o.y + dy)));
}

function removedUntil(id: string): Set<string> {
  const removed = new Set<string>();
  for (const [remove, ids] of STAGES) {
    if (remove) removed.add(remove);
    if (ids.includes(id)) return removed;
  }
  throw new Error(id);
}

/** 숨겨진 길 입구: 하나뿐인 바위 틈(cave_crack, 지나갈 수 있음) */
const crack = () => {
  const cells = map.ground.map((v, i) => (v === tileIndex("cave_crack") ? i : -1)).filter((i) => i >= 0);
  expect(cells).toHaveLength(1);
  return { x: cells[0] % map.width, y: Math.floor(cells[0] / map.width) };
};

describe("parseTiledMap on the region-3 map", () => {
  it("reads size, tileset and layers", () => {
    expect(map.width).toBeGreaterThanOrEqual(60);
    expect(map.width).toBeLessThanOrEqual(120);
    expect(map.height).toBeGreaterThanOrEqual(20);
    expect(map.height).toBeLessThanOrEqual(45);
    expect(map.tileset).toBe("overworld");
    expect(map.ground).toHaveLength(map.width * map.height);
    expect(map.deco).toHaveLength(map.width * map.height);
    expect(map.collision).toHaveLength(map.width * map.height);
    const n = ts.tiles.length;
    for (const v of [...map.ground, ...map.deco]) expect(v >= -1 && v < n).toBe(true);
    expect(map.ground.every((v) => v >= 0)).toBe(true);
    expect((raw.properties as { name: string; value: unknown }[]).find((p) => p.name === "region")?.value).toBe("r03");
  });

  it("uses the cave tiles appended after the forest tiles", () => {
    // 지역 1·2 타일 인덱스는 그대로이고 동굴 타일은 명세 순서대로 끝에 붙는다
    expect(tileIndex("dark_floor")).toBe(23);
    expect(tileIndex("root_floor")).toBe(35);
    CAVE_TILES.forEach((t, k) => expect(tileIndex(t), t).toBe(36 + k));
    expect(ts.tiles).toHaveLength(48);
    const used = new Set([...map.ground, ...map.deco].filter((v) => v >= 0).map((v) => ts.tiles[v]));
    for (const t of CAVE_TILES) expect(used.has(t), t).toBe(true);
    // 동굴 맵은 동굴 타일만 쓴다
    for (const t of used) expect(CAVE_TILES, t).toContain(t);
  });

  it("has exactly the region03-spec §4 objects with their props", () => {
    expect(map.objects.map((o) => o.id).sort()).toEqual(Object.keys(SPEC).sort());
    for (const [id, spec] of Object.entries(SPEC)) {
      expect(obj(id).type, id).toBe(spec.type);
      expect(obj(id).props, id).toEqual(spec.props);
    }
  });

  it("puts objects on cave floor inside the map", () => {
    for (const o of map.objects) {
      expect(o.x >= 0 && o.y >= 0 && o.x < map.width && o.y < map.height, o.id).toBe(true);
      expect(grid[at(o.x, o.y)], o.id).toBe(0);
      expect(map.ground[at(o.x, o.y)], o.id).toBe(tileIndex("cave_floor"));
    }
  });
});

describe("region-3 collision", () => {
  it("follows the manifest blocking list exactly (the crack is passable by itself, no override)", () => {
    const blocking = new Set(ts.blocking.map((n) => tileIndex(n)));
    for (let i = 0; i < grid.length; i++) {
      const shouldBlock = blocking.has(map.ground[i]) || blocking.has(map.deco[i]);
      expect(grid[i] === 1, `tile ${i % map.width},${Math.floor(i / map.width)}`).toBe(shouldBlock);
    }
    expect(ts.blocking).not.toContain("cave_crack");
    expect(ts.blocking).not.toContain("minecart_rail");
  });

  it("is walled in: only the west warp sits on the map border", () => {
    for (let x = 0; x < map.width; x++) {
      expect(grid[x], `top ${x}`).toBe(1);
      expect(grid[at(x, map.height - 1)], `bottom ${x}`).toBe(1);
    }
    const area = reachableTiles(map, grid, indexWithout(new Set(map.objects.map((o) => o.id))), obj("spawn_west"));
    const warp = obj("warp_west");
    for (const k of area) {
      const x = k % map.width;
      const y = Math.floor(k / map.width);
      if (x === warp.x && y === warp.y) continue;
      expect(x > 0 && x < map.width - 1 && y > 0 && y < map.height - 1, `edge tile ${x},${y}`).toBe(true);
    }
  });

  it("wall faces (torches, mural, crack) sit above open floor, and the mural faces the mural room", () => {
    const faces = new Set(["cave_wall", "torch_frozen", "mural_wall", "cave_crack"].map((t) => tileIndex(t)));
    const walls = new Set(["cave_wall", "cave_wall_top", "torch_frozen", "mural_wall", "cave_crack"].map((t) => tileIndex(t)));
    for (let y = 0; y < map.height - 1; y++) {
      for (let x = 0; x < map.width; x++) {
        const g = map.ground[at(x, y)];
        if (faces.has(g)) expect(walls.has(map.ground[at(x, y + 1)]), `face ${x},${y}`).toBe(false);
        if (g === tileIndex("cave_wall_top")) expect(walls.has(map.ground[at(x, y + 1)]), `top ${x},${y}`).toBe(true);
      }
    }
    const mural = map.ground.map((v, i) => (v === tileIndex("mural_wall") ? i : -1)).filter((i) => i >= 0);
    expect(mural.length).toBeGreaterThanOrEqual(3);
    const sign = obj("sign_mural");
    expect(mural.some((i) => i % map.width === sign.x && Math.floor(i / map.width) === sign.y - 2)).toBe(true);
  });
});

describe("region-3 progression (zones open west to east)", () => {
  it("each required monster is the only way into the next part of the cave", () => {
    const removed = new Set<string>();
    STAGES.forEach(([remove, reachable], k) => {
      if (remove) removed.add(remove);
      const area = reachableTiles(map, grid, indexWithout(removed), obj("spawn_west"));
      for (const id of reachable) expect(touches(area, obj(id)), `${id} after ${remove}`).toBe(true);
      for (const [, later] of STAGES.slice(k + 1)) {
        for (const id of later) expect(touches(area, obj(id)), `${id} too early after ${remove}`).toBe(false);
      }
    });
    for (const id of OPTIONAL) expect(removed.has(id)).toBe(false);
  });

  it("every monster's required region-3 scroll can be learned before reaching it (no need_scroll dead end)", () => {
    const lessonsDir = resolve(__dirname, "../../content/regions/r03-goblin-cave/lessons");
    const runeOf = new Map<string, string>();
    for (const id of ["L3-1", "L3-2", "L3-3", "L3-4", "L3-5"]) {
      const l = JSON.parse(readFileSync(resolve(lessonsDir, id, "lesson.json"), "utf-8")) as { scroll: { id: string } };
      runeOf.set(l.scroll.id, `rune_${id}`);
    }
    const removed = new Set<string>();
    for (const [remove, reachable] of STAGES) {
      if (remove) removed.add(remove);
      for (const id of reachable.filter((r) => obj(r).type === "monster")) {
        const before = new Set([...removed].filter((r) => r !== id));
        const area = reachableTiles(map, grid, indexWithout(before), obj("spawn_west"));
        const pid = String(obj(id).props.problem);
        const problem = JSON.parse(
          readFileSync(resolve(__dirname, `../../content/regions/r03-goblin-cave/problems/${pid}/problem.json`), "utf-8"),
        ) as { requires: string[] };
        for (const scroll of problem.requires) {
          const rune = runeOf.get(scroll);
          if (rune) expect(touches(area, obj(rune)), `${id} needs ${scroll} (${rune})`).toBe(true);
        }
      }
    }
  });

  it("required monsters block 1-tile chokepoints", () => {
    const occupied = new Set(map.objects.filter((o) => o.type !== "trigger" && o.type !== "spawn").map((o) => at(o.x, o.y)));
    for (const id of CHOKEPOINTS) {
      const o = obj(id);
      const open = D4.filter(([dx, dy]) => !grid[at(o.x + dx, o.y + dy)]);
      expect(open.length, id).toBe(2);
      expect(open[0][0] + open[1][0], id).toBe(0);
      expect(open[0][1] + open[1][1], id).toBe(0);
      expect(occupied.has(at(o.x, o.y))).toBe(true);
    }
  });

  it("zone order is west to east", () => {
    const xs = ["spawn_west", "m_P0301", "m_P0302", "m_P0304", "m_P0306", "m_P0307", "m_P0308", "m_P0310", "m_P0311", "warp_east"].map(
      (id) => obj(id).x,
    );
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(obj("warp_west").x).toBeLessThanOrEqual(1);
    expect(obj("warp_east").x).toBeGreaterThanOrEqual(map.width - 3);
  });

  it("the cave intro trigger is next to spawn and cannot be bypassed", () => {
    const spawn = obj("spawn_west");
    const trig = obj("t_cave_intro");
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    const warp = obj("warp_west");
    expect(Math.abs(spawn.x - warp.x) + Math.abs(spawn.y - warp.y)).toBe(1);
    const g = grid.slice();
    g[at(trig.x, trig.y)] = 1;
    const area = reachableTiles(map, g, indexWithout(new Set()), spawn);
    expect(touches(area, obj("rune_L3-1"))).toBe(false);
    expect(touches(area, obj("m_P0301"))).toBe(false);
  });

  it("the boss intro trigger is two tiles in front of the boss and cannot be bypassed", () => {
    const boss = obj("m_P0311");
    const trig = obj("t_boss_intro");
    expect(Math.abs(boss.x - trig.x) + Math.abs(boss.y - trig.y)).toBe(2);
    const g = grid.slice();
    g[at(trig.x, trig.y)] = 1;
    const area = reachableTiles(map, g, indexWithout(removedUntil("m_P0311")), obj("spawn_west"));
    expect(touches(area, boss)).toBe(false);
  });

  it("the shadow board stands by the storeroom campfire, past the storeroom chokepoint", () => {
    const board = obj("board_shadow_r03");
    const fire = obj("campfire_storeroom");
    expect(Math.abs(board.x - fire.x) + Math.abs(board.y - fire.y)).toBeLessThanOrEqual(3);
    const before = reachableTiles(map, grid, indexWithout(new Set(["m_P0301", "m_P0302", "m_P0304"])), obj("spawn_west"));
    expect(touches(before, board)).toBe(false);
    expect(touches(before, fire)).toBe(false);
    // 게시판·캠프파이어는 창고 안쪽(길목 m_P0306 동쪽)에 있다
    expect(board.x).toBeGreaterThan(obj("m_P0306").x);
    expect(fire.x).toBeLessThan(obj("m_P0307").x);
  });

  it("the hidden pool passage is reachable only through the cave crack between the two frozen torches", () => {
    const c = crack();
    expect(grid[at(c.x, c.y)]).toBe(0);
    // 벽 줄 가운데의 남북 틈: 동서는 벽, 남북은 열린 칸
    expect(grid[at(c.x - 1, c.y)]).toBe(1);
    expect(grid[at(c.x + 1, c.y)]).toBe(1);
    expect(grid[at(c.x, c.y - 1)]).toBe(0);
    expect(grid[at(c.x, c.y + 1)]).toBe(0);
    // 귀띔: 같은 벽 줄의 두 얼어붙은 횃불 한가운데, 웅덩이 바로 북쪽
    const torches = [];
    for (let x = obj("m_P0307").x + 1; x < obj("m_P0308").x; x++) {
      if (map.ground[at(x, c.y)] === tileIndex("torch_frozen")) torches.push(x);
    }
    expect(torches).toHaveLength(2);
    expect(c.x - torches[0]).toBe(torches[1] - c.x);
    expect(map.ground[at(c.x, c.y + 2)]).toBe(tileIndex("cave_pool"));
    expect(c.x).toBeGreaterThan(obj("m_P0307").x);
    expect(c.x).toBeLessThan(obj("m_P0308").x);

    const removed = removedUntil("chest_hidden_pool");
    const open = reachableTiles(map, grid, indexWithout(removed), obj("spawn_west"));
    expect(open.has(at(c.x, c.y))).toBe(true);
    const g = grid.slice();
    g[at(c.x, c.y)] = 1;
    const closed = reachableTiles(map, g, indexWithout(removed), obj("spawn_west"));
    expect(touches(closed, obj("chest_hidden_pool"))).toBe(false);
    expect(touches(closed, obj("m_P0309"))).toBe(false);
    // 그 밖의 웅덩이 구역은 틈 없이도 그대로 닿는다
    expect(touches(closed, obj("rune_L3-4"))).toBe(true);
    expect(touches(closed, obj("m_P0308"))).toBe(true);
  });
});
