// dev/world.html용 하네스: 지역 1 맵을 직접 불러 월드만 띄운다.
// window.__world = 컨트롤러, window.__events = 콜백 기록(E2E에서 읽는다).
import mapRaw from "../../content/regions/r01-echo-village/map.tmj?raw";
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

export function buildHarnessRegion(): Region {
  const map = JSON.parse(mapRaw) as Record<string, unknown>;
  const problems = Object.entries(ENEMY_SPRITES).map(
    ([id, sprite]) => ({ id, regionId: "r01", enemy: { name: id, sprite, attack: 0 } }) as unknown as Problem,
  );
  return { id: "r01", order: 1, name: "에코 마을", map, problems, lessons: [], dialogues: {}, recommended: [] };
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
  const region = buildHarnessRegion();
  const spawn = parseTiledMap(region.map).objects.find((o) => o.type === "spawn");
  await world.loadRegion(region, { x: spawn?.x ?? 1, y: spawn?.y ?? 1, facing: "down" }, new Set());
  window.__world = world;
  window.__worldReady = true;
}
