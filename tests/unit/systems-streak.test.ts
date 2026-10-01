import { describe, expect, it } from "vitest";
import type { StreakState } from "../../src/contracts/state";
import {
  addIceRune, createStreak, currentStreak, markActivity, repairOffer, settleStreak, todayCount, trimStreak, weekDays,
} from "../../src/systems/streak";
import { addDays } from "../../src/systems/time";
import { at } from "./systems-fixtures";

const empty = (over: Partial<StreakState> = {}): StreakState => ({ ...createStreak(at("2026-09-01")), ...over });

/** from부터 n일 연속 */
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

function play(s: StreakState, date: string, n: number, hour = 12, lastRepair?: string) {
  let r = markActivity(s, at(date, hour), { lastRepair });
  for (let i = 1; i < n; i++) r = markActivity(r.state, at(date, hour), { lastRepair });
  return r;
}

describe("streak counting", () => {
  it("첫 처치로 그날 인정, 같은 날은 한 번만", () => {
    const a = markActivity(empty(), at("2026-10-01"));
    expect(a.counted).toBe(true);
    expect(a.state.activeDays).toEqual(["2026-10-01"]);
    expect(a.state.todayCount).toBe(1);
    const b = markActivity(a.state, at("2026-10-01", 20));
    expect(b.counted).toBe(false);
    expect(b.state.activeDays).toEqual(["2026-10-01"]);
    expect(b.state.todayCount).toBe(2);
  });
  it("새벽 4시 전 활동은 전날로", () => {
    const a = markActivity(empty(), at("2026-10-01", 22));
    const b = markActivity(a.state, at("2026-10-02", 3, 30));
    expect(b.counted).toBe(false);
    expect(b.state.todayCount).toBe(2);
    const c = markActivity(b.state, at("2026-10-02", 4, 0));
    expect(c.counted).toBe(true);
    expect(c.state.todayCount).toBe(1);
    expect(c.state.activeDays).toEqual(["2026-10-01", "2026-10-02"]);
    expect(currentStreak(c.state, at("2026-10-02", 5))).toBe(2);
  });
  it("입력을 바꾸지 않음", () => {
    const s = empty({ activeDays: ["2026-09-30"] });
    markActivity(s, at("2026-10-01"));
    expect(s.activeDays).toEqual(["2026-09-30"]);
  });
  it("오늘 아직 안 했으면 어제까지로 센다", () => {
    const s = empty({ activeDays: days("2026-09-27", 4) }); // 9/27~9/30
    expect(currentStreak(s, at("2026-10-01"))).toBe(4);
    expect(currentStreak(s, at("2026-10-02"))).toBe(0);
    expect(todayCount(play(s, "2026-10-01", 2).state, at("2026-10-02"))).toBe(0);
  });
});

describe("protections", () => {
  it("하루 3번이면 불씨 1개, 상한 2", () => {
    const d1 = play(empty(), "2026-10-01", 3);
    expect(d1.emberCharged).toBe(true);
    expect(d1.state.embers).toBe(1);
    const d1b = play(d1.state, "2026-10-01", 3); // 같은 날 6번째까지
    expect(d1b.state.embers).toBe(1);
    const d2 = play(d1b.state, "2026-10-02", 3);
    expect(d2.state.embers).toBe(2);
    const d3 = play(d2.state, "2026-10-03", 3);
    expect(d3.emberCharged).toBe(false);
    expect(d3.state.embers).toBe(2);
    // 얼음 룬도 합산
    const r = play(empty({ iceRunes: 1, embers: 1 }), "2026-10-01", 3);
    expect(r.state.embers).toBe(1);
  });
  it("빠진 날은 돌아왔을 때 자동 소모(불씨 먼저)", () => {
    const s = empty({ activeDays: days("2026-09-28", 3), embers: 1, iceRunes: 1 }); // 9/28~9/30
    const r = markActivity(s, at("2026-10-03")); // 10/1, 10/2 빠짐
    expect(r.protectedNow).toEqual(["2026-10-01", "2026-10-02"]);
    expect(r.state.embers).toBe(0);
    expect(r.state.iceRunes).toBe(0);
    expect(r.state.protectedDays).toEqual(["2026-10-01", "2026-10-02"]);
    expect(currentStreak(r.state, at("2026-10-03"))).toBe(6);
    const one = markActivity(empty({ activeDays: ["2026-09-30"], embers: 1, iceRunes: 1 }), at("2026-10-02"));
    expect(one.state).toMatchObject({ embers: 0, iceRunes: 1 });
  });
  it("보호가 모자라면 쓰지 않고 끊김", () => {
    const s = empty({ activeDays: days("2026-09-25", 6), embers: 2 }); // 9/25~9/30
    const r = markActivity(s, at("2026-10-04")); // 3일 빠짐
    expect(r.protectedNow).toEqual([]);
    expect(r.state.embers).toBe(2);
    expect(currentStreak(r.state, at("2026-10-04"))).toBe(1);
  });
  it("활동 없이도 정산 결과로 연속 일수를 보여 주고, 정산은 멱등", () => {
    const s = empty({ activeDays: days("2026-09-28", 3), embers: 1 });
    expect(currentStreak(s, at("2026-10-02"))).toBe(4); // 10/1을 불씨로 메움
    const a = settleStreak(s, at("2026-10-02"));
    expect(a.protectedNow).toEqual(["2026-10-01"]);
    const b = settleStreak(a.state, at("2026-10-02"));
    expect(b.protectedNow).toEqual([]);
    expect(b.state).toBe(a.state);
    expect(settleStreak(s, at("2026-10-05")).broken).toBe(true);
  });
  it("얼음 룬 구매 상한", () => {
    const a = addIceRune(empty())!;
    expect(a.iceRunes).toBe(1);
    expect(addIceRune(a)!.iceRunes).toBe(2);
    expect(addIceRune(empty({ embers: 2 }))).toBeNull();
    expect(addIceRune(empty({ embers: 1, iceRunes: 1 }))).toBeNull();
  });
});

