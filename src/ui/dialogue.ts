// 대화창(design.md §3, §11.3). 아래쪽 상자, 보조 캐릭터만 초상화(64×64 → 3배).
import type { DialogueLine } from "../contracts/content";
import type { DialogueUI, NameContext } from "../contracts/ui";
import { createPortrait } from "./assets";
import { h, isComposing } from "./dom";
import type { UiEnv } from "./env";
import { renderInline, substituteNames } from "./markdown";

const ADVANCE_KEYS = new Set([" ", "Enter", "z", "Z"]);

/** HTML을 넣은 뒤 텍스트 노드를 한 글자씩 드러내는 타자기 효과 */
export class Typewriter {
  private nodes: { node: Text; full: string[] }[] = [];
  private timer: number | null = null;
  private done = true;

  constructor(private el: HTMLElement, private speedMs: number) {}

  start(html: string, onDone: () => void): void {
    this.stop();
    this.el.innerHTML = html;
    this.nodes = [];
    const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      this.nodes.push({ node: t, full: Array.from(t.data) });
      t.data = "";
    }
    this.done = false;
    let ni = 0;
    let ci = 0;
    const step = () => {
      while (ni < this.nodes.length && ci >= this.nodes[ni].full.length) {
        ni++;
        ci = 0;
      }
      if (ni >= this.nodes.length) {
        this.finish();
        onDone();
        return;
      }
      const cur = this.nodes[ni];
      ci++;
      cur.node.data = cur.full.slice(0, ci).join("");
    };
    if (this.speedMs <= 0) {
      this.finish();
      onDone();
      return;
    }
    this.timer = window.setInterval(step, this.speedMs);
    this.onDone = onDone;
  }

  private onDone: () => void = () => {};

  get typing(): boolean {
    return !this.done;
  }

  /** 남은 글자를 한 번에 보여 준다 */
  complete(): void {
    if (this.done) return;
    this.finish();
    this.onDone();
  }

  private finish(): void {
    this.stop();
    for (const n of this.nodes) n.node.data = n.full.join("");
    this.done = true;
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

export function speakerName(speaker: string, names: NameContext): string | null {
  if (speaker === "companion") return names.companion;
  if (speaker === "player") return names.player;
  if (speaker === "system") return null;
  return speaker;
}

export function createDialogueUI(env: UiEnv): DialogueUI {
  return {
    play(lines: DialogueLine[], names: NameContext): Promise<void> {
      if (lines.length === 0) return Promise.resolve();
      return new Promise((resolve) => {
        const modal = env.stack.open({ className: "dlg-modal", label: "대화", transparent: true });
        const portrait = createPortrait(env.companionPortrait, 3, names.companion.slice(0, 1) || "?");
        const nameEl = h("div", { class: "dlg-name" });
        const textEl = h("div", { class: "dlg-text", "aria-live": "polite" });
        const next = h("div", { class: "dlg-next", "aria-hidden": "true" }, "▼");
        const box = h(
          "div",
          { class: "dlg-box panel", tabindex: "0" },
          h("div", { class: "dlg-portrait-wrap" }, portrait.el),
          h("div", { class: "dlg-body" }, nameEl, textEl, next),
        );
        modal.el.append(box);
        const tw = new Typewriter(textEl, env.typeSpeedMs);
        let index = -1;

        const show = (i: number) => {
          const line = lines[i];
          const name = speakerName(line.speaker, names);
          box.dataset.speaker = line.speaker === "companion" || line.speaker === "player" || line.speaker === "system" ? line.speaker : "npc";
          box.dataset.line = String(i);
          nameEl.textContent = name ?? "";
          nameEl.hidden = !name;
          const isCompanion = line.speaker === "companion";
          box.classList.toggle("has-portrait", isCompanion);
          if (isCompanion) portrait.set(line.emotion ?? "neutral");
          next.classList.remove("is-ready");
          tw.start(renderInline(substituteNames(line.text, names)), () => next.classList.add("is-ready"));
        };

        const advance = () => {
          if (tw.typing) {
            tw.complete();
            return;
          }
          index++;
          if (index >= lines.length) {
            cleanup();
            resolve();
            return;
          }
          show(index);
        };

        const onKey = (e: KeyboardEvent) => {
          if (!modal.isTop() || isComposing(e) || e.repeat) return;
          if (!ADVANCE_KEYS.has(e.key)) return;
          e.preventDefault();
          e.stopPropagation();
          advance();
        };
        const onClick = (e: MouseEvent) => {
          if (!modal.isTop()) return;
          e.preventDefault();
          advance();
        };
        const cleanup = () => {
          tw.stop();
          window.removeEventListener("keydown", onKey, true);
          modal.close();
        };
        window.addEventListener("keydown", onKey, true);
        modal.el.addEventListener("click", onClick);
        advance();
        env.stack.focusInitial(modal, box);
      });
    },
  };
}
