// 프로필·칭호(design.md §7.4, §7.5): 얻은 칭호 가운데 하나를 골라 HUD 이름표에 단다. 연속 일수는 여기서 작게.
import type { TitlesUI, TitlesView } from "../contracts/ui";
import { shellModal } from "./board";
import { h } from "./dom";
import type { UiEnv } from "./env";

export function createTitlesUI(env: UiEnv): TitlesUI {
  return {
    open(view: () => TitlesView, select: (id: string | null) => Promise<void>) {
      return new Promise<void>((resolve) => {
        const close = () => {
          shell.modal.close();
          resolve();
        };
        const shell = shellModal(env, { className: "titles-modal", label: "칭호", title: "프로필·칭호", onClose: close });
        const content = h("div", { class: "titles-content" });
        let busy = false;
        const choose = async (id: string | null) => {
          if (busy) return;
          busy = true;
          try {
            await select(id);
          } finally {
            busy = false;
            render();
          }
        };
        const render = () => {
          const v = view();
          const focused = (document.activeElement as HTMLElement | null)?.dataset?.title;
          const active = v.titles.find((t) => t.id === v.active);
          const list = h("ul", { class: "title-list" });
          for (const t of v.titles) {
            const isActive = t.id === v.active;
            const btn = h("button", { class: `btn btn-small title-pick ${t.earned && !isActive ? "btn-primary" : ""}`, type: "button", "data-title": t.id }, isActive ? "달고 있음" : t.earned ? "달기" : "잠김");
            btn.disabled = !t.earned || isActive;
            btn.addEventListener("click", () => void choose(t.id));
            list.append(
              h(
                "li",
                { class: `title-item ${t.earned ? "is-earned" : "is-locked"} ${isActive ? "is-active" : ""}`, "data-title": t.id },
                h("span", { class: "title-name" }, t.earned ? `「${t.name}」` : "「？？？」"),
                h("span", { class: "title-desc" }, t.description),
                btn,
              ),
            );
          }
          const off = h("button", { class: "btn btn-small title-off", type: "button" }, "칭호 숨기기");
          off.disabled = !v.active;
          off.addEventListener("click", () => void choose(null));
          content.replaceChildren(
            h(
              "section",
              { class: "sys-section profile" },
              h("div", { class: "profile-name" }, v.playerName, active ? h("span", { class: "profile-title" }, `「${active.name}」`) : null),
              h("div", { class: "profile-meta" }, `Lv ${v.level} · 이번 주 ${v.weekDays}/7 · 연속 ${v.streak}일`),
            ),
            h("section", { class: "sys-section" }, h("h3", {}, `칭호 ${v.titles.filter((t) => t.earned).length}/${v.titles.length}`), list, off),
          );
          if (focused) content.querySelector<HTMLButtonElement>(`.title-pick[data-title="${focused}"]:not(:disabled)`)?.focus();
        };
        shell.body.append(content);
        render();
        env.stack.focusInitial(shell.modal, content.querySelector<HTMLButtonElement>(".title-pick:not(:disabled)") ?? shell.closeBtn);
      });
    },
  };
}
