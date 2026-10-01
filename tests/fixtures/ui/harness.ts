// dev/ui.html용 하네스: 가짜 실행기와 고정 데이터로 모든 UI를 열어 본다. window.__ui로 노출.
import type { DiagnosisRule, Problem, TracebackRule } from "../../../src/contracts/content";
import type { JudgeResult, PyError } from "../../../src/contracts/runner";
import type { BattleOutcome, HintLevel, RewardSummary } from "../../../src/contracts/state";
import type { BattleContext, HudState, MenuActions, NameContext } from "../../../src/contracts/ui";
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
    problems,
    /** 전투 해설 규칙(테스트가 실제 콘텐츠 규칙을 앞에 끼워 넣을 수 있다) */
    traceback,
    dialogue: (lines = dialogueLines) => record("dialogue", ui.dialogue.play(lines, names)),
    lesson: () => record("lesson", ui.lesson.open(L12, fake, names)),
    codex: () => record("codex", ui.codex.open(lessons, fake, names)),
    battle: (id: string, o: BattleOverrides = {}): Promise<BattleOutcome> => {
      const ctx: BattleContext = {
        problem: problems[id],
        runner: fake,
        companion,
        names,
        player: { hp: o.hp ?? 100, maxHp: o.maxHp ?? 100 },
        draft: o.draft,
        knockouts: o.knockouts ?? 0,
        hintLevel: o.hintLevel ?? 0,
        regionOrder: o.regionOrder ?? 1,
        traceback,
        explain: fakeExplain,
        diagnose: fakeDiagnose,
        onDraft: (code) => drafts.push(code),
        onVictory: (outcome) => victories.push(outcome),
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
