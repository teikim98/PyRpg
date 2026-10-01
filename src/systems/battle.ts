// 전투 결과 반영(design.md §5.3, §7). 입력을 바꾸지 않고 새 SaveData를 돌려준다.
// 맵 오브젝트 제거(removedObjects), 화면 전환, 캠프파이어로의 실제 이동 연출은 앱이 events를 보고 처리한다.
import type { Problem } from "../contracts/content";
import type { AttemptLog, BattleOutcome, HintLevel, ProblemRecord, RewardSummary, SaveData, ShadowEntry } from "../contracts/state";
import { accessorySlots, levelFromXp, maxHp } from "./level";
import { computeBattleReward } from "./rewards";
import { gradeFor, recordShadowResult, registerShadow, type ShadowResultKind, type ShadowTrigger } from "./shadows";
import { currentStreak, markActivity } from "./streak";
import { studyDate } from "./time";

/** 해설서가 열리는 쓰러짐 횟수(§5.3) */
export const SOLUTION_UNLOCK_KNOCKOUTS = 3;
/** 스트릭 복구 기록(StreakState에 필드가 없어 flags에 날짜별로 남긴다) */
export const STREAK_REPAIR_FLAG = "streak.repair:";

export const solutionFlag = (problemId: string) => `solution.unlocked:${problemId}`;

export type BattleEvent =
  | { type: "victory"; problemId: string; firstClear: boolean }
  | { type: "knockout"; problemId: string; knockouts: number; respawn: { regionId: string; x: number; y: number } }
  | { type: "retreat"; problemId: string }
  | { type: "solutionUnlocked"; problemId: string }
  | { type: "levelUp"; from: number; to: number; maxHp: number }
  | { type: "accessorySlotUnlocked"; slots: number }
  | { type: "shadowRegistered"; entry: ShadowEntry; change: "created" | "demoted" | "reactivated" | "unchanged" }
  | { type: "shadowUpdated"; entry: ShadowEntry; kind: ShadowResultKind }
  | { type: "streakCounted"; date: string; streak: number }
  | { type: "streakProtected"; days: string[] }
  | { type: "emberCharged"; embers: number }
  | { type: "streakRepaired"; days: string[] };

export interface ApplyOptions {
  /** 그림자 게시판에서 시작한 전투. 개념은 problem.concept */
  shadow?: boolean;
  /** 장비로 늘어난 최대 HP */
  maxHpBonus?: number;
}

export interface BattleApplyResult {
  save: SaveData;
  summary: RewardSummary;
  events: BattleEvent[];
}

export function emptyRecord(): ProblemRecord {
  return { attempts: 0, knockouts: 0, solved: false, maxHintLevel: 0, solutionViewed: false };
}

export function lastStreakRepair(flags: Record<string, boolean>): string | undefined {
  let last: string | undefined;
  for (const [k, v] of Object.entries(flags)) {
    if (!v || !k.startsWith(STREAK_REPAIR_FLAG)) continue;
    const d = k.slice(STREAK_REPAIR_FLAG.length);
    if (!last || d > last) last = d;
  }
  return last;
}

