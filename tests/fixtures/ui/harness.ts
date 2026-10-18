// dev/ui.html용 하네스: 가짜 실행기와 고정 데이터로 모든 UI를 열어 본다. window.__ui로 노출.
import type { DiagnosisRule, Problem, TracebackRule } from "../../../src/contracts/content";
import type { JudgeResult, PyError } from "../../../src/contracts/runner";
import type { BattleOutcome, HintLevel, RewardSummary } from "../../../src/contracts/state";
import type { BattleContext, BattleProgress, HudState, MenuActions, NameContext, PracticeOffer } from "../../../src/contracts/ui";
import { createUi } from "../../../src/ui";
import { FakeRunner } from "./fakeRunner";
import { L12, P0101, companion, dialogueLines, lessons, problems, recommended, traceback } from "./problems";

export const names: NameContext = { player: "하늘", companion: "누리" };

/** 가짜 해설: 예외 이름이 같은 첫 규칙 */
export function fakeExplain(error: PyError, rules: TracebackRule[]): string {
  const r = rules.find((x) => x.exception === error.type && (!x.pattern || new RegExp(x.pattern).test(error.message)));
  return r?.text ?? `${error.type}가 났어. 메시지를 같이 읽어 보자.`;
}

/** 가짜 진단: 첫 실패 테스트에 대해 규칙을 순서대로 본다 */
export function fakeDiagnose(problem: Problem, result: JudgeResult): string | undefined {
  const first = result.tests.find((t) => t.verdict !== "AC");
  if (!first) return undefined;
  const ok = (w: DiagnosisRule["when"]) =>
    (!w.verdict || w.verdict === first.verdict) &&
    (!w.outputMatches || new RegExp(w.outputMatches).test(first.actual)) &&
    (!w.exception || w.exception === first.error?.type) &&
    (!w.messageMatches || (!!first.error && new RegExp(w.messageMatches).test(first.error.message))) &&
    (!w.onlyHiddenFail || result.tests.every((t) => !t.public || t.verdict === "AC"));
  return problem.diagnoses.find((d) => ok(d.when))?.text;
}

export interface BattleOverrides {
  hp?: number;
  maxHp?: number;
  knockouts?: number;
  hintLevel?: HintLevel;
  regionOrder?: number;
  draft?: string;
  companionLines?: BattleContext["companionLines"];
  /** 이전 전투들에서 쓴 누적 시간(ms, 단위 3-E1) */
  priorElapsedMs?: number;
  shadow?: boolean;
  /**
   * 연습 상대(단위 3-E3). variant·warmup은 sourceId 문제(하네스 고정 데이터)를 id만 바꿔 연습 문제로 쓴다.
   * monster는 이름만. none은 상대 없음
   */
  practiceOffer?: { kind: PracticeOffer["kind"]; sourceId?: string; name?: string; applied?: boolean };
  /** 연습 전투 모드(단위 3-E3) */
  practice?: boolean;
  /** 가진 회복약 수(HP 30 회복) */
  potions?: number;
  /** 고정 데이터 문제를 고쳐서 연다(예: { practice: true }로 연습 몬스터) */
  patch?: Partial<Problem>;
  /** 모래시계 부적(단위 3-E5): 목표 복잡도. targetRevealed면 처음부터 보인다 */
  targetComplexity?: string;
  targetRevealed?: boolean;
}

/** 하네스용 연습 상대 */
function harnessOffer(o: NonNullable<BattleOverrides["practiceOffer"]>): PracticeOffer {
  if (o.kind === "none") return o.applied ? { kind: "none", applied: true } : { kind: "none" };
  const src = problems[o.sourceId ?? "P0103"];
  const name = o.name ?? src.enemy.name;
  if (o.kind === "monster") return { kind: "monster", problemId: o.sourceId ?? "P0103", name };
  const problem = { ...src, id: `${src.id}-v1`, title: `${src.title}(변형)` };
  return o.kind === "variant"
    ? { kind: "variant", sourceId: src.id, name, problem }
    : { kind: "warmup", sourceId: src.id, name, problem, ...(o.applied ? { applied: true } : {}) };
}

