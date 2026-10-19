// 경계 장식(결정 20, src/game/edgeDecor.ts): dev/world.html 하네스에서 지역 1~6을 그려
// 조각 레이어가 생기는지, 장식을 켜도 충돌(물가에서 멈춤)이 그대로인지 확인하고 전후 화면을 남긴다.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { Facing } from "../../src/contracts/state";

const SCREENS = "docs/art-overhaul/screens";

/** 지역마다 길·풀밭·물가가 함께 보이는 장면(플레이어를 세울 칸)과 반드시 나와야 하는 조각 묶음 */
const SCENES: { map: string; dir: string; at: [number, number]; sets: string[] }[] = [
  { map: "r01", dir: "r01-echo-village", at: [12, 32], sets: ["grass", "shore", "wall"] },
  { map: "r02", dir: "r02-crossroad-forest", at: [63, 14], sets: ["forest", "shore"] },
  { map: "r03", dir: "r03-goblin-cave", at: [60, 7], sets: ["shore_dark", "wall"] },
  { map: "r04", dir: "r04-grand-library", at: [48, 12], sets: ["wall"] },
  { map: "r05", dir: "r05-trade-port", at: [78, 8], sets: ["shore", "deck"] },
  { map: "r06", dir: "r06-mirror-lake", at: [39, 12], sets: ["island", "mist", "shore", "shore_dark"] },
];

async function bootWith(page: Page, query: string): Promise<void> {
  await page.goto(`/dev/world.html${query}`);
  await page.waitForFunction(() => window.__worldReady === true, null, { timeout: 30_000 });
}

async function teleport(page: Page, x: number, y: number, facing: Facing): Promise<void> {
  await page.evaluate(([x, y, f]) => window.__world!.teleport(x, y, f), [x, y, facing] as const);
}

const inspect = (page: Page) => page.evaluate(() => window.__world!.inspect!());
const pos = (page: Page) => page.evaluate(() => window.__world!.getPlayerPosition());

interface TmjLayer {
  name: string;
  data?: number[];
  objects?: { x: number; y: number }[];
}

/** 막히지 않고 오브젝트도 없는 땅 칸 중 바로 아래가 물(막힘)인 첫 칸 */
function cellAboveWater(dir: string): [number, number] {
  const map = JSON.parse(readFileSync(`content/regions/${dir}/map.tmj`, "utf-8")) as {
    width: number;
    height: number;
    layers: TmjLayer[];
    tilesets: { tiles: { id: number; type: string }[] }[];
  };
  const names = new Map(map.tilesets[0].tiles.map((t) => [t.id + 1, t.type]));
  const ground = map.layers.find((l) => l.name === "ground")!.data!;
  const deco = map.layers.find((l) => l.name === "deco")!.data!;
  const collision = map.layers.find((l) => l.name === "collision")!.data!;
  const taken = new Set(
    map.layers.flatMap((l) => l.objects ?? []).map((o) => Math.floor(o.y / 16) * map.width + Math.floor(o.x / 16)),
  );
  const water = new Set(["water", "harbor_water", "lake_water", "cave_pool", "stream"]);
  for (let y = 0; y + 1 < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const below = i + map.width;
      if (collision[i] || deco[i] || taken.has(i) || collision[below] === 0) continue;
      if (water.has(names.get(ground[below]) ?? "")) return [x, y];
    }
  }
  throw new Error(`${dir}: no land cell above water`);
}

test.describe("edge decor (decision 20)", () => {
  for (const s of SCENES) {
    test(`${s.map}: edge pieces are drawn on top of the map, and before/after screens`, async ({ page }) => {
      await bootWith(page, `?map=${s.map}&edges=off`);
      expect((await inspect(page)).edges).toEqual({ layers: 0, cells: 0, pieces: {} });
      const objectsOff = await page.evaluate(() => window.__world!.getObjects());
      await teleport(page, s.at[0], s.at[1], "down");
      await page.waitForTimeout(400);
      await page.locator("#world").screenshot({ path: `${SCREENS}/edges-${s.map}-before.png` });

      await bootWith(page, `?map=${s.map}`);
      const edges = (await inspect(page)).edges;
      expect(edges.layers).toBeGreaterThan(0);
      expect(edges.layers).toBeLessThanOrEqual(6);
      expect(edges.cells).toBeGreaterThan(10);
      const sets = new Set(Object.keys(edges.pieces).map((n) => n.slice(0, n.lastIndexOf("_"))));
      for (const set of s.sets) expect([...sets], s.map).toContain(set);
      // 장식은 오브젝트를 바꾸지 않는다
      expect(await page.evaluate(() => window.__world!.getObjects())).toEqual(objectsOff);
      await teleport(page, s.at[0], s.at[1], "down");
      await page.waitForTimeout(400);
      await page.locator("#world").screenshot({ path: `${SCREENS}/edges-${s.map}-after.png` });
    });
  }

  for (const s of SCENES.filter((x) => x.sets.some((set) => set.startsWith("shore")))) {
    test(`${s.map}: the shore is still blocked with edges on (decoration only)`, async ({ page }) => {
      const [x, y] = cellAboveWater(s.dir);
      await bootWith(page, `?map=${s.map}&fx=off`);
      expect((await inspect(page)).edges.layers).toBeGreaterThan(0);
      await teleport(page, x, y, "down");
      expect(await pos(page)).toMatchObject({ x, y });
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(350);
      expect(await pos(page)).toMatchObject({ x, y });
    });
  }
});
