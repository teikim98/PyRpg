// 캐릭터 애니메이션(src/game/charAnim.ts)과 타일 애니메이션(src/game/tileAnim.ts): docs/art-overhaul/plan.md §3
import { describe, expect, it } from "vitest";
import { manifest } from "../../src/contracts/assets";
import {
  BLINK_MS,
  BREATHE_DELAY_MS,
  COL,
  CharacterAnimator,
  WALK_BOB_PX,
  bobFor,
  detectSheetLayout,
  idleColumn,
  sheetFrame,
  walkColumn,
} from "../../src/game/charAnim";
import { overheadTileIndices } from "../../src/game/grid";
import { animatedTileAt, countAnimatedCells, phaserTileData, resolveTileAnimations } from "../../src/game/tileAnim";

const STEP = 135;

/** 연속으로 n걸음 걸으며 걸음마다 앞 절반·뒤 절반에서 본 열 */
function walkCols(anim: CharacterAnimator, steps: number, start = 0): number[] {
  const cols: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t0 = start + i * STEP;
    anim.beginStep("right", t0, STEP);
    cols.push(anim.sample(t0 + 10).col, anim.sample(t0 + STEP - 10).col);
  }
  return cols;
}

describe("character sheet layout", () => {
  it("tells the new 16×24 6×4 sheet from the old 16×16 8-frame sheet", () => {
    expect(detectSheetLayout(16, 24, 24)).toBe("grid6x4");
    expect(detectSheetLayout(16, 16, 8)).toBe("legacy8");
    // 세로로 길어도 프레임이 모자라면(그리다 만 시트) 옛 규칙으로
    expect(detectSheetLayout(16, 24, 8)).toBe("legacy8");
    expect(detectSheetLayout(32, 32, 24)).toBe("legacy8");
  });

  it("maps facing and column to frame numbers (row × 6 + col / legacy row × 2 + step)", () => {
    expect(sheetFrame("grid6x4", 24, "down", COL.stand)).toBe(0);
    expect(sheetFrame("grid6x4", 24, "left", COL.stepLeft)).toBe(7);
    expect(sheetFrame("grid6x4", 24, "right", COL.stepRight)).toBe(15);
    expect(sheetFrame("grid6x4", 24, "up", COL.blink)).toBe(23);
    // 옛 시트: 발 프레임은 걸음, 나머지(서기·숨쉬기·깜빡임)는 서기
    expect(sheetFrame("legacy8", 8, "right", COL.stepLeft)).toBe(5);
    expect(sheetFrame("legacy8", 8, "right", COL.stepRight)).toBe(5);
    for (const c of [COL.stand, COL.pass, COL.breathe, COL.blink]) expect(sheetFrame("legacy8", 8, "up", c)).toBe(6);
    // 프레임이 모자란 시트도 범위를 넘지 않는다
    expect(sheetFrame("legacy8", 2, "up", COL.stepLeft)).toBeLessThan(2);
  });
});

describe("walking", () => {
  it("cycles 1→2→3→0 over two steps and keeps the phase across steps", () => {
    expect([0, 1, 2, 3, 4, 5].map(walkColumn)).toEqual([1, 2, 3, 0, 1, 2]);
    const anim = new CharacterAnimator("down");
    expect(walkCols(anim, 4)).toEqual([1, 2, 3, 0, 1, 2, 3, 0]);
  });

  it("continues with the other foot after a stop", () => {
    const anim = new CharacterAnimator("down");
    expect(walkCols(anim, 1)).toEqual([1, 2]);
    anim.stop(500);
    expect(anim.sample(600).col).toBe(COL.stand);
    expect(walkCols(anim, 1, 2000)).toEqual([3, 0]);
  });

  it("raises the body 1px on the foot frames only", () => {
    expect(bobFor(COL.stepLeft)).toBe(WALK_BOB_PX);
    expect(bobFor(COL.stepRight)).toBe(WALK_BOB_PX);
    expect([COL.stand, COL.pass, COL.breathe, COL.blink].map(bobFor)).toEqual([0, 0, 0, 0]);
    const anim = new CharacterAnimator("down");
    anim.beginStep("left", 0, STEP);
    expect(anim.sample(10)).toEqual({ facing: "left", col: COL.stepLeft, bob: 1 });
    expect(anim.sample(100)).toEqual({ facing: "left", col: COL.pass, bob: 0 });
  });

  it("holds the second frame if the step runs late instead of wrapping", () => {
    const anim = new CharacterAnimator("down");
    anim.beginStep("down", 0, STEP);
    expect(anim.sample(STEP * 3).col).toBe(COL.pass);
  });

  it("companion walks half a beat behind when given the player's step number", () => {
    const player = new CharacterAnimator("down");
    const nuri = new CharacterAnimator("down", 3, 1);
    const p: number[] = [];
    const n: number[] = [];
    for (let i = 0; i < 4; i++) {
      player.beginStep("right", i * STEP, STEP);
      nuri.beginStep("right", i * STEP, STEP, player.stepIndex);
      for (const t of [10, STEP - 10]) {
        p.push(player.sample(i * STEP + t).col);
        n.push(nuri.sample(i * STEP + t).col);
      }
    }
    expect(p).toEqual([1, 2, 3, 0, 1, 2, 3, 0]);
    expect(n).toEqual([2, 3, 0, 1, 2, 3, 0, 1]);
    // 둘이 같은 순간에 같은 프레임을 보이는 일이 없다
    p.forEach((c, i) => expect(c).not.toBe(n[i]));
  });

  it("bumping a wall walks in place without bobbing, and turning stays responsive", () => {
    const anim = new CharacterAnimator("down");
    anim.bump("up", 1000);
    expect(anim.sample(1000)).toEqual({ facing: "up", col: COL.stepLeft, bob: 0 });
    const cols = new Set([1000, 1300, 1500, 1700, 1900].map((t) => anim.sample(t).col));
    expect(cols.size).toBeGreaterThan(1);
    // 같은 방향으로 계속 부딪혀도 시계를 다시 시작하지 않는다
    anim.bump("up", 1500);
    expect(anim.sample(1500).col).not.toBe(COL.stepLeft);
    anim.stop(2000);
    expect(anim.sample(2000)).toEqual({ facing: "up", col: COL.stand, bob: 0 });
  });
});

