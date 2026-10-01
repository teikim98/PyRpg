// 그림자 게시판(design.md §7.6, phase3/plan.md §5.1): 오늘 나타난 그림자 목록과, 그림자전에 낼 변형 문제.
import type { Problem } from "../contracts/content";
import type { SaveData, ShadowEntry } from "../contracts/state";
import { dueShadows, intervalFor, isReturnShadow, MAX_BOX, NEVER_DUE } from "./shadows";
import { daysBetween, studyDate } from "./time";

export interface BoardShadow {
  entry: ShadowEntry;
  overdueDays: number;
  /** 한 칸 올라가면 다음 출현까지 일수(칸 5에서 이기면 정화 → 0) */
  nextIntervalDays: number;
  returning: boolean;
}

export function boardShadows(save: Pick<SaveData, "shadows" | "history">, now: Date): BoardShadow[] {
  const today = studyDate(now);
  return dueShadows(save, now).map((entry) => ({
    entry,
    overdueDays: Math.max(0, daysBetween(entry.due, today)),
    nextIntervalDays: entry.purified || entry.box >= MAX_BOX ? 0 : intervalFor(entry.box + 1),
    returning: isReturnShadow(entry),
  }));
}

/** 등록돼 있지만 오늘은 나타나지 않는 그림자 수(정화 대기 제외) */
export function waitingShadows(save: Pick<SaveData, "shadows">, now: Date): number {
  const today = studyDate(now);
  return save.shadows.filter((s) => !s.purified && s.due > today).length;
}

/** 정화된 그림자(코덱스의 '정화된 그림자' 목록) */
export function purifiedShadows(save: Pick<SaveData, "shadows">): ShadowEntry[] {
  return save.shadows.filter((s) => s.purified);
}

export function returnCleared(e: ShadowEntry): boolean {
  return e.purified && e.due === NEVER_DUE;
}

/**
 * 그림자전에 낼 문제. 변형을 순서대로 돌려 쓰되 마지막으로 낸 것은 피한다(기록의 problemId로 안다).
 * 변형이 없으면 원래 문제. 보스 변형은 1페이즈만이므로 시간 결계(페이즈·예산)를 뗀다.
 */
export function shadowProblem(original: Problem, history: SaveData["history"]): Problem {
  const variants = original.variants ?? [];
  if (variants.length === 0) return plain(original);
  let last: string | undefined;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.shadow && h.concept === original.concept) {
      last = h.problemId;
      break;
    }
  }
  const idx = variants.findIndex((v) => v.id === last);
  const v = variants[(idx + 1) % variants.length];
  return {
    ...plain(original),
    id: v.id,
    title: v.title,
    statement: v.statement,
    tests: v.tests,
  };
}

function plain(p: Problem): Problem {
  const out: Problem = { ...p, boss: false, tests: p.boss ? p.tests.filter((t) => (t.phase ?? 1) === 1) : p.tests };
  delete out.phases;
  delete out.budgetUnits;
  delete out.variants;
  return out;
}
