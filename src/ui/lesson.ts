// 레슨 창(design.md §5.2, §5.4): 본문과 예제 실행 → 빈칸 연습 → 주문서 획득.
import type { BlankExercise, Emotion, Lesson } from "../contracts/content";
import type { PythonRunner } from "../contracts/runner";
import type { LessonUI, NameContext } from "../contracts/ui";
import { createPortrait, type PortraitHandle } from "./assets";
import type { RunOutput } from "../contracts/runner";
import { normalizeOutput, outputsMatch } from "../python/compare";
import { formatRunOutput } from "./battleLogic";
import { h } from "./dom";
import type { UiEnv } from "./env";
import { escapeHtml, renderInline, renderMarkdown, substituteNames } from "./markdown";
import { ensureRunner, mountMarkdown } from "./runnable";

export const BLANK = "___";
export const REVEAL_AFTER_TRIES = 3;

/** 빈칸 연습 통과 여부. 출력 비교는 채점기와 같은 규칙(src/python/compare.ts)을 쓴다 */
export function exerciseOutputOk(res: RunOutput, expectedOutput: string): boolean {
  return !res.error && !res.timedOut && !res.fatal && outputsMatch(res.stdout, expectedOutput);
}

/** 빈칸(___) 하나를 값으로 바꾼다 */
export function fillBlank(code: string, value: string): string {
  const i = code.indexOf(BLANK);
  return i < 0 ? code : code.slice(0, i) + value + code.slice(i + BLANK.length);
}

interface Feedback {
  set(emotion: Emotion, html: string): void;
  el: HTMLElement;
}

function companionFeedback(env: UiEnv, names: NameContext): Feedback {
  const portrait: PortraitHandle = createPortrait(env.companionPortrait, 2, names.companion.slice(0, 1) || "?");
  const msg = h("div", { class: "nuri-msg", "aria-live": "polite" });
  const el = h("div", { class: "nuri-row" }, portrait.el, h("div", { class: "nuri-bubble" }, h("div", { class: "nuri-name" }, names.companion), msg));
  portrait.set("neutral");
  return {
    el,
    set(emotion, html) {
      portrait.set(emotion);
      msg.innerHTML = html;
      el.dataset.emotion = emotion;
    },
  };
}

function exerciseSection(
  env: UiEnv,
  ex: BlankExercise,
  runner: PythonRunner,
  names: NameContext,
  onSolved: () => void,
): HTMLElement {
  const i = ex.code.indexOf(BLANK);
  const before = i < 0 ? ex.code : ex.code.slice(0, i);
  const after = i < 0 ? "" : ex.code.slice(i + BLANK.length);
  const input = h("input", {
    class: "blank-input",
    type: "text",
    "aria-label": "빈칸",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
  });
  const fit = () => (input.style.width = `calc(${Math.max(5, input.value.length + 1)}ch + 12px)`);
  fit();
  input.addEventListener("input", fit);
  const code = h("pre", { class: "blank-code md-code" });
  code.append(document.createTextNode(before), input, document.createTextNode(after));
  const runBtn = h("button", { class: "btn btn-primary blank-run", type: "button" }, "실행");
  const output = h("pre", { class: "blank-out", hidden: true });
  const fb = companionFeedback(env, names);
  fb.set("neutral", renderInline(substituteNames("빈칸을 채우고 [실행]을 눌러 봐!", names)));
  let tries = 0;
  let solved = false;

  const run = async () => {
    if (solved) return;
    const value = input.value;
    if (value.trim() === "") {
      fb.set("worried", "빈칸을 먼저 채워 줘!");
      input.focus();
      return;
    }
    runBtn.disabled = true;
    output.hidden = false;
    output.textContent = runner.isReady() ? "실행 중…" : "실행기를 깨우는 중…";
    try {
      await ensureRunner(runner);
      const res = await runner.run({ code: fillBlank(ex.code, value), stdin: ex.stdin });
      output.textContent = formatRunOutput(res);
      const ok = exerciseOutputOk(res, ex.expectedOutput);
      output.classList.toggle("is-error", !ok);
      if (ok) {
        solved = true;
        input.readOnly = true;
        fb.set("happy", "정확해! 주문이 제대로 울렸어. 이제 주문서를 받자!");
        onSolved();
        return;
      }
      tries++;
      let msg: string;
      if (res.error) msg = `주문이 폭발했어! <code>${escapeHtml(res.error.type)}: ${escapeHtml(res.error.message)}</code>`;
      else if (res.timedOut) msg = "실행이 너무 오래 걸려서 멈췄어.";
      else
        msg = `출력이 달라. 기대한 출력은 <code>${escapeHtml(normalizeOutput(ex.expectedOutput))}</code>인데 <code>${escapeHtml(
          normalizeOutput(res.stdout) || "(빈 출력)",
        )}</code>가 나왔어.`;
      if (tries >= REVEAL_AFTER_TRIES) {
        msg += ` 괜찮아, 정답 예시는 <code class="blank-answer">${escapeHtml(ex.answer)}</code>야. 넣고 다시 실행해 봐!`;
      } else {
        msg += ` (${tries}/${REVEAL_AFTER_TRIES}번째 시도)`;
      }
      fb.set("worried", msg);
    } catch (e) {
      output.textContent = `실행하지 못했어: ${(e as Error).message}`;
    } finally {
      runBtn.disabled = solved;
    }
  };
  runBtn.addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      void run();
    }
  });
  input.addEventListener("keyup", (e) => e.stopPropagation());

  const prompt = h("div", { class: "md exercise-prompt", html: renderMarkdown(substituteNames(ex.prompt, names)) });
  const expected = h(
    "div",
    { class: "exercise-expected" },
    h("span", { class: "label" }, "기대 출력"),
    h("pre", { class: "md-code" }, normalizeOutput(ex.expectedOutput)),
  );
  const stdinBox = ex.stdin
    ? h("div", { class: "exercise-expected" }, h("span", { class: "label" }, "입력(stdin)"), h("pre", { class: "md-code" }, ex.stdin.replace(/\n$/, "")))
    : null;
  return h(
    "section",
    { class: "exercise", "aria-label": "미니 연습" },
    h("h3", { class: "exercise-title" }, "빈칸 주문"),
    prompt,
    code,
    h("div", { class: "exercise-io" }, stdinBox, expected),
    h("div", { class: "exercise-bar" }, runBtn),
    output,
    fb.el,
  );
}

