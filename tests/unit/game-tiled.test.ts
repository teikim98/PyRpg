import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { manifest, tileIndex } from "../../src/contracts/assets";
import { parseObject, parseTiledMap } from "../../src/game/tiled";

const MAP_PATH = resolve(__dirname, "../../content/regions/r01-echo-village/map.tmj");
const loadMap = () => JSON.parse(readFileSync(MAP_PATH, "utf-8")) as Record<string, unknown>;

/** region1-spec.md §4 */
const SPEC: Record<string, { type: string; props: Record<string, string | number | boolean> }> = {
  spawn: { type: "spawn", props: {} },
  t_prologue: { type: "trigger", props: { dialogue: "prologue", once: true, joinCompanion: true } },
  "rune_L1-1": { type: "rune", props: { lesson: "L1-1" } },
  sign_well: { type: "sign", props: { dialogue: "sign_well" } },
  gate_well: { type: "door", props: { requires: "lesson:L1-1", lockedDialogue: "gate_well_locked" } },
  "rune_L1-2": { type: "rune", props: { lesson: "L1-2" } },
  sign_plaza: { type: "sign", props: { dialogue: "sign_plaza" } },
  npc_frozen_merchant: { type: "npc", props: { dialogue: "npc_frozen_merchant", sprite: "npc_merchant" } },
  campfire_plaza: { type: "campfire", props: {} },
  // 단위 3-1 마을 시설(docs/phase3/plan.md §5.2)
  board_shadow: { type: "board", props: {} },
  shop_echo: { type: "shop", props: {} },
  m_P0101: { type: "monster", props: { problem: "P0101" } },
  m_P0106: { type: "monster", props: { problem: "P0106" } },
  m_P0109: { type: "monster", props: { problem: "P0109" } },
  "rune_L1-3": { type: "rune", props: { lesson: "L1-3" } },
  npc_shopkeeper: { type: "npc", props: { dialogue: "npc_shopkeeper", sprite: "npc_villager" } },
  chest_shop: { type: "chest", props: { gold: 30, dialogue: "chest_shop" } },
  m_P0102: { type: "monster", props: { problem: "P0102" } },
  m_P0103: { type: "monster", props: { problem: "P0103" } },
  m_P0108: { type: "monster", props: { problem: "P0108" } },
  "rune_L1-4": { type: "rune", props: { lesson: "L1-4" } },
  sign_alley_riddle: { type: "sign", props: { dialogue: "sign_alley_riddle" } },
  npc_echo_child: { type: "npc", props: { dialogue: "npc_echo_child", sprite: "npc_child" } },
  campfire_alley: { type: "campfire", props: {} },
  m_P0104: { type: "monster", props: { problem: "P0104" } },
  m_P0107: { type: "monster", props: { problem: "P0107" } },
  chest_hidden: { type: "chest", props: { gold: 50, dialogue: "chest_hidden" } },
  m_P0110: { type: "monster", props: { problem: "P0110" } },
  t_boss_intro: { type: "trigger", props: { dialogue: "boss_intro", once: true } },
  m_P0105: { type: "monster", props: { problem: "P0105" } },
  warp_east: {
    type: "warp",
    props: {
      lockedDialogue: "east_gate_locked",
      requires: "problem:P0105",
      openDialogue: "to_be_continued",
      target: "r02",
      targetSpawn: "spawn_west",
    },
  },
};

describe("parseTiledMap on the region-1 map", () => {
  const parsed = parseTiledMap(loadMap());

  it("reads size, tileset and layers", () => {
    expect(parsed.width).toBeGreaterThanOrEqual(40);
    expect(parsed.width).toBeLessThanOrEqual(60);
    expect(parsed.height).toBeGreaterThanOrEqual(30);
    expect(parsed.height).toBeLessThanOrEqual(45);
    expect(parsed.tileset).toBe("overworld");
    expect(parsed.ground).toHaveLength(parsed.width * parsed.height);
    expect(parsed.deco).toHaveLength(parsed.width * parsed.height);
    expect(parsed.collision).toHaveLength(parsed.width * parsed.height);
    const n = manifest.tilesets.overworld.tiles.length;
    for (const v of [...parsed.ground, ...parsed.deco]) expect(v >= -1 && v < n).toBe(true);
    // 바닥은 빈칸이 없다
    expect(parsed.ground.every((v) => v >= 0)).toBe(true);
  });

  it("has exactly the region1-spec §4 objects with their props", () => {
    const byId = Object.fromEntries(parsed.objects.map((o) => [o.id, o]));
    expect(Object.keys(byId).sort()).toEqual(Object.keys(SPEC).sort());
    for (const [id, spec] of Object.entries(SPEC)) {
      expect(byId[id].type, id).toBe(spec.type);
      expect(byId[id].props, id).toEqual(spec.props);
    }
  });

  it("puts objects on tiles inside the map", () => {
    for (const o of parsed.objects) {
      expect(o.x >= 0 && o.y >= 0 && o.x < parsed.width && o.y < parsed.height, o.id).toBe(true);
    }
  });

  it("draws the hidden-room entrance as a bush that the riddle points to", () => {
    const sign = parsed.objects.find((o) => o.id === "sign_alley_riddle")!;
    const x = sign.x + "serpent".length;
    const y = sign.y - 2 ** 2;
    const i = y * parsed.width + x;
    expect(parsed.deco[i]).toBe(tileIndex("bush"));
    expect(parsed.collision![i]).toBe(0);
  });
});

