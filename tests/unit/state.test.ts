import { afterEach, describe, expect, it, vi } from "vitest";
import type { SaveData } from "../../src/contracts/state";
import { applyBattleOutcome } from "../../src/systems/battle";
import { exportSave, importSave, MIGRATIONS, parseSave, SaveImportError } from "../../src/state/exportImport";
import { createNewSave, DEFAULT_PLAYER_NAME } from "../../src/state/newGame";
import { createAutosaver, memoryBackend, requestPersistence, SaveStore, SaveStoreError, type SaveBackend } from "../../src/state/store";
import { validateSave } from "../../src/state/validate";
import { at, outcome, problem } from "./systems-fixtures";

const NOW = at("2026-10-01", 9);

function richSave(): SaveData {
  let s = createNewSave(NOW, { spawn: { x: 4, y: 6, facing: "up" } });
  s = applyBattleOutcome(s, problem(), outcome({ maxHintLevel: 2, finalCode: "a, b = map(int, input().split())\nprint(a + b)" }), NOW).save;
  s = applyBattleOutcome(s, problem({ id: "P0102", concept: "S1-ops" }), outcome({ problemId: "P0102", result: "knockout", hpLeft: 0 }), NOW).save;
  s.flags["intro.seen"] = true;
  s.inventory["potion"] = 2;
  s.removedObjects.push("monster_P0101");
  s.scrolls.push("S1-io");
  return s;
}

describe("createNewSave", () => {
  it("r01, 스폰 위치, 레벨 1 HP, 빈 기록", () => {
    const s = createNewSave(NOW, { spawn: { x: 4, y: 6 } });
    expect(s).toMatchObject({
      version: 1,
      player: { name: DEFAULT_PLAYER_NAME, xp: 0, gold: 0, hp: 100 },
      location: { regionId: "r01", x: 4, y: 6, facing: "down" },
      lastCampfire: { regionId: "r01", x: 4, y: 6 },
      problems: {},
      shadows: [],
      history: [],
    });
    expect(s.player.name).toBe("주문사");
    expect(s.streak).toEqual({ activeDays: [], embers: 0, iceRunes: 0, protectedDays: [], todayDate: "2026-10-01", todayCount: 0 });
    expect(s.createdAt).toBe(NOW.toISOString());
    expect(validateSave(s).ok).toBe(true);
    expect(createNewSave(NOW, { spawn: { x: 0, y: 0 }, name: "  " }).player.name).toBe("주문사");
    expect(createNewSave(NOW, { spawn: { x: 0, y: 0 }, name: "하늘" }).player.name).toBe("하늘");
  });
});

describe("validateSave", () => {
  it("진행한 데이터도 통과", () => {
    expect(validateSave(richSave())).toMatchObject({ ok: true });
  });
  const broken: [string, (s: any) => void, string][] = [
    ["필드 누락", (s) => delete s.player, "'player' 항목이 없습니다"],
    ["모르는 필드", (s) => (s.cheat = true), "cheat: 알 수 없는 항목"],
    ["음수 XP", (s) => (s.player.xp = -1), "player.xp: 0 이상"],
    ["소수 골드", (s) => (s.player.gold = 1.5), "player.gold: 정수"],
    ["잘못된 방향", (s) => (s.location.facing = "north"), "location.facing"],
    ["힌트 단계 4", (s) => (s.problems.P0101.maxHintLevel = 4), "problems.P0101.maxHintLevel: 0~3"],
    ["칸 6", (s) => (s.shadows[0].box = 6), "shadows[0].box: 0~5"],
    ["날짜 형식", (s) => (s.shadows[0].due = "10/02/2026"), "shadows[0].due: YYYY-MM-DD"],
    ["중복 개념", (s) => s.shadows.push({ ...s.shadows[0] }), "두 번 등록"],
    ["보호 3개", (s) => ((s.streak.embers = 2), (s.streak.iceRunes = 1)), "합쳐서 2개"],
    ["잘못된 grade", (s) => (s.history[0].grade = "perfect"), "history[0].grade"],
    ["flags 값", (s) => (s.flags.x = "yes"), "flags.x: true/false"],
    ["ISO 시각", (s) => (s.updatedAt = "어제"), "updatedAt: ISO"],
    ["배열 자리에 객체", (s) => (s.scrolls = {}), "scrolls: 배열"],
  ];
  for (const [name, mutate, msg] of broken) {
    it(`거부: ${name}`, () => {
      const s: any = structuredClone(richSave());
      mutate(s);
      const r = validateSave(s);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join("\n")).toContain(msg);
    });
  }
  it("객체가 아니면 거부", () => {
    expect(validateSave(null).ok).toBe(false);
    expect(validateSave([]).ok).toBe(false);
  });
});

