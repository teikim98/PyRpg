// XP와 레벨(design.md §7.1, §7.3). 레벨은 진행을 막지 않고 최대 HP·장신구 슬롯만 연다(§1 원칙 1).
//
// 곡선: level = floor(A · ln((XP + B) / B)) + 1, 상한 30.
// 계수는 전체 커리큘럼 XP 합계(§6.2 + §7.1)가 레벨 30 근처가 되도록 맞췄다.
//   일반 전투 194개: 지역마다 응용 전투 2개(평균 250) × 17 = 34개 → 34×250 = 8,500
//                    나머지 160개 × 100 = 16,000
//   중간 보스 8개(지역 6·7·9·12·13·14·15·16) × 400 = 3,200
//   최종 보스 17개 × 1,000 = 17,000
//   → 전투 합계 44,700
//   레슨 70개 × 30 = 2,100
//   그림자 몬스터: 개념의 약 1/3이 등록되고 정화까지 평균 3번 정도 만난다고 보고,
//                  보상 50%를 곱해 전투 XP의 약 50% → +22,350
//   총합 ≈ 69,150 (그림자를 빼면 46,800 → 레벨 27 근처)
// B는 초반 레벨업 간격을 정한다. B = 1500이면 레벨 2가 214 XP(전투 2개 정도),
// 지역 1(≈2,170 XP)을 끝내면 레벨 7, 레벨 10은 지역 2 초반.
// A = 29 / ln(69,150 / 1500 + 1) = 7.528… → 7.53. 이때 레벨 30 = 69,079 XP.
// 일일 퀘스트 XP(§7.5)는 예산에 넣지 않았다(약간 일찍 30에 닿는 여유분).

export const LEVEL_CAP = 30;
export const CURVE_A = 7.53;
export const CURVE_B = 1500;

/** 레벨 L에 필요한 누적 XP. 인덱스 = 레벨(0은 사용하지 않음) */
const THRESHOLDS: number[] = (() => {
  const t = [0, 0];
  for (let L = 2; L <= LEVEL_CAP; L++) {
    let x = Math.ceil(CURVE_B * (Math.exp((L - 1) / CURVE_A) - 1));
    // 부동소수 오차 보정: 공식으로 계산한 레벨과 표가 정확히 맞도록
    while (x > 0 && formulaLevel(x - 1) >= L) x--;
    while (formulaLevel(x) < L) x++;
    t.push(x);
  }
  return t;
})();

function formulaLevel(xp: number): number {
  return Math.floor(CURVE_A * Math.log((xp + CURVE_B) / CURVE_B)) + 1;
}

export function levelFromXp(xp: number): number {
  const x = Math.max(0, Math.floor(xp));
  let lv = 1;
  for (let L = 2; L <= LEVEL_CAP; L++) {
    if (x >= THRESHOLDS[L]) lv = L;
    else break;
  }
  return lv;
}

/** 레벨 L이 되는 누적 XP(레벨 1은 0) */
export function xpForLevel(level: number): number {
  const L = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  return THRESHOLDS[L];
}

/** 다음 레벨까지 남은 XP. 상한이면 0 */
export function xpToNext(xp: number): number {
  const lv = levelFromXp(xp);
  if (lv >= LEVEL_CAP) return 0;
  return THRESHOLDS[lv + 1] - Math.max(0, Math.floor(xp));
}

/** 현재 레벨 구간에서의 진행도(HUD 막대용) */
export function levelProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = levelFromXp(xp);
  if (level >= LEVEL_CAP) return { level, current: 0, needed: 0, ratio: 1 };
  const base = THRESHOLDS[level];
  const needed = THRESHOLDS[level + 1] - base;
  const current = Math.max(0, Math.floor(xp)) - base;
  return { level, current, needed, ratio: current / needed };
}

export const BASE_HP = 100;
export const HP_PER_LEVEL = 5;

/** 최대 HP. 레벨 1 = 100, 레벨당 +5 → 레벨 30 = 245. bonus는 장비(튼튼한 망토 +20 등) */
export function maxHp(level: number, bonus = 0): number {
  const L = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  return BASE_HP + HP_PER_LEVEL * (L - 1) + bonus;
}

/** 장신구 슬롯: 레벨 1에 1칸, 10에 2칸, 20에 3칸 */
export function accessorySlots(level: number): number {
  if (level >= 20) return 3;
  if (level >= 10) return 2;
  return 1;
}
