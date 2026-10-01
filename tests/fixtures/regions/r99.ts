// 지역 간 이동 시험용 작은 지역(r99). 실제 콘텐츠(content/)에는 없고, 단위 테스트와 E2E(?e2e&fixtures)에서만 쓴다.
//   T 나무(막힘)  . 풀  S spawn_west  H t_r99_hello(spawn 바로 옆 once 트리거)  W warp_west(에코 마을로)  C 캠프파이어
import type { Region } from "../../../src/contracts/content";

const ROWS = [
  "TTTTTTTTTT",
  "T........T",
  "TSH......T",
  "T........T",
  "TW......CT",
  "TTTTTTTTTT",
];

const TILE = { grass: 1, tree: 7 }; // overworld 타일셋 gid(firstgid 1)

type Obj = [id: string, type: string, props: Record<string, string | boolean>];
const OBJECTS: Record<string, Obj> = {
  S: ["spawn_west", "spawn", {}],
  H: ["t_r99_hello", "trigger", { dialogue: "r99_hello", once: true }],
  W: ["warp_west", "warp", { openDialogue: "r99_back", target: "r01", targetSpawn: "warp_east" }],
  C: ["campfire_r99", "campfire", {}],
};

function buildMap(): Record<string, unknown> {
  const h = ROWS.length;
  const w = ROWS[0].length;
  const ground: number[] = [];
  const objects: Record<string, unknown>[] = [];
  ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      ground.push(ch === "T" ? TILE.tree : TILE.grass);
      const o = OBJECTS[ch];
      if (!o) return;
      const [name, type, props] = o;
      objects.push({
        id: objects.length + 1,
        name,
        type,
        x: x * 16,
        y: y * 16,
        width: 16,
        height: 16,
        properties: Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === "boolean" ? "bool" : "string", value: v })),
      });
    }),
  );
  return {
    type: "map",
    orientation: "orthogonal",
    infinite: false,
    width: w,
    height: h,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [{ firstgid: 1, name: "overworld", tilecount: 24, columns: 8, tilewidth: 16, tileheight: 16 }],
    layers: [
      { type: "tilelayer", name: "ground", width: w, height: h, data: ground },
      { type: "objectgroup", name: "objects", objects },
    ],
  };
}

export function fixtureRegionR99(): Region {
  return {
    id: "r99",
    order: 99,
    name: "시험의 들판",
    map: buildMap(),
    introDialogue: "r99_intro",
    problems: [],
    lessons: [],
    recommended: [],
    dialogues: {
      r99_intro: [{ speaker: "companion", emotion: "happy", text: "여기는 시험의 들판이야." }],
      r99_hello: [{ speaker: "companion", emotion: "neutral", text: "spawn 옆 트리거야." }],
      r99_back: [{ speaker: "system", text: "에코 마을로 돌아간다." }],
    },
  };
}
