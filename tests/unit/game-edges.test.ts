// 경계 장식(src/game/edgeDecor.ts, 결정 20): 이웃 조합별로 어떤 조각이 나오는지, 실제 manifest·지역 1~6 맵에서
// 의도한 경계에 조각이 얹히고 맵 데이터·충돌은 그대로인지.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { EdgeDecorDef } from "../../src/contracts/assets";
import { manifest } from "../../src/contracts/assets";
import { computeEdgeLayers, countEdgePieces, edgePiecesAt, resolveEdgeDecor } from "../../src/game/edgeDecor";
import { buildCollisionGrid } from "../../src/game/grid";
import { parseTiledMap } from "../../src/game/tiled";

// 작은 시험용 타일셋: 0 grass, 1 path, 2 water, 3 wall, 4 lava(분류 없음), 5 dock
const TILES = ["grass", "path", "water", "wall", "lava", "dock"];
const G = 0;
const P = 1;
const W = 2;
const X = 3;
const L = 4;
const D = 5;
const DIRS = ["n", "s", "w", "e", "nw", "ne", "sw", "se"];
const DEF: EdgeDecorDef = {
  file: "tiles/edges.png",
  columns: 8,
  pieces: [
    ...DIRS.map((d) => `grass_${d}`),
    ...DIRS.map((d) => `shore_${d}`),
    "deck_n",
    "deck_w",
    "wall_n",
  ],
  terrain: { grass: "grass", path: "ground", water: "water", wall: "wall", dock: "deck" },
  rules: [
    { from: ["wall"], onto: ["ground", "grass"], pieces: "wall" },
    { from: ["grass", "ground", "wall"], onto: ["water"], pieces: "shore" },
    { from: ["deck"], onto: ["water"], pieces: "deck" },
    { from: ["grass"], onto: ["ground", "water", "deck"], pieces: "grass" },
  ],
};
const decor = resolveEdgeDecor(DEF, TILES)!;

/** 3×3 격자(행 문자열 배열)의 가운데 칸에 얹히는 조각 이름 */
function center(rows: number[][]): string[] {
  const w = rows[0].length;
  const ground = rows.flat();
  const y = Math.floor(rows.length / 2);
  const x = Math.floor(w / 2);
  return edgePiecesAt(ground, w, rows.length, decor, x, y).map((p) => decor.pieceNames[p]);
}

