// 코덱스(design.md §5.2 5단계): 획득한 주문서의 레슨을 다시 열람하고 예제를 실행한다.
import type { Lesson } from "../contracts/content";
import type { PythonRunner } from "../contracts/runner";
import type { CodexUI, NameContext, PurifiedShadowView } from "../contracts/ui";
import { h } from "./dom";
import type { UiEnv } from "./env";
import { renderInline, substituteNames } from "./markdown";
import { mountMarkdown, type MountedMarkdown } from "./runnable";

export function createCodexUI(env: UiEnv): CodexUI {
  return {
    open(lessons: Lesson[], runner: PythonRunner, names: NameContext, extra?: { purified?: PurifiedShadowView[] }) {
      return new Promise<void>((resolve) => {
        let mounted: MountedMarkdown | null = null;
        const close = () => {
          mounted?.dispose();
          modal.close();
          resolve();
        };
        const modal = env.stack.open({ className: "codex-modal", label: "코덱스", onEscape: close });
        const closeBtn = h("button", { class: "btn btn-icon codex-close", type: "button", "aria-label": "닫기", title: "닫기" }, "×");
        closeBtn.addEventListener("click", close);
        const list = h("ul", { class: "codex-list", role: "list" });
        const detail = h("div", { class: "codex-detail" });

        const showLesson = (lesson: Lesson, btn: HTMLButtonElement) => {
          list.querySelectorAll("button").forEach((b) => b.setAttribute("aria-current", String(b === btn)));
          mounted?.dispose();
          detail.replaceChildren();
          const body = h("div", { class: "codex-body" });
          detail.append(
            h("div", { class: "codex-scroll" }, h("span", { class: "badge" }, lesson.scroll.name), h("span", { class: "codex-summary", html: renderInline(substituteNames(lesson.scroll.summary, names)) })),
            h("h2", { class: "codex-lesson-title" }, lesson.title),
            body,
          );
          mounted = mountMarkdown(body, substituteNames(lesson.body, names), runner);
          detail.scrollTop = 0;
        };

        if (lessons.length === 0) {
          detail.append(h("p", { class: "codex-empty" }, "아직 획득한 주문서가 없어. 마을의 비석을 찾아보자!"));
        }
        let firstBtn: HTMLButtonElement | null = null;
        // 정화된 그림자(design.md §7.6)
        const purified = extra?.purified ?? [];
        const purifiedBox = h(
          "section",
          { class: "codex-purified", "aria-label": "정화된 그림자" },
          h("h3", {}, `정화된 그림자 ${purified.length}`),
          purified.length
            ? h(
                "ul",
                { class: "codex-purified-list" },
                ...purified.map((p) => h("li", { "data-concept": p.concept }, p.name, p.returnCleared ? h("span", { class: "codex-purified-done" }, " ✓ 귀환까지") : null)),
              )
            : h("p", { class: "codex-summary" }, "칸 5까지 이겨 낸 그림자가 여기 모여."),
        );
        for (const lesson of lessons) {
          const btn = h(
            "button",
            { class: "codex-item", type: "button", "data-lesson": lesson.id },
            h("span", { class: "codex-item-scroll" }, lesson.scroll.name),
            h("span", { class: "codex-item-title" }, lesson.title),
          );
          btn.addEventListener("click", () => showLesson(lesson, btn));
          list.append(h("li", {}, btn));
          firstBtn ??= btn;
        }
        modal.el.append(
          h(
            "div",
            { class: "panel codex-panel" },
            h("header", { class: "codex-head" }, h("h2", {}, "코덱스"), h("span", { class: "codex-count" }, `주문서 ${lessons.length}개`), closeBtn),
            h("div", { class: "codex-main" }, h("nav", { class: "codex-nav", "aria-label": "주문서 목록" }, list, purifiedBox), detail),
          ),
        );
        if (firstBtn) showLesson(lessons[0], firstBtn);
        env.stack.focusInitial(modal, firstBtn ?? closeBtn);
      });
    },
  };
}
