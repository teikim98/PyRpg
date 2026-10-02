// 기록관의 안경과 상자 아이템(docs/phase3/region04-spec.md §4.1, §6): 해설 규칙 → 레슨, 버튼 조건, 아이템 지급
import { describe, expect, it } from "vitest";
import { codexLinkFor } from "../../src/app/codexLink";
import { objectParticle } from "../../src/app/josa";
import { loadContent } from "../../src/content/loader";
import type { ItemDef, TracebackRule } from "../../src/contracts/content";
import type { PyError } from "../../src/contracts/runner";
import { explainError, lessonForError } from "../../src/python/explain";
import { FATAL_MESSAGE } from "../../src/python/protocol";
import { equipmentEffects, grantItem, MAX_PROTECTIONS } from "../../src/systems";
import { newSave } from "./systems-fixtures";

const content = loadContent();
const rules = content.traceback;
const lessons = content.regions.flatMap((r) => r.lessons);
const items = content.items;
const item = (id: string): ItemDef => items.find((i) => i.id === id)!;
const err = (type: string, message: string): PyError => ({ type, message, traceback: `${type}: ${message}\n` });

describe("traceback.json의 lesson", () => {
  it("모든 lesson은 실제 레슨 ID", () => {
    const ids = new Set(lessons.map((l) => l.id));
    const used = rules.filter((r) => r.lesson !== undefined);
    expect(used.length).toBeGreaterThan(10);
    for (const r of used) expect(ids.has(r.lesson!), `${r.exception} ${r.pattern ?? "(기본)"} → ${r.lesson}`).toBe(true);
  });

  // 실제 CPython 3.12 에러 메시지(tools/verify_content.py의 표본과 같은 코드로 만든 것) → 해설 규칙의 레슨
  const cases: [string, string, string | undefined][] = [
    ["NameError", "name 'true' is not defined", "L1-2"],
    ["NameError", "name 'console' is not defined", "L1-1"],
    ["NameError", "name 'prnt' is not defined", undefined],
    ["TypeError", 'can only concatenate str (not "int") to str', "L1-2"],
    ["TypeError", "can't multiply sequence by non-int of type 'str'", "L1-4"],
    ["TypeError", "not all arguments converted during string formatting", "L1-2"],
    ["TypeError", "unsupported operand type(s) for -: 'str' and 'str'", "L1-2"],
    ["TypeError", "object of type 'int' has no len()", "L1-2"],
    ["TypeError", "'NoneType' object is not subscriptable", "L3-3"],
    ["ValueError", "invalid literal for int() with base 10: '1 2'", "L1-2"],
    ["ValueError", "Exceeds the limit (4300 digits) for integer string conversion; use sys.set_int_max_str_digits() to increase the limit", "L1-3"],
    ["ValueError", "not enough values to unpack (expected 2, got 1)", "L1-2"],
    ["ValueError", "max() iterable argument is empty", "L3-2"],
    ["IndexError", "list index out of range", "L3-1"],
    ["ZeroDivisionError", "division by zero", "L1-3"],
    ["SyntaxError", "invalid syntax. Maybe you meant '==' or ':=' instead of '='?", "L2-1"],
    ["IndentationError", "expected an indented block after function definition on line 1", "L2-1"],
    ["EOFError", "EOF when reading a line", "L2-4"],
    ["AttributeError", "'list' object has no attribute 'push'", "L3-3"],
    ["AttributeError", "'list' object has no attribute 'filter'", "L3-4"],
    ["AttributeError", "'str' object has no attribute 'length'", "L1-2"],
    ["AttributeError", "'int' object has no attribute 'strip'", "L1-2"],
    ["RecursionError", "maximum recursion depth exceeded", undefined],
    // 지역 4 문자열 규칙: L4 레슨으로 연결
    ["TypeError", "'str' object does not support item assignment", "L4-1"],
    ["TypeError", "sequence item 0: expected str instance, int found", "L4-3"],
    ["ValueError", "substring not found", "L4-2"],
    ["AttributeError", "'str' object has no attribute 'push'", "L4-3"],
    ["AttributeError", "'str' object has no attribute 'toUpperCase'", "L4-2"],
    ["IndexError", "string index out of range", "L4-1"],
  ];
  it.each(cases)("%s: %s → %s", (type, message, lesson) => {
    expect(lessonForError(err(type, message), rules)).toBe(lesson);
  });

  it("문자열 새 규칙은 기본 규칙이 아니라 전용 해설이 걸린다", () => {
    const text = (type: string, message: string) => explainError(err(type, message), rules);
    expect(text("TypeError", "'str' object does not support item assignment")).toContain("list(s)");
    expect(text("TypeError", "'str' object doesn't support item deletion")).toContain("list(s)");
    expect(text("TypeError", "sequence item 2: expected str instance, float found")).toContain("map(str");
    expect(text("ValueError", "substring not found")).toContain("find()");
    // 문자열의 push·append는 리스트용 해설(append를 써)이 아니라 문자열 해설
    expect(text("AttributeError", "'str' object has no attribute 'append'")).toContain('"".join');
    expect(text("AttributeError", "'str' object has no attribute 'push'")).not.toContain("arr.append(x)`.");
    expect(text("AttributeError", "'list' object has no attribute 'push'")).toContain("append");
    for (const name of ["toUpperCase", "trim", "includes", "indexOf", "startsWith", "replaceAll", "charAt", "substring"]) {
      expect(text("AttributeError", `'str' object has no attribute '${name}'`), name).toContain("JS 문자열 주문");
    }
  });

  it("fatal(브라우저 스택 초과)은 패턴 규칙만 보므로 RecursionError 기본 규칙의 레슨을 쓰지 않는다", () => {
    const withLesson: TracebackRule[] = [{ exception: "RecursionError", text: "기본", lesson: "L2-3" }];
    expect(lessonForError(err("RecursionError", "maximum recursion depth exceeded"), withLesson)).toBe("L2-3");
    expect(lessonForError(err("RecursionError", FATAL_MESSAGE), withLesson)).toBeUndefined();
  });
});