describe("parseTiledMap edge cases", () => {
  const base = {
    width: 2,
    height: 1,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [
      { firstgid: 1, name: "overworld", tilecount: 24 },
      { firstgid: 25, name: "other", tilecount: 10 },
    ],
  };

  it("strips flip flags, maps gids to manifest indices and ignores foreign tilesets", () => {
    const flipped = (0x80000000 | 3) >>> 0;
    const map = {
      ...base,
      layers: [{ type: "tilelayer", name: "ground", data: [flipped, 26] }],
    };
    const p = parseTiledMap(map);
    expect(p.ground).toEqual([2, -1]);
    expect(p.deco).toEqual([-1, -1]);
    expect(p.collision).toBeNull();
  });

  it("reads layers inside groups, CSV strings and uncompressed base64", () => {
    const bytes = new Uint8Array(new Uint32Array([5, 0]).buffer);
    const b64 = btoa(String.fromCharCode(...bytes));
    const map = {
      ...base,
      layers: [
        {
          type: "group",
          name: "g",
          layers: [
            { type: "tilelayer", name: "Ground", encoding: "csv", data: "1, 2" },
            { type: "tilelayer", name: "deco", encoding: "base64", data: b64 },
          ],
        },
      ],
    };
    const p = parseTiledMap(map);
    expect(p.ground).toEqual([0, 1]);
    expect(p.deco).toEqual([4, -1]);
  });

  it("rejects compressed layers and infinite maps", () => {
    expect(() =>
      parseTiledMap({ ...base, layers: [{ type: "tilelayer", name: "ground", encoding: "base64", compression: "zlib", data: "AA==" }] }),
    ).toThrow(/compressed/);
    expect(() => parseTiledMap({ ...base, infinite: true, layers: [] })).toThrow(/infinite/);
  });

  it("rejects duplicate object ids", () => {
    const obj = { name: "a", type: "sign", x: 0, y: 0, width: 16, height: 16 };
    expect(() => parseTiledMap({ ...base, layers: [{ type: "objectgroup", name: "objects", objects: [obj, obj] }] })).toThrow(
      /duplicate/,
    );
  });
});

describe("parseObject", () => {
  it("converts a rectangle object to tile coordinates and typed props", () => {
    const o = parseObject({
      name: "m_P0101",
      type: "monster",
      x: 176,
      y: 160,
      width: 16,
      height: 16,
      properties: [
        { name: "problem", type: "string", value: "P0101" },
        { name: "once", type: "bool", value: true },
        { name: "gold", type: "int", value: 30 },
      ],
    });
    expect(o).toEqual({ id: "m_P0101", type: "monster", x: 11, y: 10, props: { problem: "P0101", once: true, gold: 30 } });
  });

  it("accepts Tiled 1.9 `class`, point objects and tile objects (bottom-anchored)", () => {
    expect(parseObject({ name: "s", class: "sign", x: 40, y: 40, point: true })).toMatchObject({ type: "sign", x: 2, y: 2 });
    expect(parseObject({ name: "c", type: "chest", gid: 5, x: 32, y: 64, width: 16, height: 16 })).toMatchObject({ x: 2, y: 3 });
  });

  it("skips unknown object types", () => {
    expect(parseObject({ name: "x", type: "lava", x: 0, y: 0 })).toBeNull();
    expect(parseObject({ name: "x", x: 0, y: 0 })).toBeNull();
  });
});
