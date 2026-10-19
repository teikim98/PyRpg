// 지역 분위기(src/game/ambience.ts, region.json의 ambience): docs/art-overhaul/plan.md §3
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildContent, collectSources, loadContent } from "../../src/content/loader";
import {
  DEFAULT_GRADE,
  GRADE_NAMES,
  GRADE_PRESETS,
  PARTICLE_KINDS,
  PARTICLE_SPECS,
  WRAP_MARGIN,
  applyMatrix,
  gradeMatrix,
  particleCount,
  particleDisplay,
  resolveAmbience,
  spawnParticles,
  stepParticle,
} from "../../src/game/ambience";

describe("resolveAmbience", () => {
  it("uses the defaults when missing and keeps known names", () => {
    expect(resolveAmbience(undefined)).toEqual({ grade: DEFAULT_GRADE, particles: "none" });
    expect(resolveAmbience({})).toEqual({ grade: "dusty_teal", particles: "none" });
    expect(resolveAmbience({ grade: "cave", particles: "dust" })).toEqual({ grade: "cave", particles: "dust" });
    expect(resolveAmbience({ particles: "mist" })).toEqual({ grade: "dusty_teal", particles: "mist" });
  });

  it("falls back on unknown names and says why", () => {
    const problems: string[] = [];
    expect(resolveAmbience({ grade: "neon", particles: "snow" }, problems)).toEqual({ grade: "dusty_teal", particles: "none" });
    expect(problems).toHaveLength(2);
  });

  it("tools/verify_content.py checks the same names", () => {
    const py = readFileSync("tools/verify_content.py", "utf8");
    const list = (name: string) => JSON.parse(new RegExp(`^${name} = (\\[.*\\])$`, "m").exec(py)![1].replace(/'/g, '"'));
    expect(list("AMBIENCE_GRADES")).toEqual([...GRADE_NAMES]);
    expect(list("AMBIENCE_PARTICLES")).toEqual([...PARTICLE_KINDS]);
  });
});

describe("region.json ambience", () => {
  it("every region has a valid ambience that the loader passes through", () => {
    const regions = loadContent().regions;
    expect(regions.length).toBeGreaterThanOrEqual(6);
    for (const r of regions) {
      const problems: string[] = [];
      expect(r.ambience, r.id).toBeDefined();
      resolveAmbience(r.ambience, problems);
      expect(problems, r.id).toEqual([]);
    }
    expect(regions.find((r) => r.id === "r01")!.ambience).toEqual({ grade: "dusty_teal", particles: "sparkle" });
  });

  it("the loader rejects a non-object ambience", () => {
    const src = collectSources();
    const json = { ...src.json };
    const key = Object.keys(json).find((k) => k.endsWith("r01-echo-village/region.json"))!;
    json[key] = { ...(json[key] as object), ambience: "sparkle" };
    expect(() => buildContent({ json, text: src.text })).toThrow(/ambience/);
  });
});

describe("color grade", () => {
  it("a neutral preset is the identity", () => {
    const m = gradeMatrix({ saturation: 0, contrast: 0, brightness: 1, tint: [1, 1, 1], lift: [0, 0, 0], vignette: { radius: 1, strength: 0, color: 0 } });
    expect(applyMatrix(m, [10, 128, 250]).map((v) => Math.round(v))).toEqual([10, 128, 250]);
  });

  it("every preset is gentle: colors move a little, nothing clips to black or white", () => {
    for (const name of GRADE_NAMES) {
      const m = gradeMatrix(GRADE_PRESETS[name]);
      for (const rgb of [
        [128, 128, 128],
        [106, 168, 79], // 풀
        [210, 180, 140], // 길
        [61, 133, 198], // 주인공 옷
      ] as [number, number, number][]) {
        const out = applyMatrix(m, rgb);
        out.forEach((v, i) => expect(Math.abs(v - rgb[i]), `${name} ${rgb}`).toBeLessThan(40));
      }
      const white = applyMatrix(m, [255, 255, 255]);
      const black = applyMatrix(m, [0, 0, 0]);
      expect(Math.min(...white), name).toBeGreaterThan(215);
      expect(Math.max(...black), name).toBeLessThan(40);
      // 비네트 반지름은 화면 모서리(0.71)보다 커야 모서리가 끊기지 않는다
      expect(GRADE_PRESETS[name].vignette.radius).toBeGreaterThan(0.72);
    }
  });

  it("dusty_teal lowers saturation and leans gray toward teal", () => {
    const m = gradeMatrix(GRADE_PRESETS.dusty_teal);
    const [r, g, b] = applyMatrix(m, [128, 128, 128]);
    expect(b).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
    const sat = ([x, y, z]: number[]) => Math.max(x, y, z) - Math.min(x, y, z);
    expect(sat(applyMatrix(m, [200, 60, 60]))).toBeLessThan(sat([200, 60, 60]));
  });
});

describe("floating particles", () => {
  const view = { x: 100, y: 50, width: 320, height: 180 };

  it("spawns a deterministic, capped number inside the view", () => {
    for (const kind of PARTICLE_KINDS) {
      if (kind === "none") continue;
      const spec = PARTICLE_SPECS[kind];
      const a = spawnParticles(spec, view, 42);
      expect(a).toEqual(spawnParticles(spec, view, 42));
      expect(a.length).toBe(particleCount(spec, view));
      expect(a.length).toBeLessThanOrEqual(spec.max);
      expect(particleCount(spec, { width: 4000, height: 4000 })).toBe(spec.max);
      for (const p of a) {
        expect(p.x).toBeGreaterThanOrEqual(view.x);
        expect(p.x).toBeLessThan(view.x + view.width);
        // 멈춘 세계: 아주 느리다(초당 8px 미만)
        expect(Math.hypot(p.vx, p.vy)).toBeLessThan(8);
      }
    }
  });

  it("wraps particles that drift out of the view (plus margin) to the other side", () => {
    const p = spawnParticles(PARTICLE_SPECS.leaves, view, 1)[0];
    p.x = view.x + view.width + WRAP_MARGIN + 3;
    p.y = view.y - WRAP_MARGIN - 2;
    stepParticle(p, 0, view);
    expect(p.x).toBeCloseTo(view.x - WRAP_MARGIN + 3);
    expect(p.y).toBeGreaterThan(view.y + view.height);
    // 카메라가 멀리 이동해도 바로 화면 안으로 들어온다
    stepParticle(p, 16, { ...view, x: 5000 });
    expect(p.x).toBeGreaterThanOrEqual(5000 - WRAP_MARGIN);
    expect(p.x).toBeLessThan(5000 + view.width + WRAP_MARGIN);
  });

  it("sparkles twinkle by changing shape (hidden → dot → plus → star)", () => {
    const spec = PARTICLE_SPECS.sparkle;
    const p = spawnParticles(spec, view, 7)[0];
    const shapes = new Set(Array.from({ length: 400 }, (_, i) => particleDisplay(p, spec, i * 20).shape));
    expect(shapes).toEqual(new Set([null, "dot", "plus", "star"]));
    // 다른 입자는 모양이 그대로이고 투명도만 바뀐다
    const d = spawnParticles(PARTICLE_SPECS.dust, view, 7)[0];
    const alphas = new Set(Array.from({ length: 100 }, (_, i) => particleDisplay(d, PARTICLE_SPECS.dust, i * 100).alpha.toFixed(2)));
    expect(alphas.size).toBeGreaterThan(5);
    expect(particleDisplay(d, PARTICLE_SPECS.dust, 0).shape).toBe("dot");
  });
});