export function applyBattleOutcome(save: SaveData, problem: Problem, outcome: BattleOutcome, now: Date, opts: ApplyOptions = {}): BattleApplyResult {
  const s: SaveData = structuredClone(save);
  const events: BattleEvent[] = [];
  const notes: string[] = [];
  const iso = now.toISOString();
  const id = problem.id;
  const shadowBattle = !!opts.shadow;
  const levelBefore = levelFromXp(s.player.xp);
  const reward = computeBattleReward(problem, outcome, save, { shadow: shadowBattle });

  const log = (grade: AttemptLog["grade"]) =>
    s.history.push({ at: iso, problemId: id, concept: problem.concept, grade, shadow: shadowBattle });

  if (!shadowBattle) {
    const prev = s.problems[id] ?? emptyRecord();
    const rec: ProblemRecord = {
      ...prev,
      attempts: prev.attempts + Math.max(0, outcome.attempts),
      maxHintLevel: Math.max(prev.maxHintLevel, outcome.maxHintLevel) as HintLevel,
      solutionViewed: prev.solutionViewed || outcome.solutionViewed,
      draft: outcome.finalCode,
    };
    if (outcome.result === "victory") {
      const firstClear = !prev.solved;
      if (firstClear) {
        rec.solved = true;
        rec.solvedAt = iso;
      }
      events.push({ type: "victory", problemId: id, firstClear });
    } else if (outcome.result === "knockout") {
      rec.knockouts = prev.knockouts + 1;
      if (rec.knockouts === SOLUTION_UNLOCK_KNOCKOUTS) {
        s.flags[solutionFlag(id)] = true;
        events.push({ type: "solutionUnlocked", problemId: id });
      }
    } else {
      events.push({ type: "retreat", problemId: id });
    }
    s.problems[id] = rec;

    // 그림자 등록(§7.6): 새로 생긴 조건만, 한 전투에서 가장 무거운 것 하나
    let trigger: ShadowTrigger | null = null;
    if (rec.solutionViewed && !prev.solutionViewed) trigger = "solution";
    else if (outcome.result === "knockout") trigger = "knockout";
    else if (rec.maxHintLevel >= 2 && prev.maxHintLevel < 2) trigger = "hint";
    if (trigger) {
      const r = registerShadow(s.shadows, { concept: problem.concept, problemId: id, trigger }, now);
      s.shadows = r.shadows;
      notes.push(r.note);
      events.push({ type: "shadowRegistered", entry: r.entry, change: r.change });
    }

    if (outcome.result !== "retreat") {
      log(gradeFor({ result: outcome.result, maxHintLevel: rec.maxHintLevel, solutionViewed: rec.solutionViewed, attempts: outcome.attempts }));
    }
  } else if (outcome.result !== "retreat") {
    const r = { result: outcome.result, maxHintLevel: outcome.maxHintLevel, solutionViewed: outcome.solutionViewed, attempts: outcome.attempts };
    const upd = recordShadowResult(s.shadows, problem.concept, r, now);
    if (upd) {
      s.shadows = upd.shadows;
      notes.push(upd.note);
      events.push({ type: "shadowUpdated", entry: upd.entry, kind: upd.kind });
    }
    log(gradeFor(r));
    if (outcome.result === "victory") events.push({ type: "victory", problemId: id, firstClear: false });
  } else {
    events.push({ type: "retreat", problemId: id });
  }

  // 보상과 레벨
  s.player.xp += reward.xp;
  s.player.gold += reward.gold;
  const levelAfter = levelFromXp(s.player.xp);
  const hpMax = maxHp(levelAfter, opts.maxHpBonus ?? 0);
  if (levelAfter > levelBefore) {
    events.push({ type: "levelUp", from: levelBefore, to: levelAfter, maxHp: hpMax });
    if (accessorySlots(levelAfter) > accessorySlots(levelBefore)) events.push({ type: "accessorySlotUnlocked", slots: accessorySlots(levelAfter) });
  }

  // HP: 쓰러지면 마지막 캠프파이어에서 가득 찬 채로, 레벨업하면 가득 채움
  if (outcome.result === "knockout") {
    s.player.hp = hpMax;
    const c = s.lastCampfire;
    s.location = { regionId: c.regionId, x: c.x, y: c.y, facing: "down" };
    const knockouts = shadowBattle ? 0 : s.problems[id].knockouts;
    events.push({ type: "knockout", problemId: id, knockouts, respawn: { ...c } });
  } else if (levelAfter > levelBefore) {
    s.player.hp = hpMax;
  } else {
    s.player.hp = Math.min(hpMax, Math.max(0, Math.round(outcome.hpLeft)));
  }

  // 스트릭: 전투 승리 또는 그림자 처치
  let streakCounted = false;
  if (outcome.result === "victory") {
    const m = markActivity(s.streak, now, { lastRepair: lastStreakRepair(s.flags) });
    s.streak = m.state;
    streakCounted = m.counted;
    if (m.protectedNow.length) events.push({ type: "streakProtected", days: m.protectedNow });
    if (m.repaired) {
      s.flags[STREAK_REPAIR_FLAG + studyDate(now)] = true;
      events.push({ type: "streakRepaired", days: m.repaired });
    }
    if (m.emberCharged) events.push({ type: "emberCharged", embers: m.state.embers });
    if (m.counted) events.push({ type: "streakCounted", date: studyDate(now), streak: currentStreak(m.state, now) });
  }

  const summary: RewardSummary = {
    xp: reward.xp,
    gold: reward.gold,
    penalty: reward.penalty,
    levelBefore,
    levelAfter,
    streakCounted,
  };
  if (notes.length) summary.shadowNote = notes.join(" / ");
  return { save: s, summary, events };
}
