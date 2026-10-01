// 일일 퀘스트(design.md §7.5). 하루 3개를 날짜 시드로 정해서 뽑고(같은 날이면 언제 열어도 같다),
// 전투·그림자·레슨·코덱스·캠프파이어 사건으로 진행을 올린다. 하나에 30 XP·20 골드, 3개를 다 하면 상자.
import type { QuestContent, QuestDef, QuestEventType } from "../contracts/content";
import type { DailyQuestState, SaveData } from "../contracts/state";
import { levelFromXp } from "./level";
import { studyDate } from "./time";

/** 오늘 뽑을 수 있는지 판단하는 상황 */
export interface QuestContext {
  shadowDue: boolean;
  battleLeft: boolean;
  lessonLeft: boolean;
  lessonDone: boolean;
}

export type QuestEvent =
  | { type: "win"; maxHintLevel: number; attempts: number }
  | { type: "shadow" }
  | { type: "lesson" }
  | { type: "codexRun" }
  | { type: "rest" };

/** 문자열 → 32비트 시드(FNV-1a) */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 결정적 난수(mulberry32) */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function eligible(q: QuestDef, ctx: QuestContext): boolean {
  return !q.needs || ctx[q.needs];
}

/**
 * 그날의 퀘스트 ID. 할 수 있는 것 가운데 날짜 시드로 섞어 perDay개를 고른다.
 * 할 수 있는 것이 모자라면 조건 없는 퀘스트로 채운다.
 */
export function selectDailyQuests(quests: QuestContent, date: string, ctx: QuestContext): string[] {
  const n = quests.perDay;
  const rand = seededRandom(hashSeed(`quests:${date}`));
  const shuffle = <T>(arr: T[]): T[] => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const picked = shuffle(quests.pool.filter((q) => eligible(q, ctx))).slice(0, n);
  if (picked.length < n) {
    for (const q of quests.pool) {
      if (picked.length >= n) break;
      if (!q.needs && !picked.includes(q)) picked.push(q);
    }
  }
  return picked.map((q) => q.id);
}

/** 오늘의 퀘스트 상태. 날짜가 바뀌었거나 없으면 새로 뽑는다(입력은 바꾸지 않음) */
export function ensureDailyQuests(save: SaveData, quests: QuestContent, now: Date, ctx: QuestContext): SaveData {
  const today = studyDate(now);
  const cur = save.quests;
  if (cur && cur.date === today && cur.ids.every((id) => quests.pool.some((q) => q.id === id))) return save;
  const ids = selectDailyQuests(quests, today, ctx);
  const state: DailyQuestState = { date: today, ids, progress: ids.map(() => 0), claimed: ids.map(() => false), chest: false };
  return { ...save, quests: state };
}

function matches(q: QuestDef, e: QuestEvent): boolean {
  const type: QuestEventType = q.event;
  switch (type) {
    case "anyWin":
      return e.type === "win" || e.type === "shadow";
    case "win":
      if (e.type !== "win") return false;
      if (q.filter?.noHint && e.maxHintLevel > 0) return false;
      if (q.filter?.firstCast && e.attempts !== 1) return false;
      return true;
    default:
      return e.type === type;
  }
}

export interface QuestUpdate {
  save: SaveData;
  /** 이번에 완료한 퀘스트 */
  completed: QuestDef[];
  /** 이번에 받은 모두 완료 상자 */
  chest: QuestContent["chest"] | null;
  xp: number;
  gold: number;
  levelBefore: number;
  levelAfter: number;
}

/** 사건 하나를 반영하고, 완료한 퀘스트와 상자의 보상을 바로 준다 */
export function applyQuestEvent(save: SaveData, quests: QuestContent, event: QuestEvent): QuestUpdate {
  const levelBefore = levelFromXp(save.player.xp);
  const none: QuestUpdate = { save, completed: [], chest: null, xp: 0, gold: 0, levelBefore, levelAfter: levelBefore };
  const cur = save.quests;
  if (!cur) return none;
  const s: SaveData = structuredClone(save);
  const st = s.quests!;
  const completed: QuestDef[] = [];
  let xp = 0;
  let gold = 0;
  let changed = false;
  st.ids.forEach((id, i) => {
    const q = quests.pool.find((d) => d.id === id);
    if (!q || st.claimed[i] || !matches(q, event)) return;
    changed = true;
    st.progress[i] = Math.min(q.count, st.progress[i] + 1);
    if (st.progress[i] >= q.count) {
      st.claimed[i] = true;
      completed.push(q);
      xp += quests.reward.xp;
      gold += quests.reward.gold;
    }
  });
  if (!changed) return none;
  if (completed.length === 0) return { ...none, save: s };
  let chest: QuestContent["chest"] | null = null;
  if (!st.chest && st.claimed.length > 0 && st.claimed.every(Boolean)) {
    st.chest = true;
    chest = quests.chest;
    gold += chest.gold;
    for (const [id, n] of Object.entries(chest.items)) s.inventory[id] = (s.inventory[id] ?? 0) + n;
  }
  s.player.xp += xp;
  s.player.gold += gold;
  return { save: s, completed, chest, xp, gold, levelBefore, levelAfter: levelFromXp(s.player.xp) };
}

/** HUD용 완료 수 */
export function questProgress(save: SaveData): { done: number; total: number } | undefined {
  const q = save.quests;
  if (!q) return undefined;
  return { done: q.claimed.filter(Boolean).length, total: q.ids.length };
}