describe("codexLinkFor(버튼을 보일 조건)", () => {
  const concat = err("TypeError", 'can only concatenate str (not "int") to str');
  const ctx = (mutate: (s: ReturnType<typeof newSave>) => void) => {
    const save = newSave();
    mutate(save);
    return { rules, lessons, items, save };
  };

  it("안경을 끼고 + 규칙에 레슨이 있고 + 그 레슨을 배웠으면 레슨 ID와 제목", () => {
    const c = ctx((s) => {
      s.inventory["archivist-glasses"] = 1;
      s.equipment = ["archivist-glasses"];
      s.lessonsCompleted = ["L1-1", "L1-2"];
    });
    const l12 = lessons.find((l) => l.id === "L1-2")!;
    expect(codexLinkFor(concat, c)).toEqual({ id: "L1-2", title: l12.title });
  });

  it("안경이 없으면(가지고만 있어도) 없음", () => {
    const c = ctx((s) => {
      s.inventory["archivist-glasses"] = 1;
      s.lessonsCompleted = ["L1-2"];
    });
    expect(codexLinkFor(concat, c)).toBeUndefined();
  });

  it("레슨을 아직 안 배웠으면 없음", () => {
    const c = ctx((s) => {
      s.equipment = ["archivist-glasses"];
      s.lessonsCompleted = ["L1-1"];
    });
    expect(codexLinkFor(concat, c)).toBeUndefined();
    // 배운 레슨이어도 규칙에 lesson이 없으면 없음
    c.save.lessonsCompleted = lessons.map((l) => l.id);
    expect(codexLinkFor(err("NameError", "name 'prnt' is not defined"), c)).toBeUndefined();
    expect(codexLinkFor(concat, c)?.id).toBe("L1-2");
  });

  it("안경의 효과는 codexLinks(준비 중 아님)", () => {
    expect(item("archivist-glasses").pending).toBeUndefined();
    const s = newSave();
    s.equipment = ["archivist-glasses"];
    expect(equipmentEffects(s, items)).toEqual({ maxHpBonus: 0, guideFeather: false, targetComplexity: false, codexLinks: true });
  });
});

describe("grantItem(상자 아이템)", () => {
  it("장신구는 하나만: 이미 있으면 주지 않고 입력도 그대로", () => {
    const s = newSave();
    const r = grantItem(s, item("archivist-glasses"));
    expect(r.granted).toBe(true);
    expect(r.save.inventory["archivist-glasses"]).toBe(1);
    expect(s.inventory["archivist-glasses"]).toBeUndefined();
    const again = grantItem(r.save, item("archivist-glasses"));
    expect(again.granted).toBe(false);
    expect(again.save).toBe(r.save);
    expect(again.save.inventory["archivist-glasses"]).toBe(1);
  });

  it("소모품은 최대 보유 수까지, 얼음 룬은 보호 수 상한까지", () => {
    let s = newSave();
    const potion = item("potion");
    for (let i = 0; i < potion.maxStack!; i++) s = grantItem(s, potion).save;
    expect(s.inventory.potion).toBe(potion.maxStack);
    expect(grantItem(s, potion).granted).toBe(false);
    s = newSave();
    for (let i = 0; i < MAX_PROTECTIONS; i++) s = grantItem(s, item("ice-rune")).save;
    expect(grantItem(s, item("ice-rune")).granted).toBe(false);
  });
});

describe("objectParticle", () => {
  it("받침에 맞는 목적격 조사", () => {
    expect(`기록관의 안경${objectParticle("기록관의 안경")}`).toBe("기록관의 안경을");
    expect(`길잡이 깃털${objectParticle("길잡이 깃털")}`).toBe("길잡이 깃털을");
    expect(`회복약${objectParticle("회복약")}`).toBe("회복약을");
    expect(`모래시계 부적${objectParticle("모래시계 부적")}`).toBe("모래시계 부적을");
    expect(objectParticle("메아리 고리")).toBe("를");
    expect(objectParticle("주문사 염료: 새벽빛")).toBe("을");
    expect(objectParticle("Pyodide")).toBe("을(를)");
    expect(objectParticle("")).toBe("을(를)");
  });
});
