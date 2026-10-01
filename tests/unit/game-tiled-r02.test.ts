// 지역 2(갈림길 숲) 맵: docs/phase3/region02-spec.md §4의 오브젝트·속성, 충돌, 구역 진행 순서를
// 엔진의 해석기(parseTiledMap)와 격자·길찾기(buildCollisionGrid, reachableTiles)로 확인한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { manifest, tileIndex } from "../../src/contracts/assets";
import type { MapObjectDef } from "../../src/contracts/world";
import { ObjectIndex, buildCollisionGrid, reachableTiles } from "../../src/game/grid";
import { parseTiledMap } from "../../src/game/tiled";

const MAP_PATH = resolve(__dirname, "../../content/regions/r02-crossroad-forest/map.tmj");
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

/** region02-spec.md §4 */
const SPEC: Record<string, { type: string; props: Record<string, string | number | boolean> }> = {
  spawn_west: { type: "spawn", props: {} },
  warp_west: { type: "warp", props: { target: "r01", targetSpawn: "warp_east" } },
  t_forest_intro: { type: "trigger", props: { dialogue: "forest_intro", once: true } },
  "rune_L2-1": { type: "rune", props: { lesson: "L2-1" } },
  sign_forest: { type: "sign", props: { dialogue: "sign_forest" } },
  campfire_entrance: { type: "campfire", props: {} },
  m_P0201: { type: "monster", props: { problem: "P0201" } },
  m_P0202: { type: "monster", props: { problem: "P0202" } },
  m_P0203: { type: "monster", props: { problem: "P0203" } },
  "rune_L2-2": { type: "rune", props: { lesson: "L2-2" } },
  sign_loop: { type: "sign", props: { dialogue: "sign_loop" } },
  npc_lost_traveler: { type: "npc", props: { dialogue: "npc_lost_traveler", sprite: "npc_traveler" } },
  m_P0204: { type: "monster", props: { problem: "P0204" } },
  m_P0205: { type: "monster", props: { problem: "P0205" } },
  m_P0206: { type: "monster", props: { problem: "P0206" } },
  chest_loop: { type: "chest", props: { gold: 40, dialogue: "chest_loop" } },
  "rune_L2-3": { type: "rune", props: { lesson: "L2-3" } },
  "rune_L2-4": { type: "rune", props: { lesson: "L2-4" } },
  npc_woodcutter: { type: "npc", props: { dialogue: "npc_woodcutter", sprite: "npc_woodcutter" } },
  campfire_stream: { type: "campfire", props: {} },
  // 단위 3-1: 개울 쉼터의 그림자 게시판(docs/phase3/plan.md §5.2)
  board_shadow_r02: { type: "board", props: {} },
  m_P0207: { type: "monster", props: { problem: "P0207" } },
  m_P0208: { type: "monster", props: { problem: "P0208" } },
  chest_hidden_grove: { type: "chest", props: { gold: 60, dialogue: "chest_hidden_grove" } },
  m_P0209: { type: "monster", props: { problem: "P0209" } },
  t_boss_intro: { type: "trigger", props: { dialogue: "boss_intro", once: true } },
  m_P0210: { type: "monster", props: { problem: "P0210" } },
  warp_east: {
    type: "warp",
    props: { requires: "problem:P0210", lockedDialogue: "east_gate_locked", openDialogue: "to_be_continued" },
  },
};

/** 구역(서 → 동)과 그 구역에서 처음 닿는 오브젝트. 앞 구역 출구 몬스터를 치워야 다음 구역이 열린다 */
const STAGES: [string | null, string[]][] = [
  [null, ["warp_west", "t_forest_intro", "rune_L2-1", "sign_forest", "campfire_entrance", "m_P0201"]],
  ["m_P0201", ["m_P0202", "m_P0203"]],
  ["m_P0203", ["rune_L2-2", "sign_loop", "npc_lost_traveler", "m_P0204"]],
  ["m_P0204", ["m_P0205", "chest_loop", "m_P0206"]],
  ["m_P0206", ["rune_L2-3", "npc_woodcutter", "m_P0207", "m_P0208", "chest_hidden_grove"]],
  ["m_P0207", ["rune_L2-4", "campfire_stream", "m_P0209"]],
  ["m_P0209", ["t_boss_intro", "m_P0210"]],
  ["m_P0210", ["warp_east"]],
];
const OPTIONAL = ["m_P0202", "m_P0205", "m_P0208"];

