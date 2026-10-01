// 상점(design.md §7.2). 내용물과 가격을 처음부터 보여 주고, 결제·확률형은 없다.
// 레벨이 모자란 품목은 실루엣으로, 이미 가진 장신구·꾸미기는 '보유 중'으로 보여 준다(§7.1, CodeCombat 방식).
import type { NameContext, ShopEntry, ShopUI, ShopView } from "../contracts/ui";
import { shellModal } from "./board";
import { h } from "./dom";
import type { UiEnv } from "./env";

const KIND_LABEL: Record<ShopEntry["kind"], string> = {
  consumable: "소모품",
  iceRune: "스트릭 보호",
  accessory: "장신구",
  cosmetic: "꾸미기",
};

const STATE_LABEL: Record<ShopEntry["state"], string> = {
  available: "사기",
  owned: "보유 중",
  locked: "잠김",
  full: "가득 참",
  poor: "골드 부족",
};

export function itemIcon(kind: ShopEntry["kind"], id: string, extraClass = ""): HTMLElement {
  return h("span", { class: `item-icon item-${kind} ${extraClass}`, "data-item": id, "aria-hidden": "true" });
}

export function createShopUI(env: UiEnv): ShopUI {
  return {
    open(view: () => ShopView, buy: (id: string) => Promise<string>, names: NameContext) {
      return new Promise<void>((resolve) => {
        const close = () => {
          shell.modal.close();
          resolve();
        };
        const shell = shellModal(env, { className: "shop-modal", label: "상점", title: "상점", onClose: close });
        const gold = h("span", { class: "shop-gold" });
        shell.panel.querySelector(".sys-head h2")?.after(gold);
        const status = h("p", { class: "shop-status", "aria-live": "polite" });
        const grid = h("ul", { class: "shop-grid" });
        let busy = false;

        const render = () => {
          const v = view();
          gold.textContent = `${v.gold} G`;
          const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.buy;
          grid.replaceChildren();
          for (const e of v.entries) {
            const locked = e.state === "locked";
            const btn = h(
              "button",
              { class: `btn btn-small shop-buy ${e.state === "available" ? "btn-primary" : ""}`, type: "button", "data-buy": e.id },
              e.state === "available" ? `${e.price} G에 사기` : STATE_LABEL[e.state],
            );
            btn.disabled = e.state !== "available" || busy;
            btn.addEventListener("click", () => void doBuy(e));
            const color = e.tint;
            const icon = itemIcon(e.kind, e.id, locked ? "is-silhouette" : "");
            if (color && !locked) icon.style.setProperty("--tint", color);
            grid.append(
              h(
                "li",
                { class: `shop-item is-${e.state}`, "data-item": e.id, "data-state": e.state },
                icon,
                h(
                  "div",
                  { class: "shop-info" },
                  h("div", { class: "shop-name" }, e.name, e.pending ? h("span", { class: "pending-tag" }, "(준비 중)") : null),
                  h("div", { class: "shop-kind" }, KIND_LABEL[e.kind], e.have !== undefined ? ` · 보유 ${e.have}` : ""),
                  h("div", { class: "shop-desc" }, locked ? `Lv ${e.minLevel}에 열려. ${e.description}` : e.description),
                ),
                h("div", { class: "shop-side" }, h("span", { class: "shop-price" }, `${e.price} G`), btn),
              ),
            );
            if (focusedId === e.id && !btn.disabled) btn.focus();
          }
        };

        const doBuy = async (e: ShopEntry) => {
          if (busy) return;
          busy = true;
          status.classList.remove("is-error");
          try {
            status.textContent = await buy(e.id);
          } catch (err) {
            status.textContent = (err as Error).message;
            status.classList.add("is-error");
          } finally {
            busy = false;
            render();
          }
        };

        shell.body.append(
          h("p", { class: "sys-nuri" }, h("span", { class: "nuri-name" }, names.companion), "가격이 다 적혀 있어서 좋다! 뽑기 같은 건 없어. 필요한 것만 사자."),
          grid,
          status,
        );
        render();
        const firstBuy = grid.querySelector<HTMLButtonElement>(".shop-buy:not(:disabled)");
        env.stack.focusInitial(shell.modal, firstBuy ?? shell.closeBtn);
      });
    },
  };
}
