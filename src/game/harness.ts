// dev/world.html용 하네스: 지역 맵을 직접 불러 월드만 띄운다(기본 지역 1, ?map=r02면 지역 2, ?map=r03이면 지역 3).
// window.__world = 컨트롤러, window.__events = 콜백 기록(E2E에서 읽는다).
import mapRaw from "../../content/regions/r01-echo-village/map.tmj?raw";
import mapRawR02 from "../../content/regions/r02-crossroad-forest/map.tmj?raw";
import mapRawR03 from "../../content/regions/r03-goblin-cave/map.tmj?raw";
import type { Problem, Region } from "../contracts/content";
import type { MapObjectDef, WorldController } from "../contracts/world";
import { createWorld } from "./index";
import { parseTiledMap } from "./tiled";

export type HarnessEvent =
  | { type: "interact"; id: string; objectType: string }
  | { type: "trigger"; id: string }
  | { type: "moved"; x: number; y: number; facing: string }
  | { type: "menu" };

declare global {
  interface Window {
    __world?: WorldController;
    __events?: HarnessEvent[];
    __worldReady?: boolean;
  }
}

/** 콘텐츠 로더 없이 쓰는 몬스터 스프라이트(region1-spec.md §3) */
const ENEMY_SPRITES: Record<string, string> = {
  P0101: "monster_type_slime",
  P0106: "monster_sep_sprite",
  P0109: "monster_type_slime",
  P0102: "monster_remainder_bat",
  P0103: "monster_iron_mole",
  P0108: "monster_clock_beetle",
  P0104: "monster_echo_ghost",
  P0107: "monster_sep_sprite",
  P0110: "monster_clock_beetle",
  P0105: "boss_stair_mimic",
};

/** 지역 2 몬스터 스프라이트(region02-spec.md §3) */
const ENEMY_SPRITES_R02: Record<string, string> = {
  P0201: "monster_fork_sprout",
  P0202: "monster_fork_sprout",
  P0203: "monster_leap_owl",
  P0204: "monster_loop_snake",
  P0205: "monster_count_shroom",
  P0206: "monster_loop_snake",
  P0207: "monster_hail_wisp",
  P0208: "monster_hail_wisp",
  P0209: "monster_acorn_mite",
  P0210: "boss_crossroad_tree",
};

/** 지역 3 몬스터 스프라이트(region03-spec.md §6, 하네스용 배정) */
const ENEMY_SPRITES_R03: Record<string, string> = {
  P0301: "monster_index_goblin",
  P0302: "monster_index_goblin",
  P0303: "monster_index_goblin",
  P0304: "monster_slice_bat",
  P0305: "monster_slice_bat",
  P0306: "monster_stack_crab",
  P0307: "monster_stack_crab",
  P0308: "monster_mirror_slime",
  P0309: "monster_mirror_slime",
  P0310: "monster_grid_golem",
  P0311: "boss_goblin_chief",
};

type HarnessMap = "r01" | "r02" | "r03";
const HARNESS_MAPS: Record<HarnessMap, { raw: string; sprites: Record<string, string>; name: string; order: number }> = {
  r01: { raw: mapRaw, sprites: ENEMY_SPRITES, name: "에코 마을", order: 1 },
  r02: { raw: mapRawR02, sprites: ENEMY_SPRITES_R02, name: "갈림길 숲", order: 2 },
  r03: { raw: mapRawR03, sprites: ENEMY_SPRITES_R03, name: "고블린 동굴", order: 3 },
};

export function buildHarnessRegion(which: HarnessMap = "r01"): Region {
  const def = HARNESS_MAPS[which];
  const map = JSON.parse(def.raw) as Record<string, unknown>;
  const problems = Object.entries(def.sprites).map(
    ([id, sprite]) => ({ id, regionId: which, enemy: { name: id, sprite, attack: 0 } }) as unknown as Problem,
  );
  return { id: which, order: def.order, name: def.name, map, problems, lessons: [], dialogues: {}, recommended: [] };
}

export async function startWorldHarness(): Promise<void> {
  const parent = document.getElementById("world")!;
  const logEl = document.getElementById("log");
  const events: HarnessEvent[] = [];
  window.__events = events;
  const log = (e: HarnessEvent) => {
    events.push(e);
    if (logEl) {
      logEl.textContent = `${JSON.stringify(e)}\n${logEl.textContent ?? ""}`.slice(0, 4000);
    }
  };
  const describe = (o: MapObjectDef) => ({ id: o.id, objectType: o.type });

  const world = await createWorld.create(parent, {
    onInteract: (o) => log({ type: "interact", ...describe(o) }),
    onTrigger: (o) => log({ type: "trigger", id: o.id }),
    onMoved: (p) => log({ type: "moved", ...p }),
    onMenu: () => log({ type: "menu" }),
  });
  const param = new URLSearchParams(location.search).get("map");
  const region = buildHarnessRegion(param === "r02" || param === "r03" ? param : "r01");
  const spawn = parseTiledMap(region.map).objects.find((o) => o.type === "spawn");
  world.setCompanionVisible(true);
  await world.loadRegion(region, { x: spawn?.x ?? 1, y: spawn?.y ?? 1, facing: "down" }, new Set());
  window.__world = world;
  window.__worldReady = true;
}
