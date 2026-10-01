// 상점·장비·꾸미기(design.md §7.2, §7.3). 결제·확률형 없음, 정답 판정을 바꾸는 상품 없음.
import type { ItemDef } from "../contracts/content";
import type { SaveData } from "../contracts/state";
import { accessorySlots, levelFromXp } from "./level";
import { GUIDE_FEATHER_ID } from "./rewards";
import { addIceRune, MAX_PROTECTIONS, protections } from "./streak";

export type ShopState = "available" | "owned" | "locked" | "full" | "poor";

/** 보유 수(장신구·꾸미기는 0 또는 1) */
export function owned(save: SaveData, id: string): number {
  return save.inventory[id] ?? 0;
}

/** 상점 품목의 지금 상태. 가격이 없는 아이템은 상점에 나오지 않는다(null) */
export function shopState(save: SaveData, item: ItemDef): ShopState | null {
  if (item.price === undefined) return null;
  const level = levelFromXp(save.player.xp);
  if (level < (item.minLevel ?? 1)) return "locked";
  if ((item.kind === "accessory" || item.kind === "cosmetic") && owned(save, item.id) > 0) return "owned";
  if (item.kind === "consumable" && owned(save, item.id) >= (item.maxStack ?? 99)) return "full";
  if (item.kind === "iceRune" && protections(save.streak) >= MAX_PROTECTIONS) return "full";
  if (save.player.gold < item.price) return "poor";
  return "available";
}

export class ShopError extends Error {}

const STATE_MESSAGE: Record<Exclude<ShopState, "available">, string> = {
  locked: "아직 레벨이 모자라",
  owned: "이미 가지고 있어",
  full: "더는 가질 수 없어",
  poor: "골드가 모자라",
};

/** 구매. 살 수 없으면 ShopError(입력은 바꾸지 않음) */
export function buyItem(save: SaveData, item: ItemDef): SaveData {
  const st = shopState(save, item);
  if (st === null) throw new ShopError("파는 물건이 아니야");
  if (st !== "available") throw new ShopError(STATE_MESSAGE[st]);
  const s: SaveData = structuredClone(save);
  s.player.gold -= item.price!;
  if (item.kind === "iceRune") {
    const next = addIceRune(s.streak);
    if (!next) throw new ShopError(STATE_MESSAGE.full);
    s.streak = next;
  } else {
    s.inventory[item.id] = owned(s, item.id) + 1;
  }
  return s;
}

/** 장착한 장신구의 효과 모음 */
export interface EquipmentEffects {
  maxHpBonus: number;
  guideFeather: boolean;
  targetComplexity: boolean;
}

export function equipmentEffects(save: Pick<SaveData, "equipment">, items: ItemDef[]): EquipmentEffects {
  const out: EquipmentEffects = { maxHpBonus: 0, guideFeather: false, targetComplexity: false };
  for (const id of save.equipment) {
    const it = items.find((i) => i.id === id);
    // 길잡이 깃털은 아이템 데이터가 없어도 ID로 알아본다(rewards.ts와 같은 규칙)
    if (id === GUIDE_FEATHER_ID) out.guideFeather = true;
    if (!it?.effect || it.pending) continue;
    if (it.effect.type === "maxHp") out.maxHpBonus += it.effect.value;
    if (it.effect.type === "guideFeather") out.guideFeather = true;
    if (it.effect.type === "targetComplexity") out.targetComplexity = true;
  }
  return out;
}

/** 장착/해제 전환. 가지지 않았거나 슬롯이 가득하면 ShopError */
export function toggleAccessory(save: SaveData, item: ItemDef): { save: SaveData; equipped: boolean } {
  if (item.kind !== "accessory") throw new ShopError("장신구가 아니야");
  const s: SaveData = structuredClone(save);
  if (s.equipment.includes(item.id)) {
    s.equipment = s.equipment.filter((id) => id !== item.id);
    return { save: s, equipped: false };
  }
  if (owned(s, item.id) <= 0) throw new ShopError("아직 가지고 있지 않아");
  const slots = accessorySlots(levelFromXp(s.player.xp));
  if (s.equipment.length >= slots) throw new ShopError(`장신구 슬롯이 가득 찼어(${slots}칸). 하나를 먼저 빼 줘`);
  s.equipment = [...s.equipment, item.id];
  return { save: s, equipped: true };
}

/** 꾸미기 적용/해제 전환(대상마다 하나) */
export function toggleCosmetic(save: SaveData, item: ItemDef): { save: SaveData; applied: boolean } {
  if (item.kind !== "cosmetic" || !item.target) throw new ShopError("꾸미기 아이템이 아니야");
  if (owned(save, item.id) <= 0) throw new ShopError("아직 가지고 있지 않아");
  const s: SaveData = structuredClone(save);
  const cur = { ...(s.cosmetics ?? {}) };
  const applied = cur[item.target] !== item.id;
  if (applied) cur[item.target] = item.id;
  else delete cur[item.target];
  s.cosmetics = cur;
  return { save: s, applied };
}

/** "#rrggbb" → 0xrrggbb */
export function tintColor(hex: string | undefined): number | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return parseInt(hex.slice(1), 16);
}

/** 전투 중 회복약 하나 사용. 없으면 null */
export function usePotion(save: SaveData, itemId: string): SaveData | null {
  if (owned(save, itemId) <= 0) return null;
  const s: SaveData = structuredClone(save);
  s.inventory[itemId] = owned(s, itemId) - 1;
  if (s.inventory[itemId] === 0) delete s.inventory[itemId];
  return s;
}

/** 이 문제를 처음 이겼을 때 받는 아이템(예: 지역 2 보스 → 길잡이 깃털) */
export function itemsRewardedBy(items: ItemDef[], problemId: string): ItemDef[] {
  return items.filter((i) => i.rewardFrom === problemId);
}
