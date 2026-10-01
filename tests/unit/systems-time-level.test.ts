import { describe, expect, it } from "vitest";
import {
  accessorySlots, CURVE_A, CURVE_B, LEVEL_CAP, levelFromXp, levelProgress, maxHp, xpForLevel, xpToNext,
} from "../../src/systems/level";
import { addDays, daysBetween, isDateString, studyDate, weekDates, weekStart } from "../../src/systems/time";
import { at } from "./systems-fixtures";

describe("time", () => {
  it("새벽 4시 경계", () => {
    expect(studyDate(at("2026-10-02", 3, 59))).toBe("2026-10-01");
    expect(studyDate(at("2026-10-02", 4, 0))).toBe("2026-10-02");
    expect(studyDate(at("2026-10-01", 23, 59))).toBe("2026-10-01");
    expect(studyDate(at("2026-10-02", 0, 30))).toBe("2026-10-01");
  });
  it("월·연 경계를 넘는 새벽", () => {
    expect(studyDate(at("2026-11-01", 1))).toBe("2026-10-31");
    expect(studyDate(at("2027-01-01", 2))).toBe("2026-12-31");
    expect(studyDate(at("2028-03-01", 3))).toBe("2028-02-29");
  });
  it("날짜 산술", () => {
    expect(addDays("2026-10-01", 1)).toBe("2026-10-02");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween("2026-10-05", "2026-10-01")).toBe(-4);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
  it("주는 월요일부터", () => {
    expect(weekStart("2026-10-01")).toBe("2026-09-28"); // 목 → 월
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // 일 → 같은 주 월
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // 월
    expect(weekDates("2026-10-01")).toHaveLength(7);
    expect(weekDates("2026-10-01")[6]).toBe("2026-10-04");
  });
  it("날짜 문자열 검사", () => {
    expect(isDateString("2026-10-01")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-1-01")).toBe(false);
    expect(isDateString(20261001)).toBe(false);
  });
});

describe("level curve", () => {
  it("레벨 1 시작, 상한 30", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(-50)).toBe(1);
    expect(levelFromXp(10_000_000)).toBe(LEVEL_CAP);
    expect(xpToNext(10_000_000)).toBe(0);
  });
  it("문턱이 단조 증가하고 레벨 계산과 정확히 맞음", () => {
    let prev = -1;
    for (let L = 1; L <= LEVEL_CAP; L++) {
      const x = xpForLevel(L);
      expect(x).toBeGreaterThan(prev);
      expect(levelFromXp(x)).toBe(L);
      if (L > 1) expect(levelFromXp(x - 1)).toBe(L - 1);
      prev = x;
    }
    // 필요 XP 간격도 점점 커짐(로그 곡선)
    for (let L = 2; L < LEVEL_CAP; L++) {
      expect(xpForLevel(L + 1) - xpForLevel(L)).toBeGreaterThanOrEqual(xpForLevel(L) - xpForLevel(L - 1));
    }
  });
  it("레벨 함수가 XP에 대해 단조", () => {
    let prev = 1;
    for (let x = 0; x <= 80_000; x += 37) {
      const lv = levelFromXp(x);
      expect(lv).toBeGreaterThanOrEqual(prev);
      prev = lv;
    }
  });
  it("공식 형태 그대로", () => {
    for (const x of [0, 100, 999, 5000, 20000, 60000]) {
      const f = Math.min(LEVEL_CAP, Math.floor(CURVE_A * Math.log((x + CURVE_B) / CURVE_B)) + 1);
      expect(levelFromXp(x)).toBe(f);
    }
  });
  it("전체 커리큘럼 XP 예산에서 레벨 30 근처", () => {
    const battles = 160 * 100 + 34 * 250 + 8 * 400 + 17 * 1000;
    const lessons = 70 * 30;
    const total = battles * 1.5 + lessons;
    expect(total).toBe(69_150);
    expect(Math.abs(xpForLevel(30) - total) / total).toBeLessThan(0.02);
    expect(levelFromXp(total)).toBe(30);
    expect(levelFromXp(total * 0.9)).toBeLessThan(30);
    // 그림자 없이 본편만 하면 20대 후반
    expect(levelFromXp(battles + lessons)).toBeGreaterThanOrEqual(25);
    expect(levelFromXp(battles + lessons)).toBeLessThan(30);
    // 지역 1(일반 8×100 + 응용 250 + 보스 1000 + 레슨 4×30)
    const r01 = 8 * 100 + 250 + 1000 + 120;
    expect(levelFromXp(r01)).toBeGreaterThanOrEqual(5);
    expect(levelFromXp(r01)).toBeLessThan(10);
    // 첫 레벨업은 전투 두세 개 안에
    expect(xpForLevel(2)).toBeLessThanOrEqual(300);
  });
  it("xpToNext와 진행도", () => {
    expect(xpToNext(0)).toBe(xpForLevel(2));
    expect(xpToNext(xpForLevel(5) + 10)).toBe(xpForLevel(6) - xpForLevel(5) - 10);
    const p = levelProgress(xpForLevel(3) + 5);
    expect(p).toMatchObject({ level: 3, current: 5, needed: xpForLevel(4) - xpForLevel(3) });
    expect(levelProgress(1e9).ratio).toBe(1);
  });
  it("최대 HP와 장신구 슬롯", () => {
    expect(maxHp(1)).toBe(100);
    expect(maxHp(30)).toBe(245);
    expect(maxHp(31)).toBe(245);
    expect(maxHp(1, 20)).toBe(120);
    for (let L = 2; L <= 30; L++) expect(maxHp(L)).toBeGreaterThan(maxHp(L - 1));
    expect(accessorySlots(1)).toBe(1);
    expect(accessorySlots(9)).toBe(1);
    expect(accessorySlots(10)).toBe(2);
    expect(accessorySlots(19)).toBe(2);
    expect(accessorySlots(20)).toBe(3);
    expect(accessorySlots(30)).toBe(3);
  });
});
