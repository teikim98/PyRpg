// 새 게임 저장 데이터.
import type { Facing, SaveData } from "../contracts/state";
import { maxHp } from "../systems/level";
import { createStreak } from "../systems/streak";

export const SAVE_VERSION = 1 as const;
export const DEFAULT_PLAYER_NAME = "주문사";
export const START_REGION = "r01";

export interface NewGameOptions {
  /** 시작 위치(맵의 spawn 오브젝트 좌표, 타일 단위). 처음 캠프파이어로도 쓴다 */
  spawn: { x: number; y: number; facing?: Facing };
  regionId?: string;
  name?: string;
}

export function createNewSave(now: Date, opts: NewGameOptions): SaveData {
  const iso = now.toISOString();
  const regionId = opts.regionId ?? START_REGION;
  const { x, y } = opts.spawn;
  return {
    version: SAVE_VERSION,
    createdAt: iso,
    updatedAt: iso,
    player: { name: opts.name?.trim() || DEFAULT_PLAYER_NAME, xp: 0, gold: 0, hp: maxHp(1) },
    location: { regionId, x, y, facing: opts.spawn.facing ?? "down" },
    lastCampfire: { regionId, x, y },
    scrolls: [],
    lessonsCompleted: [],
    problems: {},
    removedObjects: [],
    flags: {},
    inventory: {},
    equipment: [],
    titles: [],
    shadows: [],
    streak: createStreak(now),
    history: [],
  };
}
