// 받침에 맞는 조사(src/app/josa.ts, docs/phase3/region05-spec.md §7)
import { describe, expect, it } from "vitest";
import {
  andParticle,
  directionParticle,
  hasFinalConsonant,
  josa,
  objectParticle,
  subjectParticle,
  topicParticle,
  withJosa,
} from "../../src/app/josa";

describe("hasFinalConsonant", () => {
  it("한글은 마지막 글자의 받침으로", () => {
    expect(hasFinalConsonant("사서 골렘")).toBe(true);
    expect(hasFinalConsonant("고블린 족장")).toBe(true);
    expect(hasFinalConsonant("거울 슬라임")).toBe(true);
    expect(hasFinalConsonant("상자 게")).toBe(false);
    expect(hasFinalConsonant("계단 미믹")).toBe(true);
    expect(hasFinalConsonant("메아리 고리")).toBe(false);
  });
  it("숫자는 한국어로 읽은 소리로(1 일, 2 이, 10 십 …)", () => {
    expect(hasFinalConsonant("1")).toBe(true);
    expect(hasFinalConsonant("2")).toBe(false);
    expect(hasFinalConsonant("3")).toBe(true);
    expect(hasFinalConsonant("4")).toBe(false);
    expect(hasFinalConsonant("5")).toBe(false);
    expect(hasFinalConsonant("6")).toBe(true);
    expect(hasFinalConsonant("7")).toBe(true);
    expect(hasFinalConsonant("8")).toBe(true);
    expect(hasFinalConsonant("9")).toBe(false);
    expect(hasFinalConsonant("10")).toBe(true);
    expect(hasFinalConsonant("2026-09-30")).toBe(true);
  });
  it("닫는 괄호·따옴표·공백은 건너뛰고 본다", () => {
    expect(hasFinalConsonant("「첫 주문」")).toBe(true);
    expect(hasFinalConsonant("「시간을 돌린 자」")).toBe(false);
    expect(hasFinalConsonant("회복약(소)")).toBe(false);
    expect(hasFinalConsonant("사서 골렘 ")).toBe(true);
  });
  it("영어·빈 문자열은 알 수 없음", () => {
    expect(hasFinalConsonant("Pyodide")).toBeUndefined();
    expect(hasFinalConsonant("")).toBeUndefined();
    expect(hasFinalConsonant("」")).toBeUndefined();
  });
});

describe("josa", () => {
  it("을/를", () => {
    expect(withJosa("사서 골렘", "을/를")).toBe("사서 골렘을");
    expect(withJosa("상자 게", "을/를")).toBe("상자 게를");
    expect(objectParticle("메아리 고리")).toBe("를");
    expect(objectParticle("Pyodide")).toBe("을(를)");
  });
  it("이/가", () => {
    expect(withJosa("고블린 족장", "이/가")).toBe("고블린 족장이");
    expect(withJosa("층층 게", "이/가")).toBe("층층 게가");
    expect(subjectParticle("2026-09-30")).toBe("이");
    expect(subjectParticle("2026-10-02")).toBe("가");
    expect(subjectParticle("Golem")).toBe("이(가)");
  });
  it("은/는", () => {
    expect(withJosa("얼음 룬", "은/는")).toBe("얼음 룬은");
    expect(withJosa("누리", "은/는")).toBe("누리는");
    expect(topicParticle("x")).toBe("은(는)");
  });
  it("과/와", () => {
    expect(withJosa("문자열", "과/와")).toBe("문자열과");
    expect(withJosa("리스트", "과/와")).toBe("리스트와");
    expect(andParticle("dict")).toBe("과(와)");
  });
  it("으로/로: ㄹ 받침은 '로'", () => {
    expect(withJosa("캠프파이어", "으로/로")).toBe("캠프파이어로");
    expect(withJosa("마을", "으로/로")).toBe("마을로");
    expect(withJosa("대도서관", "으로/로")).toBe("대도서관으로");
    expect(withJosa("1", "으로/로")).toBe("1로");
    expect(withJosa("3", "으로/로")).toBe("3으로");
    expect(directionParticle("Lv")).toBe("(으)로");
  });
  it("josa는 조사만 돌려준다", () => {
    expect(josa("기록관의 안경", "을/를")).toBe("을");
    expect(josa("길잡이 깃털", "이/가")).toBe("이");
  });
});
