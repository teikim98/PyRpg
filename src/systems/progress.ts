// 전투 밖의 진행 규칙: 레슨 완료, 캠프파이어, 불러온 직후 정산, HUD 값.
import type { SaveData } from "../contracts/state";
import type { HudState } from "../contracts/ui";
import { levelFromXp, maxHp, xpToNext } from "./level";
import { settleStreak, weekDays } from "./streak";
import { studyDate } from "./time";

/** 레슨 완료 XP(§7.1) */
export const LESSON_XP = 30;

export interface LessonResult {
  save: SaveData;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  /** 처음 완료했을 때만 true(다시 열람하면 보상 없음) */
  firstTime: boolean;
}

/** 레슨 완료: 주문서 획득 + 30 XP. 이미 완료한 레슨은 보상 없음 */
export function completeLesson(save: SaveData, lesson: { id: string; scroll: { id: string } }, opts: { maxHpBonus?: number } = {}): LessonResult {
  const s: SaveData = structuredClone(save);
  const levelBefore = levelFromXp(s.player.xp);
  const firstTime = !s.lessonsCompleted.includes(lesson.id);
  if (firstTime) {
    s.lessonsCompleted.push(lesson.id);
    s.player.xp += LESSON_XP;
  }
  if (!s.scrolls.includes(lesson.scroll.id)) s.scrolls.push(lesson.scroll.id);
  const levelAfter = levelFromXp(s.player.xp);
  if (levelAfter > levelBefore) s.player.hp = maxHp(levelAfter, opts.maxHpBonus ?? 0);
  return { save: s, xp: firstTime ? LESSON_XP : 0, levelBefore, levelAfter, firstTime };
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
  return {
    regionName,
    level,
    xp: save.player.xp,
    xpToNext: xpToNext(save.player.xp),
    hp: save.player.hp,
    maxHp: maxHp(level, opts.maxHpBonus ?? 0),
    gold: save.player.gold,
    weekDays: weekDays(save.streak, now),
    scrolls: save.scrolls.length,
  };
}