function indexWithout(removed: Set<string>): ObjectIndex {
  const idx = new ObjectIndex(map.width);
  for (const o of map.objects) if (!removed.has(o.id)) idx.add(o);
  return idx;
}

/** 오브젝트 칸이나 그 이웃 칸에 닿을 수 있는지 */
function touches(area: Set<number>, o: MapObjectDef): boolean {
  return [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => area.has((o.y + dy) * map.width + o.x + dx));
}

function removedUntil(id: string): Set<string> {
  const removed = new Set<string>();
  for (const [remove, ids] of STAGES) {
    if (remove) removed.add(remove);
    if (ids.includes(id)) return removed;
  }
  throw new Error(id);
}

/** 숨겨진 길 입구: 줄지어 선 덤불 중 하나뿐인 지나갈 수 있는 덤불(나머지는 막힘) */
const hiddenBush = () => {
  const bushes = map.deco.map((v, i) => (v === tileIndex("bush") && !grid[i] ? i : -1)).filter((i) => i >= 0);
  expect(bushes).toHaveLength(1);
  return { x: bushes[0] % map.width, y: Math.floor(bushes[0] / map.width) };
};

describe("parseTiledMap on the region-2 map", () => {
  it("reads size, tileset and layers", () => {
    expect(map.width).toBeGreaterThanOrEqual(60);
    expect(map.width).toBeLessThanOrEqual(100);
    expect(map.height).toBeGreaterThanOrEqual(20);
    expect(map.height).toBeLessThanOrEqual(45);
    expect(map.tileset).toBe("overworld");
    expect(map.ground).toHaveLength(map.width * map.height);
    expect(map.deco).toHaveLength(map.width * map.height);
    expect(map.collision).toHaveLength(map.width * map.height);
    const n = ts.tiles.length;
    for (const v of [...map.ground, ...map.deco]) expect(v >= -1 && v < n).toBe(true);
    expect(map.ground.every((v) => v >= 0)).toBe(true);
    expect((raw.properties as { name: string; value: unknown }[]).find((p) => p.name === "region")?.value).toBe("r02");
  });

  it("uses the forest tiles appended to the tileset", () => {
    const used = new Set([...map.ground, ...map.deco].filter((v) => v >= 0).map((v) => ts.tiles[v]));
    for (const t of ["forest_floor", "root_floor", "pine_tree", "stream", "stepping_stone", "signpost_fork"]) {
      expect(used.has(t), t).toBe(true);
    }
    // 지역 1 타일 인덱스는 그대로다(새 타일은 끝에만 붙는다)
    expect(tileIndex("dark_floor")).toBe(23);
    expect(tileIndex("forest_floor")).toBe(24);
    expect(tileIndex("root_floor")).toBe(35);
  });

  it("has exactly the region02-spec §4 objects with their props", () => {
    expect(map.objects.map((o) => o.id).sort()).toEqual(Object.keys(SPEC).sort());
    for (const [id, spec] of Object.entries(SPEC)) {
      expect(obj(id).type, id).toBe(spec.type);
      expect(obj(id).props, id).toEqual(spec.props);
    }
  });

  it("puts objects on walkable-looking tiles inside the map", () => {
    for (const o of map.objects) {
      expect(o.x >= 0 && o.y >= 0 && o.x < map.width && o.y < map.height, o.id).toBe(true);
      // 오브젝트 칸에는 막힌 지형이 없다(오브젝트만 길을 막는다)
      expect(grid[o.y * map.width + o.x], o.id).toBe(0);
    }
  });
});

