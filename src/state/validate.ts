// SaveData 구조 검증. 불러오기·가져오기 때 깨진 데이터가 게임에 들어오지 않게 막는다.
// 모르는 필드도 오류로 본다(버전이 바뀌면 마이그레이션으로 처리).
import type { SaveData } from "../contracts/state";
import { NEVER_DUE } from "../systems/shadows";
import { isDateString } from "../systems/time";

export type ValidationResult = { ok: true; value: SaveData } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

class Checker {
  errors: string[] = [];
  private fail(path: string, msg: string) {
    if (this.errors.length < 50) this.errors.push(`${path}: ${msg}`);
  }

  obj(v: unknown, path: string, keys: { required: string[]; optional?: string[] }): v is Obj {
    if (!isObj(v)) {
      this.fail(path, "객체여야 합니다");
      return false;
    }
    for (const k of keys.required) if (!(k in v)) this.fail(path, `'${k}' 항목이 없습니다`);
    const allowed = new Set([...keys.required, ...(keys.optional ?? [])]);
    for (const k of Object.keys(v)) if (!allowed.has(k)) this.fail(`${path}.${k}`, "알 수 없는 항목입니다");
    return true;
  }
  str(v: unknown, path: string, nonEmpty = false) {
    if (typeof v !== "string") this.fail(path, "문자열이어야 합니다");
    else if (nonEmpty && v.length === 0) this.fail(path, "비어 있으면 안 됩니다");
  }
  bool(v: unknown, path: string) {
    if (typeof v !== "boolean") this.fail(path, "true/false여야 합니다");
  }
  int(v: unknown, path: string, min = 0, max = Number.MAX_SAFE_INTEGER) {
    if (typeof v !== "number" || !Number.isInteger(v)) this.fail(path, "정수여야 합니다");
    else if (v < min || v > max) this.fail(path, max === Number.MAX_SAFE_INTEGER ? `${min} 이상이어야 합니다` : `${min}~${max} 사이여야 합니다`);
  }
  num(v: unknown, path: string) {
    if (typeof v !== "number" || !Number.isFinite(v)) this.fail(path, "숫자여야 합니다");
  }
  iso(v: unknown, path: string) {
    if (!isIso(v)) this.fail(path, "ISO 날짜·시각 문자열이어야 합니다");
  }
  date(v: unknown, path: string) {
    if (!isDateString(v) && v !== NEVER_DUE) this.fail(path, "YYYY-MM-DD 날짜여야 합니다");
  }
  oneOf(v: unknown, path: string, options: readonly string[]) {
    if (typeof v !== "string" || !options.includes(v)) this.fail(path, `${options.join(", ")} 중 하나여야 합니다`);
  }
  arr(v: unknown, path: string, each: (item: unknown, path: string) => void) {
    if (!Array.isArray(v)) {
      this.fail(path, "배열이어야 합니다");
      return;
    }
    v.forEach((item, i) => each(item, `${path}[${i}]`));
  }
  strArr(v: unknown, path: string) {
    this.arr(v, path, (x, p) => this.str(x, p, true));
  }
  record(v: unknown, path: string, each: (item: unknown, path: string) => void) {
    if (!isObj(v)) {
      this.fail(path, "객체여야 합니다");
      return;
    }
    for (const [k, item] of Object.entries(v)) each(item, `${path}.${k}`);
  }
  custom(ok: boolean, path: string, msg: string) {
    if (!ok) this.fail(path, msg);
  }
}

const FACING = ["up", "down", "left", "right"] as const;
const GRADES = ["again", "hard", "good", "easy"] as const;