describe("edge decor: neighbour combinations", () => {
  it("grass above a path hangs over its top edge; grass on a side spills from that side", () => {
    expect(center([[P, G, P], [P, P, P], [P, P, P]])).toEqual(["grass_n"]);
    expect(center([[P, P, P], [P, P, P], [P, G, P]])).toEqual(["grass_s"]);
    expect(center([[P, P, P], [G, P, P], [P, P, P]])).toEqual(["grass_w"]);
    expect(center([[P, P, P], [P, P, G], [P, P, P]])).toEqual(["grass_e"]);
  });

  it("two grass sides give both pieces and no corner; a lone diagonal gives the inner corner", () => {
    expect(center([[G, G, P], [G, P, P], [P, P, P]])).toEqual(["grass_n", "grass_w"]);
    expect(center([[G, P, P], [P, P, P], [P, P, P]])).toEqual(["grass_nw"]);
    expect(center([[P, P, G], [P, P, P], [P, P, G]])).toEqual(["grass_ne", "grass_se"]);
    // 대각선 옆 한 칸이라도 풀이면 모서리 조각은 생략(옆 조각이 이미 덮음)
    expect(center([[G, P, P], [G, P, P], [P, P, P]])).toEqual(["grass_w"]);
  });

  it("a path surrounded by grass gets all four sides in rule order (n, s, w, e)", () => {
    expect(center([[G, G, G], [G, P, G], [G, G, G]])).toEqual(["grass_n", "grass_s", "grass_w", "grass_e"]);
  });

  it("grass itself, unclassified tiles and empty cells get nothing", () => {
    expect(center([[P, P, P], [P, G, P], [P, P, P]])).toEqual([]);
    expect(center([[G, G, G], [G, L, G], [G, G, G]])).toEqual([]);
    expect(center([[G, G, G], [G, -1, G], [G, G, G]])).toEqual([]);
    // 분류가 없는 이웃은 넘어오지 않는다
    expect(center([[L, L, L], [L, P, L], [L, L, L]])).toEqual([]);
  });

  it("water: land on any side gives shore pieces, drawn before the grass overhang", () => {
    expect(center([[W, G, W], [W, W, W], [W, W, W]])).toEqual(["shore_n", "grass_n"]);
    expect(center([[W, P, W], [W, W, W], [W, W, W]])).toEqual(["shore_n"]);
    expect(center([[W, W, W], [X, W, W], [W, W, W]])).toEqual(["shore_w"]);
    expect(center([[W, W, W], [W, W, W], [W, W, P]])).toEqual(["shore_se"]);
    expect(center([[W, W, W], [W, W, W], [W, W, W]])).toEqual([]);
  });

  it("sets without a direction are skipped (deck only casts n and w shadows)", () => {
    expect(center([[W, D, W], [D, W, D], [W, D, W]])).toEqual(["deck_n", "deck_w"]);
    expect(center([[P, P, P], [P, P, P], [P, X, P]])).toEqual([]);
    expect(center([[P, X, P], [P, P, P], [P, P, P]])).toEqual(["wall_n"]);
    expect(center([[G, X, G], [G, G, G], [G, G, G]])).toEqual(["wall_n"]);
  });

  it("the map border counts as no neighbour", () => {
    const names = (ground: number[], w: number, h: number, x: number, y: number) =>
      edgePiecesAt(ground, w, h, decor, x, y).map((p) => decor.pieceNames[p]);
    expect(names([P], 1, 1, 0, 0)).toEqual([]);
    expect(names([W], 1, 1, 0, 0)).toEqual([]);
    // 맨 오른쪽 칸 바깥에 '다음 줄 첫 칸'이 이웃으로 섞이지 않는다
    expect(names([P, P, G, P], 2, 2, 1, 0)).toEqual(["grass_sw"]);
    expect(names([G, P, P, P], 2, 2, 1, 0)).toEqual(["grass_w"]);
    expect(names([P, G, P, P], 2, 2, 0, 1)).toEqual(["grass_ne"]);
  });
});

describe("edge decor: layers", () => {
  it("stacks a cell's pieces over as many layers as the busiest cell needs, without touching the map", () => {
    const ground = [G, G, P, G, P, P, W, W, W];
    const before = [...ground];
    const layers = computeEdgeLayers(ground, 3, 3, decor);
    expect(ground).toEqual(before);
    expect(layers).toHaveLength(2);
    for (const l of layers) expect(l).toHaveLength(9);
    const at = (i: number) => layers.map((l) => l[i]).filter((p) => p >= 0).map((p) => decor.pieceNames[p]);
    expect(at(4)).toEqual(["grass_n", "grass_w"]);
    expect(at(2)).toEqual(["grass_w"]);
    expect(at(6)).toEqual(["shore_n", "grass_n"]);
    expect(at(0)).toEqual([]);
    expect(countEdgePieces(layers, decor.pieceNames)).toMatchObject({ grass_n: 2, grass_w: 2, grass_nw: 2, shore_n: 3 });
  });

  it("no pieces → no layers", () => {
    expect(computeEdgeLayers([P, P, P, P], 2, 2, decor)).toEqual([]);
  });
});

describe("edge decor: definition problems", () => {
  it("reports unknown tiles, classes without tiles and piece sets missing from the sheet", () => {
    const problems: string[] = [];
    const r = resolveEdgeDecor(
      {
        ...DEF,
        terrain: { ...DEF.terrain, magma: "lava" },
        rules: [...DEF.rules, { from: ["sand"], onto: ["ground"], pieces: "sand" }],
      },
      TILES,
      problems,
    );
    expect(problems.some((p) => p.includes("magma"))).toBe(true);
    expect(problems.some((p) => p.includes("sand"))).toBe(true);
    // 쓸 수 없는 규칙만 빼고 나머지는 그대로
    expect(r!.rules).toHaveLength(DEF.rules.length);
    expect(resolveEdgeDecor(undefined, TILES)).toBeNull();
  });
});

