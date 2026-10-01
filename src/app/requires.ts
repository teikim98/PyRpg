// 맵 오브젝트의 requires 조건(docs/phase2/region1-spec.md §1) 판정.
// 형식: "lesson:L1-1", "problem:P0105", "flag:name", "scroll:scroll.voice". 쉼표로 여러 개(모두 만족).
import type { SaveData } from "../contracts/state";

export interface RequireCheck {
  ok: boolean;
  missing: string[];
}

export function checkRequires(requires: string | undefined, save: SaveData): RequireCheck {
  if (!requires) return { ok: true, missing: [] };
  const missing = requires
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((cond) => !isMet(cond, save));
  return { ok: missing.length === 0, missing };
}

function isMet(cond: string, save: SaveData): boolean {
  const i = cond.indexOf(":");
  const kind = i < 0 ? "flag" : cond.slice(0, i);
  const id = i < 0 ? cond : cond.slice(i + 1);
  switch (kind) {
    case "lesson":
      return save.lessonsCompleted.includes(id);
    case "problem":
      return save.problems[id]?.solved === true;
    case "scroll":
      return save.scrolls.includes(id);
    case "flag":
      return save.flags[id] === true;
    default:
      throw new Error(`알 수 없는 requires 조건: ${cond}`);
  }
}

/** 몬스터 전투에 필요한 주문서 중 아직 없는 것 */
export function missingScrolls(requires: string[], save: SaveData): string[] {
  return requires.filter((s) => !save.scrolls.includes(s));
}
