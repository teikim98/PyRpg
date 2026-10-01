// 스트릭(design.md §7.5). 전투 1개 또는 그림자 1마리 처치로 그날을 인정한다. 하루 경계는 새벽 4시.
import type { StreakState } from "../contracts/state";
import { addDays, daysBetween, studyDate, weekDates } from "./time";

/** 불씨 + 얼음 룬 보유 상한 */
export const MAX_PROTECTIONS = 2;
/** 하루 인정 조건의 3배를 하면 불씨 1개 */
export const EMBER_THRESHOLD = 3;
export const REPAIR_MIN_STREAK = 7;
export const REPAIR_BATTLES = 3;
export const REPAIR_COOLDOWN_DAYS = 30;
/** 끊긴 지 48시간 안 = 빠진 날이 1~2일 */
export const REPAIR_MAX_MISSED = 2;
/** 보관 기간. 현재 이어지는 스트릭의 날짜는 이보다 오래돼도 남긴다(연속 일수 계산용) */
export const KEEP_DAYS = 60;
export const WEEK_GOAL = 5;

export function createStreak(now: Date): StreakState {
  return { activeDays: [], embers: 0, iceRunes: 0, protectedDays: [], todayDate: studyDate(now), todayCount: 0 };
}

function cloneStreak(s: StreakState): StreakState {
  return { ...s, activeDays: [...s.activeDays], protectedDays: [...s.protectedDays] };
}

function countedSet(s: StreakState): Set<string> {
  return new Set([...s.activeDays, ...s.protectedDays]);
}

/** today 이전에 인정(또는 보호)된 마지막 날 */
function lastCountedBefore(s: StreakState, today: string): string | undefined {
  let last: string | undefined;
  for (const d of [...s.activeDays, ...s.protectedDays]) if (d < today && (!last || d > last)) last = d;
  return last;
}

function runEndingAt(set: Set<string>, day: string): string[] {
  const run: string[] = [];
  let d = day;
  while (set.has(d)) {
    run.push(d);
    d = addDays(d, -1);
  }
  return run;
}

export function protections(s: StreakState): number {
  return s.embers + s.iceRunes;
}

export interface SettleResult {
  state: StreakState;
  /** 이번에 보호로 메운 날짜 */
  protectedNow: string[];
  /** 빈 날을 다 메우지 못해 스트릭이 끊긴 상태 */
  broken: boolean;
}

/**
 * 돌아왔을 때 빠진 날을 보호(불씨 먼저, 그다음 얼음 룬)로 자동으로 메운다.
 * 빠진 날을 전부 메울 수 없으면 보호를 쓰지 않는다(어차피 끊기므로 아껴 둔다).
 * 여러 번 불러도 결과가 같다.
 */
export function settleStreak(state: StreakState, now: Date): SettleResult {
  const today = studyDate(now);
  const last = lastCountedBefore(state, today);
  if (!last) return { state, protectedNow: [], broken: false };
  const missed = daysBetween(last, today) - 1;
  if (missed <= 0) return { state, protectedNow: [], broken: false };
  if (missed > protections(state)) return { state, protectedNow: [], broken: true };
  const s = cloneStreak(state);
  const days: string[] = [];
  for (let i = 1; i <= missed; i++) {
    const d = addDays(last, i);
    days.push(d);
    if (s.embers > 0) s.embers--;
    else s.iceRunes--;
  }
  s.protectedDays = [...s.protectedDays, ...days].sort();
  return { state: s, protectedNow: days, broken: false };
}

export interface RepairOffer {
  /** 메워질 날짜 */
  missedDays: string[];
  /** 끊기기 전 연속 일수 */
  previousStreak: number;
}

/**
 * 복구 조건(§7.5): 7일 이상 스트릭이 끊긴 지 48시간 안, 30일에 한 번. 오늘 전투 3개를 끝내면 복구된다.
 * 스트릭은 처음 빠진 날이 끝날 때 끊기므로, 48시간 안 = 오늘이 처음 빠진 날 + 2일 이내.
 * 돌아온 날 전투를 1~2개만 했어도 다음 날(48시간 안)에 3개를 채우면 복구된다.
 */
