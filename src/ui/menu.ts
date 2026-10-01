// 메뉴: 코덱스 / 저장 내보내기 / 저장 불러오기 / 처음부터 / 닫기
import type { MenuActions, MenuUI } from "../contracts/ui";
import { h } from "./dom";
import type { UiEnv } from "./env";

/** 예/아니요 확인 창. true면 예 */
export function confirmDialog(env: UiEnv, title: string, message: string, yes: string, no = "취소"): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      modal.close();
      resolve(v);
    };
    const modal = env.stack.open({ className: "confirm-modal", label: title, onEscape: () => done(false) });
    const yesBtn = h("button", { class: "btn btn-primary confirm-yes", type: "button" }, yes);
    const noBtn = h("button", { class: "btn confirm-no", type: "button" }, no);
    yesBtn.addEventListener("click", () => done(true));
    noBtn.addEventListener("click", () => done(false));
    modal.el.append(
      h("div", { class: "panel confirm-panel" }, h("h2", {}, title), h("p", { class: "confirm-msg" }, message), h("div", { class: "confirm-bar" }, noBtn, yesBtn)),
    );
    env.stack.focusInitial(modal, noBtn);
  });
}

export function createMenuUI(env: UiEnv): MenuUI {
  return {
    open(actions: MenuActions) {
      return new Promise<void>((resolve) => {
        const close = () => {
          modal.close();
          resolve();
        };
        const modal = env.stack.open({ className: "menu-modal", label: "메뉴", onEscape: close });
        const status = h("p", { class: "menu-status", "aria-live": "polite" });
        const fileInput = h("input", { type: "file", accept: "application/json,.json", class: "menu-file", "aria-label": "저장 파일 선택", tabindex: "-1" });
        const buttons: HTMLButtonElement[] = [];
        const mk = (label: string, cls: string, fn: () => void) => {
          const b = h("button", { class: `btn menu-btn ${cls}`, type: "button" }, label);
          b.addEventListener("click", fn);
          buttons.push(b);
          return b;
        };
        const busy = async (fn: () => Promise<void>, okMsg?: string, closeAfter = false) => {
          buttons.forEach((b) => (b.disabled = true));
          status.textContent = "";
          status.classList.remove("is-error");
          try {
            await fn();
            if (closeAfter) {
              close();
              return;
            }
            if (okMsg) status.textContent = okMsg;
          } catch (e) {
            status.textContent = `실패했어: ${(e as Error).message}`;
            status.classList.add("is-error");
          } finally {
            buttons.forEach((b) => (b.disabled = false));
          }
        };
        fileInput.addEventListener("change", () => {
          const f = fileInput.files?.[0];
          fileInput.value = "";
          if (f) void busy(() => actions.importSave(f), undefined, true);
        });
        const list = h(
          "div",
          { class: "menu-list" },
          mk("코덱스", "menu-codex", () => void busy(() => actions.openCodex())),
          mk("저장 내보내기", "menu-export", () => void busy(() => actions.exportSave(), "저장 파일을 내보냈어.")),
          mk("저장 불러오기", "menu-import", () => fileInput.click()),
          mk("처음부터", "menu-reset", async () => {
            const ok = await confirmDialog(env, "처음부터", "지금까지의 진행이 모두 지워져. 정말 처음부터 시작할까?", "처음부터");
            if (ok) void busy(() => actions.resetSave(), undefined, true);
          }),
          mk("닫기", "menu-close", close),
        );
        modal.el.append(h("div", { class: "panel menu-panel" }, h("h2", { class: "menu-title" }, "메뉴"), list, fileInput, status));
        env.stack.focusInitial(modal, buttons[0]);
      });
    },
  };
}
