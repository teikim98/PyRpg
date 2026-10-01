// 그리드 이동·충돌·키 입력 해석. Phaser에 의존하지 않는 순수 함수(단위 테스트 대상).
import type { Facing } from "../contracts/state";
import type { MapObjectDef } from "../contracts/world";
import type { ParsedMap } from "./tiled";

export const DIRS: Record<Facing, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** 캐릭터 시트의 방향 순서(assets.ts 규칙): 아래·왼쪽·오른쪽·위 × 2프레임 */
export const FACING_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };

export const OPPOSITE: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

/** 길을 막지 않는 오브젝트 종류 */
export const PASSABLE_OBJECT_TYPES: ReadonlySet<string> = new Set(["trigger", "spawn"]);

export function facingFromDelta(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/**
 * 타일 충돌 격자(1 = 막힘). collision 레이어가 있으면 그것을 따르고(숨겨진 통로처럼 예외를 둘 수 있다),
 * 없으면 ground·deco 타일 이름이 manifest의 blocking에 있는지로 정한다.
 */
export function buildCollisionGrid(map: ParsedMap, tileset: { tiles: string[]; blocking: string[] }): Uint8Array {
  const size = map.width * map.height;
  const grid = new Uint8Array(size);
  if (map.collision) {
    for (let i = 0; i < size; i++) grid[i] = map.collision[i] ? 1 : 0;
    return grid;
  }
  const blocking = new Set(tileset.blocking);
  const isBlocking = (idx: number) => idx >= 0 && blocking.has(tileset.tiles[idx] ?? "");
  for (let i = 0; i < size; i++) grid[i] = isBlocking(map.ground[i]) || isBlocking(map.deco[i]) ? 1 : 0;
  return grid;
}

/** 오브젝트 위치 색인. 제거된 오브젝트는 빼고 넣는다 */
export class ObjectIndex {
  private byTile = new Map<number, MapObjectDef[]>();
  constructor(private width: number) {}

  add(o: MapObjectDef): void {
    const k = o.y * this.width + o.x;
    const list = this.byTile.get(k);
    if (list) list.push(o);
    else this.byTile.set(k, [o]);
  }

  remove(id: string): void {
    for (const [k, list] of this.byTile) {
      const i = list.findIndex((o) => o.id === id);
      if (i >= 0) {
        list.splice(i, 1);
        if (!list.length) this.byTile.delete(k);
        return;
      }
    }
  }

  at(x: number, y: number): MapObjectDef[] {
    return this.byTile.get(y * this.width + x) ?? [];
  }

  /** 그 칸을 막는 오브젝트(trigger·spawn 제외) */
  blockerAt(x: number, y: number): MapObjectDef | undefined {
    return this.at(x, y).find((o) => !PASSABLE_OBJECT_TYPES.has(o.type));
  }

  triggersAt(x: number, y: number): MapObjectDef[] {
    return this.at(x, y).filter((o) => o.type === "trigger");
  }
}

export function inBounds(map: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** (x, y)로 걸어 들어갈 수 있는지(타일 + 오브젝트) */
export function isWalkable(
  map: { width: number; height: number },
  grid: Uint8Array,
  objects: ObjectIndex,
  x: number,
  y: number,
): boolean {
  return inBounds(map, x, y) && !grid[y * map.width + x] && !objects.blockerAt(x, y);
}

/** start에서 걸어서 닿는 칸 집합(인덱스 y*width+x) */
export function reachableTiles(
  map: { width: number; height: number },
  grid: Uint8Array,
  objects: ObjectIndex,
  start: { x: number; y: number },
): Set<number> {
  const seen = new Set<number>([start.y * map.width + start.x]);
  const queue = [[start.x, start.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx;
      const ny = y + dy;
      const k = ny * map.width + nx;
      if (!seen.has(k) && isWalkable(map, grid, objects, nx, ny)) {
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

export type KeyAction = { kind: "move"; dir: Facing } | { kind: "interact" } | { kind: "menu" };

/** 키 → 월드 동작. e.code(배열 기준, 한글 자판에서도 같음)를 먼저 보고 e.key로 보완한다 */
export function keyAction(code: string, key: string): KeyAction | null {
  switch (code) {
    case "ArrowUp":
    case "KeyW":
      return { kind: "move", dir: "up" };
    case "ArrowDown":
    case "KeyS":
      return { kind: "move", dir: "down" };
    case "ArrowLeft":
    case "KeyA":
      return { kind: "move", dir: "left" };
    case "ArrowRight":
    case "KeyD":
      return { kind: "move", dir: "right" };
    case "Space":
    case "Enter":
    case "NumpadEnter":
    case "KeyZ":
      return { kind: "interact" };
    case "Escape":
    case "KeyM":
      return { kind: "menu" };
  }
  switch (key) {
    case "ArrowUp":
      return { kind: "move", dir: "up" };
    case "ArrowDown":
      return { kind: "move", dir: "down" };
    case "ArrowLeft":
      return { kind: "move", dir: "left" };
    case "ArrowRight":
      return { kind: "move", dir: "right" };
    case " ":
    case "Enter":
      return { kind: "interact" };
    case "Escape":
      return { kind: "menu" };
  }
  return null;
}

/** 글자를 입력받는 요소인지(이때 월드는 키에 반응하지도, preventDefault하지도 않는다) */
export function isEditableElement(el: unknown): boolean {
  if (!el || typeof el !== "object") return false;
  const e = el as { tagName?: string; isContentEditable?: boolean; type?: string; readOnly?: boolean };
  if (e.isContentEditable) return true;
  const tag = (e.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const t = (e.type ?? "text").toLowerCase();
    return !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"].includes(t);
  }
  return false;
}

/** 버튼·링크처럼 Space/Enter에 자체 동작이 있는 요소 */
export function isActivatableElement(el: unknown): boolean {
  if (!el || typeof el !== "object") return false;
  const e = el as { tagName?: string; type?: string };
  const tag = (e.tagName ?? "").toUpperCase();
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
  return tag === "INPUT" && ["button", "submit", "reset", "checkbox", "radio"].includes((e.type ?? "").toLowerCase());
}
