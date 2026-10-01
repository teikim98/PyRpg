// CodeMirror 6 에디터(design.md §9.7, research.md §3.4).
// 4칸 들여쓰기, Tab 들여쓰기(Esc → Tab으로 빠져나감), 줄 번호, 되돌리기, 오류 줄 강조.
// 래퍼에서 keydown/keyup 전파를 막아 게임 키 처리와 충돌하지 않게 한다.
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { bracketMatching, defaultHighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { h } from "./dom";

const setErrorLine = StateEffect.define<number | null>();

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        if (e.value === null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([Decoration.line({ class: "cm-error-line" }).range(line.from)]);
      }
    }
    // 코드를 고치면 강조를 지운다
    return tr.docChanged ? Decoration.none : deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface CodeEditor {
  wrapper: HTMLElement;
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  /** 1부터. null이면 강조 해제 */
  highlightLine(line: number | null): void;
  focus(): void;
  destroy(): void;
}

export interface EditorOptions {
  onChange?: (code: string) => void;
  readOnly?: boolean;
  /** 접근성 이름 */
  label?: string;
  className?: string;
}

export function createCodeEditor(doc: string, opts: EditorOptions = {}): CodeEditor {
  const wrapper = h("div", { class: `code-editor ${opts.className ?? ""}` });
  // 게임 쪽 키 처리로 새지 않게 전파를 막는다(research.md §3.3.3 ②)
  const stop = (e: Event) => e.stopPropagation();
  wrapper.addEventListener("keydown", stop);
  wrapper.addEventListener("keyup", stop);
  wrapper.addEventListener("keypress", stop);

  const view = new EditorView({
    parent: wrapper,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        python(),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        errorLineField,
        EditorView.contentAttributes.of({ "aria-label": opts.label ?? "코드 에디터", spellcheck: "false", autocapitalize: "off" }),
        EditorState.readOnly.of(!!opts.readOnly),
        EditorView.editable.of(!opts.readOnly),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange?.(u.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    wrapper,
    view,
    getCode: () => view.state.doc.toString(),
    setCode(code) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
    },
    highlightLine(line) {
      view.dispatch({ effects: setErrorLine.of(line) });
      if (line !== null && line >= 1 && line <= view.state.doc.lines) {
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.line(line).from, { y: "center" }) });
      }
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
