// 그림자 몬스터(고정 간격 Leitner 변형, design.md §7.6, research.md §1.9).
import type { AttemptLog, HintLevel, SaveData, ShadowEntry } from "../contracts/state";
import { addDays, daysBetween, studyDate } from "./time";

/** 칸 0~5의 다음 출현 간격(일) */
export const SHADOW_INTERVALS = [1, 1, 3, 7, 14, 30] as const;
export const MAX_BOX = 5;
/** 정화 뒤 귀환 그림자가 나타날 때까지 */
export const RETURN_AFTER_DAYS = 90;
/** 귀환 그림자에게 지면 돌아가는 칸 */
export const RETURN_FAIL_BOX = 3;
export const DAILY_SHADOW_LIMIT = 3;
/** 다시 나타나지 않음(귀환까지 통과) */
export const NEVER_DUE = "9999-12-31";

export type ShadowTrigger = "solution" | "knockout" | "hint";
export type Grade = AttemptLog["grade"];

export interface ShadowBattleResult {
  result: "victory" | "knockout";
  maxHintLevel: HintLevel;
  solutionViewed: boolean;
  /** 이번 전투의 [시전] 횟수 */
  attempts: number;
}

export type ShadowMove = "up" | "stay" | "down1" | "down2";

export function intervalFor(box: number): number {
  return SHADOW_INTERVALS[clampBox(box)];
}

function clampBox(box: number): number {
  return Math.min(MAX_BOX, Math.max(0, Math.floor(box)));
}

/** 강등. floor보다 낮은 칸은 그대로 둔다(칸 0에서 '최소 칸 1' 강등이 승급이 되지 않도록) */
function demote(box: number, steps: number, floor: number): number {
  return box <= floor ? box : Math.max(floor, box - steps);
}

/** §7.6 이동 규칙 */
export function shadowMove(r: ShadowBattleResult): ShadowMove {
  if (r.result === "knockout" || r.solutionViewed) return "down2";
  if (r.maxHintLevel >= 2) return "down1";
  if (r.maxHintLevel === 1 || r.attempts >= 4) return "stay";
  return "up";
}

/** FSRS 대비 결과 매핑(research.md §1.9): 해설서/쓰러짐 = again, 힌트 2~3 = hard, 힌트 1·4회 이상 = good, 그 외 easy */
export function gradeFor(r: ShadowBattleResult): Grade {
  switch (shadowMove(r)) {
    case "down2":
      return "again";
    case "down1":
      return "hard";
    case "stay":
      return "good";
    default:
      return "easy";
  }
}

/** 정화된 뒤 90일 귀환을 기다리거나 지금 귀환한 그림자 */
export function isReturnShadow(e: ShadowEntry): boolean {
  return e.purified && e.due !== NEVER_DUE;
}

function replace(shadows: ShadowEntry[], entry: ShadowEntry): ShadowEntry[] {
  const i = shadows.findIndex((s) => s.concept === entry.concept);
  if (i < 0) return [...shadows, entry];
  const out = shadows.slice();
  out[i] = entry;
  return out;
}

export interface RegisterResult {
  shadows: ShadowEntry[];
  entry: ShadowEntry;
  change: "created" | "demoted" | "reactivated" | "unchanged";
  note: string;
}

/**
 * 등록(§7.6). 해설서 → 칸 0, 쓰러짐·힌트 2~3단계 → 칸 1.
 * 같은 개념이 이미 있으면 새로 만들지 않고 강등 규칙을 적용한다(해설서·쓰러짐 두 칸/최소 0, 힌트 한 칸/최소 1).
 * 정화된 개념이면 다시 활성화한다.
 */
export function registerShadow(
  shadows: ShadowEntry[],
  reg: { concept: string; problemId: string; trigger: ShadowTrigger },
  now: Date,
): RegisterResult {
  const today = studyDate(now);
  const startBox = reg.trigger === "solution" ? 0 : 1;
  const existing = shadows.find((s) => s.concept === reg.concept);
  if (!existing || existing.purified) {
    const entry: ShadowEntry = {
      concept: reg.concept,
      problemId: existing?.problemId ?? reg.problemId,
      box: startBox,
      due: addDays(today, intervalFor(startBox)),
      purified: false,
      createdAt: existing?.createdAt ?? now.toISOString(),
    };
    const change = existing ? "reactivated" : "created";
    return {
      shadows: replace(shadows, entry),
      entry,
      change,
      note: `${existing ? "정화했던 그림자가 다시 깨어났다" : "그림자 몬스터 등록"}: ${reg.concept} (칸 ${entry.box}, ${entry.due} 출현)`,
    };
  }
  const box = reg.trigger === "hint" ? demote(existing.box, 1, 1) : demote(existing.box, 2, 0);
  const entry: ShadowEntry = { ...existing, box, due: addDays(today, intervalFor(box)) };
  const change = box !== existing.box ? "demoted" : "unchanged";
  return {
    shadows: replace(shadows, entry),
    entry,
    change,
    note: `그림자가 짙어졌다: ${reg.concept} (칸 ${existing.box} → ${box}, ${entry.due} 출현)`,
  };
}

