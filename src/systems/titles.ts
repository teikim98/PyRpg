// 칭호(design.md §7.4). 능력치 없는 꾸미기 보상. 조건은 저장 데이터만 보고 판단하므로
// 옛 저장을 불러와도 이미 이룬 칭호를 바로 받는다.
import type { Region, TitleCondition, TitleDef } from "../contracts/content";
import type { SaveData } from "../contracts/state";
import { weekStart } from "./time";

/** 보스 시간 결계를 첫 시전에 통과한 기록(BattleOutcome.timeBarrierFirstTry) */
export const TIME_BARRIER_FLAG = "feat.timeBarrierFirstTry";

/** 그림자 몬스터를 이긴 수(쓰러짐은 again으로 남고, 그림자전에는 해설서가 없으므로 again이 아니면 승리) */
export function shadowWins(save: Pick<SaveData, "history">): number {
  return save.history.filter((h) => h.shadow && h.grade !== "again").length;
}

/** 학습일(인정 + 보호)이 days일 이상인 주의 수 */
export function goodWeeks(save: Pick<SaveData, "streak">, days: number): number {
  const counts = new Map<string, number>();
  for (const d of new Set([...save.streak.activeDays, ...save.streak.protectedDays])) {
    const w = weekStart(d);
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.values()].filter((n) => n >= days).length;
}

export function titleMet(cond: TitleCondition, save: SaveData, regions: Pick<Region, "id" | "problems">[]): boolean {
  const recs = Object.values(save.problems);
  switch (cond.type) {
    case "firstWin":
      return recs.some((r) => r.solved);
    case "noHintRegion":
      return regions.some((region) => {
        const ps = region.problems.filter((p) => !p.practice);
        return (
          ps.length > 0 &&
          ps.every((p) => {
            const r = save.problems[p.id];
            return r?.solved && r.maxHintLevel === 0 && !r.solutionViewed;
          })
        );
      });
    case "timeBarrierFirstTry":
      return save.flags[TIME_BARRIER_FLAG] === true;
    case "shadowWins":
      return shadowWins(save) >= cond.count;
    case "persistence":
      return recs.some((r) => r.solved && r.attempts >= cond.attempts);
    case "goodWeeks":
      return goodWeeks(save, cond.days) >= cond.weeks;
    case "regionClear":
      return save.flags[`region.${cond.region}.clear`] === true;
    default:
      return false;
  }
}

/** 새로 얻은 칭호를 더한다. 이미 가진 칭호는 그대로 */
export function awardTitles(
  save: SaveData,
  titles: TitleDef[],
  regions: Pick<Region, "id" | "problems">[],
): { save: SaveData; earned: TitleDef[] } {
  const earned = titles.filter((t) => !save.titles.includes(t.id) && titleMet(t.condition, save, regions));
  if (earned.length === 0) return { save, earned };
  return { save: { ...save, titles: [...save.titles, ...earned.map((t) => t.id)] }, earned };
}