// ── 실제 manifest와 지역 1~6 맵 ──
const REGIONS_DIR = resolve(__dirname, "../../content/regions");
const regionDirs = readdirSync(REGIONS_DIR).filter((d) => /^r0[1-6]-/.test(d)).sort();
const ts = manifest.tilesets.overworld;

describe("edge decor: real manifest and regions 1-6", () => {
  it("the manifest definition resolves without problems", () => {
    const problems: string[] = [];
    const real = resolveEdgeDecor(manifest.edgeDecor, ts.tiles, problems);
    expect(problems).toEqual([]);
    expect(real).not.toBeNull();
    // 풀 덤불·물가 묶음이 모두 8방향을 갖는다
    for (const set of ["grass", "forest", "island", "mist", "shore", "shore_dark"]) {
      for (const d of DIRS) expect(manifest.edgeDecor!.pieces).toContain(`${set}_${d}`);
    }
  });

  it("dark water (cave pool, lake) uses the faint shore_dark set; bright water keeps shore; water beside water has none", () => {
    const real = resolveEdgeDecor(manifest.edgeDecor, ts.tiles)!;
    const t = (n: string) => ts.tiles.indexOf(n);
    const at = (row: string[]) =>
      edgePiecesAt(row.map(t), row.length, 1, real, 1, 0).map((p) => real.pieceNames[p]);
    expect(at(["cave_floor", "cave_pool", "cave_pool"])).toEqual(["shore_dark_w"]);
    expect(at(["lake_shore", "lake_water", "lake_water"])).toEqual(["shore_dark_w"]);
    expect(at(["path", "water", "water"])).toEqual(["shore_w"]);
    expect(at(["port_cobble", "harbor_water", "harbor_water"])).toEqual(["shore_w"]);
    expect(at(["mirror_water", "lake_water", "mirror_water"])).toEqual([]);
    expect(at(["lake_water", "mirror_water", "lake_water"])).toEqual([]);
    // 어두운 물에도 풀 덤불·갑판 그늘은 그대로 넘어온다
    expect(at(["island_grass", "lake_water", "lake_water"])).toEqual(["shore_dark_w", "island_w"]);
    expect(at(["lake_bridge", "lake_water", "lake_water"])).toEqual(["deck_w"]);
  });

  /** 지역마다 반드시 나와야 하는 묶음(그 지역에 있는 경계) */
  const EXPECT: Record<string, string[]> = {
    r01: ["grass", "shore", "wall"],
    r02: ["forest", "shore"],
    r03: ["shore_dark", "wall"],
    r04: ["wall"],
    r05: ["shore", "deck", "wall"],
    r06: ["island", "mist", "shore", "shore_dark", "deck"],
  };

  it.each(regionDirs)("%s: pieces land only on onto-classes, the map and collision are unchanged", (dir) => {
    const raw = JSON.parse(readFileSync(resolve(REGIONS_DIR, dir, "map.tmj"), "utf-8")) as Record<string, unknown>;
    const parsed = parseTiledMap(raw);
    const snapshot = JSON.stringify(parsed);
    const gridBefore = buildCollisionGrid(parsed, ts);
    const real = resolveEdgeDecor(manifest.edgeDecor, ts.tiles)!;
    const layers = computeEdgeLayers(parsed.ground, parsed.width, parsed.height, real);
    expect(JSON.stringify(parsed)).toBe(snapshot);
    expect(buildCollisionGrid(parsed, ts)).toEqual(gridBefore);

    const onto = new Set(real.rules.flatMap((r) => [...r.onto]));
    for (const l of layers) {
      l.forEach((p, i) => {
        if (p < 0) return;
        const cls = real.classOf[parsed.ground[i]];
        expect(cls !== null && onto.has(cls), `${dir} cell ${i} (${ts.tiles[parsed.ground[i]]})`).toBe(true);
      });
    }
    const counts = countEdgePieces(layers, real.pieceNames);
    const sets = new Set(Object.keys(counts).map((n) => n.slice(0, n.lastIndexOf("_"))));
    for (const s of EXPECT[dir.slice(0, 3)]) expect([...sets], dir).toContain(s);
    // 겹침은 몇 겹이면 충분하다(레이어 수가 맵 크기에 비례해 늘지 않는다)
    expect(layers.length).toBeLessThanOrEqual(6);
  });
});
