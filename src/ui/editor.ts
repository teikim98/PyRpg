// CodeMirror 6 에디터(design.md §9.7, research.md §3.4).
// 4칸 들여쓰기, Tab 들여쓰기(Esc → Tab으로 빠져나감), 줄 번호, 되돌리기, 오류 줄 강조, 메아리 고리의 줄별 실행 횟수 거터.
// 래퍼에서 keydown/keyup 전파를 막아 게임 키 처리와 충돌하지 않게 한다.
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { bracketMatching, defaultHighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension, RangeSet, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  GutterMarker,
  drawSelection,
  gutter,
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

/** 거터에 붙일 줄 표시(메아리 고리: 줄 번호 옆 실행 횟수) */
export interface GutterLabel {
  /** 1부터 */
  line: number;
  text: string;
  /** 마우스를 올렸을 때 보일 설명 */
  title?: string;
}

const setGutterLabels = StateEffect.define<GutterLabel[] | null>();

class LabelMarker extends GutterMarker {
  constructor(
    readonly text: string,
    readonly title: string,
  ) {
    super();
  }
  eq(other: GutterMarker): boolean {
    return other instanceof LabelMarker && other.text === this.text && other.title === this.title;
  }
  toDOM(): Node {
    const el = document.createElement("span");
    el.className = "cm-echo-count";
    el.textContent = this.text;
    if (this.title) el.title = this.title;
    return el;
  }
}

const gutterLabelField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    for (const e of tr.effects) {
      if (e.is(setGutterLabels)) {
        if (!e.value) return RangeSet.empty;
        const doc = tr.state.doc;
        const marks = e.value
          .filter((l) => Number.isInteger(l.line) && l.line >= 1 && l.line <= doc.lines)
          .sort((a, b) => a.line - b.line)
          .map((l) => new LabelMarker(l.text, l.title ?? "").range(doc.line(l.line).from));
        return RangeSet.of(marks);
      }
    }
    // 코드를 고치면 지운다(고친 코드의 횟수가 아니므로)
    return tr.docChanged ? RangeSet.empty : set;
  },
});

/** 줄 번호 오른쪽의 표시 거터. 표시가 없으면 폭이 0 */
function labelGutter(): Extension {
  return [gutterLabelField, gutter({ class: "cm-echo-gutter", markers: (v) => v.state.field(gutterLabelField) })];
}

export interface CodeEditor {
  wrapper: HTMLElement;
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  /** 1부터. null이면 강조 해제 */
  highlightLine(line: number | null): void;
  /** 줄 번호 옆 표시(메아리 고리). null이면 지운다. 코드를 고치면 저절로 지워진다. labelGutter 옵션이 없으면 아무것도 하지 않는다 */
  setGutterLabels(labels: GutterLabel[] | null): void;
  focus(): void;
  destroy(): void;
}

export interface EditorOptions {
  onChange?: (code: string) => void;
  readOnly?: boolean;
  /** 접근성 이름 */
  label?: string;
  className?: string;
  /** 줄 번호 옆 표시 거터를 둔다(전투 에디터의 메아리 고리) */
  labelGutter?: boolean;
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
        opts.labelGutter ? labelGutter() : [],
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
    setGutterLabels(labels) {
      if (!opts.labelGutter) return;
      view.dispatch({ effects: setGutterLabels.of(labels) });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
