// 맵 오브젝트의 스프라이트 논리 이름(design.md §11.4). Phaser 없이 단위 테스트할 수 있게 WorldScene에서 뺐다.
import type { Problem } from "../contracts/content";
import type { MapObjectDef } from "../contracts/world";

/** 오브젝트 종류별 기본 스프라이트(논리 이름) */
export const TYPE_SPRITE: Partial<Record<MapObjectDef["type"], string>> = {
  sign: "obj_sign",
  chest: "obj_chest",
  door: "obj_door",
  campfire: "obj_campfire",
  rune: "obj_rune",
  warp: "obj_door",
  board: "obj_board",
  shop: "obj_shop",
};

/**
 * 그릴 스프라이트. 몬스터는 문제의 적 스프라이트, 그 밖에는 props.sprite, 없으면 종류별 기본값. 그리지 않는 오브젝트는 null.
 * door의 props.sprite(예: 고장 난 다리 obj_bridge_broken, region07-spec.md §9.1)는 manifest에 있을 때만 쓰고,
 * 아직 그림이 없으면 지금처럼 obj_door를 그린다(isKnown = manifest에 있는가)
 */
export function objectSpriteKey(
  def: Pick<MapObjectDef, "type" | "props">,
  problems: readonly Pick<Problem, "id" | "enemy">[] | undefined,
  isKnown: (name: string) => boolean,
): string | null {
  if (def.type === "trigger" || def.type === "spawn") return null;
  const own = typeof def.props.sprite === "string" && def.props.sprite !== "" ? def.props.sprite : undefined;
  if (def.type === "door") return own && isKnown(own) ? own : TYPE_SPRITE.door!;
  let key: string | undefined;
  if (def.type === "monster") key = problems?.find((p) => p.id === def.props.problem)?.enemy?.sprite;
  key ??= own;
  key ??= def.type === "monster" ? "monster_type_slime" : def.type === "npc" ? "npc_villager" : TYPE_SPRITE[def.type];
  return key ?? null;
}

/** 제자리 애니메이션을 하지 않는 오브젝트: 닫힘/열림 두 프레임인 상자·문, 그리고 door에 그린 정지 그림(부서진 다리 등) */
export function isStaticObject(def: Pick<MapObjectDef, "type">, key: string): boolean {
  return def.type === "door" || key === "obj_chest" || key === "obj_door";
}
