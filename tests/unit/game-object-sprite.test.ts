// 맵 오브젝트 스프라이트(src/game/objectSprite.ts): door의 sprite 속성(고장 난 다리, region07-spec.md §9.1)
import { describe, expect, it } from "vitest";
import { manifest } from "../../src/contracts/assets";
import { isStaticObject, objectSpriteKey } from "../../src/game/objectSprite";

const known = (name: string) => name in manifest.sprites;
const def = (type: string, props: Record<string, unknown> = {}) => ({ type, props }) as Parameters<typeof objectSpriteKey>[0];

describe("objectSpriteKey", () => {
  it("door: sprite가 manifest에 있으면 그 그림, 없거나 비었으면 obj_door", () => {
    expect(objectSpriteKey(def("door", { sprite: "obj_sign" }), [], known)).toBe("obj_sign");
    expect(objectSpriteKey(def("door", { sprite: "obj_bridge_broken" }), [], () => true)).toBe("obj_bridge_broken");
    expect(objectSpriteKey(def("door", { sprite: "obj_bridge_broken" }), [], () => false)).toBe("obj_door");
    expect(objectSpriteKey(def("door", { sprite: "" }), [], known)).toBe("obj_door");
    expect(objectSpriteKey(def("door", { puzzle: "Z0701" }), [], known)).toBe("obj_door");
  });

  it("다른 종류는 지금과 같다", () => {
    const problems = [{ id: "P0101", enemy: { name: "슬라임", sprite: "monster_type_slime", attack: 20 } }];
    expect(objectSpriteKey(def("monster", { problem: "P0101", sprite: "obj_sign" }), problems, known)).toBe("monster_type_slime");
    expect(objectSpriteKey(def("monster", { problem: "P9999" }), problems, known)).toBe("monster_type_slime");
    expect(objectSpriteKey(def("npc", { sprite: "npc_new_person" }), [], known)).toBe("npc_new_person");
    expect(objectSpriteKey(def("npc"), [], known)).toBe("npc_villager");
    expect(objectSpriteKey(def("warp"), [], known)).toBe("obj_door");
    expect(objectSpriteKey(def("chest"), [], known)).toBe("obj_chest");
    expect(objectSpriteKey(def("trigger", { sprite: "obj_sign" }), [], known)).toBeNull();
    expect(objectSpriteKey(def("spawn"), [], known)).toBeNull();
  });

  it("door에 그린 그림은 제자리 애니메이션을 하지 않는다", () => {
    expect(isStaticObject(def("door"), "obj_bridge_broken")).toBe(true);
    expect(isStaticObject(def("chest"), "obj_chest")).toBe(true);
    expect(isStaticObject(def("warp"), "obj_door")).toBe(true);
    expect(isStaticObject(def("sign"), "obj_sign")).toBe(false);
  });
});