describe("export / import", () => {
  it("왕복하면 같은 데이터", () => {
    const s = richSave();
    const { text, filename } = exportSave(s, at("2026-10-01", 21, 5));
    expect(filename).toBe("pyrpg-save-20261001-2105.json");
    expect(text).toContain('\n  "version": 1');
    expect(importSave(text)).toEqual(s);
    expect(importSave("﻿" + text)).toEqual(s);
  });
  it("파일 이름 기본값은 updatedAt", () => {
    expect(exportSave(richSave()).filename).toMatch(/^pyrpg-save-\d{8}-\d{4}\.json$/);
  });
  it("깨진 파일은 한국어 오류", () => {
    expect(() => importSave("")).toThrow("비어 있습니다");
    expect(() => importSave("{nope")).toThrow(/JSON 형식이 아닙니다/);
    expect(() => importSave("[1,2]")).toThrow("JSON 객체");
    expect(() => importSave('{"hello": 1}')).toThrow("버전");
    const s: any = richSave();
    s.version = 2;
    expect(() => importSave(JSON.stringify(s))).toThrow(/더 새로운 게임 버전\(v2\)/);
    s.version = 1;
    s.player.hp = "많음";
    try {
      importSave(JSON.stringify(s));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(SaveImportError);
      expect((e as SaveImportError).issues).toEqual(["player.hp: 정수여야 합니다"]);
      expect((e as Error).message).toContain("올바르지 않습니다");
    }
  });
  it("마이그레이션 훅: 옛 버전에 변환이 없으면 오류", () => {
    const s: any = richSave();
    s.version = 0;
    expect(() => parseSave(s)).toThrow("버전");
    expect(MIGRATIONS).toEqual({});
  });
});

