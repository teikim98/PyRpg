import { describe, expect, it } from "vitest";
import { checkRequires, missingScrolls } from "../../src/app/requires";
import { createNewSave } from "../../src/state";

const base = () => createNewSave(new Date("2026-10-01T10:00:00"), { spawn: { x: 1, y: 1 } });

describe("checkRequires", () => {
  it("empty requires is always ok", () => {
    expect(checkRequires(undefined, base())).toEqual({ ok: true, missing: [] });
  });
  it("checks each kind", () => {
    const s = base();
    s.lessonsCompleted.push("L1-1");
    s.problems.P0105 = { attempts: 1, knockouts: 0, solved: true, maxHintLevel: 0, solutionViewed: false };
    s.flags["region.r01.clear"] = true;
    s.scrolls.push("scroll.voice");
    expect(checkRequires("lesson:L1-1, problem:P0105,flag:region.r01.clear,scroll:scroll.voice", s).ok).toBe(true);
    expect(checkRequires("lesson:L1-2,problem:P0101", s).missing).toEqual(["lesson:L1-2", "problem:P0101"]);
  });
  it("rejects unknown kinds", () => {
    expect(() => checkRequires("item:x", base())).toThrow();
  });
  it("missingScrolls", () => {
    const s = base();
    s.scrolls.push("scroll.voice");
    expect(missingScrolls(["scroll.voice", "scroll.convert"], s)).toEqual(["scroll.convert"]);
  });
});
