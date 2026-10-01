import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { manifest, tileIndex } from "../../src/contracts/assets";
import type { MapObjectDef } from "../../src/contracts/world";
import {
  ObjectIndex,
  buildCollisionGrid,
  facingFromDelta,
  isActivatableElement,
  isEditableElement,
  isWalkable,
  keyAction,
  reachableTiles,
} from "../../src/game/grid";
import { parseTiledMap } from "../../src/game/tiled";
import { computeViewport } from "../../src/game/viewport";

const ts = manifest.tilesets.overworld;
const map = parseTiledMap(
  JSON.parse(readFileSync(resolve(__dirname, "../../content/regions/r01-echo-village/map.tmj"), "utf-8")),
);
const grid = buildCollisionGrid(map, ts);
const objById = new Map(map.objects.map((o) => [o.id, o]));

const get = (id: string): MapObjectDef => {
  const o = objById.get(id);
  if (!o) throw new Error(`missing object ${id}`);
  return o;
};

function indexWithout(removed: Set<string>): ObjectIndex {
  const idx = new ObjectIndex(map.width);
  for (const o of map.objects) if (!removed.has(o.id)) idx.add(o);
  return idx;
}

/** 오브젝트 칸이나 그 이웃 칸에 닿을 수 있는지 */
function touches(area: Set<number>, o: MapObjectDef): boolean {
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => area.has((o.y + dy) * map.width + o.x + dx));
}

describe("collision grid", () => {
  it("uses the collision layer when present (hidden bush is passable)", () => {
    const sign = objById.get("sign_alley_riddle")!;
    const i = (sign.y - 4) * map.width + sign.x + 7;
    expect(map.deco[i]).toBe(tileIndex("bush"));
    expect(grid[i]).toBe(0);
  });

  it("falls back to manifest blocking tiles without a collision layer", () => {
    const g = buildCollisionGrid({ ...map, collision: null }, ts);
    const sign = objById.get("sign_alley_riddle")!;
    expect(g[(sign.y - 4) * map.width + sign.x + 7]).toBe(1);
    // 그 밖에는 collision 레이어와 같다
    let diff = 0;
    for (let i = 0; i < g.length; i++) if (g[i] !== grid[i]) diff++;
    expect(diff).toBe(1);
  });

  it("blocks every tile whose ground or deco is a blocking tile, except the hidden bush", () => {
    const blocking = new Set(ts.blocking.map((n) => tileIndex(n)));
    let exceptions = 0;
    for (let i = 0; i < grid.length; i++) {
      const shouldBlock = blocking.has(map.ground[i]) || blocking.has(map.deco[i]);
      if (shouldBlock !== (grid[i] === 1)) exceptions++;
    }
    expect(exceptions).toBe(1);
  });
});

describe("ObjectIndex", () => {
  it("treats triggers and spawn as passable and everything else as blocking", () => {
    const idx = indexWithout(new Set());
    const spawn = objById.get("spawn")!;
    const trig = objById.get("t_prologue")!;
    const npc = objById.get("npc_frozen_merchant")!;
    expect(idx.blockerAt(spawn.x, spawn.y)).toBeUndefined();
    expect(idx.blockerAt(trig.x, trig.y)).toBeUndefined();
    expect(idx.triggersAt(trig.x, trig.y).map((o) => o.id)).toEqual(["t_prologue"]);
    expect(idx.blockerAt(npc.x, npc.y)?.id).toBe("npc_frozen_merchant");
    expect(isWalkable(map, grid, idx, npc.x, npc.y)).toBe(false);
    idx.remove("npc_frozen_merchant");
    expect(isWalkable(map, grid, idx, npc.x, npc.y)).toBe(true);
  });
});