export function mountHarness(game: HTMLElement) {
  const params = new URLSearchParams(location.search);
  const speed = params.has("speed") ? Number(params.get("speed")) : 20;
  const ui = createUi(game, { typeSpeedMs: speed });
  const fake = new FakeRunner();
  const drafts: string[] = [];
  const menuCalls: string[] = [];
  const results: unknown[] = [];
  /** onVictory로 받은 결과(AC 순간) */
  const victories: BattleOutcome[] = [];
  /** onProgress로 받은 진행(힌트·해설서·반격·탭 숨김) */
  const progresses: BattleProgress[] = [];
  /** onTargetRevealed로 받은 공개(모래시계 부적, 단위 3-E5): 문제 ID */
  const reveals: string[] = [];
  const logEl = document.getElementById("log");
  const record = <T>(label: string, p: Promise<T>): Promise<T> =>
    p.then((v) => {
      results.push({ label, value: v });
      if (logEl) logEl.textContent = `${label} → ${JSON.stringify(v, null, 2)}`;
      return v;
    });

  const menuActions: MenuActions = {
    openCodex: async () => {
      menuCalls.push("codex");
      await ui.codex.open(lessons, fake, names);
    },
    exportSave: async () => {
      menuCalls.push("export");
    },
    importSave: async (file: File) => {
      menuCalls.push(`import:${file.name}`);
    },
    resetSave: async () => {
      menuCalls.push("reset");
    },
  };

  const api = {
    ui,
    fake,
    drafts,
    menuCalls,
    results,
    victories,
    progresses,
    reveals,
    problems,
    /** 전투 해설 규칙(테스트가 실제 콘텐츠 규칙을 앞에 끼워 넣을 수 있다) */
    traceback,
    dialogue: (lines = dialogueLines) => record("dialogue", ui.dialogue.play(lines, names)),
    lesson: () => record("lesson", ui.lesson.open(L12, fake, names)),
    codex: () => record("codex", ui.codex.open(lessons, fake, names)),
    battle: (id: string, o: BattleOverrides = {}): Promise<BattleOutcome> => {
      const ctx: BattleContext = {
        problem: o.patch ? { ...problems[id], ...o.patch } : problems[id],
        runner: fake,
        companion,
        names,
        player: { hp: o.hp ?? 100, maxHp: o.maxHp ?? 100 },
        draft: o.draft,
        knockouts: o.knockouts ?? 0,
        hintLevel: o.hintLevel ?? 0,
        ...(o.priorElapsedMs !== undefined ? { priorElapsedMs: o.priorElapsedMs } : {}),
        ...(o.shadow ? { shadow: true } : {}),
        ...(o.practiceOffer ? { practiceOffer: harnessOffer(o.practiceOffer) } : {}),
        ...(o.practice ? { practice: true } : {}),
        ...(o.potions ? { potions: { count: o.potions, heal: 30, name: "회복약" } } : {}),
        ...(o.targetComplexity
          ? { perks: { targetComplexity: o.targetComplexity, targetRevealed: o.targetRevealed === true, onTargetRevealed: () => void reveals.push(id) } }
          : {}),
        regionOrder: o.regionOrder ?? 1,
        traceback,
        explain: fakeExplain,
        diagnose: fakeDiagnose,
        onDraft: (code) => drafts.push(code),
        onVictory: (outcome) => victories.push(outcome),
        onProgress: (p) => progresses.push(p),
        companionLines: o.companionLines,
      };
      return record(`battle ${id}`, ui.battle.open(ctx));
    },
    menu: () => record("menu", ui.menu.open(menuActions)),
    reward: (s?: Partial<RewardSummary>) =>
      record(
        "reward",
        ui.reward.show(
          { xp: 75, gold: 38, penalty: 0.25, levelBefore: 1, levelAfter: 2, shadowNote: "변환의 주문서 그림자가 나타났어(칸 1).", streakCounted: true, ...s },
          P0101,
        ),
      ),
    recommended: (base: string | null = null) => record("recommended", ui.reward.showRecommended("에코 마을", recommended, base)),
    hud: (s: Partial<HudState> = {}) =>
      ui.hud.update({ regionName: "에코 마을", level: 3, xp: 120, xpToNext: 300, hp: 82, maxHp: 100, gold: 140, weekDays: 3, scrolls: 2, ...s }),
    toast: (m: string) => ui.hud.toast(m),
  };
  (window as unknown as { __ui: typeof api }).__ui = api;
  return api;
}
