// 지역 간 이동(docs/phase3/region02-spec.md §4)의 도착 칸 계산. Phaser 없이 맵 데이터만 본다(단위 테스트 대상).
import { manifest } from "../contracts/assets";
import type { Region } from "../contracts/content";
import type { Facing } from "../contracts/state";
import { DIRS, PASSABLE_OBJECT_TYPES, buildCollisionGrid, inBounds } from "../game/grid";
import { parseTiledMap } from "../game/tiled";

export interface Arrival {
  x: number;
  y: number;
  facing: Facing;
}

/** 지역 맵에서 (x, y)에 설 수 있는지(타일 충돌 + 막는 오브젝트, removed는 제외) */
export function walkableFn(region: Region, removed: ReadonlySet<string>): (x: number, y: number) => boolean {
  const parsed = parseTiledMap(region.map, Object.keys(manifest.tilesets));
  const grid = buildCollisionGrid(parsed, manifest.tilesets[parsed.tileset]);
  const blocked = new Set<number>();
  for (const o of parsed.objects) {
    if (!removed.has(o.id) && !PASSABLE_OBJECT_TYPES.has(o.type)) blocked.add(o.y * parsed.width + o.x);
  }
  return (x, y) => inBounds(parsed, x, y) && !grid[y * parsed.width + x] && !blocked.has(y * parsed.width + x);
}

const ORDER: Facing[] = ["right", "down", "left", "up"];

/**
 * anchorId 오브젝트 옆의 걸을 수 있는 칸과, 오브젝트를 등지는 방향.
 * 등진 방향 앞이 트인 칸(벽을 마주 보지 않는 칸)을 먼저 고른다. 오브젝트가 없거나 옆이 다 막혔으면 null
 */
export function arrivalSpot(region: Region, anchorId: string, removed: ReadonlySet<string>): Arrival | null {
  const anchor = parseTiledMap(region.map, Object.keys(manifest.tilesets)).objects.find((o) => o.id === anchorId);
  if (!anchor) return null;
  const ok = walkableFn(region, removed);
  const candidates = ORDER.map((facing) => {
    const [dx, dy] = DIRS[facing];
    const x = anchor.x + dx;
    const y = anchor.y + dy;
    return { x, y, facing, open: ok(x + dx, y + dy) };
  }).filter((c) => ok(c.x, c.y));
  const best = candidates.find((c) => c.open) ?? candidates[0];
  return best ? { x: best.x, y: best.y, facing: best.facing } : null;
}
