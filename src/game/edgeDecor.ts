// 경계 장식(결정 20, docs/art-overhaul/style-guide.md §4.2). Phaser에 의존하지 않는 순수 코드(단위 테스트 대상).
//
// 타일 한 칸은 이웃을 모르므로 '풀 덤불이 길로 넘어옴'·'물가'는 타일 그림만으로 그릴 수 없다.
// 맵을 그릴 때 ground 레이어의 칸마다 이웃 칸의 분류(manifest edgeDecor.terrain)를 보고 얹을 조각을 고른다.
// - 규칙 { from, onto, pieces }: 이 칸이 onto 분류이고 n·s·w·e 이웃이 from 분류면 `${pieces}_${방향}` 조각.
// - 대각선(nw·ne·sw·se)은 그 대각선 이웃만 from이고 양옆 두 칸(예: nw면 n과 w)은 from이 아닐 때만(안쪽 모서리).
// - 시트에 없는 방향 조각은 건너뛴다(예: 그늘 묶음은 n만 있음). 맵 밖은 이웃이 없는 것으로 본다.
// 결과는 겹쳐 그릴 레이어 목록이다(한 칸에 조각이 여러 개면 여러 레이어에 나눠 담는다). 맵 데이터는 읽기만 한다.
import type { EdgeDecorDef, EdgeDir } from "../contracts/assets";

/** 한 규칙 안에서 조각을 그리는 순서(뒤가 위) */
export const EDGE_DIRS: readonly EdgeDir[] = ["n", "s", "w", "e", "nw", "ne", "sw", "se"];

const OFFSET: Record<EdgeDir, readonly [number, number]> = {
  n: [0, -1],
  s: [0, 1],
  w: [-1, 0],
  e: [1, 0],
  nw: [-1, -1],
  ne: [1, -1],
  sw: [-1, 1],
  se: [1, 1],
};

/** 대각선 방향을 이루는 두 옆 방향 */
const DIAGONAL_SIDES: Partial<Record<EdgeDir, readonly [EdgeDir, EdgeDir]>> = {
  nw: ["n", "w"],
  ne: ["n", "e"],
  sw: ["s", "w"],
  se: ["s", "e"],
};

export interface ResolvedEdgeRule {
  from: ReadonlySet<string>;
  onto: ReadonlySet<string>;
  /** 방향 → 조각 시트 인덱스(시트에 있는 방향만) */
  pieces: Partial<Record<EdgeDir, number>>;
}

export interface ResolvedEdgeDecor {
  /** 타일셋 인덱스 → 분류(관여하지 않는 타일은 null) */
  classOf: readonly (string | null)[];
  rules: readonly ResolvedEdgeRule[];
  /** 조각 시트 인덱스 → 이름 */
  pieceNames: readonly string[];
}

/**
 * manifest 정의를 타일셋 인덱스로 바꾼다. 타일셋에 없는 타일 이름, 어느 타일도 갖지 않는 분류,
 * 조각이 하나도 없는 묶음은 problems에 남긴다(그 항목만 빼고 계속 쓴다). 정의가 없으면 null.
 */
export function resolveEdgeDecor(
  def: EdgeDecorDef | undefined,
  tiles: readonly string[],
  problems: string[] = [],
): ResolvedEdgeDecor | null {
  if (!def) return null;
  const terrain = def.terrain ?? {};
  for (const name of Object.keys(terrain)) if (!tiles.includes(name)) problems.push(`terrain: 타일셋에 없는 타일 ${name}`);
  const classes = new Set(Object.values(terrain));
  const pieceNames = Array.isArray(def.pieces) ? def.pieces : [];
  const rules: ResolvedEdgeRule[] = [];
  (def.rules ?? []).forEach((r, i) => {
    for (const cls of [...(r.from ?? []), ...(r.onto ?? [])]) {
      if (!classes.has(cls)) problems.push(`rules[${i}]: 어느 타일도 갖지 않는 분류 ${cls}`);
    }
    const pieces: Partial<Record<EdgeDir, number>> = {};
    for (const d of EDGE_DIRS) {
      const idx = pieceNames.indexOf(`${r.pieces}_${d}`);
      if (idx >= 0) pieces[d] = idx;
    }
    if (!Object.keys(pieces).length) {
      problems.push(`rules[${i}]: 조각 묶음 ${r.pieces}의 조각이 시트에 없음`);
      return;
    }
    rules.push({ from: new Set(r.from ?? []), onto: new Set(r.onto ?? []), pieces });
  });
  const classOf = tiles.map((t) => (Object.prototype.hasOwnProperty.call(terrain, t) ? terrain[t] : null));
  return { classOf, rules, pieceNames };
}

/** (x, y) 칸 하나에 얹을 조각 인덱스(그리는 순서대로) */
export function edgePiecesAt(
  ground: readonly number[],
  width: number,
  height: number,
  decor: ResolvedEdgeDecor,
  x: number,
  y: number,
): number[] {
  const classAt = (cx: number, cy: number): string | null => {
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return null;
    const t = ground[cy * width + cx];
    return t >= 0 ? (decor.classOf[t] ?? null) : null;
  };
  const own = classAt(x, y);
  if (own === null) return [];
  const out: number[] = [];
  for (const rule of decor.rules) {
    if (!rule.onto.has(own)) continue;
    const from = (d: EdgeDir): boolean => {
      const cls = classAt(x + OFFSET[d][0], y + OFFSET[d][1]);
      return cls !== null && rule.from.has(cls);
    };
    for (const d of EDGE_DIRS) {
      const piece = rule.pieces[d];
      if (piece === undefined || !from(d)) continue;
      const sides = DIAGONAL_SIDES[d];
      if (sides && (from(sides[0]) || from(sides[1]))) continue;
      out.push(piece);
    }
  }
  return out;
}

/**
 * 맵 전체의 경계 장식 레이어. layers[k][i] = k번째로 겹칠 조각 인덱스(없으면 -1).
 * 레이어 수 = 한 칸에 얹히는 조각 수의 최댓값(조각이 없으면 빈 배열).
 */
export function computeEdgeLayers(
  ground: readonly number[],
  width: number,
  height: number,
  decor: ResolvedEdgeDecor,
): number[][] {
  const layers: number[][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pieces = edgePiecesAt(ground, width, height, decor, x, y);
      pieces.forEach((p, k) => {
        if (!layers[k]) layers[k] = new Array<number>(width * height).fill(-1);
        layers[k][y * width + x] = p;
      });
    }
  }
  return layers;
}

/** 조각 이름별로 얹힌 칸 수(검사·디버그용) */
export function countEdgePieces(layers: readonly (readonly number[])[], pieceNames: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const layer of layers) {
    for (const p of layer) {
      if (p < 0) continue;
      const name = pieceNames[p] ?? String(p);
      out[name] = (out[name] ?? 0) + 1;
    }
  }
  return out;
}