describe("repair", () => {
  const seven = empty({ activeDays: days("2026-09-23", 7) }); // 9/23~9/29

  it("7일 스트릭이 끊긴 지 48시간 안에 하루 전투 3개면 복구", () => {
    // 9/30, 10/1 빠짐 → 10/2에 복귀
    const r1 = play(seven, "2026-10-02", 1);
    expect(r1.repaired).toBeNull();
    expect(currentStreak(r1.state, at("2026-10-02"))).toBe(1);
    const r3 = play(seven, "2026-10-02", 3);
    expect(r3.repaired).toEqual(["2026-09-30", "2026-10-01"]);
    expect(currentStreak(r3.state, at("2026-10-02"))).toBe(10);
    // 4번째 전투에서 다시 일어나지 않음
    expect(markActivity(r3.state, at("2026-10-02")).repaired).toBeNull();
  });
  it("돌아온 날 1개, 다음 날 3개여도 48시간 안이면 복구", () => {
    const d1 = play(seven, "2026-10-01", 1); // 9/30 빠짐
    const d2 = play(d1.state, "2026-10-02", 3);
    expect(d2.repaired).toEqual(["2026-09-30"]);
    expect(currentStreak(d2.state, at("2026-10-02"))).toBe(10);
    // 48시간이 지나면 불가
    const late = play(d1.state, "2026-10-03", 3);
    expect(late.repaired).toBeNull();
  });
  it("조건 미달: 3일 빠짐, 6일 스트릭, 30일 안에 이미 복구", () => {
    expect(play(seven, "2026-10-03", 3).repaired).toBeNull();
    const six = empty({ activeDays: days("2026-09-24", 6) });
    expect(play(six, "2026-10-01", 3).repaired).toBeNull();
    expect(play(seven, "2026-10-01", 3, 12, "2026-09-10").repaired).toBeNull();
    expect(play(seven, "2026-10-01", 3, 12, "2026-09-01").repaired).toEqual(["2026-09-30"]);
  });
  it("보호로 다 메워지면 복구할 것이 없음", () => {
    const s = { ...seven, embers: 1 };
    expect(repairOffer(s, at("2026-10-01"))).toBeNull();
    expect(repairOffer(seven, at("2026-10-01"))).toEqual({ missedDays: ["2026-09-30"], previousStreak: 7 });
  });
});

describe("week count and trimming", () => {
  it("이번 주(월~일) 인정·보호 일수", () => {
    const s = empty({
      activeDays: ["2026-09-27", "2026-09-28", "2026-09-30", "2026-10-04"],
      protectedDays: ["2026-09-29"],
    });
    expect(weekDays(s, at("2026-10-01"))).toBe(4); // 9/27(일)은 지난주
    expect(weekDays(s, at("2026-10-05", 3))).toBe(4); // 월요일 새벽 3시는 아직 일요일
    expect(weekDays(s, at("2026-10-05", 4))).toBe(0);
  });
  it("60일 넘은 날짜는 지우되 이어지는 스트릭은 남김", () => {
    const old = days("2026-06-01", 10); // 끊긴 옛 기록
    const run = days("2026-06-20", 104); // 6/20 ~ 10/1
    const t = trimStreak(empty({ activeDays: [...old, ...run] }), "2026-10-01");
    expect(t.activeDays).not.toContain("2026-06-01");
    expect(t.activeDays).toContain("2026-06-20");
    expect(currentStreak(t, at("2026-10-01"))).toBe(104);
    const after = markActivity(t, at("2026-10-02"));
    expect(currentStreak(after.state, at("2026-10-02"))).toBe(105);
    // 끊긴 뒤에는 최근 60일만
    const broken = trimStreak(empty({ activeDays: run }), "2026-10-10");
    expect(broken.activeDays[0]).toBe(addDays("2026-10-10", -59));
  });
});
