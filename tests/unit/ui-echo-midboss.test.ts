// 단위 3-6 시스템(docs/phase3/region06-spec.md §7): 메아리 고리 거터 문구, 중간 보스 표시·판정 규칙(순수 함수)
import { describe, expect, it } from "vitest";
import { isFinalBoss } from "../../src/systems";
import { bossKind, bossPhases, disclosureMode, formatLineCount, lineCountLabels } from "../../src/ui/battleLogic";
import { isTimeBarrier } from "../../src/python/limits";
import { P0101, P0105 } from "../fixtures/ui/problems";

describe("메아리 고리: 줄별 실행 횟수 표시", () => {
  it("1만 미만은 그대로, 10만 미만은 소수 한 자리 만, 100만 미만은 정수 만, 그 이상은 ×99만+(모두 내림)", () => {
    expect(formatLineCount(0)).toBe("×0");
    expect(formatLineCount(1)).toBe("×1");
    expect(formatLineCount(9999)).toBe("×9999");
    expect(formatLineCount(10_000)).toBe("×1만");
    expect(formatLineCount(12_345)).toBe("×1.2만");
    expect(formatLineCount(19_999)).toBe("×1.9만");
    expect(formatLineCount(99_999)).toBe("×9.9만");
    expect(formatLineCount(100_000)).toBe("×10만");
    expect(formatLineCount(123_456)).toBe("×12만");
    expect(formatLineCount(999_999)).toBe("×99만");
    expect(formatLineCount(1_000_000)).toBe("×99만+");
    expect(formatLineCount(5e9)).toBe("×99만+");
    expect(formatLineCount(Number.NaN)).toBe("×0");
  });

  it("거터 표시는 줄 순서, 정확한 횟수는 title. 0번·이상한 줄 번호는 뺀다", () => {
    expect(lineCountLabels({ 3: 12_345, 1: 2, 0: 5, 2: 0 })).toEqual([
      { line: 1, text: "×2", title: "1번째 줄: 2번 실행" },
      { line: 3, text: "×1.2만", title: "3번째 줄: 12,345번 실행" },
    ]);
    expect(lineCountLabels({})).toEqual([]);
  });
});

describe("중간 보스(midBoss)", () => {
  const mid = { ...P0105, id: "P0608", midBoss: true };

  it("이름은 '중간 보스', 최종 보스는 '보스', 일반 몬스터는 null", () => {
    expect(bossKind(mid)).toBe("중간 보스");
    expect(bossKind(P0105)).toBe("보스");
    expect(bossKind(P0101)).toBeNull();
    // boss가 아닌데 midBoss만 붙은 잘못된 데이터는 보스가 아니다
    expect(bossKind({ boss: false, midBoss: true })).toBeNull();
  });

  it("지역 클리어는 최종 보스만", () => {
    expect(isFinalBoss(P0105)).toBe(true);
    expect(isFinalBoss(mid)).toBe(false);
    expect(isFinalBoss(P0101)).toBe(false);
  });

  it("보스와 같은 페이즈·판정 공개(verdictOnly)·시간 결계", () => {
    expect(bossPhases(mid)).toEqual([1, 2]);
    expect(disclosureMode(6, mid.boss)).toBe("verdictOnly");
    const phase2 = mid.tests.find((t) => t.phase === 2)!;
    expect(isTimeBarrier(mid, phase2)).toBe(true);
  });
});