describe("idle", () => {
  it("stands still at first, breathes after the delay, and blinks briefly now and then", () => {
    const cols = Array.from({ length: 12000 / 10 }, (_, i) => idleColumn(i * 10, 0));
    expect(cols.slice(0, BREATHE_DELAY_MS / 10).every((c) => c === COL.stand || c === COL.blink)).toBe(true);
    expect(cols.slice(0, 50).every((c) => c === COL.stand)).toBe(true);
    expect(cols).toContain(COL.breathe);
    expect(cols).toContain(COL.blink);
    // 깜빡임은 짧고, 12초에 몇 번만
    let runs = 0;
    let longest = 0;
    let run = 0;
    for (const c of cols) {
      if (c === COL.blink) run++;
      else {
        if (run) runs++;
        longest = Math.max(longest, run);
        run = 0;
      }
    }
    expect(longest * 10).toBeLessThanOrEqual(BLINK_MS);
    expect(runs).toBeGreaterThanOrEqual(2);
    expect(runs).toBeLessThanOrEqual(5);
  });

  it("different seeds blink at different times", () => {
    const at = (seed: number) => Array.from({ length: 1000 }, (_, i) => i * 10).filter((t) => idleColumn(t, seed) === COL.blink);
    expect(at(0)).not.toEqual(at(3));
  });

  it("stop keeps the breathing clock when already standing the same way", () => {
    const anim = new CharacterAnimator("down");
    anim.stop(0, "down", true);
    anim.stop(3000, "down");
    expect([...Array(200)].some((_, i) => anim.sample(3000 + i * 10).col === COL.breathe)).toBe(true);
    anim.stop(3000, "left");
    expect(anim.sample(3100).col).toBe(COL.stand);
  });
});

describe("tile animations", () => {
  const tiles = ["grass", "water", "path", "water_a1", "water_a2", "flower", "flower_a1"];

  it("resolves names to tileset indices and skips broken entries", () => {
    const problems: string[] = [];
    const anims = resolveTileAnimations(
      {
        water: { frames: ["water", "water_a1", "water_a2"], fps: 3 },
        flower: { frames: ["flower", "flower_a1"], fps: 2 },
        lava: { frames: ["lava", "lava_a1"], fps: 3 },
        path: { frames: ["path"], fps: 3 },
        grass: { frames: ["grass", "path"], fps: 0 },
      },
      tiles,
      problems,
    );
    expect(anims).toEqual([
      { name: "water", frames: [1, 3, 4], frameMs: 1000 / 3 },
      { name: "flower", frames: [5, 6], frameMs: 500 },
    ]);
    expect(problems).toHaveLength(3);
    expect(resolveTileAnimations(undefined, tiles)).toEqual([]);
  });

  it("builds Phaser tileData keyed by the painted tile and cycles frames by time", () => {
    const data = phaserTileData(resolveTileAnimations({ water: { frames: ["water", "water_a1", "water_a2"], fps: 4 } }, tiles));
    expect(Object.keys(data)).toEqual(["1"]);
    expect(data[1].animationDuration).toBe(750);
    expect(data[1].animation.map((f) => [f.tileid, f.startTime, f.duration])).toEqual([
      [1, 0, 250],
      [3, 250, 250],
      [4, 500, 250],
    ]);
    expect([0, 249, 250, 600, 750, 1000].map((t) => animatedTileAt(data, 1, t))).toEqual([1, 1, 3, 4, 1, 3]);
    // 애니메이션이 없는 타일은 그대로
    expect(animatedTileAt(data, 2, 300)).toBe(2);
    expect(countAnimatedCells([[1, 1, 2, -1], [0, 1]], data)).toBe(3);
  });

  it("the real manifest's tileAnimations (if any) only reference tiles appended to the tileset", () => {
    for (const ts of Object.values(manifest.tilesets)) {
      const problems: string[] = [];
      const anims = resolveTileAnimations(manifest.tileAnimations, ts.tiles, problems);
      expect(problems).toEqual([]);
      for (const a of anims) {
        // 프레임 타일(frames[1..])은 맵에 칠하는 타일보다 뒤(끝에 추가)
        for (const f of a.frames.slice(1)) expect(f).toBeGreaterThan(a.frames[0]);
      }
    }
  });
});

describe("overhead tiles", () => {
  it("defaults to *_roof tiles and honours an explicit list", () => {
    expect([...overheadTileIndices({ tiles: ["grass", "house_roof", "tower_roof", "roof_edge"] })]).toEqual([1, 2]);
    expect([...overheadTileIndices({ tiles: ["grass", "house_roof", "eave"], overhead: ["eave"] })]).toEqual([2]);
    expect(overheadTileIndices(manifest.tilesets.overworld).size).toBeGreaterThan(0);
  });
});