export function validateSave(raw: unknown): ValidationResult {
  const c = new Checker();
  const root = "저장 데이터";
  if (
    !c.obj(raw, root, {
      required: [
        "version", "createdAt", "updatedAt", "player", "location", "lastCampfire", "scrolls", "lessonsCompleted",
        "problems", "removedObjects", "flags", "inventory", "equipment", "titles", "shadows", "streak", "history",
      ],
    })
  ) {
    return { ok: false, errors: c.errors };
  }
  const d = raw;
  c.custom(d.version === 1, "version", "지원하는 버전은 1입니다");
  c.iso(d.createdAt, "createdAt");
  c.iso(d.updatedAt, "updatedAt");

  if (c.obj(d.player, "player", { required: ["name", "xp", "gold", "hp"] })) {
    const p = d.player;
    c.str(p.name, "player.name", true);
    c.int(p.xp, "player.xp");
    c.int(p.gold, "player.gold");
    c.int(p.hp, "player.hp");
  }
  if (c.obj(d.location, "location", { required: ["regionId", "x", "y", "facing"] })) {
    const l = d.location;
    c.str(l.regionId, "location.regionId", true);
    c.int(l.x, "location.x");
    c.int(l.y, "location.y");
    c.oneOf(l.facing, "location.facing", FACING);
  }
  if (c.obj(d.lastCampfire, "lastCampfire", { required: ["regionId", "x", "y"] })) {
    const l = d.lastCampfire;
    c.str(l.regionId, "lastCampfire.regionId", true);
    c.int(l.x, "lastCampfire.x");
    c.int(l.y, "lastCampfire.y");
  }
  c.strArr(d.scrolls, "scrolls");
  c.strArr(d.lessonsCompleted, "lessonsCompleted");
  c.strArr(d.removedObjects, "removedObjects");
  c.strArr(d.equipment, "equipment");
  c.strArr(d.titles, "titles");

  c.record(d.problems, "problems", (v, p) => {
    if (!c.obj(v, p, { required: ["attempts", "knockouts", "solved", "maxHintLevel", "solutionViewed"], optional: ["solvedAt", "draft"] })) return;
    c.int(v.attempts, `${p}.attempts`);
    c.int(v.knockouts, `${p}.knockouts`);
    c.bool(v.solved, `${p}.solved`);
    if (v.solvedAt !== undefined) c.iso(v.solvedAt, `${p}.solvedAt`);
    c.int(v.maxHintLevel, `${p}.maxHintLevel`, 0, 3);
    c.bool(v.solutionViewed, `${p}.solutionViewed`);
    if (v.draft !== undefined) c.str(v.draft, `${p}.draft`);
  });
  c.record(d.flags, "flags", (v, p) => c.bool(v, p));
  c.record(d.inventory, "inventory", (v, p) => c.int(v, p));

  const concepts = new Set<string>();
  c.arr(d.shadows, "shadows", (v, p) => {
    if (!c.obj(v, p, { required: ["concept", "problemId", "box", "due", "purified", "createdAt"] })) return;
    c.str(v.concept, `${p}.concept`, true);
    if (typeof v.concept === "string") {
      c.custom(!concepts.has(v.concept), `${p}.concept`, `같은 개념(${v.concept})이 두 번 등록되어 있습니다`);
      concepts.add(v.concept);
    }
    c.str(v.problemId, `${p}.problemId`, true);
    c.int(v.box, `${p}.box`, 0, 5);
    c.date(v.due, `${p}.due`);
    c.bool(v.purified, `${p}.purified`);
    c.iso(v.createdAt, `${p}.createdAt`);
  });

  if (c.obj(d.streak, "streak", { required: ["activeDays", "embers", "iceRunes", "protectedDays", "todayDate", "todayCount"] })) {
    const s = d.streak;
    c.arr(s.activeDays, "streak.activeDays", (v, p) => c.date(v, p));
    c.arr(s.protectedDays, "streak.protectedDays", (v, p) => c.date(v, p));
    c.int(s.embers, "streak.embers", 0, 2);
    c.int(s.iceRunes, "streak.iceRunes", 0, 2);
    if (typeof s.embers === "number" && typeof s.iceRunes === "number") {
      c.custom(s.embers + s.iceRunes <= 2, "streak", "불씨와 얼음 룬은 합쳐서 2개까지입니다");
    }
    c.date(s.todayDate, "streak.todayDate");
    c.int(s.todayCount, "streak.todayCount");
  }

  c.arr(d.history, "history", (v, p) => {
    if (!c.obj(v, p, { required: ["at", "problemId", "concept", "grade", "shadow"] })) return;
    c.iso(v.at, `${p}.at`);
    c.str(v.problemId, `${p}.problemId`, true);
    c.str(v.concept, `${p}.concept`, true);
    c.oneOf(v.grade, `${p}.grade`, GRADES);
    c.bool(v.shadow, `${p}.shadow`);
  });

  if (c.errors.length) return { ok: false, errors: c.errors };
  return { ok: true, value: raw as unknown as SaveData };
}
