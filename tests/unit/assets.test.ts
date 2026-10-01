import { describe, expect, it } from "vitest";
import { manifest, tileIndex } from "../../src/contracts/assets";

describe("asset manifest", () => {
  it("maps tile names to indices", () => {
    expect(tileIndex("grass")).toBe(0);
    expect(tileIndex("path")).toBe(2);
    expect(() => tileIndex("lava")).toThrow();
  });
  it("blocking tiles exist in the tileset", () => {
    const ts = manifest.tilesets.overworld;
    for (const b of ts.blocking) expect(ts.tiles).toContain(b);
  });
});
