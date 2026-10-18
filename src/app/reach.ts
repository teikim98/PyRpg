// 지금 위치에서 걸어서 닿는가(연습 상대 탐색 ②, design.md §6.2, 단위 3-E3). Phaser 없이 맵 데이터만 본다(단위 테스트 대상).
// 걷는 규칙은 src/app/travel.ts의 walkableFn과 같다(타일 충돌 + 막는 오브젝트, 치운 오브젝트는 지나감).
// 숨겨진 길도 걸을 수 있는 칸이므로 여기서는 구별하지 않는다. 연습 몬스터를 숨겨진 길 끝에 두지 않는 것은
// 맵 생성기의 검사(tools/maps/common.py check_practice_placement, 지역 7부터)가 지킨다.
import { manifest } from "../contracts/assets";
import type { Region } from "../contracts/content";
import { DIRS } from "../game/grid";
import { parseTiledMap } from "../game/tiled";
import { walkableFn } from "./travel";

export interface ReachArea {
  width: number;
  /** 닿는 칸(y * width + x) */
  cells: Set<number>;
}

/**
 * from에서 걸어서 닿는 칸. from 칸은 언제나 들어간다(지금 서 있는 칸).
 * 막는 오브젝트(몬스터·비석 등)는 removed에 없으면 지나갈 수 없다. extraBlocked 칸(y * width + x)은 막힌 것으로 본다(검사용)
 */
export function reachableCells(region: Region, removed: ReadonlySet<string>, from: { x: number; y: number }, extraBlocked: ReadonlySet<number> = new Set()): ReachArea {
  const width = parseTiledMap(region.map, Object.keys(manifest.tilesets)).width;
  const walk = walkableFn(region, removed);
  const cells = new Set<number>([from.y * width + from.x]);
  const queue: [number, number][] = [[from.x, from.y]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * width + nx;
      if (cells.has(k) || extraBlocked.has(k) || !walk(nx, ny)) continue;
      cells.add(k);
      queue.push([nx, ny]);
    }
  }
  return { width, cells };
}

/** 오브젝트 칸이나 그 상하좌우 칸에 닿는가(막는 오브젝트는 옆 칸에서 상호작용한다. tools/maps/common.py touches와 같다) */
export function touches(area: ReachArea, at: { x: number; y: number }): boolean {
  if (area.cells.has(at.y * area.width + at.x)) return true;
  // 줄 끝을 넘어 이웃 줄로 새지 않게 x를 맵 폭 안으로 제한한다(y가 범위 밖이면 cells에 없다)
  return Object.values(DIRS).some(([dx, dy]) => {
    const x = at.x + dx;
    return x >= 0 && x < area.width && area.cells.has((at.y + dy) * area.width + x);
  });
}

/** 지금 위치에서 걸어서 닿는 몬스터의 문제 ID(치운 몬스터 제외). 연습 상대 탐색 ②의 canReach가 쓴다 */
export function reachableMonsterProblems(region: Region, removed: ReadonlySet<string>, from: { x: number; y: number }): Set<string> {
  const area = reachableCells(region, removed, from);
  const out = new Set<string>();
  for (const o of parseTiledMap(region.map, Object.keys(manifest.tilesets)).objects) {
    if (o.type !== "monster" || removed.has(o.id) || o.props.problem === undefined) continue;
    if (touches(area, o)) out.add(String(o.props.problem));
  }
  return out;
}
