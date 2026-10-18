// 전투 밖의 진행 규칙: 레슨 완료, 캠프파이어, 불러온 직후 정산, HUD 값.
import type { Problem } from "../contracts/content";
import type { SaveData } from "../contracts/state";
import type { HudState } from "../contracts/ui";
import { levelFromXp, levelProgress, maxHp } from "./level";
import { markActivity, settleStreak, weekDays } from "./streak";
import { studyDate } from "./time";

/**
 * 지역 클리어를 일으키는 최종 보스인지(docs/phase3/region06-spec.md §7.1).
 * 중간 보스(midBoss)도 boss라서 시간 결계·판정 공개 방식은 같지만, 지역 클리어·클리어 연출은 최종 보스로만
 */
export function isFinalBoss(problem: Pick<Problem, "boss" | "midBoss">): boolean {
  return problem.boss && problem.midBoss !== true;
}

/** 레슨 완료 XP(§7.1) */
export const LESSON_XP = 30;

export interface LessonResult {
  save: SaveData;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  /** 처음 완료했을 때만 true(다시 열람하면 보상 없음) */
  firstTime: boolean;
  /** 이번 첫 완료로 오늘이 처음 학습일로 인정됐는가(opts.now를 넘겼을 때만, design.md §7.5) */
  streakCounted: boolean;
}

/**
 * 레슨 완료: 주문서 획득 + 30 XP. 이미 완료한 레슨은 보상 없음.
 * opts.now를 넘기면 처음 완료한 날을 스트릭 학습일로 인정한다(오늘 처치 수는 올리지 않음, 단위 3-E3)
 */
export function completeLesson(
  save: SaveData,
  lesson: { id: string; scroll: { id: string } },
  opts: { maxHpBonus?: number; now?: Date } = {},
): LessonResult {
  const s: SaveData = structuredClone(save);
  const levelBefore = levelFromXp(s.player.xp);
  const firstTime = !s.lessonsCompleted.includes(lesson.id);
  let streakCounted = false;
  if (firstTime) {
    s.lessonsCompleted.push(lesson.id);
    s.player.xp += LESSON_XP;
    if (opts.now) {
      const m = markActivity(s.streak, opts.now, { countOnly: true });
      s.streak = m.state;
      streakCounted = m.counted;
    }
  }
  if (!s.scrolls.includes(lesson.scroll.id)) s.scrolls.push(lesson.scroll.id);
  const levelAfter = levelFromXp(s.player.xp);
  if (levelAfter > levelBefore) s.player.hp = maxHp(levelAfter, opts.maxHpBonus ?? 0);
  return { save: s, xp: firstTime ? LESSON_XP : 0, levelBefore, levelAfter, firstTime, streakCounted };
}

/** 캠프파이어: HP 회복 + 마지막 캠프파이어 갱신(저장은 앱이 바로 한다) */
export function restAtCampfire(save: SaveData, campfire: { regionId: string; x: number; y: number }, opts: { maxHpBonus?: number } = {}): SaveData {
  const s: SaveData = structuredClone(save);
  s.player.hp = maxHp(levelFromXp(s.player.xp), opts.maxHpBonus ?? 0);
  s.lastCampfire = { regionId: campfire.regionId, x: campfire.x, y: campfire.y };
  return s;
}

/**
 * 불러온 직후·날짜가 바뀐 뒤 호출: 빠진 날을 보호로 메우고 오늘 카운터를 맞춘다.
 * protectedDays가 비어 있지 않으면 앱이 "불씨가 스트릭을 지켰다" 같은 안내를 띄울 수 있다.
 */
export function settleOnLoad(save: SaveData, now: Date): { save: SaveData; protectedDays: string[]; streakBroken: boolean } {
  const r = settleStreak(save.streak, now);
  const today = studyDate(now);
  if (r.protectedNow.length === 0 && save.streak.todayDate === today) return { save, protectedDays: [], streakBroken: r.broken };
  const s: SaveData = structuredClone(save);
  s.streak = r.state.todayDate === today ? { ...r.state } : { ...r.state, todayDate: today, todayCount: 0 };
  return { save: s, protectedDays: r.protectedNow, streakBroken: r.broken };
}

export function hudState(save: SaveData, now: Date, regionName: string, opts: { maxHpBonus?: number } = {}): HudState {
  const level = levelFromXp(save.player.xp);
  // HUD는 xp/xpToNext로 막대를 그리므로 지금 레벨 구간 안의 진행도를 넘긴다(누적 XP/남은 XP를 넘기면 1720/108처럼 보였다)
  const prog = levelProgress(save.player.xp);
  return {
    regionName,
    level,
    xp: prog.current,
    xpToNext: prog.needed,
    hp: save.player.hp,
    maxHp: maxHp(level, opts.maxHpBonus ?? 0),
    gold: save.player.gold,
    weekDays: weekDays(save.streak, now),
    scrolls: save.scrolls.length,
  };
}
