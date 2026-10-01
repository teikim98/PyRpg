// Tiled JSON(.tmj) 해석. Phaser·DOM에 의존하지 않는 순수 함수(단위 테스트 대상).
// 타일 이미지는 tmj의 image 경로가 아니라 같은 이름의 manifest 타일셋으로 찾는다(design.md §9.8).
import type { TiledMap } from "../contracts/content";
import type { MapObjectDef, MapObjectType } from "../contracts/world";

export const OBJECT_TYPES: readonly MapObjectType[] = [
  "npc",
  "sign",
  "chest",
  "door",
  "monster",
  "campfire",
  "rune",
  "trigger",
  "warp",
  "spawn",
  "board",
  "shop",
];

export interface ParsedMap {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  /** manifest의 타일셋 이름 */
  tileset: string;
  /** 타일셋 인덱스(0부터). 빈칸은 -1 */
  ground: number[];
  deco: number[];
  /** collision 레이어(0이 아니면 막힘). 레이어가 없으면 null */
  collision: number[] | null;
  objects: MapObjectDef[];
}

const FLIP_MASK = 0x1fffffff;

type Json = Record<string, unknown>;

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** 그룹 레이어를 펼쳐서 모든 레이어를 순서대로 돌려준다 */
function flattenLayers(layers: unknown): Json[] {
  const out: Json[] = [];
  if (!Array.isArray(layers)) return out;
  for (const l of layers as Json[]) {
    if (l?.type === "group") out.push(...flattenLayers(l.layers));
    else if (l) out.push(l);
  }
  return out;
}

function decodeData(layer: Json, size: number): number[] {
  const data = layer.data;
  if (Array.isArray(data)) return data.map((v) => num(v, 0));
  if (typeof data === "string") {
    if (layer.encoding === "csv") return data.split(",").map((s) => Number(s.trim()) || 0);
    if (layer.encoding === "base64" && !layer.compression) {
      const bin = atob(data.trim());
      const out: number[] = [];
      for (let i = 0; i + 3 < bin.length; i += 4) {
        out.push(
          (bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16) | (bin.charCodeAt(i + 3) << 24)) >>> 0,
        );
      }
      return out;
    }
    throw new Error(`tile layer "${String(layer.name)}": compressed data is not supported (save as CSV in Tiled)`);
  }
  return new Array<number>(size).fill(0);
}

/**
 * Tiled 맵을 해석한다. knownTilesets에 있는 이름의 타일셋 중 첫 번째를 그리기용 타일셋으로 쓴다.
 * 다른 타일셋의 gid는 빈칸(-1)으로 처리한다.
 */
export function parseTiledMap(map: TiledMap, knownTilesets: readonly string[] = ["overworld"]): ParsedMap {
  const width = num(map.width, 0);
  const height = num(map.height, 0);
  if (width <= 0 || height <= 0) throw new Error("tiled map: width/height missing");
  const tileWidth = num(map.tilewidth, 16);
  const tileHeight = num(map.tileheight, 16);
  if (map.infinite === true) throw new Error("tiled map: infinite maps are not supported");

  const tilesets = (Array.isArray(map.tilesets) ? map.tilesets : []) as Json[];
  const sorted = tilesets
    .map((t) => ({ firstgid: num(t.firstgid, 1), name: str(t.name) ?? "", count: num(t.tilecount, Infinity) }))
    .sort((a, b) => a.firstgid - b.firstgid);
  const main = sorted.find((t) => knownTilesets.includes(t.name)) ?? (sorted.length === 1 ? sorted[0] : undefined);
  const tileset = main && knownTilesets.includes(main.name) ? main.name : knownTilesets[0];
  const firstgid = main?.firstgid ?? 1;
  // 그 다음 타일셋의 firstgid 전까지가 이 타일셋의 범위
  const next = sorted.find((t) => t.firstgid > firstgid);
  const lastgid = Math.min(next ? next.firstgid - 1 : Infinity, firstgid + (main?.count ?? Infinity) - 1);

  const toIndex = (raw: number): number => {
    const gid = raw & FLIP_MASK;
    if (gid === 0 || gid < firstgid || gid > lastgid) return -1;
    return gid - firstgid;
  };

  const size = width * height;
  const layers = flattenLayers(map.layers);
  const tileLayer = (name: string): Json | undefined =>
    layers.find((l) => l.type === "tilelayer" && String(l.name).toLowerCase() === name);

  const readLayer = (name: string): number[] | null => {
    const l = tileLayer(name);
    if (!l) return null;
    const d = decodeData(l, size);
    return Array.from({ length: size }, (_, i) => toIndex(d[i] ?? 0));
  };

  const ground = readLayer("ground") ?? new Array<number>(size).fill(-1);
  const deco = readLayer("deco") ?? new Array<number>(size).fill(-1);
  const collisionLayer = tileLayer("collision");
  const collision = collisionLayer ? decodeData(collisionLayer, size).map((v) => ((v & FLIP_MASK) !== 0 ? 1 : 0)) : null;

  const objects: MapObjectDef[] = [];
  const seen = new Set<string>();
  for (const l of layers) {
    if (l.type !== "objectgroup" || !Array.isArray(l.objects)) continue;
    for (const o of l.objects as Json[]) {
      const def = parseObject(o, tileWidth, tileHeight);
      if (!def) continue;
      if (seen.has(def.id)) throw new Error(`tiled map: duplicate object id "${def.id}"`);
      seen.add(def.id);
      objects.push(def);
    }
  }
  return { width, height, tileWidth, tileHeight, tileset, ground, deco, collision, objects };
}

let objectsCounter = 0;

/** Tiled 오브젝트 하나 → MapObjectDef. 종류를 모르면 null */
export function parseObject(o: Json, tileWidth = 16, tileHeight = 16): MapObjectDef | null {
  const type = (str(o.type) || str(o.class) || "") as MapObjectType;
  if (!OBJECT_TYPES.includes(type)) {
    if (type) console.warn(`tiled map: unknown object type "${type}" (${String(o.name)})`);
    return null;
  }
  const x = num(o.x, 0);
  const y = num(o.y, 0);
  const w = num(o.width, 0);
  const h = num(o.height, 0);
  let tx: number;
  let ty: number;
  if (typeof o.gid === "number") {
    // 타일 오브젝트는 y가 아래쪽 기준
    tx = Math.floor((x + w / 2) / tileWidth);
    ty = Math.floor((y - h / 2) / tileHeight);
  } else {
    tx = Math.floor((x + w / 2) / tileWidth);
    ty = Math.floor((y + h / 2) / tileHeight);
  }
  const props: Record<string, string | number | boolean> = {};
  if (Array.isArray(o.properties)) {
    for (const p of o.properties as Json[]) {
      const name = str(p.name);
      if (!name) continue;
      const v = p.value;
      props[name] = typeof v === "number" || typeof v === "boolean" || typeof v === "string" ? v : String(v);
    }
  }
  const id = str(o.name) || `${type}_${num(o.id, objectsCounter++)}`;
  return { id, type, x: tx, y: ty, props };
}