export function repairOffer(state: StreakState, now: Date, lastRepair?: string): RepairOffer | null {
  const today = studyDate(now);
  if (lastRepair && daysBetween(lastRepair, today) < REPAIR_COOLDOWN_DAYS) return null;
  const set = countedSet(settleStreak(state, now).state);
  if (set.size === 0) return null;
  let d = addDays(today, -1);
  while (set.has(d)) d = addDays(d, -1);
  const missedDays: string[] = [];
  while (!set.has(d) && missedDays.length <= REPAIR_MAX_MISSED) {
    missedDays.unshift(d);
    d = addDays(d, -1);
  }
  if (missedDays.length < 1 || missedDays.length > REPAIR_MAX_MISSED) return null;
  if (daysBetween(missedDays[0], today) > REPAIR_MAX_MISSED) return null;
  const run = runEndingAt(set, d);
  if (run.length < REPAIR_MIN_STREAK) return null;
  return { missedDays, previousStreak: run.length };
}

export interface MarkResult {
  state: StreakState;
  /** 이번 활동으로 오늘이 처음 인정됨 */
  counted: boolean;
  emberCharged: boolean;
  /** 돌아오면서 보호로 메운 날짜 */
  protectedNow: string[];
  /** 복구로 메운 날짜(복구가 일어났을 때만) */
  repaired: string[] | null;
}

/** 전투 승리 또는 그림자 처치 1회 */
export function markActivity(state: StreakState, now: Date, opts: { lastRepair?: string } = {}): MarkResult {
  const today = studyDate(now);
  // 복구 판정은 보호 정산 전 상태로 미리 계산(정산은 복구 가능 여부를 바꾸지 않는다)
  const offer = repairOffer(state, now, opts.lastRepair);
  const settled = settleStreak(state, now);
  const s = cloneStreak(settled.state);
  if (s.todayDate !== today) {
    s.todayDate = today;
    s.todayCount = 0;
  }
  s.todayCount++;
  let counted = false;
  if (!s.activeDays.includes(today)) {
    s.activeDays = [...s.activeDays, today].sort();
    counted = true;
  }
  let emberCharged = false;
  let repaired: string[] | null = null;
  if (s.todayCount === EMBER_THRESHOLD) {
    if (protections(s) < MAX_PROTECTIONS) {
      s.embers++;
      emberCharged = true;
    }
  }
  if (s.todayCount === REPAIR_BATTLES && offer) {
    s.protectedDays = [...new Set([...s.protectedDays, ...offer.missedDays])].sort();
    repaired = offer.missedDays;
  }
  return { state: trimStreak(s, today), counted, emberCharged, protectedNow: settled.protectedNow, repaired };
}

/** 최근 60일 + 현재 이어지는 스트릭 날짜만 남긴다 */
export function trimStreak(s: StreakState, today: string): StreakState {
  const set = countedSet(s);
  const start = set.has(today) ? today : addDays(today, -1);
  const run = new Set(runEndingAt(set, start));
  const cutoff = addDays(today, -(KEEP_DAYS - 1));
  const keep = (d: string) => d >= cutoff || run.has(d);
  return { ...s, activeDays: s.activeDays.filter(keep), protectedDays: s.protectedDays.filter(keep) };
}

/** 연속 일수. 오늘 아직 활동하지 않았으면 어제까지로 센다(오늘이 끝나기 전엔 끊기지 않음) */
export function currentStreak(state: StreakState, now: Date): number {
  const s = settleStreak(state, now).state;
  const today = studyDate(now);
  const set = countedSet(s);
  return runEndingAt(set, set.has(today) ? today : addDays(today, -1)).length;
}

/** 이번 주(월~일) 학습일 수(인정 + 보호). HUD의 "이번 주 ○/7일" */
export function weekDays(state: StreakState, now: Date): number {
  const set = countedSet(settleStreak(state, now).state);
  return weekDates(studyDate(now)).filter((d) => set.has(d)).length;
}

/** 오늘 인정 조건 진행(날짜가 바뀌었으면 0) */
export function todayCount(state: StreakState, now: Date): number {
  return state.todayDate === studyDate(now) ? state.todayCount : 0;
}

/** 얼음 룬 구매. 보유 상한(불씨 포함 2개)이면 null */
export function addIceRune(state: StreakState): StreakState | null {
  if (protections(state) >= MAX_PROTECTIONS) return null;
  return { ...cloneStreak(state), iceRunes: state.iceRunes + 1 };
}
