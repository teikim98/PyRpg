// DOM UI 진입점(design.md §9.7). 게임 캔버스를 담은 컨테이너(root) 위에 절대 위치로 겹친다.
import "./styles.css";
import type { UiServices } from "../contracts/ui";
import { createBattleUI } from "./battle";
import { createCodexUI } from "./codex";
import { createDialogueUI } from "./dialogue";
import { registerFonts } from "./fonts";
import { ModalStack, h } from "./dom";
import type { UiEnv, UiOptions } from "./env";
import { createHudUI } from "./hud";
import { createLessonUI } from "./lesson";
import { createMenuUI } from "./menu";
import { createRewardUI } from "./reward";
import { createBoardUI } from "./board";
import { createEquipmentUI } from "./equipment";
import { createShopUI } from "./shop";
import { createTitlesUI } from "./titles";

export type { UiOptions } from "./env";

export interface UiServicesExt extends UiServices {
  /** 모달(대화·레슨·전투·메뉴 등)이 하나라도 열려 있는가. 열려 있으면 앱이 월드 입력을 끈다 */
  isModalOpen(): boolean;
}

export function createUi(root: HTMLElement, options: UiOptions = {}): UiServicesExt {
  registerFonts();
  const layer = h("div", { class: "pyrpg-ui" });
  const hudLayer = h("div", { class: "ui-hud-layer" });
  const modalLayer = h("div", { class: "ui-modal-layer" });
  const toastLayer = h("div", { class: "ui-toast-layer", "aria-live": "polite" });
  layer.append(hudLayer, modalLayer, toastLayer);
  root.classList.add("pyrpg-ui-root");
  root.append(layer);
  const stack = new ModalStack(modalLayer);
  const env: UiEnv = {
    root: layer,
    modalLayer,
    hudLayer,
    toastLayer,
    stack,
    companionPortrait: options.companionPortrait ?? "portrait_nuri",
    typeSpeedMs: options.typeSpeedMs ?? 28,
  };
  // 모달이 열려 있는지 CSS에서도 알 수 있게
  new MutationObserver(() => layer.classList.toggle("has-modal", stack.size > 0)).observe(modalLayer, { childList: true });
  return {
    dialogue: createDialogueUI(env),
    lesson: createLessonUI(env),
    codex: createCodexUI(env),
    battle: createBattleUI(env),
    hud: createHudUI(env),
    menu: createMenuUI(env),
    reward: createRewardUI(env),
    board: createBoardUI(env),
    shop: createShopUI(env),
    equipment: createEquipmentUI(env),
    titles: createTitlesUI(env),
    isModalOpen: () => stack.size > 0,
  };
}