describe("region-1 progression (zones open in order)", () => {
  const stages: [string | null, string[]][] = [
    [null, ["rune_L1-1", "sign_well", "gate_well", "t_prologue"]],
    ["gate_well", ["rune_L1-2", "sign_plaza", "npc_frozen_merchant", "campfire_plaza", "m_P0109", "m_P0101"]],
    ["m_P0101", ["m_P0106"]],
    ["m_P0106", ["rune_L1-3", "npc_shopkeeper", "chest_shop", "m_P0102"]],
    ["m_P0102", ["m_P0103", "m_P0108"]],
    ["m_P0103", ["rune_L1-4", "sign_alley_riddle", "npc_echo_child", "m_P0104", "chest_hidden", "m_P0110"]],
    ["m_P0104", ["campfire_alley", "m_P0107"]],
    ["m_P0107", ["t_boss_intro", "m_P0105"]],
    ["m_P0105", ["warp_east"]],
  ];

  it("each required monster (or the gate) is the only way into the next zone", () => {
    const removed = new Set<string>();
    const spawn = objById.get("spawn")!;
    stages.forEach(([remove, reachable], k) => {
      if (remove) removed.add(remove);
      const area = reachableTiles(map, grid, indexWithout(removed), spawn);
      for (const id of reachable) expect(touches(area, objById.get(id)!), `${id} after ${remove}`).toBe(true);
      for (const [, later] of stages.slice(k + 1)) {
        for (const id of later) expect(touches(area, objById.get(id)!), `${id} too early after ${remove}`).toBe(false);
      }
    });
    // 선택 몬스터는 한 번도 치우지 않았다
    for (const id of ["m_P0108", "m_P0109", "m_P0110"]) expect(removed.has(id)).toBe(false);
  });

  it("every monster's required region-1 scroll can be learned before reaching it (no need_scroll dead end)", () => {
    const regionDir = resolve(__dirname, "../../content/regions/r01-echo-village");
    const runeOf = new Map<string, string>();
    for (const id of readdirSync(resolve(regionDir, "lessons"))) {
      const l = JSON.parse(readFileSync(resolve(regionDir, "lessons", id, "lesson.json"), "utf-8")) as { id: string; scroll: { id: string } };
      runeOf.set(l.scroll.id, `rune_${l.id}`);
    }
    expect(runeOf.size).toBeGreaterThan(0);
    const removed = new Set<string>();
    let checked = 0;
    for (const [remove, reachable] of stages) {
      if (remove) removed.add(remove);
      for (const id of reachable.filter((r) => get(r).type === "monster")) {
        const before = new Set([...removed].filter((r) => r !== id));
        const area = reachableTiles(map, grid, indexWithout(before), get("spawn"));
        const pid = String(get(id).props.problem);
        const problem = JSON.parse(readFileSync(resolve(regionDir, "problems", pid, "problem.json"), "utf-8")) as {
          requires: string[];
        };
        for (const scroll of problem.requires) {
          const rune = runeOf.get(scroll);
          if (!rune) continue;
          checked++;
          expect(touches(area, get(rune)), `${id} needs ${scroll} (${rune})`).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("the boss intro trigger is two tiles in front of the boss and cannot be bypassed", () => {
    const boss = objById.get("m_P0105")!;
    const trig = objById.get("t_boss_intro")!;
    expect(Math.abs(boss.x - trig.x) + Math.abs(boss.y - trig.y)).toBe(2);
    const removed = new Set(["gate_well", "m_P0101", "m_P0106", "m_P0102", "m_P0103", "m_P0104", "m_P0107"]);
    const g = grid.slice();
    g[trig.y * map.width + trig.x] = 1;
    const area = reachableTiles(map, g, indexWithout(removed), objById.get("spawn")!);
    expect(touches(area, boss)).toBe(false);
  });
});

describe("input helpers", () => {
  it("maps arrows/WASD, interact and menu keys", () => {
    expect(keyAction("ArrowUp", "ArrowUp")).toEqual({ kind: "move", dir: "up" });
    expect(keyAction("KeyA", "ㅁ")).toEqual({ kind: "move", dir: "left" });
    expect(keyAction("KeyS", "s")).toEqual({ kind: "move", dir: "down" });
    expect(keyAction("KeyD", "d")).toEqual({ kind: "move", dir: "right" });
    expect(keyAction("Space", " ")).toEqual({ kind: "interact" });
    expect(keyAction("Enter", "Enter")).toEqual({ kind: "interact" });
    expect(keyAction("KeyZ", "z")).toEqual({ kind: "interact" });
    expect(keyAction("Escape", "Escape")).toEqual({ kind: "menu" });
    expect(keyAction("KeyM", "m")).toEqual({ kind: "menu" });
    expect(keyAction("KeyQ", "q")).toBeNull();
    expect(keyAction("", "ArrowLeft")).toEqual({ kind: "move", dir: "left" });
  });

  it("recognizes editable and activatable elements", () => {
    expect(isEditableElement({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableElement({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isEditableElement({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isEditableElement({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isEditableElement({ tagName: "DIV" })).toBe(false);
    expect(isEditableElement(null)).toBe(false);
    expect(isActivatableElement({ tagName: "BUTTON" })).toBe(true);
    expect(isActivatableElement({ tagName: "CANVAS" })).toBe(false);
  });

  it("derives facing from a delta", () => {
    expect(facingFromDelta(1, 0)).toBe("right");
    expect(facingFromDelta(0, -1)).toBe("up");
    expect(facingFromDelta(0, 0)).toBeNull();
  });
});

describe("computeViewport", () => {
  it("uses the largest integer zoom that fits 320x180 and widens the view with the remainder", () => {
    expect(computeViewport(960, 540)).toEqual({ zoom: 3, width: 320, height: 180 });
    expect(computeViewport(1280, 600)).toEqual({ zoom: 3, width: 426, height: 200 });
    expect(computeViewport(300, 100)).toEqual({ zoom: 1, width: 300, height: 100 });
    expect(computeViewport(0, 0).zoom).toBe(3);
  });
});