describe("SaveStore (memory backend)", () => {
  it("저장하면 updatedAt 갱신, 불러오기는 검증된 데이터", async () => {
    const backend = memoryBackend();
    const store = new SaveStore(backend, () => at("2026-10-02", 8));
    expect(await store.load()).toBeNull();
    const s = richSave();
    const saved = await store.save(s);
    expect(saved.updatedAt).toBe(at("2026-10-02", 8).toISOString());
    expect(s.updatedAt).toBe(NOW.toISOString()); // 입력 불변
    expect(await store.load()).toEqual(saved);
    await store.clear();
    expect(await store.load()).toBeNull();
  });
  it("손상된 데이터는 corrupt 오류(원본 포함)", async () => {
    const store = new SaveStore(memoryBackend({ version: 1, player: 3 }));
    await expect(store.load()).rejects.toMatchObject({ name: "SaveStoreError", code: "corrupt" });
    try {
      await store.load();
    } catch (e) {
      expect((e as SaveStoreError).issues.length).toBeGreaterThan(0);
      expect((e as SaveStoreError).raw).toEqual({ version: 1, player: 3 });
    }
  });
  it("백엔드 실패는 read/write/quota로", async () => {
    const boom = (err: unknown): SaveBackend => ({
      get: () => Promise.reject(err),
      put: () => Promise.reject(err),
      remove: () => Promise.reject(err),
    });
    const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
    await expect(new SaveStore(boom(new Error("x"))).load()).rejects.toMatchObject({ code: "read" });
    await expect(new SaveStore(boom(new Error("x"))).save(richSave())).rejects.toMatchObject({ code: "write" });
    await expect(new SaveStore(boom(quota)).save(richSave())).rejects.toMatchObject({ code: "quota" });
    await expect(new SaveStore(boom(new Error("x"))).clear()).rejects.toMatchObject({ code: "write" });
  });
  it("IndexedDB가 없으면 unavailable", async () => {
    const store = new SaveStore(); // node에는 indexedDB가 없음
    await expect(store.load()).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("autosave", () => {
  afterEach(() => vi.useRealTimers());
  it("디바운스: 마지막 데이터만 한 번 저장", async () => {
    vi.useFakeTimers();
    const saves: SaveData[] = [];
    const store = { save: async (d: SaveData) => (saves.push(d), d) };
    const auto = createAutosaver(store, { delayMs: 500 });
    const a = richSave();
    const b = { ...a, player: { ...a.player, gold: 999 } };
    auto.schedule(a);
    await vi.advanceTimersByTimeAsync(300);
    auto.schedule(b);
    expect(auto.pending).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(saves).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(saves).toEqual([b]);
    expect(auto.pending).toBe(false);
  });
  it("flush는 즉시, cancel은 취소, 오류는 onError로", async () => {
    vi.useFakeTimers();
    const saves: SaveData[] = [];
    const errors: SaveStoreError[] = [];
    let fail = false;
    const store = {
      save: async (d: SaveData) => {
        if (fail) throw new SaveStoreError("quota", "full");
        saves.push(d);
        return d;
      },
    };
    const auto = createAutosaver(store, { delayMs: 1000, onError: (e) => errors.push(e) });
    auto.schedule(richSave());
    await auto.flush();
    expect(saves).toHaveLength(1);
    auto.schedule(richSave());
    auto.cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saves).toHaveLength(1);
    fail = true;
    auto.schedule(richSave());
    await auto.flush();
    expect(errors.map((e) => e.code)).toEqual(["quota"]);
  });
  it("saveNow는 진행 중인 자동 저장 뒤에 써서, 늦게 끝난 옛 자동 저장이 새 데이터를 덮지 않는다", async () => {
    let stored: SaveData | null = null;
    let releaseSlow!: () => void;
    let first = true;
    const store = {
      save: async (d: SaveData) => {
        if (first) {
          // 첫 자동 저장(옛 데이터)이 느리게 끝난다
          first = false;
          await new Promise<void>((r) => (releaseSlow = r));
        }
        stored = d;
        return d;
      },
    };
    const auto = createAutosaver(store, { delayMs: 1000 });
    const old = richSave();
    const fresh = { ...old, player: { ...old.player, gold: 12345 } };
    auto.schedule(old);
    const slow = auto.flush();
    const now = auto.saveNow(fresh);
    await vi.waitFor(() => expect(releaseSlow).toBeTypeOf("function"));
    releaseSlow();
    await slow;
    expect(await now).toBe(fresh);
    expect(stored).toBe(fresh);
  });
  it("saveNow 실패는 reject, 대기 중인 자동 저장은 버린다", async () => {
    vi.useFakeTimers();
    const saves: SaveData[] = [];
    const store = {
      save: async (d: SaveData) => {
        if (d.player.gold === -1) throw new SaveStoreError("quota", "full");
        saves.push(d);
        return d;
      },
    };
    const auto = createAutosaver(store, { delayMs: 500 });
    auto.schedule(richSave());
    const bad = richSave();
    bad.player.gold = -1;
    await expect(auto.saveNow(bad)).rejects.toMatchObject({ code: "quota" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(saves).toHaveLength(0);
    // 실패 뒤에도 다음 저장은 동작한다
    await auto.saveNow(richSave());
    expect(saves).toHaveLength(1);
  });
});

describe("validateSave 위치", () => {
  it("위치·캠프파이어 좌표는 정수여야 한다(소수 좌표는 충돌 판정을 건너뛴다)", () => {
    const s = richSave() as unknown as Record<string, any>;
    s.location.x = 3.5;
    s.lastCampfire.y = 1.25;
    const r = validateSave(s);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join("\n")).toContain("location.x");
      expect(r.errors.join("\n")).toContain("lastCampfire.y");
    }
  });
});

describe("requestPersistence", () => {
  it("지원하지 않으면 false", async () => {
    expect(await requestPersistence()).toBe(false);
  });
});
