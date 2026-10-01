// 장비 화면(design.md §7.3): 장신구 슬롯(레벨 1/10/20에 1/2/3칸), 장착·해제, 꾸미기, 소모품 목록.
import type { EquipmentActions, EquipmentItemView, EquipmentUI, EquipmentView } from "../contracts/ui";
import { shellModal } from "./board";
import { h } from "./dom";
import type { UiEnv } from "./env";
import { itemIcon } from "./shop";

export function createEquipmentUI(env: UiEnv): EquipmentUI {
  return {
    open(view: () => EquipmentView, actions: EquipmentActions) {
      return new Promise<void>((resolve) => {
        const close = () => {
          shell.modal.close();
          resolve();
        };
        const shell = shellModal(env, { className: "equip-modal", label: "장비", title: "장비", onClose: close });
        const content = h("div", { class: "equip-content" });
        const status = h("p", { class: "shop-status", "aria-live": "polite" });
        let busy = false;

        const run = async (fn: () => Promise<string>) => {
          if (busy) return;
          busy = true;
          status.classList.remove("is-error");
          try {
            status.textContent = await fn();
          } catch (err) {
            status.textContent = (err as Error).message;
            status.classList.add("is-error");
          } finally {
            busy = false;
            render();
          }
        };

        const row = (it: EquipmentItemView, kind: "accessory" | "cosmetic", onToggle: () => void) => {
          const label = !it.owned ? "없음" : it.equipped ? (kind === "accessory" ? "빼기" : "되돌리기") : kind === "accessory" ? "장착" : "적용";
          const btn = h("button", { class: `btn btn-small equip-toggle ${it.owned && !it.equipped ? "btn-primary" : ""}`, type: "button", "data-item": it.id }, label);
          btn.disabled = !it.owned || busy;
          btn.addEventListener("click", onToggle);
          const icon = itemIcon(kind, it.id, it.owned ? "" : "is-silhouette");
          if (it.tint && it.owned) icon.style.setProperty("--tint", it.tint);
          return h(
            "li",
            { class: `equip-item ${it.equipped ? "is-equipped" : ""} ${it.owned ? "" : "is-missing"}`, "data-item": it.id },
            icon,
            h(
              "div",
              { class: "shop-info" },
              h("div", { class: "shop-name" }, it.name, it.pending ? h("span", { class: "pending-tag" }, "(준비 중)") : null, it.equipped ? h("span", { class: "equip-tag" }, "장착 중") : null),
              h("div", { class: "shop-desc" }, it.owned ? it.description : `${it.description} · 얻는 곳: ${it.source ?? "상점"}`),
            ),
            btn,
          );
        };

        const render = () => {
          const v = view();
          const focused = (document.activeElement as HTMLElement | null)?.dataset?.item;
          const equipped = v.accessories.filter((a) => a.equipped);
          const slots = h("div", { class: "equip-slots", "aria-label": "장신구 슬롯" });
          for (let i = 0; i < 3; i++) {
            const open = i < v.slots;
            const it = equipped[i];
            slots.append(
              h(
                "div",
                { class: `equip-slot ${open ? "" : "is-locked"} ${it ? "is-filled" : ""}`, "data-slot": String(i) },
                it ? itemIcon("accessory", it.id) : null,
                h("span", { class: "equip-slot-label" }, it ? it.name : open ? "빈 칸" : `Lv ${i === 1 ? 10 : 20}`),
              ),
            );
          }
          const accList = h("ul", { class: "equip-list" });
          for (const it of v.accessories) accList.append(row(it, "accessory", () => void run(() => actions.toggleAccessory(it.id))));
          const cosList = h("ul", { class: "equip-list" });
          for (const it of v.cosmetics) cosList.append(row(it, "cosmetic", () => void run(() => actions.toggleCosmetic(it.id))));
          const consList = h("ul", { class: "equip-consumables" });
          for (const c of v.consumables) consList.append(h("li", { "data-item": c.id }, `${c.name} × ${c.count}`, h("span", { class: "shop-desc" }, ` — ${c.description}`)));
          content.replaceChildren(
            h(
              "section",
              { class: "sys-section" },
              h("h3", {}, `장신구 슬롯 ${equipped.length}/${v.slots}`),
              slots,
              h("p", { class: "equip-note" }, `최대 HP ${v.maxHp}${v.nextSlotLevel ? ` · 다음 슬롯은 Lv ${v.nextSlotLevel}에 열려` : ""}`),
              accList,
            ),
            h("section", { class: "sys-section" }, h("h3", {}, "꾸미기"), v.cosmetics.length ? cosList : h("p", { class: "shop-desc" }, "아직 꾸미기 아이템이 없어. 상점에서 염료를 팔아.")),
            h("section", { class: "sys-section" }, h("h3", {}, "소모품"), v.consumables.length ? consList : h("p", { class: "shop-desc" }, "가진 소모품이 없어.")),
          );
          if (focused) content.querySelector<HTMLButtonElement>(`.equip-toggle[data-item="${focused}"]:not(:disabled)`)?.focus();
        };

        shell.body.append(content, status);
        render();
        env.stack.focusInitial(shell.modal, content.querySelector<HTMLButtonElement>(".equip-toggle:not(:disabled)") ?? shell.closeBtn);
      });
    },
  };
}