describe("region-2 collision", () => {
  it("blocks every blocking tile except the hidden bush, and the hidden bush is a passable bush", () => {
    const blocking = new Set(ts.blocking.map((n) => tileIndex(n)));
    const exceptions: number[] = [];
    for (let i = 0; i < grid.length; i++) {
      const shouldBlock = blocking.has(map.ground[i]) || blocking.has(map.deco[i]);
      if (shouldBlock !== (grid[i] === 1)) exceptions.push(i);
    }
    const h = hiddenBush();
    expect(exceptions).toEqual([h.y * map.width + h.x]);
    expect(map.deco[h.y * map.width + h.x]).toBe(tileIndex("bush"));
  });

  it("is walled in: only the west warp sits on the map border", () => {
    for (let x = 0; x < map.width; x++) {
      expect(grid[x], `top ${x}`).toBe(1);
      expect(grid[(map.height - 1) * map.width + x], `bottom ${x}`).toBe(1);
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

  it("crosses the frozen stream only on the stepping stones", () => {
    const stone = tileIndex("stepping_stone");
    const stream = tileIndex("stream");
    const stones = map.ground.map((v, i) => (v === stone ? i : -1)).filter((i) => i >= 0);
    expect(stones.length).toBeGreaterThanOrEqual(2);
    for (const i of stones) expect(grid[i]).toBe(0);
    const p207 = obj("m_P0207");
    expect(map.ground[p207.y * map.width + p207.x]).toBe(stone);
    expect(map.ground.some((v) => v === stream)).toBe(true);
  });
});

describe("region-2 progression (zones open west to east)", () => {
  it("each required monster is the only way into the next part of the forest", () => {
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

  it("zone order is west to east", () => {
    const xs = ["spawn_west", "m_P0201", "m_P0203", "m_P0204", "m_P0206", "m_P0207", "m_P0209", "m_P0210", "warp_east"].map(
      (id) => obj(id).x,
    );
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(obj("warp_west").x).toBeLessThanOrEqual(1);
    expect(obj("warp_east").x).toBeGreaterThanOrEqual(map.width - 3);
  });

  it("the forest intro trigger is next to spawn and cannot be bypassed", () => {
    const spawn = obj("spawn_west");
    const trig = obj("t_forest_intro");
    expect(Math.abs(spawn.x - trig.x) + Math.abs(spawn.y - trig.y)).toBe(1);
    const warp = obj("warp_west");
    expect(Math.abs(spawn.x - warp.x) + Math.abs(spawn.y - warp.y)).toBe(1);
    const g = grid.slice();
    g[trig.y * map.width + trig.x] = 1;
    const area = reachableTiles(map, g, indexWithout(new Set()), spawn);
    expect(touches(area, obj("rune_L2-1"))).toBe(false);
    expect(touches(area, obj("m_P0201"))).toBe(false);
  });

  it("the boss intro trigger is two tiles in front of the boss and cannot be bypassed", () => {
    const boss = obj("m_P0210");
    const trig = obj("t_boss_intro");
    expect(Math.abs(boss.x - trig.x) + Math.abs(boss.y - trig.y)).toBe(2);
    const g = grid.slice();
    g[trig.y * map.width + trig.x] = 1;
    const area = reachableTiles(map, g, indexWithout(removedUntil("m_P0210")), obj("spawn_west"));
    expect(touches(area, boss)).toBe(false);
  });

  it("the hidden grove is reachable only through the passable bush on the stream's north stretch", () => {
    const h = hiddenBush();
    // 나무꾼의 귀띔: 개울을 따라 북쪽으로 올라가 개울가 덤불을 지나간다
    const stream = tileIndex("stream");
    const nb = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].map(([dx, dy]) => map.ground[(h.y + dy) * map.width + h.x + dx]);
    expect(nb).toContain(stream);
    // 나무꾼 대사('덤불이 줄지어 있는데, 그중 딱 하나만'): 같은 줄에 막힌 덤불이 이어져 있다
    const left = h.y * map.width + h.x - 1;
    expect(map.deco[left]).toBe(tileIndex("bush"));
    expect(grid[left]).toBe(1);
    expect(map.deco[left - 1]).toBe(tileIndex("bush"));
    expect(h.y).toBeLessThan(obj("npc_woodcutter").y);
    expect(h.y).toBeLessThan(obj("m_P0207").y);
    const removed = removedUntil("chest_hidden_grove");
    const open = reachableTiles(map, grid, indexWithout(removed), obj("spawn_west"));
    expect(open.has(h.y * map.width + h.x)).toBe(true);
    const g = grid.slice();
    g[h.y * map.width + h.x] = 1;
    const closed = reachableTiles(map, g, indexWithout(removed), obj("spawn_west"));
    expect(touches(closed, obj("chest_hidden_grove"))).toBe(false);
    expect(touches(closed, obj("m_P0208"))).toBe(false);
    // 그 밖의 숲 구역은 덤불 없이도 그대로 닿는다
    expect(touches(closed, obj("m_P0207"))).toBe(true);
  });
});