export function createLessonUI(env: UiEnv): LessonUI {
  return {
    open(lesson: Lesson, runner: PythonRunner, names: NameContext) {
      return new Promise((resolve) => {
        let finished = false;
        const finish = (completed: boolean) => {
          if (finished) return;
          finished = true;
          mounted.dispose();
          modal.close();
          resolve({ completed });
        };
        const modal = env.stack.open({ className: "lesson-modal", label: `레슨: ${lesson.title}`, onEscape: () => finish(false) });
        const closeBtn = h("button", { class: "btn btn-icon lesson-close", type: "button", "aria-label": "닫기", title: "닫기" }, "×");
        closeBtn.addEventListener("click", () => finish(false));
        const body = h("div", { class: "lesson-body" });
        const mounted = mountMarkdown(body, substituteNames(lesson.body, names), runner);
        const claimBtn = h("button", { class: "btn btn-primary lesson-claim", type: "button" }, "주문서 받기");
        claimBtn.disabled = !!lesson.exercise;
        const panel = h(
          "div",
          { class: "panel lesson-panel" },
          h(
            "header",
            { class: "lesson-head" },
            h("span", { class: "badge" }, lesson.scroll.name),
            h("h2", { class: "lesson-title" }, lesson.title),
            closeBtn,
          ),
          h(
            "div",
            { class: "lesson-scroll" },
            body,
            lesson.exercise ? exerciseSection(env, lesson.exercise, runner, names, () => (claimBtn.disabled = false)) : null,
          ),
          h("footer", { class: "lesson-foot" }, claimBtn),
        );
        modal.el.append(panel);

        claimBtn.addEventListener("click", () => {
          // 주문서 획득 화면
          const ok = h("button", { class: "btn btn-primary scroll-ok", type: "button" }, "확인");
          ok.addEventListener("click", () => finish(true));
          const screen = h(
            "div",
            { class: "panel scroll-acquired", role: "status" },
            h("div", { class: "scroll-icon", "aria-hidden": "true" }),
            h("div", { class: "scroll-caption" }, "주문서 획득!"),
            h("h2", { class: "scroll-name" }, lesson.scroll.name),
            h("p", { class: "scroll-summary", html: renderInline(substituteNames(lesson.scroll.summary, names)) }),
            h("p", { class: "scroll-note" }, "코덱스에서 언제든 다시 볼 수 있어."),
            ok,
          );
          panel.replaceWith(screen);
          env.stack.focusInitial(modal, ok);
        });
        env.stack.focusInitial(modal, closeBtn);
      });
    },
  };
}