export type ShadowResultKind = "promoted" | "kept" | "demoted" | "purified" | "returnCleared" | "returnFailed";

export interface ShadowResultUpdate {
  shadows: ShadowEntry[];
  entry: ShadowEntry;
  kind: ShadowResultKind;
  grade: Grade;
  note: string;
}

/** 그림자 전투 결과 반영. 그 개념의 그림자가 없으면 null */
export function recordShadowResult(shadows: ShadowEntry[], concept: string, r: ShadowBattleResult, now: Date): ShadowResultUpdate | null {
  const existing = shadows.find((s) => s.concept === concept);
  if (!existing) return null;
  const today = studyDate(now);
  const move = shadowMove(r);
  const grade = gradeFor(r);

  if (existing.purified) {
    // 귀환 그림자: 통과(승급·유지 판정)하면 끝, 실패하면 칸 3
    if (move === "up" || move === "stay") {
      const entry = { ...existing, due: NEVER_DUE };
      return { shadows: replace(shadows, entry), entry, kind: "returnCleared", grade, note: `귀환 그림자를 완전히 정화했다: ${concept}` };
    }
    const entry: ShadowEntry = { ...existing, purified: false, box: RETURN_FAIL_BOX, due: addDays(today, intervalFor(RETURN_FAIL_BOX)) };
    return { shadows: replace(shadows, entry), entry, kind: "returnFailed", grade, note: `귀환 그림자가 다시 자리를 잡았다: ${concept} (칸 ${RETURN_FAIL_BOX}, ${entry.due} 출현)` };
  }

  if (move === "up" && existing.box >= MAX_BOX) {
    const entry: ShadowEntry = { ...existing, box: MAX_BOX, purified: true, due: addDays(today, RETURN_AFTER_DAYS) };
    return { shadows: replace(shadows, entry), entry, kind: "purified", grade, note: `그림자 정화: ${concept} (${RETURN_AFTER_DAYS}일 뒤 한 번 귀환)` };
  }

  let box = existing.box;
  let kind: ShadowResultKind;
  if (move === "up") {
    box = existing.box + 1;
    kind = "promoted";
  } else if (move === "stay") {
    kind = "kept";
  } else {
    box = move === "down1" ? demote(existing.box, 1, 1) : demote(existing.box, 2, 0);
    kind = "demoted";
  }
  const entry: ShadowEntry = { ...existing, box, due: addDays(today, intervalFor(box)) };
  const verb = kind === "promoted" ? "옅어졌다" : kind === "kept" ? "버티고 있다" : "짙어졌다";
  return {
    shadows: replace(shadows, entry),
    entry,
    kind,
    grade,
    note: `그림자가 ${verb}: ${concept} (칸 ${existing.box} → ${box}, ${entry.due} 출현)`,
  };
}

/** 오늘 이미 상대한 그림자 개념 수(하루 상한 계산용) */
export function shadowsFoughtToday(history: AttemptLog[], now: Date): number {
  const today = studyDate(now);
  const set = new Set<string>();
  for (const h of history) if (h.shadow && studyDate(new Date(h.at)) === today) set.add(h.concept);
  return set.size;
}

/**
 * 오늘 나타나는 그림자(최대 3마리, 오늘 이미 상대한 수만큼 줄어듦).
 * 연체일이 긴 것 → 칸이 낮은 것 순서. 나머지는 벌칙 없이 다음 날로 넘어간다.
 */
export function dueShadows(save: Pick<SaveData, "shadows" | "history">, now: Date, limit = DAILY_SHADOW_LIMIT): ShadowEntry[] {
  const today = studyDate(now);
  const remaining = Math.max(0, limit - shadowsFoughtToday(save.history, now));
  if (remaining === 0) return [];
  return save.shadows
    .filter((s) => s.due !== NEVER_DUE && s.due <= today)
    .map((s) => ({ s, overdue: daysBetween(s.due, today) }))
    .sort((a, b) => b.overdue - a.overdue || a.s.box - b.s.box || a.s.createdAt.localeCompare(b.s.createdAt) || a.s.concept.localeCompare(b.s.concept))
    .slice(0, remaining)
    .map((x) => x.s);
}
