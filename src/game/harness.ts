// dev/world.html용 하네스: 지역 맵을 직접 불러 월드만 띄운다(기본 지역 1, ?map=r02~r07이면 그 지역.
// ?sheet=new·?sheet=old·?tileanim=test·?fx=off·?edges=off는 harnessOptions 참고).
// window.__world = 컨트롤러, window.__events = 콜백 기록(E2E에서 읽는다).
import mapRaw from "../../content/regions/r01-echo-village/map.tmj?raw";
import mapRawR02 from "../../content/regions/r02-crossroad-forest/map.tmj?raw";
import mapRawR03 from "../../content/regions/r03-goblin-cave/map.tmj?raw";
import regionR01 from "../../content/regions/r01-echo-village/region.json";
import regionR02 from "../../content/regions/r02-crossroad-forest/region.json";
import regionR03 from "../../content/regions/r03-goblin-cave/region.json";
import mapRawR04 from "../../content/regions/r04-grand-library/map.tmj?raw";
import mapRawR05 from "../../content/regions/r05-trade-port/map.tmj?raw";
import mapRawR06 from "../../content/regions/r06-mirror-lake/map.tmj?raw";
import regionR04 from "../../content/regions/r04-grand-library/region.json";
import regionR05 from "../../content/regions/r05-trade-port/region.json";
import regionR06 from "../../content/regions/r06-mirror-lake/region.json";
import mapRawR07 from "../../content/regions/r07-hourglass-desert/map.tmj?raw";
import regionR07 from "../../content/regions/r07-hourglass-desert/region.json";
import type { Problem, Region, RegionAmbience } from "../contracts/content";
import type { MapObjectDef, WorldController, WorldOptions } from "../contracts/world";
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

/** 지역 4~7은 problem.json의 enemy.sprite를 그대로 쓴다(그래픽 확인용) */
const PROBLEM_JSON = import.meta.glob<{ id: string; enemy?: { sprite?: string } }>(
  "../../content/regions/r0[4-7]-*/problems/*/problem.json",
  { eager: true, import: "default" },
);
function enemySprites(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, p] of Object.entries(PROBLEM_JSON)) {
    if (path.includes(`/${dir}/`) && p.enemy?.sprite) out[p.id] = p.enemy.sprite;
  }
  return out;
}

type HarnessMap = "r01" | "r02" | "r03" | "r04" | "r05" | "r06" | "r07";
const HARNESS_MAPS: Record<
  HarnessMap,
  { raw: string; sprites: Record<string, string>; name: string; order: number; ambience?: RegionAmbience }
> = {
  r01: { raw: mapRaw, sprites: ENEMY_SPRITES, name: "에코 마을", order: 1, ambience: regionR01.ambience },
  r02: { raw: mapRawR02, sprites: ENEMY_SPRITES_R02, name: "갈림길 숲", order: 2, ambience: regionR02.ambience },
  r03: { raw: mapRawR03, sprites: ENEMY_SPRITES_R03, name: "고블린 동굴", order: 3, ambience: regionR03.ambience },
  r04: { raw: mapRawR04, sprites: enemySprites("r04-grand-library"), name: regionR04.name, order: 4, ambience: regionR04.ambience },
  r05: { raw: mapRawR05, sprites: enemySprites("r05-trade-port"), name: regionR05.name, order: 5, ambience: regionR05.ambience },
  r06: { raw: mapRawR06, sprites: enemySprites("r06-mirror-lake"), name: regionR06.name, order: 6, ambience: regionR06.ambience },
  r07: { raw: mapRawR07, sprites: enemySprites("r07-hourglass-desert"), name: regionR07.name, order: 7, ambience: regionR07.ambience },
};

export function buildHarnessRegion(which: HarnessMap = "r01"): Region {
  const def = HARNESS_MAPS[which];
  const map = JSON.parse(def.raw) as Record<string, unknown>;
  const problems = Object.entries(def.sprites).map(
    ([id, sprite]) => ({ id, regionId: which, enemy: { name: id, sprite, attack: 0 } }) as unknown as Problem,
  );
  const region: Region = { id: which, order: def.order, name: def.name, map, problems, lessons: [], dialogues: {}, recommended: [] };
  if (def.ambience) region.ambience = def.ambience;
  return region;
}

/**
 * URL로 고르는 시험 옵션(E2E·눈으로 확인용)
 * - ?sheet=new: 플레이어·누리·NPC를 코드로 그린 새 형식(16×24, 6×4) 시트로, 몬스터·보스는 4프레임으로
 * - ?sheet=old: 플레이어·누리를 코드로 그린 옛 형식(16×16, 가로 8프레임) 시트로(옛 시트를 읽는지 확인용)
 * - ?tileanim=test: 물 타일을 [water, path] 2프레임(4fps)으로 바꿔 보이게
 * - ?fx=off: 화면 연출을 끈 채로 시작
 * - ?edges=off: 경계 장식(결정 20)을 그리지 않음(전후 비교용)
 */
export function harnessOptions(search: string): WorldOptions {
  const q = new URLSearchParams(search);
  const options: WorldOptions = {};
  if (q.get("sheet") === "new") {
    options.testSheets = [
      "player",
      "nuri",
      "npc_merchant",
      "npc_villager",
      "npc_child",
      ...new Set(Object.values(HARNESS_MAPS).flatMap((m) => Object.values(m.sprites))),
    ];
  }
  if (q.get("sheet") === "old") options.legacySheets = ["player", "nuri"];
  if (q.get("tileanim") === "test") options.tileAnimations = { water: { frames: ["water", "path"], fps: 4 } };
  if (q.get("fx") === "off") options.ambience = false;
  if (q.get("edges") === "off") options.edgeDecor = false;
  return options;
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
  }, harnessOptions(location.search));
  const param = new URLSearchParams(location.search).get("map");
  const region = buildHarnessRegion(param && param in HARNESS_MAPS ? (param as HarnessMap) : "r01");
  const spawn = parseTiledMap(region.map).objects.find((o) => o.type === "spawn");
  world.setCompanionVisible(true);
  await world.loadRegion(region, { x: spawn?.x ?? 1, y: spawn?.y ?? 1, facing: "down" }, new Set());
  window.__world = world;
  window.__worldReady = true;
}
