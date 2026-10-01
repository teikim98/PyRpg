// DOM 도우미와 모달 스택(포커스 가두기, 닫을 때 포커스 복귀).

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "class") el.className = String(v);
    else if (k === "html") el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

/** IME 조합 중 입력인가(한글 조합 중 Enter/Space 오작동 방지, design.md §9.7) */
export function isComposing(e: KeyboardEvent): boolean {
  return e.isComposing || e.keyCode === 229;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[hidden]") && !el.closest(".is-hidden") && el.getClientRects().length > 0,
  );
}

export interface Modal {
  el: HTMLElement;
  close(): void;
  isTop(): boolean;
  closed: boolean;
}

export interface ModalOptions {
  className: string;
  label: string;
  /** Esc를 눌렀을 때(에디터 안의 Esc는 에디터 래퍼에서 막힌다) */
  onEscape?: () => void;
  /** 어두운 배경을 깔지 않음(대화창) */
  transparent?: boolean;
}

export class ModalStack {
  private stack: Modal[] = [];
  private keyHandlers = new WeakMap<Modal, (e: KeyboardEvent) => void>();
  constructor(private layer: HTMLElement) {
    // 포커스가 body로 빠져도(비활성화된 버튼 등) Esc·Tab이 맨 위 모달에 닿도록 document에서 받는다
    document.addEventListener("keydown", (e) => {
      const top = this.top();
      if (top) this.keyHandlers.get(top)?.(e);
    });
    document.addEventListener("focusin", (e) => {
      const top = this.top();
      if (!top) return;
      const t = e.target as Node | null;
      // 위쪽 모달 바깥으로 포커스가 나가면 되돌린다
      if (t && !top.el.contains(t)) {
        const f = focusables(top.el);
        (f[0] ?? top.el).focus();
      }
    });
  }

  top(): Modal | undefined {
    return this.stack[this.stack.length - 1];
  }

  get size(): number {
    return this.stack.length;
  }

  open(opts: ModalOptions): Modal {
    const prevFocus = document.activeElement as HTMLElement | null;
    const el = h("div", {
      class: `ui-modal ${opts.transparent ? "ui-modal-transparent" : ""} ${opts.className}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": opts.label,
      tabindex: "-1",
    });
    const modal: Modal = {
      el,
      closed: false,
      isTop: () => this.top() === modal,
      close: () => {
        if (modal.closed) return;
        modal.closed = true;
        el.remove();
        this.stack = this.stack.filter((m) => m !== modal);
        const top = this.top();
        if (top) {
          if (prevFocus && top.el.contains(prevFocus)) prevFocus.focus();
          else (focusables(top.el)[0] ?? top.el).focus();
        } else if (prevFocus && document.contains(prevFocus)) {
          prevFocus.focus();
        } else {
          (document.activeElement as HTMLElement | null)?.blur?.();
        }
      },
    };
    const onKey = (e: KeyboardEvent) => {
      if (!modal.isTop() || isComposing(e)) return;
      if (e.key === "Tab" && !e.defaultPrevented) {
        const f = focusables(el);
        if (f.length === 0) {
          e.preventDefault();
          return;
        }
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !el.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !el.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === "Escape" && opts.onEscape && !e.defaultPrevented) {
        e.preventDefault();
        opts.onEscape();
      }
    };
    this.keyHandlers.set(modal, onKey);
    this.stack.push(modal);
    this.layer.append(el);
    return modal;
  }

  /** 모달 안의 첫 번째 포커스 가능 요소(또는 지정한 요소)에 포커스 */
  focusInitial(modal: Modal, preferred?: HTMLElement | null): void {
    requestAnimationFrame(() => {
      if (modal.closed) return;
      (preferred ?? focusables(modal.el)[0] ?? modal.el).focus();
    });
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
