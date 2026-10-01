// 전투 화면(design.md §5.3, §7.1, §9.7)
import type { DialogueLine, Emotion } from "../contracts/content";
import type { JudgeResult, PyError, TestResult } from "../contracts/runner";
import type { BattleOutcome, HintLevel } from "../contracts/state";
import type { BattleContext, BattleUI } from "../contracts/ui";
import { createPortrait, createSprite } from "./assets";
import {
  HINT_COSTS,
  VERDICT_LABEL,
  bossPhases,
  buildCastFeedback,
  buildPublicFeedback,
  computeDamage,
  disclosureMode,
  firstFailed,
  formatRunOutput,
  genericVerdictMessage,
  hintShortCost,
  practiceThresholdMs,
  testsInScope,
  timeGaugePercent,
  type Feedback,
} from "./battleLogic";
import { h } from "./dom";
import { createCodeEditor } from "./editor";
import type { UiEnv } from "./env";
import { escapeHtml, renderInline, renderMarkdown, substituteNames } from "./markdown";
import { confirmDialog } from "./menu";
import { ensureRunner } from "./runnable";

const DRAFT_DEBOUNCE_MS = 600;

function restartAnim(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function detailsEl(fb: Feedback): HTMLElement {
  const el = h("div", { class: "fb" }, h("div", { class: "fb-summary" }, fb.summary));
  for (const d of fb.details) {
    const rows: HTMLElement[] = [];
    const row = (label: string, value: string | undefined, cls: string) => {
      if (value === undefined) return;
      rows.push(h("div", { class: `fb-row ${cls}` }, h("span", { class: "fb-label" }, label), h("pre", { class: "fb-val" }, value === "" ? "(빈 값)" : value)));
    };
    row("입력", d.input, "fb-input");
    row("기대", d.expected, "fb-expected");
    row("내 출력", d.actual, "fb-actual");
    row("print 출력", d.stdout, "fb-stdout");
    row("에러", d.errorText, "fb-error");
    el.append(
      h(
        "div",
        { class: `fb-test verdict-${d.verdict}`, "data-index": String(d.index) },
        h("div", { class: "fb-head" }, `#${d.index + 1} ${d.public ? "공개" : "숨김"} · ${VERDICT_LABEL[d.verdict]}`),
        ...rows,
      ),
    );
  }
  if (fb.note) el.append(h("div", { class: "fb-note" }, fb.note));
  return el;
}

export function createBattleUI(env: UiEnv): BattleUI {
  return {
    open(ctx: BattleContext): Promise<BattleOutcome> {
      return new Promise((resolve) => {
        const p = ctx.problem;
        const names = ctx.names;
        const phases = bossPhases(p);
        let phaseIdx = 0;
        const currentPhase = () => (phases.length ? phases[phaseIdx] : undefined);
        const maxHp = ctx.player.maxHp;
        let hp = Math.min(ctx.player.hp, maxHp);
        let attempts = 0;
        let hintLevel: HintLevel = ctx.hintLevel;
        let solutionViewed = false;
        let busy = false;
        // 시간 결계 페이즈(2페이즈 이후)를 모두 첫 시전에 통과했는가(칭호 '시간을 돌린 자')
        let barrierFirstTry = true;
        let potions = ctx.potions?.count ?? 0;
        const freeHint2 = ctx.perks?.freeHint2 === true;
        let closed = false;
        // 승리·쓰러짐 배너가 뜬 뒤에는 버튼을 다시 켜지 않는다
        let ended = false;
        const startedAt = Date.now();
        const timers: number[] = [];
        const cleanups: (() => void)[] = [];

        const modal = env.stack.open({ className: "battle-modal", label: `전투: ${p.enemy.name}` });
        const root = h("div", { class: `battle ${p.boss ? "is-boss" : ""} ${ctx.shadow ? "is-shadow" : ""}`, "data-problem": p.id });
        modal.el.append(root);

        // ---------- 위: 적과 나 ----------
        const sprite = createSprite(p.enemy.sprite, p.boss ? 3 : 4, p.enemy.name);
        const enemyName = h("div", { class: "enemy-name" }, ctx.shadow ? `${p.enemy.name}의 그림자` : p.enemy.name);
        const phaseLabel = h("div", { class: "phase-label", hidden: !phases.length });
        const segs = h("div", { class: "enemy-hp", role: "meter", "aria-label": `${p.enemy.name} HP` });
        const hiddenInfo = h("span", { class: "enemy-hidden" });
        const gaugeFill = h("div", { class: "bar-fill" });
        const gaugeText = h("span", { class: "time-gauge-text" }, "—");
        // 모래시계 부적(design.md §7.3): 목표 복잡도
        const gaugeTarget = ctx.perks?.targetComplexity ? h("span", { class: "time-gauge-target" }, `목표 ${ctx.perks.targetComplexity}`) : null;
        const gauge = h(
          "div",
          { class: "time-gauge", hidden: true, "aria-label": "시간 게이지" },
          h("span", { class: "time-gauge-label" }, "시간 결계"),
          h("div", { class: "bar bar-time" }, gaugeFill),
          gaugeText,
          gaugeTarget,
        );
        const hpFill = h("div", { class: "bar-fill" });
        const hpText = h("span", { class: "player-hp-text" });
        const hpBar = h("div", { class: "bar bar-hp player-hp", role: "meter", "aria-label": "내 HP", "aria-valuemin": "0", "aria-valuemax": String(maxHp) }, hpFill);
        const floatLayer = h("div", { class: "float-layer", "aria-hidden": "true" });
        root.append(
          h(
            "div",
            { class: "battle-top panel" },
            h("div", { class: "enemy-sprite-wrap" }, sprite),
            h("div", { class: "enemy-info" }, h("div", { class: "enemy-line" }, enemyName, phaseLabel), h("div", { class: "enemy-line" }, segs, hiddenInfo), gauge),
            h("div", { class: "player-info" }, h("div", { class: "player-name" }, names.player), h("div", { class: "player-line" }, h("span", { class: "hud-label" }, "HP"), hpBar, hpText)),
            floatLayer,
          ),
        );

        const setSegments = () => {
          const tests = testsInScope(p, currentPhase());
          segs.replaceChildren(...tests.map(() => h("span", { class: "enemy-seg" })));
          const hidden = tests.filter((t) => !t.public).length;
          hiddenInfo.textContent = `(숨겨진 테스트 ${hidden}개)`;
          const ph = p.phases?.find((x) => x.phase === currentPhase());
          if (phases.length) phaseLabel.textContent = `${currentPhase()}페이즈${ph ? ` · ${ph.name}` : ""}`;
          root.dataset.phase = String(currentPhase() ?? 1);
          gauge.hidden = !(phases.length && phaseIdx >= 1);
        };
        const refillEnemy = () => segs.querySelectorAll(".enemy-seg").forEach((s) => s.classList.remove("is-gone"));
        const hitEnemy = () => {
          const alive = segs.querySelector(".enemy-seg:not(.is-gone)");
          alive?.classList.add("is-gone");
          restartAnim(sprite, "is-hit");
          floatText("-1", "float-hit");
        };
        const floatText = (text: string, cls: string) => {
          const f = h("span", { class: `float ${cls}` }, text);
          floatLayer.append(f);
          setTimeout(() => f.remove(), 1000);
        };
        // 힌트·해설서·반격으로 바뀐 상태를 앱에 알린다(새로고침으로 대가·쓰러짐을 피하지 못하게 앱이 임시 저장)
        const reportProgress = () => {
          try {
            ctx.onProgress?.({ attempts, maxHintLevel: hintLevel, solutionViewed, hp });
          } catch (e) {
            console.error(e);
          }
        };
        const setHp = (v: number) => {
          hp = Math.max(0, v);
          hpFill.style.width = `${maxHp > 0 ? (hp / maxHp) * 100 : 0}%`;
          hpText.textContent = `${hp}/${maxHp}`;
          hpBar.setAttribute("aria-valuenow", String(hp));
          hpBar.classList.toggle("is-low", maxHp > 0 && hp / maxHp <= 0.3);
        };
        const setGauge = (res: JudgeResult) => {
          const pct = timeGaugePercent(res);
          gaugeFill.style.width = `${Math.min(100, pct)}%`;
          gauge.dataset.percent = String(pct);
          gauge.classList.toggle("is-over", pct >= 100);
          gaugeText.textContent = pct >= 100 ? "초과!" : `${pct}%`;
        };

        // ---------- 가운데: 문제와 에디터 ----------
        const statement = h(
          "div",
          { class: "battle-statement-view" },
          h("h2", { class: "battle-title" }, p.title),
          // 공개 예제 표는 statement.md 안에 있다(콘텐츠 규칙). 따로 그리지 않는다
          h("div", { class: "md", html: renderMarkdown(substituteNames(p.statement, names)) }),
        );
        const solutionView = h("div", { class: "battle-solution-view", hidden: true });
        const tabStatement = h("button", { class: "tab is-active", type: "button" }, "문제");
        const tabSolution = h("button", { class: "tab", type: "button" }, "해설서");
        const tabs = h("div", { class: "battle-tabs", hidden: true }, tabStatement, tabSolution);
        const showTab = (which: "statement" | "solution") => {
          statement.hidden = which !== "statement";
          solutionView.hidden = which !== "solution";
          tabStatement.classList.toggle("is-active", which === "statement");
          tabSolution.classList.toggle("is-active", which === "solution");
        };
        tabStatement.addEventListener("click", () => showTab("statement"));
        tabSolution.addEventListener("click", () => showTab("solution"));
        const left = h("div", { class: "battle-statement panel" }, tabs, h("div", { class: "battle-statement-scroll" }, statement, solutionView));

        let draftTimer: number | null = null;
        let lastDraft = ctx.draft ?? p.starter;
        const flushDraft = () => {
          if (draftTimer !== null) window.clearTimeout(draftTimer);
          draftTimer = null;
          const code = editor.getCode();
          if (code !== lastDraft) {
            lastDraft = code;
            ctx.onDraft(code);
          }
        };
        const editor = createCodeEditor(ctx.draft ?? p.starter, {
          label: "주문 코드 에디터",
          className: "battle-editor",
          onChange: () => {
            if (draftTimer !== null) window.clearTimeout(draftTimer);
            draftTimer = window.setTimeout(flushDraft, DRAFT_DEBOUNCE_MS);
          },
        });
        const stdinArea = h("textarea", { class: "custom-stdin", rows: "3", spellcheck: "false", "aria-label": "직접 넣을 입력값", placeholder: "입력값(stdin)" });
        stdinArea.addEventListener("keydown", (e) => e.stopPropagation());
        stdinArea.addEventListener("keyup", (e) => e.stopPropagation());
        const customBtn = h("button", { class: "btn btn-small custom-run", type: "button" }, p.kind === "stdin" ? "직접 입력으로 실행" : "그냥 실행(print 확인)");
        const right = h(
          "div",
          { class: "battle-editor-col panel" },
          editor.wrapper,
          h("div", { class: "editor-hint" }, "Tab: 들여쓰기 · Esc 다음 Tab: 에디터 밖으로"),
          h(
            "details",
            { class: "custom-run-box" },
            h("summary", {}, "직접 실행해 보기"),
            p.kind === "stdin" ? stdinArea : null,
            customBtn,
          ),
        );
        root.append(h("div", { class: "battle-mid" }, left, right));

        // ---------- 아래: 누리와 버튼 ----------
        const portrait = createPortrait(ctx.companion.portrait, 2, ctx.companion.name.slice(0, 1) || "?");
        const msg = h("div", { class: "battle-msg-text" });
        const msgDetails = h("div", { class: "battle-msg-details" });
        const msgBox = h("div", { class: "battle-msg", "aria-live": "polite" }, h("div", { class: "nuri-name" }, names.companion), msg);
        // 메시지가 칸보다 길면 아래에 '더 있음' 표시(헤드리스·오버레이 스크롤바에서도 잘림이 보이게). 누르면 한 칸 내려간다
        const msgMore = h("button", { class: "battle-msg-more", type: "button", tabindex: "-1", "aria-hidden": "true", hidden: true }, "▼ 더 있어");
        const msgWrap = h("div", { class: "battle-msg-wrap" }, msgBox, msgMore);
        const updateMsgMore = () => {
          const rest = msgBox.scrollHeight - msgBox.scrollTop - msgBox.clientHeight;
          msgMore.hidden = rest <= 4;
          msgWrap.classList.toggle("has-more", rest > 4);
        };
        msgBox.addEventListener("scroll", updateMsgMore, { passive: true });
        msgMore.addEventListener("click", () => {
          msgBox.scrollBy({ top: Math.max(24, msgBox.clientHeight - 32) });
          updateMsgMore();
        });
        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(updateMsgMore);
          ro.observe(msgBox);
          ro.observe(msg);
          cleanups.push(() => ro.disconnect());
        }
        // 일반 해설 접기/펼치기(진단이 있을 때 한 줄로 접어 둔 Traceback 해설)
        msg.addEventListener("click", (e) => {
          const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".err-more");
          if (!btn) return;
          const body = msg.querySelector<HTMLElement>(".err-explain");
          if (!body) return;
          const open = body.hidden;
          body.hidden = !open;
          btn.setAttribute("aria-expanded", String(open));
          btn.textContent = open ? "접기" : "자세히";
          if (open) body.scrollIntoView({ block: "nearest" });
          updateMsgMore();
        });
        const say = (emotion: Emotion, html: string, details?: HTMLElement | null) => {
          portrait.set(emotion);
          msgBox.dataset.emotion = emotion;
          msg.innerHTML = html;
          msgDetails.replaceChildren(...(details ? [details] : []));
          msgDetails.hidden = !details;
          // 판정·통과 개수뿐인 짧은 피드백(보스전)이면 오른쪽 칸을 좁혀 누리의 말에 자리를 준다
          msgDetails.classList.toggle("is-compact", !!details?.classList.contains("fb") && !details.querySelector(".fb-test"));
          msgBox.scrollTop = 0;
          msgDetails.scrollTop = 0;
          updateMsgMore();
        };

        const btnPublic = h("button", { class: "btn act-public", type: "button" }, "예제 실행");
        const btnCast = h("button", { class: "btn btn-primary act-cast", type: "button" }, "시전");
        const hintBtns = ([1, 2, 3] as const).map((lv) => {
          const b = h("button", { class: `btn act-hint act-hint-${lv}`, type: "button", "data-level": String(lv) });
          b.addEventListener("click", () => void openHint(lv));
          return b;
        });
        const btnSolution = h("button", { class: "btn act-solution", type: "button", hidden: ctx.shadow === true }, "해설서");
        const btnPotion = h("button", { class: "btn act-potion", type: "button", hidden: potions <= 0 });
        const btnRetreat = h("button", { class: "btn act-retreat", type: "button" }, "후퇴");
        const actions = h(
          "div",
          { class: "battle-actions" },
          btnPublic,
          btnCast,
          h("span", { class: "act-sep", "aria-hidden": "true" }),
          ...hintBtns,
          btnSolution,
          btnPotion,
          h("span", { class: "act-sep", "aria-hidden": "true" }),
          btnRetreat,
        );
        const banner = h("div", { class: "battle-banner", hidden: true });
        root.append(h("div", { class: "battle-bottom panel" }, h("div", { class: "battle-portrait" }, portrait.el), msgWrap, msgDetails), actions, banner);

        const updateButtons = () => {
          btnPublic.disabled = busy;
          btnCast.disabled = busy;
          customBtn.disabled = busy;
          btnRetreat.disabled = ended;
          hintBtns.forEach((b, i) => {
            const lv = (i + 1) as 1 | 2 | 3;
            const opened = lv <= hintLevel;
            b.disabled = busy || lv > hintLevel + 1;
            b.classList.toggle("is-open", opened);
            const free = lv === 2 && freeHint2;
            b.textContent = opened ? `힌트 ${lv} ✓` : free ? "힌트 2 (깃털: 무료)" : `힌트 ${lv} (${hintShortCost(lv)})`;
            b.title = opened ? "다시 보기" : free ? "길잡이 깃털: 보상 대가 없음(그림자 몬스터 등록은 그대로)" : `대가: ${HINT_COSTS[lv].label}`;
            b.classList.toggle("is-free", free && !opened);
          });
          const canSolution = ctx.knockouts >= 3;
          btnSolution.disabled = busy || !canSolution;
          btnSolution.title = canSolution ? "모범답안과 풀이(보상 0)" : `같은 적에게 세 번 쓰러지면 열 수 있어 (${Math.min(ctx.knockouts, 3)}/3)`;
          btnSolution.textContent = canSolution ? "해설서" : `해설서 (${Math.min(ctx.knockouts, 3)}/3)`;
          btnPotion.hidden = potions <= 0;
          btnPotion.textContent = `${ctx.potions?.name ?? "회복약"} ×${potions}`;
          btnPotion.disabled = busy || ended || hp >= maxHp;
          btnPotion.title = `HP ${ctx.potions?.heal ?? 0} 회복`;
        };
        const setBusy = (v: boolean) => {
          busy = v || ended;
          root.classList.toggle("is-busy", v);
          updateButtons();
        };

        // ---------- 판정 해설 ----------
        // explain()은 'n번째 줄: '을 앞에 붙이는데, 여기서는 줄 번호를 따로 강조해 보여 주므로 본문만 쓴다
        const explainBody = (error: PyError) => ctx.explain({ ...error, line: undefined }, ctx.traceback);
        const explainResult = (res: JudgeResult): { emotion: Emotion; html: string } => {
          const first = firstFailed(res);
          if (res.fatal) {
            if (first?.error?.line) editor.highlightLine(first.error.line);
            const common = companionSay(ctx.companionLines?.fatalRecursion);
            if (common) return common;
            return {
              emotion: "serious",
              html: "실행기가 버티지 못하고 다시 시작했어(마력 재충전). 재귀가 너무 깊으면 이런 일이 생겨. 반복문이나 dict 메모로 바꿔 볼래?",
            };
          }
          if (!first) return { emotion: "happy", html: "" };
          const diag = ctx.diagnose(p, res);
          const diagHtml = diag ? `<div class="diag">${renderInline(substituteNames(diag, names))}</div>` : "";
          // 문제 전용 진단이 있으면 진단을 본문으로 보여 주고, 일반 Traceback 해설은 [자세히]로 접어 둔다(같은 말을 두 번 하지 않게)
          const collapsed = (head: string, ex: string | undefined) =>
            `<div class="err-head">${head}${
              ex ? ` <button type="button" class="err-more" aria-expanded="false">자세히</button>` : ""
            }</div>${ex ? `<div class="err-explain" hidden>${renderInline(substituteNames(ex, names))}</div>` : ""}`;
          // TLE는 실행기가 KeyboardInterrupt로 멈춘 것이라 '폭발'(RE)처럼 말하지 않는다
          if (first.verdict === "TLE") {
            const line = first.error?.line;
            if (line) editor.highlightLine(line);
            const where = line ? `<span class="err-line">${line}번째 줄</span>을 도는 중에 멈췄어. ` : "";
            // 문제 전용 진단을 먼저 보여 준다(보스 시간 결계에서 일반 문구가 진단을 밀어내지 않게)
            if (diag) return { emotion: "serious", html: `${diagHtml}${where ? collapsed(where.trim(), first.error ? explainBody(first.error) : undefined) : ""}` };
            const ex = first.error ? explainBody(first.error) : genericVerdictMessage("TLE");
            return { emotion: "serious", html: `${where}${renderInline(substituteNames(ex, names))}` };
          }
          if (first.error) {
            const line = first.error.line;
            if (line) editor.highlightLine(line);
            const ex = explainBody(first.error);
            const type = `<code>${escapeHtml(first.error.type)}</code>`;
            if (diag) {
              const chip = `<span class="err-chip">${line ? `<span class="err-line">${line}번째 줄</span> · ` : ""}${type}</span>`;
              return { emotion: "surprised", html: `${collapsed(`주문이 폭발했어! ${chip}`, ex)}${diagHtml}` };
            }
            const where = line ? `<span class="err-line">${line}번째 줄</span>에서 ` : "";
            return { emotion: "surprised", html: `주문이 폭발했어! ${where}${type}가 났어. ${renderInline(substituteNames(ex, names))}` };
          }
          const text = diag ?? genericVerdictMessage(first.verdict);
          return { emotion: "worried", html: renderInline(substituteNames(text, names)) };
        };

        const runPublic = async () => {
          if (busy) return;
          setBusy(true);
          editor.highlightLine(null);
          say("neutral", runnerWaitText());
          try {
            await ensureRunner(ctx.runner);
            say("neutral", "예제로 시험해 보는 중…");
            const res = await ctx.runner.judge(p, editor.getCode(), { scope: "public" });
            if (closed) return;
            const fb = buildPublicFeedback(res);
            if (res.verdict === "AC" && !res.fatal) {
              say("happy", "예제는 전부 통과! 이제 [시전]으로 숨겨진 테스트까지 도전해 봐.", detailsEl(fb));
            } else {
              const ex = explainResult(res);
              say(ex.emotion, ex.html, detailsEl(fb));
            }
          } catch (e) {
            say("worried", `실행하지 못했어: ${escapeHtml((e as Error).message)}`);
          } finally {
            if (!closed) setBusy(false);
          }
        };

        const runCustom = async () => {
          if (busy) return;
          setBusy(true);
          editor.highlightLine(null);
          say("neutral", runnerWaitText());
          try {
            await ensureRunner(ctx.runner);
            const out = await ctx.runner.run({ code: editor.getCode(), stdin: p.kind === "stdin" ? stdinArea.value : "" });
            if (closed) return;
            if (out.error?.line) editor.highlightLine(out.error.line);
            const pre = h("pre", { class: "custom-out" }, formatRunOutput(out));
            if (out.error) {
              say("surprised", renderInline(substituteNames(ctx.explain(out.error, ctx.traceback), names)), pre);
            } else {
              say("neutral", "직접 실행한 결과야. (채점은 하지 않았어)", pre);
            }
          } catch (e) {
            say("worried", `실행하지 못했어: ${escapeHtml((e as Error).message)}`);
          } finally {
            if (!closed) setBusy(false);
          }
        };

        // 공통 대사(여러 줄)를 전투 메시지 한 칸에 담는다. 표정은 첫 줄 것
        const companionSay = (lines: DialogueLine[] | undefined): { emotion: Emotion; html: string } | null => {
          if (!lines?.length) return null;
          return {
            emotion: lines[0].emotion ?? "neutral",
            html: lines.map((l) => `<p class="nuri-line">${renderInline(substituteNames(l.text, names))}</p>`).join(""),
          };
        };

        const runnerWaitText = () => (ctx.runner.isReady() ? "주문을 읽는 중…" : "실행기를 깨우는 중… 처음 한 번은 조금 걸려.");

        const cast = async () => {
          if (busy) return;
          setBusy(true);
          attempts++;
          editor.highlightLine(null);
          refillEnemy();
          say("neutral", runnerWaitText());
          let hits = 0;
          try {
            await ensureRunner(ctx.runner);
            say("neutral", "시전!");
            restartAnim(root, "is-casting");
            const res = await ctx.runner.judge(p, editor.getCode(), {
              scope: "all",
              phase: currentPhase(),
              onProgress: (t: TestResult) => {
                if (closed) return;
                if (t.verdict === "AC") {
                  hits++;
                  hitEnemy();
                } else floatText("빗나감", "float-miss");
              },
            });
            if (closed) return;
            // onProgress를 부르지 않는 실행기 대비
            while (hits < res.passed) {
              hits++;
              hitEnemy();
            }
            if (phases.length && phaseIdx >= 1) setGauge(res);
            if (res.verdict === "AC" && !res.fatal) {
              if (phases.length && phaseIdx < phases.length - 1) {
                await nextPhase();
              } else {
                victory();
              }
              return;
            }
            // 실패: 반격
            if (phases.length && phaseIdx >= 1) barrierFirstTry = false;
            const dmg = computeDamage(p.enemy.attack, res.passed, res.total);
            setHp(hp - dmg);
            restartAnim(root, "is-damaged");
            floatText(`-${dmg}`, "float-dmg");
            reportProgress();
            const ex = explainResult(res);
            const fb = buildCastFeedback(res, disclosureMode(ctx.regionOrder, p.boss));
            say(ex.emotion, `${ex.html}<div class="counter">${escapeHtml(p.enemy.name)}의 반격! HP −${dmg}</div>`, detailsEl(fb));
            timers.push(window.setTimeout(refillEnemy, 900));
            if (hp <= 0) {
              knockout();
              return;
            }
          } catch (e) {
            say("worried", `시전하지 못했어: ${escapeHtml((e as Error).message)}`);
          } finally {
            if (!closed) setBusy(false);
          }
        };

        const showBanner = (title: string, sub: string, btnLabel: string, cls: string, onOk: () => void) => {
          const ok = h("button", { class: "btn btn-primary banner-ok", type: "button" }, btnLabel);
          ok.addEventListener("click", onOk);
          banner.className = `battle-banner ${cls}`;
          banner.replaceChildren(h("div", { class: "panel banner-panel" }, h("div", { class: "banner-title" }, title), h("p", { class: "banner-sub" }, sub), ok));
          banner.hidden = false;
          env.stack.focusInitial(modal, ok);
        };

        const nextPhase = async () => {
          phaseIdx++;
          setSegments();
          gaugeFill.style.width = "0%";
          gaugeText.textContent = "—";
          delete gauge.dataset.percent;
          const ph = p.phases?.find((x) => x.phase === currentPhase());
          restartAnim(root, "is-phase-change");
          const intro = ph?.intro ? substituteNames(ph.intro, names) : "보스가 시간 결계를 펼쳤어! 이제는 정확할 뿐 아니라 빨라야 해.";
          say("surprised", `<div class="phase-intro"><strong>${currentPhase()}페이즈${ph ? ` · ${escapeHtml(ph.name)}` : ""}</strong></div>${renderInline(intro)}`);
        };

        const victory = () => {
          ended = true;
          // 배너를 누르기 전에 새로고침해도 승리가 남도록 앱에 바로 알린다
          try {
            ctx.onVictory?.(outcomeOf("victory"));
          } catch (e) {
            console.error(e);
          }
          restartAnim(sprite, "is-defeated");
          say("happy", `해냈어! ${escapeHtml(p.enemy.name)}을(를) 정화했어!`);
          setBusy(true);
          showBanner("정화 완료!", `${p.enemy.name}이(가) 빛이 되어 흩어졌다.`, "계속", "is-victory", () => finish("victory"));
        };

        const knockout = () => {
          ended = true;
          say("worried", "으앗… 쓰러졌어. 코드는 그대로 남아 있으니까, 캠프파이어에서 쉬고 다시 오자.");
          setBusy(true);
          showBanner("쓰러졌다…", "마지막 캠프파이어로 돌아갑니다. 작성한 코드는 보존돼요.", "캠프파이어로", "is-knockout", () => finish("knockout"));
        };

        const openHint = async (lv: 1 | 2 | 3) => {
          if (busy || lv > hintLevel + 1) return;
          if (lv > hintLevel && lv > 1) {
            const cost = lv === 2 && freeHint2 ? "길잡이 깃털 덕분에 보상은 그대로야. 그래도 그림자 몬스터로는 등록돼" : `이 힌트를 열면 ${HINT_COSTS[lv].label}`;
            const ok = await confirmDialog(env, `힌트 ${lv}단계`, `${cost}. 열어 볼까?`, "열기");
            if (!ok || closed) return;
          }
          if (lv > hintLevel) {
            hintLevel = lv;
            reportProgress();
          }
          updateButtons();
          const title = ["", "방향", "핵심 아이디어", "부분 코드"][lv];
          const body = h("div", { class: "md hint-body", html: renderMarkdown(substituteNames(p.hints[lv - 1], names)) });
          say("neutral", `<strong class="hint-title">힌트 ${lv} · ${title}</strong>`, body);
        };

        const openSolution = async () => {
          if (busy || ctx.knockouts < 3) return;
          if (!solutionViewed) {
            const ok = await confirmDialog(env, "해설서", "해설서를 열면 이 전투의 보상이 0이 되고, 이 개념이 그림자 몬스터로 등록돼. 열어 볼까?", "해설서 열기");
            if (!ok || closed) return;
            solutionViewed = true;
            reportProgress();
            solutionView.append(
              h("h2", { class: "battle-title" }, "해설서"),
              h("p", { class: "solution-note" }, "이 전투의 보상은 0이 돼."),
              h("pre", { class: "md-code solution-code" }, p.solution.replace(/\n$/, "")),
              h("div", { class: "md solution-explanation", html: renderMarkdown(substituteNames(p.explanation, names)) }),
            );
            tabs.hidden = false;
          }
          showTab("solution");
          say("serious", "괜찮아, 막혔을 땐 풀이를 보고 이해하는 것도 실력이야. 이해했으면 직접 다시 써 보자.");
        };

        const outcomeOf = (result: BattleOutcome["result"]): BattleOutcome => ({
          problemId: p.id,
          result,
          attempts,
          maxHintLevel: hintLevel,
          solutionViewed,
          finalCode: editor.getCode(),
          hpLeft: result === "knockout" ? 0 : hp,
          elapsedMs: Date.now() - startedAt,
          ...(phases.length > 1 && result === "victory" ? { timeBarrierFirstTry: barrierFirstTry } : {}),
        });

        const usePotion = () => {
          if (busy || ended || potions <= 0 || hp >= maxHp) return;
          potions--;
          const before = hp;
          setHp(Math.min(maxHp, hp + (ctx.potions?.heal ?? 0)));
          floatText(`+${hp - before}`, "float-heal");
          try {
            ctx.onUsePotion?.();
          } catch (e) {
            console.error(e);
          }
          reportProgress();
          updateButtons();
          say("happy", `${escapeHtml(ctx.potions?.name ?? "회복약")}을 마셨어! HP가 ${hp - before} 돌아왔어.`);
        };

        const finish = (result: BattleOutcome["result"]) => {
          if (closed) return;
          flushDraft();
          closed = true;
          timers.forEach((t) => window.clearTimeout(t));
          cleanups.forEach((f) => f());
          const outcome = outcomeOf(result);
          editor.destroy();
          modal.close();
          resolve(outcome);
        };

        btnPublic.addEventListener("click", () => void runPublic());
        btnCast.addEventListener("click", () => void cast());
        customBtn.addEventListener("click", () => void runCustom());
        btnSolution.addEventListener("click", () => void openSolution());
        btnRetreat.addEventListener("click", () => finish("retreat"));
        btnPotion.addEventListener("click", usePotion);

        // 시간 기반 우회 제안(design.md §7.1)
        if (!p.practice) {
          timers.push(
            window.setTimeout(() => {
              if (closed) return;
              const common = companionSay(ctx.companionLines?.practiceSuggest);
              if (common) say(common.emotion, common.html);
              else {
                say(
                  "neutral",
                  "꽤 오래 붙잡고 있네! 같은 주문서의 <strong>연습 전투</strong>를 먼저 해 보는 건 어때? 강제는 아니고, 돌아와도 보상은 그대로야.",
                );
              }
              msgBox.dataset.practice = "true";
            }, practiceThresholdMs(p.estimatedMinutes)),
          );
        }

        setSegments();
        setHp(hp);
        updateButtons();
        say(
          "neutral",
          ctx.shadow
            ? `<strong>${escapeHtml(p.enemy.name)}의 그림자</strong>가 나타났어! 예전에 막혔던 개념이야. 이야기와 값은 달라도 같은 주문으로 이길 수 있어.`
            : p.boss
            ? `보스 <strong>${escapeHtml(p.enemy.name)}</strong>이(가) 나타났어! 페이즈마다 한 번에 모든 테스트를 통과해야 해.`
            : `<strong>${escapeHtml(p.enemy.name)}</strong>이(가) 길을 막고 있어! 한 번의 시전에서 모든 테스트를 통과해야 쓰러뜨릴 수 있어.`,
        );
        env.stack.focusInitial(modal, editor.view.contentDOM);
      });
    },
  };
}
